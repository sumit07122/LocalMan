import crypto from 'node:crypto';
import { env } from '../../../config/env.js';
import {
  PaymentGatewayAdapter,
  CreateOrderOptions,
  OrderResult,
  RefundOptions,
} from './payment-gateway.interface.js';

export interface RazorpayAdapterOptions {
  keyId?: string;
  keySecret?: string;
  webhookSecret?: string;
  fetchFn?: typeof fetch;
}

export class RazorpayAdapter implements PaymentGatewayAdapter {
  private keyId: string;
  private keySecret: string;
  private webhookSecret: string;
  private fetchFn: typeof fetch;

  constructor(options?: RazorpayAdapterOptions) {
    this.keyId = options?.keyId ?? env.RAZORPAY_KEY_ID;
    this.keySecret = options?.keySecret ?? env.RAZORPAY_KEY_SECRET;
    this.webhookSecret = options?.webhookSecret ?? env.RAZORPAY_WEBHOOK_SECRET;
    this.fetchFn = options?.fetchFn ?? fetch;
  }

  private hasValidCredentials(): boolean {
    return Boolean(
      this.keyId &&
      this.keySecret &&
      this.keyId !== 'rzp_test_example' &&
      this.keySecret !== 'rzp_secret_example'
    );
  }

  async createOrder(options: CreateOrderOptions): Promise<OrderResult> {
    const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const orderPayload = {
      amount: options.amountPaisa,
      currency: options.currency,
      receipt: options.bookingNumber,
      notes: {
        bookingId: options.bookingId,
        customerPhone: options.customerPhone,
      },
    };

    if (this.hasValidCredentials() || env.NODE_ENV === 'production') {
      const response = await this.fetchFn('https://api.razorpay.com/v1/orders', {
        method: 'POST',
        headers: {
          Authorization: `Basic ${authHeader}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(orderPayload),
        signal: AbortSignal.timeout(8000),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Razorpay order creation failed: ${errorText}`);
      }

      const data = (await response.json()) as any;
      return {
        gateway: 'RAZORPAY',
        gatewayOrderId: data.id,
        amountPaisa: data.amount,
        currency: data.currency,
      };
    }

    return {
      gateway: 'RAZORPAY',
      gatewayOrderId: `rzp_order_${Date.now()}`,
      amountPaisa: options.amountPaisa,
      currency: options.currency,
    };
  }

  verifyPaymentSignature(options: {
    gatewayOrderId: string;
    gatewayPaymentId: string;
    gatewaySignature: string;
  }): boolean {
    if (!options.gatewaySignature || !options.gatewayOrderId || !options.gatewayPaymentId) {
      return false;
    }
    const text = `${options.gatewayOrderId}|${options.gatewayPaymentId}`;
    const expectedSignature = crypto
      .createHmac('sha256', this.keySecret)
      .update(text)
      .digest('hex');

    if (Buffer.byteLength(options.gatewaySignature) !== Buffer.byteLength(expectedSignature)) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(options.gatewaySignature)
    );
  }

  verifyWebhookSignature(rawBody: string, signature: string): boolean {
    if (!signature) return false;
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(rawBody)
      .digest('hex');

    if (Buffer.byteLength(expectedSignature) !== Buffer.byteLength(signature)) {
      return false;
    }

    return crypto.timingSafeEqual(
      Buffer.from(expectedSignature),
      Buffer.from(signature)
    );
  }

  async processRefund(options: RefundOptions): Promise<{ gatewayRefundId: string }> {
    const authHeader = Buffer.from(`${this.keyId}:${this.keySecret}`).toString('base64');
    const refundPayload = {
      amount: options.amountPaisa,
      notes: {
        reason: options.reason || 'Booking cancellation or service adjustment',
      },
    };

    if (this.hasValidCredentials() || env.NODE_ENV === 'production') {
      const response = await this.fetchFn(
        `https://api.razorpay.com/v1/payments/${encodeURIComponent(options.gatewayPaymentId)}/refund`,
        {
          method: 'POST',
          headers: {
            Authorization: `Basic ${authHeader}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(refundPayload),
          signal: AbortSignal.timeout(8000),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`Razorpay refund failed: ${errorText}`);
      }

      const data = (await response.json()) as any;
      return {
        gatewayRefundId: data.id,
      };
    }

    const seed = options.idempotencyKey || `${options.gatewayPaymentId}_${options.amountPaisa}`;
    const hash = crypto.createHash('sha256').update(seed).digest('hex').substring(0, 16);
    return {
      gatewayRefundId: `rfnd_rzp_${hash}`,
    };
  }
}
