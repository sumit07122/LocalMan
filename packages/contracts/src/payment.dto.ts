import { z } from 'zod';
import { PaymentGateway } from '@localman/constants';

export const CheckoutOrderSchema = z.object({
  bookingId: z.string().min(1),
  gateway: z
    .enum([
      PaymentGateway.RAZORPAY,
      PaymentGateway.CASHFREE,
      PaymentGateway.PHONEPE,
      PaymentGateway.CASH_ON_DELIVERY,
    ])
    .default(PaymentGateway.RAZORPAY),
  idempotencyKey: z.string().max(100).optional(),
});
export type CheckoutOrderInput = z.infer<typeof CheckoutOrderSchema>;

export const CreatePaymentOrderSchema = CheckoutOrderSchema;
export type CreatePaymentOrderInput = CheckoutOrderInput;

export const VerifyPaymentSchema = z
  .object({
    paymentId: z.string().min(1).optional(),
    bookingId: z.string().min(1).optional(),
    gatewayPaymentId: z.string().min(1),
    gatewayOrderId: z.string().min(1),
    gatewaySignature: z.string().min(1),
  })
  .refine((data) => data.paymentId || data.bookingId, {
    message: 'Either paymentId or bookingId must be provided',
  });
export type VerifyPaymentInput = z.infer<typeof VerifyPaymentSchema>;

export const VerifyPaymentWebhookSchema = z.object({
  gateway: z
    .enum([
      PaymentGateway.RAZORPAY,
      PaymentGateway.CASHFREE,
      PaymentGateway.PHONEPE,
    ])
    .default(PaymentGateway.RAZORPAY),
  rawBody: z.string().optional(),
  signature: z.string().optional(),
});
export type VerifyPaymentWebhookInput = z.infer<typeof VerifyPaymentWebhookSchema>;

export const ProcessRefundSchema = z.object({
  paymentId: z.string().min(1),
  amountPaisa: z.number().int().min(100),
  reason: z.string().min(5).max(500),
});
export type ProcessRefundInput = z.infer<typeof ProcessRefundSchema>;

export interface CheckoutResponseDto {
  paymentId: string;
  gateway: string;
  gatewayOrderId: string;
  amountPaisa: number;
  currency: string;
  keyId: string;
  idempotencyKey?: string;
  paymentStatus?: string;
  bookingId?: string;
}

export interface PaymentSummaryItemDto {
  itemName: string;
  quantity: number;
  unitPricePaisa: number;
  totalPricePaisa: number;
}

export interface PaymentSummaryDto {
  bookingId: string;
  bookingNumber: string;
  serviceName: string;
  providerName: string;
  currentStatus: string;
  baseAmountPaisa: number;
  materialsAmountPaisa: number;
  materials: PaymentSummaryItemDto[];
  items?: PaymentSummaryItemDto[];
  platformFeePaisa?: number;
  taxAmountPaisa: number;
  totalAmountPaisa: number;
  paymentId?: string;
  gateway?: string;
  paymentGateway?: string;
  gatewayPaymentId?: string;
  paymentStatus?: string;
  paidAt?: string;
}
