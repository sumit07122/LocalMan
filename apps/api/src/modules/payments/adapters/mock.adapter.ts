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

  verifyWebhookSignature(_rawBody: string, signature: string): boolean {
    return Boolean(signature && signature.length > 0);
  }

  async processRefund(_options: RefundOptions): Promise<{ gatewayRefundId: string }> {
    return {
      gatewayRefundId: `rfnd_mock_${Date.now()}`,
    };
  }
}
