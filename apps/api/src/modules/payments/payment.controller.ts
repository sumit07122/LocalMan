import { FastifyRequest, FastifyReply } from 'fastify';
import { paymentService } from './payment.service.js';
import {
  CheckoutOrderSchema,
  CreatePaymentOrderSchema,
  VerifyPaymentSchema,
  ProcessRefundSchema,
} from '@localman/contracts';
import { sendSuccess } from '../../common/utils/response.js';
import { UnauthorizedError } from '../../common/errors/app-error.js';
import { z } from 'zod';

export class PaymentController {
  /**
   * Initializes a customer checkout session
   */
  createCheckoutSession = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const params = request.params as { bookingId?: string };
    const rawBody = (request.body as Record<string, any>) || {};
    const bookingId = params.bookingId || rawBody.bookingId;

    const validated = CheckoutOrderSchema.parse({
      ...rawBody,
      bookingId,
    });

    const session = await paymentService.createCheckoutSession(request.user, validated);
    return sendSuccess(reply, session, 201);
  };

  /**
   * Authoritatively verifies customer-submitted payment proof
   */
  verifyPayment = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const params = request.params as { bookingId?: string };
    const rawBody = (request.body as Record<string, any>) || {};
    const bookingId = params.bookingId || rawBody.bookingId;

    const validated = VerifyPaymentSchema.parse({
      ...rawBody,
      bookingId,
    });
    const result = await paymentService.verifyPayment(request.user, validated);
    return sendSuccess(reply, result, 200);
  };

  /**
   * Payment webhook receiver
   */
  handleWebhook = async (request: FastifyRequest, reply: FastifyReply) => {
    const signature =
      (request.headers['x-razorpay-signature'] as string) ||
      (request.headers['x-gateway-signature'] as string) ||
      (request.body as any)?.signature;

    const rawBody = typeof request.body === 'string' ? request.body : JSON.stringify(request.body);
    const result = await paymentService.handleWebhook(signature, request.body, rawBody);
    return sendSuccess(reply, result, 200);
  };

  /**
   * Authoritative payment summary / receipt
   */
  getPaymentSummary = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const params = request.params as { bookingId: string };
    const summary = await paymentService.getPaymentSummary(request.user, params.bookingId);
    return sendSuccess(reply, summary, 200);
  };

  /**
   * Backwards compatible order creator
   */
  createOrder = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = CreatePaymentOrderSchema.parse(request.body);
    const order = await paymentService.createPaymentOrder(request.user, validated);
    return sendSuccess(reply, order, 201);
  };

  /**
   * Payment simulation/confirmation endpoint for development testing
   */
  confirmPayment = async (request: FastifyRequest, reply: FastifyReply) => {
    const schema = z.object({
      paymentId: z.string().min(1),
      gatewayPaymentId: z.string().default(`pay_${Date.now()}`),
    });
    const { paymentId, gatewayPaymentId } = schema.parse(request.body);
    const result = await paymentService.handleSuccessfulPayment(paymentId, gatewayPaymentId);
    return sendSuccess(reply, result, 200);
  };

  /**
   * Admin-authorized refund
   */
  processRefund = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = ProcessRefundSchema.parse(request.body);
    const refund = await paymentService.processRefund(request.user, validated);
    return sendSuccess(reply, refund, 200);
  };
}

export const paymentController = new PaymentController();
