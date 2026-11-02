import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import {
  CreatePaymentOrderInput,
  CheckoutOrderInput,
  VerifyPaymentInput,
  ProcessRefundInput,
  CheckoutResponseDto,
  PaymentSummaryDto,
  PaymentSummaryItemDto,
} from '@localman/contracts';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
  BadRequestError,
} from '../../common/errors/app-error.js';
import { BookingStatus } from '@localman/constants';
import { PaymentGatewayAdapter } from './adapters/payment-gateway.interface.js';
import { MockPaymentAdapter } from './adapters/mock.adapter.js';
import { RazorpayAdapter } from './adapters/razorpay.adapter.js';
import { AuthenticatedUser } from '../../common/middleware/auth.middleware.js';
import { financialService } from '../financial/financial.service.js';
import { realtimeService } from '../realtime/realtime.service.js';
import { notificationService } from '../notifications/notification.service.js';

export class PaymentService {
  private adapter: PaymentGatewayAdapter;

  constructor(adapter?: PaymentGatewayAdapter) {
    this.adapter =
      adapter ||
      (env.PAYMENT_GATEWAY_PROVIDER === 'razorpay'
        ? new RazorpayAdapter()
        : new MockPaymentAdapter());
  }

  public setAdapter(adapter: PaymentGatewayAdapter): void {
    this.adapter = adapter;
  }

  public getAdapter(): PaymentGatewayAdapter {
    return this.adapter;
  }

  /**
   * Initializes a customer checkout session with server-calculated amounts
   */
  async createCheckoutSession(
    customer: AuthenticatedUser,
    input: CheckoutOrderInput
  ): Promise<CheckoutResponseDto> {
    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      include: {
        customer: true,
        provider: { include: { user: true } },
        service: true,
        materials: true,
        payment: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // 1. Authorization check: Customer must own booking
    if (booking.customerId !== customer.id) {
      throw new ForbiddenError('Unauthorized to create payment checkout for this booking.');
    }

    // 2. Conflict check: Cannot pay for already settled booking
    if (
      booking.currentStatus === BookingStatus.PAYMENT_SETTLED ||
      (booking.payment && booking.payment.status === 'CAPTURED')
    ) {
      throw new BadRequestError('Booking has already been paid and settled.');
    }

    // 3. Lifecycle state gate: Booking must be in JOB_COMPLETED or PAYMENT_PENDING
    const eligibleStates: string[] = [BookingStatus.JOB_COMPLETED, BookingStatus.PAYMENT_PENDING];
    if (!eligibleStates.includes(booking.currentStatus)) {
      throw new BadRequestError(
        `Booking in status '${booking.currentStatus}' is not eligible for payment checkout. Job execution must be completed first.`
      );
    }

    // 4. Server-authoritative amount calculation:
    // Base amount + approved materials total + taxes
    let approvedMaterialsTotal = 0;
    if (booking.materials && Array.isArray(booking.materials)) {
      approvedMaterialsTotal = booking.materials
        .filter((m: any) => m.isCustomerApproved || m.status === 'APPROVED')
        .reduce((sum: number, m: any) => sum + (m.totalAmountPaisa || m.totalPricePaisa || 0), 0);
    }

    const calculatedPayablePaisa =
      booking.baseAmountPaisa +
      approvedMaterialsTotal +
      (booking.taxAmountPaisa || 0) +
      (booking.extraDurationAmountPaisa || 0);

    const amountPaisa = Math.max(calculatedPayablePaisa, booking.totalAmountPaisa);

    // Synchronize booking.totalAmountPaisa if it drifted
    if (booking.totalAmountPaisa !== amountPaisa) {
      await prisma.booking.update({
        where: { id: booking.id },
        data: { totalAmountPaisa: amountPaisa },
      });
      booking.totalAmountPaisa = amountPaisa;
    }

    // 5. Idempotency handling
    const key = input.idempotencyKey || `pay_checkout_${booking.id}`;

    // Global idempotency check: check if key was already used for another booking
    if (input.idempotencyKey) {
      const existingWithKey = await prisma.payment.findFirst({
        where: { idempotencyKey: input.idempotencyKey },
      });
      if (existingWithKey && existingWithKey.bookingId !== booking.id) {
        throw new ConflictError(
          'Idempotency key collision: this key was already used for a different booking.'
        );
      }
    }

    // If a payment already exists for this booking
    if (booking.payment) {
      // If payment is already captured, reject
      if (booking.payment.status === 'CAPTURED') {
        throw new BadRequestError('Booking has already been paid and settled.');
      }

      // If idempotency keys match:
      if (booking.payment.idempotencyKey === key) {
        // If parameters conflict (different gateway):
        if (input.gateway && booking.payment.gateway !== input.gateway) {
          throw new ConflictError(
            'Idempotency key collision: checkout session already created with different parameters.'
          );
        }
        return {
          paymentId: booking.payment.id,
          bookingId: booking.id,
          gateway: booking.payment.gateway,
          gatewayOrderId: booking.payment.gatewayOrderId || '',
          amountPaisa: booking.payment.amountPaisa,
          currency: booking.payment.currency,
          keyId: env.RAZORPAY_KEY_ID,
          idempotencyKey: booking.payment.idempotencyKey,
          paymentStatus: 'CREATED',
        };
      }

      // If existing payment is INITIATED and has a valid gateway order ID and same gateway, reuse it
      if (
        booking.payment.status === 'INITIATED' &&
        (!input.gateway || booking.payment.gateway === input.gateway)
      ) {
        return {
          paymentId: booking.payment.id,
          bookingId: booking.id,
          gateway: booking.payment.gateway,
          gatewayOrderId: booking.payment.gatewayOrderId || '',
          amountPaisa: booking.payment.amountPaisa,
          currency: booking.payment.currency,
          keyId: env.RAZORPAY_KEY_ID,
          idempotencyKey: booking.payment.idempotencyKey,
          paymentStatus: 'CREATED',
        };
      }
    }

    // 6. Call Gateway Adapter to create order
    const orderResult = await this.adapter.createOrder({
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      amountPaisa,
      currency: 'INR',
      customerPhone: booking.customer.phoneNumber,
      customerName: booking.customer.fullName,
    });

    // 7. Persist payment record & transaction
    const payment = await prisma.$transaction(async (tx) => {
      let p;
      if (booking.payment) {
        p = await tx.payment.update({
          where: { id: booking.payment.id },
          data: {
            gateway: input.gateway as any,
            gatewayOrderId: orderResult.gatewayOrderId,
            amountPaisa,
            status: 'INITIATED',
            idempotencyKey: key,
          },
        });
      } else {
        p = await tx.payment.create({
          data: {
            bookingId: booking.id,
            gateway: input.gateway as any,
            gatewayOrderId: orderResult.gatewayOrderId,
            amountPaisa,
            currency: 'INR',
            status: 'INITIATED',
            idempotencyKey: key,
          },
        });
      }

      await tx.paymentTransaction.create({
        data: {
          paymentId: p.id,
          transactionType: 'ORDER_CREATION',
          gatewayPayload: { gatewayOrderId: orderResult.gatewayOrderId },
          status: 'INITIATED',
        },
      });

      // Update booking to PAYMENT_PENDING if currently JOB_COMPLETED
      if (booking.currentStatus === BookingStatus.JOB_COMPLETED) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { currentStatus: BookingStatus.PAYMENT_PENDING },
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            fromState: BookingStatus.JOB_COMPLETED,
            toState: BookingStatus.PAYMENT_PENDING,
            actorId: customer.id,
            actorRole: 'CUSTOMER',
            reason: 'Customer initiated checkout session',
          },
        });
      }

      return p;
    });

    return {
      paymentId: payment.id,
      bookingId: booking.id,
      paymentStatus: 'CREATED',
      gateway: payment.gateway,
      gatewayOrderId: payment.gatewayOrderId || '',
      amountPaisa: payment.amountPaisa,
      currency: payment.currency,
      keyId: env.RAZORPAY_KEY_ID,
      idempotencyKey: payment.idempotencyKey,
    };
  }

  /**
   * Authoritatively verifies customer-submitted payment proof and triggers financial settlement
   */
  async verifyPayment(customer: AuthenticatedUser, input: VerifyPaymentInput) {
    let payment: any = null;

    if (input.paymentId) {
      payment = await prisma.payment.findUnique({
        where: { id: input.paymentId },
        include: {
          booking: {
            include: {
              customer: true,
              provider: { include: { user: true } },
              service: true,
            },
          },
        },
      });
    }

    if (!payment && input.bookingId) {
      payment = await prisma.payment.findUnique({
        where: { bookingId: input.bookingId },
        include: {
          booking: {
            include: {
              customer: true,
              provider: { include: { user: true } },
              service: true,
            },
          },
        },
      });
    }

    if (!payment && input.gatewayOrderId) {
      payment = await prisma.payment.findFirst({
        where: { gatewayOrderId: input.gatewayOrderId },
        include: {
          booking: {
            include: {
              customer: true,
              provider: { include: { user: true } },
              service: true,
            },
          },
        },
      });
    }

    if (!payment) {
      if (input.bookingId) {
        const booking = await prisma.booking.findUnique({ where: { id: input.bookingId } });
        if (!booking) {
          throw new NotFoundError('Booking not found');
        }
        if (booking.customerId !== customer.id) {
          throw new ForbiddenError('Unauthorized: only the booking customer can verify this payment.');
        }
      }
      throw new NotFoundError('Payment record not found');
    }

    // 1. Authorization: Only booking customer can verify payment
    if (payment.booking?.customerId !== customer.id) {
      throw new ForbiddenError('Unauthorized: only the booking customer can verify this payment.');
    }

    // 2. Idempotency: If already CAPTURED, return idempotent success
    if (payment.status === 'CAPTURED') {
      return {
        success: true,
        message: 'Payment already settled',
        paymentId: payment.id,
        bookingId: payment.bookingId,
        status: 'CAPTURED',
        paymentStatus: 'SUCCESS',
        bookingStatus: BookingStatus.PAYMENT_SETTLED,
        gatewayPaymentId: payment.gatewayPaymentId,
      };
    }

    // 3. Cryptographic signature check via gateway adapter
    const isValid = this.adapter.verifyPaymentSignature({
      gatewayOrderId: input.gatewayOrderId,
      gatewayPaymentId: input.gatewayPaymentId,
      gatewaySignature: input.gatewaySignature,
    });

    if (!isValid) {
      await prisma.paymentTransaction.create({
        data: {
          paymentId: payment.id,
          transactionType: 'VERIFY_SIGNATURE',
          status: 'FAILED',
          errorMessage: 'Invalid payment signature',
        },
      });
      throw new BadRequestError('Invalid payment gateway signature');
    }

    // 4. Financial settlement via FinancialService (the single authority)
    const settlementResult = await financialService.settleBookingPayment(
      payment.id,
      input.gatewayPaymentId,
      { gatewayOrderId: input.gatewayOrderId, gatewaySignature: input.gatewaySignature }
    );

    // 5. Realtime SSE events
    realtimeService.publishToBooking(payment.bookingId, {
      type: 'PAYMENT_CONFIRMED',
      payload: {
        bookingId: payment.bookingId,
        paymentId: payment.id,
        gatewayPaymentId: input.gatewayPaymentId,
        amountPaisa: payment.amountPaisa,
        status: 'PAYMENT_SETTLED',
        timestamp: new Date().toISOString(),
      },
    });

    realtimeService.publishToBooking(payment.bookingId, {
      type: 'JOB_STATUS_CHANGED',
      payload: {
        bookingId: payment.bookingId,
        fromState: payment.booking.currentStatus,
        toState: 'PAYMENT_SETTLED',
        timestamp: new Date().toISOString(),
      },
    });

    // 6. Multi-channel notifications
    try {
      await notificationService.notifyPaymentConfirmed(
        payment.booking.customerId,
        payment.booking.bookingNumber,
        payment.amountPaisa
      );

      if (payment.booking.provider) {
        const netEarnings = Math.round(payment.amountPaisa * 0.84); // 15% comm + 1% TDS = 84%
        await notificationService.notifyProviderPaymentSettled(
          payment.booking.provider.userId,
          payment.booking.provider.id,
          payment.booking.bookingNumber,
          netEarnings
        );
      }
    } catch {
      // Non-blocking notification
    }

    return {
      success: true,
      paymentId: payment.id,
      bookingId: payment.bookingId,
      status: 'CAPTURED',
      paymentStatus: 'SUCCESS',
      bookingStatus: BookingStatus.PAYMENT_SETTLED,
      gatewayPaymentId: input.gatewayPaymentId,
      settlement: settlementResult,
    };
  }

  /**
   * Processes gateway webhook event
   */
  async handleWebhook(signature: string | undefined, payload: any, rawBody?: string) {
    const raw = rawBody || (typeof payload === 'string' ? payload : JSON.stringify(payload));
    const isValid = this.adapter.verifyWebhookSignature(raw, signature || '');
    if (!isValid) {
      throw new BadRequestError('Invalid webhook signature');
    }

    // Extract payment identifiers
    let paymentId = payload.paymentId;
    let gatewayPaymentId = payload.gatewayPaymentId || `pay_wh_${Date.now()}`;
    let gatewayOrderId = payload.gatewayOrderId;

    // Support Razorpay webhook envelope format
    if (payload.payload?.payment?.entity) {
      const entity = payload.payload.payment.entity;
      gatewayPaymentId = entity.id || gatewayPaymentId;
      gatewayOrderId = entity.order_id || gatewayOrderId;
    }

    // Look up Payment record
    let payment: any = null;
    if (paymentId) {
      payment = await prisma.payment.findUnique({ where: { id: paymentId }, include: { booking: true } });
    }
    if (!payment && gatewayOrderId) {
      payment = await prisma.payment.findFirst({ where: { gatewayOrderId }, include: { booking: true } });
    }

    if (!payment) {
      throw new NotFoundError('Associated payment record for webhook not found');
    }

    // Handle payment.failed event
    if (payload.event === 'payment.failed') {
      await prisma.payment.update({
        where: { id: payment.id },
        data: {
          status: 'FAILED',
        },
      });

      realtimeService.publishToBooking(payment.bookingId, {
        type: 'PAYMENT_FAILED',
        payload: {
          bookingId: payment.bookingId,
          paymentId: payment.id,
          reason: payload.payload?.payment?.entity?.error_description || 'Payment failed',
          timestamp: new Date().toISOString(),
        },
      });

      return { received: true, status: 'FAILED' };
    }

    // Handle refund webhook events
    if (payload.event === 'refund.processed' || payload.event === 'refund.created') {
      const refundEntity = payload.payload?.refund?.entity;
      const gatewayRefundId = refundEntity?.id || payload.gatewayRefundId;
      if (gatewayRefundId) {
        await prisma.refund.updateMany({
          where: {
            paymentId: payment.id,
            OR: [{ gatewayRefundId }, { status: 'PROCESSING' }],
          },
          data: {
            status: 'SUCCEEDED',
            gatewayRefundId,
          },
        });
      }

      realtimeService.publishToBooking(payment.bookingId, {
        type: 'REFUND_COMPLETED',
        payload: {
          bookingId: payment.bookingId,
          paymentId: payment.id,
          gatewayRefundId,
          timestamp: new Date().toISOString(),
        },
      });

      return { received: true, refundProcessed: true };
    }

    if (payload.event === 'refund.failed') {
      const gatewayRefundId = payload.payload?.refund?.entity?.id || payload.gatewayRefundId;
      if (gatewayRefundId) {
        await prisma.refund.updateMany({
          where: { gatewayRefundId },
          data: { status: 'FAILED' },
        });
      }

      realtimeService.publishToBooking(payment.bookingId, {
        type: 'REFUND_FAILED',
        payload: {
          bookingId: payment.bookingId,
          paymentId: payment.id,
          gatewayRefundId,
          reason: payload.payload?.refund?.entity?.error_description || 'Refund failed at gateway',
          timestamp: new Date().toISOString(),
        },
      });

      return { received: true, refundFailed: true };
    }

    // Replay / Duplicate Webhook check: If already CAPTURED, return harmlessly
    if (payment.status === 'CAPTURED') {
      return { received: true, alreadyProcessed: true };
    }

    // Perform settlement via FinancialService
    await financialService.settleBookingPayment(payment.id, gatewayPaymentId, payload);

    // Emit Realtime events
    realtimeService.publishToBooking(payment.bookingId, {
      type: 'PAYMENT_CONFIRMED',
      payload: {
        bookingId: payment.bookingId,
        paymentId: payment.id,
        gatewayPaymentId,
        amountPaisa: payment.amountPaisa,
        status: 'PAYMENT_SETTLED',
        timestamp: new Date().toISOString(),
      },
    });

    realtimeService.publishToBooking(payment.bookingId, {
      type: 'JOB_STATUS_CHANGED',
      payload: {
        bookingId: payment.bookingId,
        fromState: payment.booking.currentStatus,
        toState: 'PAYMENT_SETTLED',
        timestamp: new Date().toISOString(),
      },
    });

    return { received: true, settled: true };
  }

  /**
   * Returns sanitized, customer-safe payment receipt / summary
   */
  async getPaymentSummary(user: AuthenticatedUser, bookingId: string): Promise<PaymentSummaryDto> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        provider: { include: { user: true } },
        service: true,
        materials: true,
        payment: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const isCustomer = booking.customerId === user.id;
    const isAssignedProvider = booking.provider?.userId === user.id;
    const isAdmin = user.roles.includes('ADMIN');

    if (!isCustomer && !isAssignedProvider && !isAdmin) {
      throw new ForbiddenError('Unauthorized to access payment summary for this booking.');
    }

    const approvedMaterials = (booking.materials || [])
      .filter((m: any) => m.isCustomerApproved || m.status === 'APPROVED')
      .map((m: any) => ({
        itemName: m.materialName || m.itemName || 'Material Item',
        quantity: Number(m.quantity) || 1,
        unitPricePaisa: m.unitPricePaisa,
        totalPricePaisa: m.totalAmountPaisa || m.totalPricePaisa || (m.unitPricePaisa * (Number(m.quantity) || 1)),
      }));

    const materialsAmountPaisa = approvedMaterials.reduce(
      (sum: number, m: any) => sum + m.totalPricePaisa,
      0
    );

    const items: PaymentSummaryItemDto[] = [
      {
        itemName: booking.service?.name || 'Base Service',
        quantity: 1,
        unitPricePaisa: booking.baseAmountPaisa,
        totalPricePaisa: booking.baseAmountPaisa,
      },
      ...approvedMaterials,
    ];

    return {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      serviceName: booking.service?.name || 'Service',
      providerName:
        booking.provider?.businessName ||
        booking.provider?.user?.fullName ||
        'Assigned Service Partner',
      currentStatus: booking.currentStatus,
      baseAmountPaisa: booking.baseAmountPaisa,
      materialsAmountPaisa,
      materials: approvedMaterials,
      items,
      platformFeePaisa: booking.platformFeePaisa || 0,
      taxAmountPaisa: booking.taxAmountPaisa || 0,
      totalAmountPaisa: booking.totalAmountPaisa,
      paymentId: booking.payment?.id || undefined,
      gateway: booking.payment?.gateway || undefined,
      paymentGateway: booking.payment?.gateway || undefined,
      gatewayPaymentId: booking.payment?.gatewayPaymentId || undefined,
      paymentStatus: booking.payment?.status === 'CAPTURED' ? 'SUCCESS' : booking.payment?.status || undefined,
      paidAt: booking.payment?.updatedAt?.toISOString() || undefined,
    };
  }

  /**
   * Backwards-compatible aliases
   */
  async createPaymentOrder(customer: AuthenticatedUser, input: CreatePaymentOrderInput) {
    return this.createCheckoutSession(customer, input);
  }

  async handleSuccessfulPayment(paymentId: string, gatewayPaymentId: string, payload?: any) {
    return financialService.settleBookingPayment(paymentId, gatewayPaymentId, payload);
  }

  /**
   * Processes a refund via gateway and updates booking status
   */
  async processRefund(admin: AuthenticatedUser, input: ProcessRefundInput) {
    const payment = await prisma.payment.findUnique({
      where: { id: input.paymentId },
      include: { booking: true },
    });

    if (!payment) {
      throw new NotFoundError('Payment record not found');
    }

    if (payment.status !== 'CAPTURED') {
      throw new ValidationError('Only captured payments can be refunded.');
    }

    const refundResult = await this.adapter.processRefund({
      gatewayPaymentId: payment.gatewayPaymentId || '',
      amountPaisa: input.amountPaisa,
      reason: input.reason,
    });

    const refund = await prisma.$transaction(async (tx) => {
      const created = await tx.refund.create({
        data: {
          paymentId: payment.id,
          gatewayRefundId: refundResult.gatewayRefundId,
          amountPaisa: input.amountPaisa,
          reason: input.reason,
          initiatedBy: admin.id,
          status: 'SUCCESS',
        },
      });

      await tx.payment.update({
        where: { id: payment.id },
        data: { status: 'REFUNDED' },
      });

      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { currentStatus: 'REFUNDED' },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: payment.bookingId,
          fromState: payment.booking.currentStatus,
          toState: 'REFUNDED',
          actorId: admin.id,
          actorRole: 'ADMIN',
          reason: `Refund of ₹${(input.amountPaisa / 100).toFixed(2)} processed: ${input.reason}`,
        },
      });

      return created;
    });

    return refund;
  }
}

export const paymentService = new PaymentService();
