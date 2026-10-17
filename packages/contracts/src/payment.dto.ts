import { z } from 'zod';
import { PaymentGateway } from '@localman/constants';

export const CreatePaymentOrderSchema = z.object({
  bookingId: z.string().min(1),
  gateway: z
    .enum([
      PaymentGateway.RAZORPAY,
      PaymentGateway.CASHFREE,
      PaymentGateway.PHONEPE,
      PaymentGateway.CASH_ON_DELIVERY,
    ])
    .default(PaymentGateway.RAZORPAY),
});
export type CreatePaymentOrderInput = z.infer<typeof CreatePaymentOrderSchema>;

export const VerifyPaymentWebhookSchema = z.object({
  gateway: z.enum([
    PaymentGateway.RAZORPAY,
    PaymentGateway.CASHFREE,
    PaymentGateway.PHONEPE,
  ]),
  rawBody: z.string(),
  signature: z.string(),
});
export type VerifyPaymentWebhookInput = z.infer<typeof VerifyPaymentWebhookSchema>;

export const ProcessRefundSchema = z.object({
  paymentId: z.string().min(1),
  amountPaisa: z.number().int().min(100),
  reason: z.string().min(5).max(500),
});
export type ProcessRefundInput = z.infer<typeof ProcessRefundSchema>;
