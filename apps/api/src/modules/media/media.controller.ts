import { FastifyRequest, FastifyReply } from 'fastify';
import { mediaService } from './media.service.js';
import {
  RequestPresignedUploadUrlSchema,
  ConfirmMediaAttachmentSchema,
} from '@localman/contracts';

export class MediaController {
  /**
   * POST /api/v1/media/presign
   */
  async requestPresignedUrl(req: FastifyRequest, reply: FastifyReply) {
    const input = RequestPresignedUploadUrlSchema.parse(req.body);
    const user = req.user as any;
    const roles = user.roles || (user.role ? [user.role] : []);

    const result = await mediaService.generatePresignedUploadUrl(user.id, roles, input);
    return reply.status(200).send(result);
  }

  /**
   * POST /api/v1/media/confirm
   */
  async confirmMediaAttachment(req: FastifyRequest, reply: FastifyReply) {
    const input = ConfirmMediaAttachmentSchema.parse(req.body);
    const user = req.user as any;
    const roles = user.roles || (user.role ? [user.role] : []);

    const result = await mediaService.confirmMediaAttachment(user.id, roles, input);
    return reply.status(201).send(result);
  }

  /**
   * GET /api/v1/media/booking/:bookingId
   * or GET /api/v1/bookings/:id/media
   */
  async getBookingMedia(req: FastifyRequest, reply: FastifyReply) {
    const params = (req.params || {}) as { bookingId?: string; id?: string };
    const bookingId = params.bookingId || params.id;
    if (!bookingId) {
      return reply.status(400).send({ error: 'Booking ID is required' });
    }

    const user = req.user as any;
    const roles = user.roles || (user.role ? [user.role] : []);

    const result = await mediaService.getBookingMedia(bookingId, user.id, roles);
    return reply.status(200).send(result);
  }

  /**
   * DELETE /api/v1/media/:mediaId
   */
  async deleteMedia(req: FastifyRequest, reply: FastifyReply) {
    const params = (req.params || {}) as { mediaId?: string };
    const mediaId = params.mediaId;
    if (!mediaId) {
      return reply.status(400).send({ error: 'Media ID is required' });
    }

    const user = req.user as any;
    const roles = user.roles || (user.role ? [user.role] : []);

    const result = await mediaService.deleteMediaAttachment(mediaId, user.id, roles);
    return reply.status(200).send(result);
  }
}

export const mediaController = new MediaController();
