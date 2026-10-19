import { PaymentGatewayType } from '@localman/constants';

export interface CreateOrderOptions {
  bookingId: string;
  bookingNumber: string;
  amountPaisa: number;
  currency: string;
  customerPhone: string;
  customerName?: string | null;
}

export interface OrderResult {
  gateway: PaymentGatewayType;
  gatewayOrderId: string;
  amountPaisa: number;
  currency: string;
}

export interface RefundOptions {
  gatewayPaymentId: string;
  amountPaisa: number;
  reason: string;
}

export interface VerifyPaymentOptions {
  gatewayOrderId: string;
  gatewayPaymentId: string;
  gatewaySignature: string;
}

export interface PaymentGatewayAdapter {
  createOrder(options: CreateOrderOptions): Promise<OrderResult>;
  verifyPaymentSignature(options: VerifyPaymentOptions): boolean;
  verifyWebhookSignature(rawBody: string, signature: string): boolean;
  processRefund(options: RefundOptions): Promise<{ gatewayRefundId: string }>;
}
