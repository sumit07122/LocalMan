import { prisma } from '../../config/database.js';
import { env } from '../../config/env.js';
import {
  CreatePaymentOrderInput,
  ProcessRefundInput,
} from '@localman/contracts';
import {
  NotFoundError,
  ValidationError,
  ConflictError,
  ForbiddenError,
} from '../../common/errors/app-error.js';
import { PaymentGatewayAdapter } from './adapters/payment-gateway.interface.js';
import { MockPaymentAdapter } from './adapters/mock.adapter.js';
import { RazorpayAdapter } from './adapters/razorpay.adapter.js';
import { AuthenticatedUser } from '../../common/middleware/auth.middleware.js';

export class PaymentService {
  private adapter: PaymentGatewayAdapter;

  constructor() {
    this.adapter =
      env.PAYMENT_GATEWAY_PROVIDER === 'razorpay'
        ? new RazorpayAdapter()
        : new MockPaymentAdapter();
  }

  /**
   * Initializes a payment order with the payment gateway
   */
  async createPaymentOrder(customer: AuthenticatedUser, input: CreatePaymentOrderInput) {
    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
      include: {
        customer: true,
        payment: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.customerId !== customer.id) {
      throw new ForbiddenError('Unauthorized to make payment for this booking.');
    }

    if (booking.payment && booking.payment.status === 'CAPTURED') {
      throw new ConflictError('Payment for this booking has already been settled.');
    }

    // Reuse existing initiated payment order if available
    if (booking.payment && booking.payment.status === 'INITIATED') {
      return {
        paymentId: booking.payment.id,
        gateway: booking.payment.gateway,
        gatewayOrderId: booking.payment.gatewayOrderId,
        amountPaisa: booking.payment.amountPaisa,
        currency: booking.payment.currency,
      };
    }

    const idempotencyKey = `pay_idem_${booking.id}_${Date.now()}`;
    const amountPaisa = booking.totalAmountPaisa;

    // Call payment gateway adapter
    const orderResult = await this.adapter.createOrder({
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      amountPaisa,
      currency: 'INR',
      customerPhone: booking.customer.phoneNumber,
      customerName: booking.customer.fullName,
    });

    const payment = await prisma.payment.create({
      data: {
        bookingId: booking.id,
        gateway: input.gateway as any,
        gatewayOrderId: orderResult.gatewayOrderId,
        amountPaisa,
        currency: 'INR',
        status: 'INITIATED',
        idempotencyKey,
      },
    });

    return {
      paymentId: payment.id,
      gateway: payment.gateway,
      gatewayOrderId: payment.gatewayOrderId,
      amountPaisa: payment.amountPaisa,
      currency: payment.currency,
    };
  }

  /**
   * Settles payment and generates provider payout ledger entry
   */
  async handleSuccessfulPayment(paymentId: string, gatewayPaymentId: string, payload?: any) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: { provider: true },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment record not found');
    }

    if (payment.status === 'CAPTURED') {
      return { message: 'Payment already settled', payment };
    }

    const updated = await prisma.$transaction(async (tx) => {
      // 1. Mark Payment Captured
      const capturedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'CAPTURED',
          gatewayPaymentId,
        },
      });

      // 2. Log transaction
      await tx.paymentTransaction.create({
        data: {
          paymentId,
          transactionType: 'CHARGE',
          gatewayPayload: payload || {},
          status: 'SUCCESS',
        },
      });

      // 3. Advance Booking Status to PAYMENT_SETTLED
      await tx.booking.update({
        where: { id: payment.bookingId },
        data: { currentStatus: 'PAYMENT_SETTLED' },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: payment.bookingId,
          fromState: payment.booking.currentStatus,
          toState: 'PAYMENT_SETTLED',
          actorId: payment.booking.customerId,
          actorRole: 'SYSTEM',
          reason: `Payment captured via ${payment.gateway} (Ref: ${gatewayPaymentId})`,
        },
      });

      // 4. Create Provider Payout Ledger Record
      if (payment.booking.providerId) {
        const grossAmountPaisa = payment.booking.totalAmountPaisa;
        const platformDeductionPaisa = payment.booking.platformFeePaisa;
        // 1% TDS under Section 194O / 194M of Indian Income Tax Act if applicable
        const tdsDeductionPaisa = Math.round((grossAmountPaisa * 1) / 100);
        const netPayoutPaisa = grossAmountPaisa - platformDeductionPaisa - tdsDeductionPaisa;

        await tx.providerPayout.create({
          data: {
            providerId: payment.booking.providerId,
            bookingId: payment.bookingId,
            grossAmountPaisa,
            platformDeductionPaisa,
            tdsDeductionPaisa,
            netPayoutPaisa,
            payoutMode: 'BANK_TRANSFER',
            status: 'PENDING',
          },
        });
      }

      return capturedPayment;
    });

    return updated;
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
