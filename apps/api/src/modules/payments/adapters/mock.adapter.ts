import {
  PaymentGatewayAdapter,
  CreateOrderOptions,
  OrderResult,
  RefundOptions,
} from './payment-gateway.interface.js';

export class MockPaymentAdapter implements PaymentGatewayAdapter {
  async createOrder(options: CreateOrderOptions): Promise<OrderResult> {
    const timestamp = Date.now();
    return {
      gateway: 'RAZORPAY',
      gatewayOrderId: `order_mock_${options.bookingNumber}_${timestamp}`,
      amountPaisa: options.amountPaisa,
      currency: options.currency,
    };
  }

  verifyPaymentSignature(options: { gatewayOrderId: string; gatewayPaymentId: string; gatewaySignature: string }): boolean {
    return Boolean(
      options.gatewayPaymentId &&
      options.gatewayOrderId &&
      options.gatewaySignature &&
      options.gatewaySignature !== 'invalid_signature' &&
      options.gatewaySignature !== 'bad_signature'
    );
  }

  verifyWebhookSignature(_rawBody: string, signature: string): boolean {
    return Boolean(signature && signature.length > 0 && signature !== 'invalid_signature' && signature !== 'bad_signature');
  }

  async processRefund(_options: RefundOptions): Promise<{ gatewayRefundId: string }> {
    return {
      gatewayRefundId: `rfnd_mock_${Date.now()}`,
    };
  }
}
