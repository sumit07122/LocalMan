import { FastifyRequest, FastifyReply } from 'fastify';
import { PaymentService } from './payment.service.js';
import {
  CreatePaymentOrderSchema,
  ProcessRefundSchema,
} from '@localman/contracts';
import { sendSuccess } from '../../common/utils/response.js';
import { UnauthorizedError } from '../../common/errors/app-error.js';
import { z } from 'zod';

export class PaymentController {
  private paymentService = new PaymentService();

  createOrder = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = CreatePaymentOrderSchema.parse(request.body);
    const order = await this.paymentService.createPaymentOrder(request.user, validated);
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
    const result = await this.paymentService.handleSuccessfulPayment(paymentId, gatewayPaymentId);
    return sendSuccess(reply, result, 200);
  };

  processRefund = async (request: FastifyRequest, reply: FastifyReply) => {
    if (!request.user) throw new UnauthorizedError();
    const validated = ProcessRefundSchema.parse(request.body);
    const refund = await this.paymentService.processRefund(request.user, validated);
    return sendSuccess(reply, refund, 200);
  };
}
