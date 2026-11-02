import { FastifyRequest, FastifyReply } from 'fastify';
import { reviewService } from './review.service.js';
import {
  CreateReviewSchema,
  UpdateReviewSchema,
  ProviderResponseSchema,
  ReportReviewSchema,
  ModerateReviewSchema,
  ReviewQuerySchema,
} from '@localman/contracts';
import { AuthenticatedUser } from '../../common/middleware/auth.middleware.js';

export class ReviewController {
  /**
   * POST /api/v1/bookings/:bookingId/review
   * Customer submits review for their completed booking
   */
  createBookingReview = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const bookingId = params.bookingId || params.id || '';
    const input = CreateReviewSchema.parse(request.body);
    const user = request.user as AuthenticatedUser;

    const result = await reviewService.createReview(user.id, bookingId, input);
    return reply.status(201).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  };

  /**
   * GET /api/v1/bookings/:bookingId/review
   * Retrieves review for a specific booking
   */
  getBookingReview = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const bookingId = params.bookingId || params.id || '';
    const user = request.user as AuthenticatedUser;

    const result = await reviewService.getBookingReview(user, bookingId);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  };

  /**
   * PATCH /api/v1/bookings/:bookingId/review
   * or PUT /api/v1/reviews/:reviewId
   * Customer edits their review within 48-hour window
   */
  updateBookingReview = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const user = request.user as AuthenticatedUser;
    const input = UpdateReviewSchema.parse(request.body);

    let reviewId = params.reviewId;
    if (!reviewId) {
      const bookingId = params.bookingId || params.id || '';
      const existing = await reviewService.getBookingReview(user, bookingId);
      reviewId = existing.id;
    }

    const result = await reviewService.updateReview(user.id, reviewId, input);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  };

  /**
   * GET /api/v1/reviews/:reviewId
   */
  getReviewById = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const reviewId = params.reviewId || params.id || '';
    const user = request.user as AuthenticatedUser;

    const result = await reviewService.getReviewById(user, reviewId);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  };

  /**
   * POST /api/v1/reviews/:reviewId/response
   * Assigned service professional responds to review
   */
  submitProviderResponse = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const reviewId = params.reviewId || params.id || '';
    const input = ProviderResponseSchema.parse(request.body);
    const user = request.user as AuthenticatedUser;

    const result = await reviewService.submitProviderResponse(user.id, reviewId, input);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  };

  /**
   * POST /api/v1/reviews/:reviewId/report
   * Flag/report review for moderation
   */
  reportReview = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const reviewId = params.reviewId || params.id || '';
    const input = ReportReviewSchema.parse(request.body);
    const user = request.user as AuthenticatedUser;

    const result = await reviewService.reportReview(user.id, reviewId, input);
    return reply.status(201).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  };

  /**
   * GET /api/v1/providers/:providerId/reviews
   * Public list of published reviews for provider profile
   */
  getProviderReviews = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const query = ReviewQuerySchema.parse(request.query || {});
    const result = await reviewService.getProviderReviews(params.providerId, query);
    return reply.status(200).send({
      success: true,
      data: result.reviews,
      pagination: result.pagination,
      meta: { timestamp: new Date().toISOString() },
    });
  };

  /**
   * GET /api/v1/providers/:providerId/reputation
   * Authoritative provider reputation metrics
   */
  getProviderReputation = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const result = await reviewService.getProviderReputation(params.providerId);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  };

  /**
   * GET /api/v1/provider/reviews
   * Authenticated provider views their own reviews
   */
  getMyProviderReviews = async (request: FastifyRequest, reply: FastifyReply) => {
    const user = request.user as AuthenticatedUser;
    const query = ReviewQuerySchema.parse(request.query || {});
    const result = await reviewService.getMyProviderReviews(user.id, query);
    return reply.status(200).send({
      success: true,
      data: result.reviews,
      pagination: result.pagination,
      meta: { timestamp: new Date().toISOString() },
    });
  };

  /**
   * GET /api/v1/admin/reviews
   * Admin review moderation queue
   */
  adminListReviews = async (request: FastifyRequest, reply: FastifyReply) => {
    const query = ReviewQuerySchema.parse(request.query || {});
    const result = await reviewService.adminListReviews(query);
    return reply.status(200).send({
      success: true,
      data: result.reviews,
      pagination: result.pagination,
      meta: { timestamp: new Date().toISOString() },
    });
  };

  /**
   * GET /api/v1/admin/reviews/:reviewId
   */
  adminGetReviewDetails = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const reviewId = params.reviewId || params.id || '';
    const result = await reviewService.adminGetReviewDetails(reviewId);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  };

  /**
   * PATCH /api/v1/admin/reviews/:reviewId/moderate
   */
  adminModerateReview = async (request: FastifyRequest, reply: FastifyReply) => {
    const params = request.params as any;
    const reviewId = params.reviewId || params.id || '';
    const input = ModerateReviewSchema.parse(request.body);
    const user = request.user as AuthenticatedUser;

    const result = await reviewService.adminModerateReview(user.id, reviewId, input);
    return reply.status(200).send({
      success: true,
      data: result,
      meta: { timestamp: new Date().toISOString() },
    });
  };
}

export const reviewController = new ReviewController();
