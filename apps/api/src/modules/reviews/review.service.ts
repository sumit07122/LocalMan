import { prisma } from '../../config/database.js';
import {
  BookingStatus,
  ReviewStatus,
  ReviewStatusType,
  REVIEW_EDIT_WINDOW_MS,
  REVIEW_CONSTRAINTS,
} from '@localman/constants';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
  ConflictError,
} from '../../common/errors/app-error.js';
import {
  CreateReviewInput,
  UpdateReviewInput,
  ProviderResponseInput,
  ReportReviewInput,
  ModerateReviewInput,
  ReviewQueryInput,
  ProviderReputationDto,
  PublicReviewDto,
  ReviewDetailDto,
} from '@localman/contracts';
import { notificationService } from '../notifications/notification.service.js';
import { realtimeService } from '../realtime/realtime.service.js';

export class ReviewService {
  /**
   * Helper to format a review object safely for public/customer/provider views,
   * omitting internal moderation fields.
   */
  private formatPublicReview(review: any): PublicReviewDto {
    return {
      id: review.id,
      bookingId: review.bookingId,
      rating: review.rating,
      title: review.title || null,
      body: review.body || review.comment || null,
      photos: Array.isArray(review.photos) ? review.photos : [],
      providerResponse: review.providerResponse || review.providerReply || null,
      providerRespondedAt: review.providerRespondedAt ? new Date(review.providerRespondedAt).toISOString() : null,
      createdAt: new Date(review.createdAt).toISOString(),
      updatedAt: new Date(review.updatedAt).toISOString(),
      customerName: review.customer?.fullName || 'Verified Customer',
      customerAvatarUrl: review.customer?.avatarUrl || null,
    };
  }

  /**
   * Helper to format a review object with detail & edit window metadata for authorized customer/admin
   */
  private formatReviewDetail(review: any, currentUserId?: string): ReviewDetailDto {
    const createdAt = new Date(review.createdAt);
    const elapsedMs = Date.now() - createdAt.getTime();
    const isOwner = currentUserId ? review.customerId === currentUserId : false;
    const canEdit = isOwner && review.status === ReviewStatus.PUBLISHED && elapsedMs <= REVIEW_EDIT_WINDOW_MS;
    const editWindowExpiresAt = new Date(createdAt.getTime() + REVIEW_EDIT_WINDOW_MS).toISOString();

    return {
      ...this.formatPublicReview(review),
      customerId: review.customerId,
      providerId: review.providerId,
      status: review.status as ReviewStatusType,
      isFlagged: Boolean(review.isFlagged),
      canEdit,
      editWindowExpiresAt,
      moderatedAt: review.moderatedAt ? new Date(review.moderatedAt).toISOString() : null,
      moderationReason: review.moderationReason || null,
    };
  }

  /**
   * Server-authoritative provider reputation calculation.
   * Only PUBLISHED reviews contribute to average rating and counts.
   */
  async getProviderReputation(providerId: string, clientPrisma: any = prisma): Promise<ProviderReputationDto> {
    const provider = await clientPrisma.provider.findUnique({
      where: { id: providerId },
      select: { id: true },
    });

    if (!provider) {
      throw new NotFoundError('Provider not found');
    }

    const reviews = await clientPrisma.review.findMany({
      where: {
        providerId,
        status: ReviewStatus.PUBLISHED,
      },
      select: { rating: true },
    });

    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    let sum = 0;

    for (const r of reviews) {
      if (r.rating >= 1 && r.rating <= 5) {
        distribution[r.rating as 1 | 2 | 3 | 4 | 5]++;
        sum += r.rating;
      }
    }

    const totalCount = reviews.length;
    // Default to 5.00 if provider has 0 published reviews
    const averageRating = totalCount > 0 ? Math.round((sum / totalCount) * 100) / 100 : 5.0;

    return {
      providerId,
      averageRating,
      publishedReviewCount: totalCount,
      ratingDistribution: distribution,
    };
  }

  /**
   * Recalculates provider reputation from published reviews and transactionally updates
   * the denormalized Provider.ratingAverage and Provider.ratingCount.
   */
  async recalculateAndPersistProviderReputation(providerId: string, tx: any): Promise<void> {
    const reputation = await this.getProviderReputation(providerId, tx);

    await tx.provider.update({
      where: { id: providerId },
      data: {
        ratingAverage: reputation.averageRating,
        ratingCount: reputation.publishedReviewCount,
      },
    });
  }

  /**
   * Customer submits a review for a completed booking.
   */
  async createReview(
    customerId: string,
    bookingId: string,
    input: CreateReviewInput
  ): Promise<ReviewDetailDto> {
    // 1. Fetch booking with assignment and customer details
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: {
          select: { id: true, userId: true, businessName: true },
        },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // 2. Ownership Check: Customer can only review their own booking
    if (booking.customerId !== customerId) {
      throw new ForbiddenError('You can only review your own bookings.');
    }

    // 3. Provider Assignment Check
    if (!booking.providerId || !booking.provider) {
      throw new BadRequestError('Cannot review a booking without an assigned service professional.');
    }

    // Prevent provider from reviewing themselves as customer
    if (booking.provider.userId === customerId) {
      throw new ForbiddenError('Service professionals cannot review their own bookings.');
    }

    // 4. Booking Completion Check: Must have reached JOB_COMPLETED (or settled states)
    const allowedStates: string[] = [
      BookingStatus.JOB_COMPLETED,
      BookingStatus.PAYMENT_PENDING,
      BookingStatus.PAYMENT_SETTLED,
      BookingStatus.REVIEWED,
    ];
    if (!allowedStates.includes(booking.currentStatus)) {
      throw new BadRequestError(
        `Review can only be submitted for completed bookings. Current status: ${booking.currentStatus}`
      );
    }

    // 5. Duplicate Check
    const existingReview = await prisma.review.findFirst({
      where: {
        bookingId,
        customerId,
      },
    });
    if (existingReview) {
      throw new ConflictError('A review has already been submitted for this booking.');
    }

    // 6. Content Validation
    if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
      throw new BadRequestError('Rating must be an integer between 1 and 5.');
    }

    const title = input.title ? input.title.trim() : null;
    const body = input.body ? input.body.trim() : input.comment ? input.comment.trim() : null;

    // 7. Atomic Database Transaction
    const createdReview = await prisma.$transaction(async (tx) => {
      // Create Review
      const review = await tx.review.create({
        data: {
          bookingId: booking.id,
          customerId,
          providerId: booking.providerId!,
          rating: input.rating,
          title,
          body,
          comment: body,
          photos: Array.isArray(input.photos) ? input.photos.slice(0, 5) : [],
          status: ReviewStatus.PUBLISHED,
          isFlagged: false,
        } as any,
        include: {
          customer: { select: { fullName: true, avatarUrl: true } },
        },
      });

      // Update Booking status to REVIEWED if in JOB_COMPLETED or PAYMENT_SETTLED
      if (
        booking.currentStatus === BookingStatus.JOB_COMPLETED ||
        booking.currentStatus === BookingStatus.PAYMENT_SETTLED
      ) {
        await tx.booking.update({
          where: { id: booking.id },
          data: { currentStatus: BookingStatus.REVIEWED },
        });

        await tx.bookingStatusHistory.create({
          data: {
            bookingId: booking.id,
            fromState: booking.currentStatus,
            toState: BookingStatus.REVIEWED,
            actorId: customerId,
            actorRole: 'CUSTOMER',
            reason: 'Customer submitted rating and review',
          },
        });
      }

      // Authoritative Provider Reputation update
      await this.recalculateAndPersistProviderReputation(booking.providerId!, tx);

      // Audit Log
      await tx.auditLog.create({
        data: {
          userId: customerId,
          action: 'REVIEW_CREATED',
          resourceType: 'REVIEW',
          resourceId: review.id,
          newState: {
            bookingId: booking.id,
            providerId: booking.providerId,
            rating: input.rating,
            status: ReviewStatus.PUBLISHED,
          },
        },
      });

      return review;
    });

    // 8. Notifications & Realtime events
    if (booking.provider.userId) {
      await notificationService.notifyReviewReceived(
        booking.provider.userId,
        booking.providerId,
        booking.id,
        createdReview.rating
      );
    }
    realtimeService.emitToCustomer(customerId, 'REVIEW_CREATED', {
      reviewId: createdReview.id,
      bookingId: booking.id,
    });

    return this.formatReviewDetail(createdReview, customerId);
  }

  /**
   * Retrieves review for a specific booking.
   * Authorized: customer owner, assigned provider, or admin.
   */
  async getBookingReview(
    actor: { id: string; roles: string[] },
    bookingId: string
  ): Promise<ReviewDetailDto> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: { select: { id: true, userId: true } },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const isCustomer = booking.customerId === actor.id;
    const isAssignedProvider = booking.provider?.userId === actor.id || booking.providerId === actor.id;
    const isAdmin = actor.roles.includes('ADMIN') || actor.roles.includes('CITY_MANAGER');

    if (!isCustomer && !isAssignedProvider && !isAdmin) {
      throw new ForbiddenError('Access denied to booking review.');
    }

    const review = await prisma.review.findUnique({
      where: { bookingId },
      include: {
        customer: { select: { fullName: true, avatarUrl: true } },
      },
    });

    if (!review) {
      throw new NotFoundError('No review found for this booking.');
    }

    // Non-admins and non-customer owners cannot see un-published (HIDDEN/REMOVED/PENDING) reviews
    if (review.status !== ReviewStatus.PUBLISHED && !isCustomer && !isAdmin) {
      throw new NotFoundError('No published review found for this booking.');
    }

    return this.formatReviewDetail(review, actor.id);
  }

  /**
   * Retrieves review by ID.
   */
  async getReviewById(
    actor: { id: string; roles: string[] },
    reviewId: string
  ): Promise<ReviewDetailDto> {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        customer: { select: { fullName: true, avatarUrl: true } },
      },
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    const isCustomer = review.customerId === actor.id;
    const isAdmin = actor.roles.includes('ADMIN') || actor.roles.includes('CITY_MANAGER');

    if (review.status !== ReviewStatus.PUBLISHED && !isCustomer && !isAdmin) {
      throw new NotFoundError('Review not found.');
    }

    return this.formatReviewDetail(review, actor.id);
  }

  /**
   * Customer edits their review within the 48-hour edit window.
   */
  async updateReview(
    customerId: string,
    reviewId: string,
    input: UpdateReviewInput
  ): Promise<ReviewDetailDto> {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        customer: { select: { fullName: true, avatarUrl: true } },
      },
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    // Ownership Check
    if (review.customerId !== customerId) {
      throw new ForbiddenError('You can only edit your own reviews.');
    }

    // Moderation state check: cannot edit if HIDDEN or REMOVED
    if (review.status === ReviewStatus.HIDDEN || review.status === ReviewStatus.REMOVED) {
      throw new ForbiddenError('Cannot edit a review that has been moderated.');
    }

    // 48-Hour Edit Window Check
    const elapsedMs = Date.now() - new Date(review.createdAt).getTime();
    if (elapsedMs > REVIEW_EDIT_WINDOW_MS) {
      throw new BadRequestError('Review can only be edited within 48 hours of creation.');
    }

    // Validate rating if updated
    if (input.rating !== undefined) {
      if (!Number.isInteger(input.rating) || input.rating < 1 || input.rating > 5) {
        throw new BadRequestError('Rating must be an integer between 1 and 5.');
      }
    }

    const title = input.title !== undefined ? (input.title ? input.title.trim() : null) : review.title;
    const body =
      input.body !== undefined
        ? input.body
          ? input.body.trim()
          : null
        : input.comment !== undefined
          ? input.comment
            ? input.comment.trim()
            : null
          : review.body;

    const ratingChanged = input.rating !== undefined && input.rating !== review.rating;

    const updated = await prisma.$transaction(async (tx) => {
      const updatedReview = await tx.review.update({
        where: { id: reviewId },
        data: {
          rating: input.rating !== undefined ? input.rating : review.rating,
          title,
          body,
          comment: body,
          ...(input.photos !== undefined
            ? { photos: Array.isArray(input.photos) ? input.photos.slice(0, 5) : [] }
            : {}),
          updatedAt: new Date(),
        } as any,
        include: {
          customer: { select: { fullName: true, avatarUrl: true } },
        },
      });

      if (ratingChanged) {
        await this.recalculateAndPersistProviderReputation(review.providerId, tx);
      }

      await tx.auditLog.create({
        data: {
          userId: customerId,
          action: 'REVIEW_UPDATED',
          resourceType: 'REVIEW',
          resourceId: review.id,
          oldState: { rating: review.rating, title: review.title, body: review.body },
          newState: { rating: updatedReview.rating, title: updatedReview.title, body: updatedReview.body },
        },
      });

      return updatedReview;
    });

    return this.formatReviewDetail(updated, customerId);
  }

  /**
   * Assigned service professional responds to a published review.
   */
  async submitProviderResponse(
    providerUserId: string,
    reviewId: string,
    input: ProviderResponseInput
  ): Promise<PublicReviewDto> {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        booking: { select: { id: true, customerId: true } },
      },
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    // Response can only be added to a PUBLISHED review
    if (review.status !== ReviewStatus.PUBLISHED) {
      throw new BadRequestError('Can only respond to published reviews.');
    }

    // Find provider profile for authenticated provider user
    const provider = await prisma.provider.findUnique({
      where: { userId: providerUserId },
      select: { id: true, businessName: true },
    });

    if (!provider) {
      throw new ForbiddenError('Only registered service professionals can respond to reviews.');
    }

    // Provider IDOR check: must own the review's providerId
    if (review.providerId !== provider.id) {
      throw new ForbiddenError('You can only respond to reviews for your own services.');
    }

    const trimmedResponse = input.response.trim();

    const updated = await prisma.$transaction(async (tx) => {
      const resp = await tx.review.update({
        where: { id: reviewId },
        data: {
          providerResponse: trimmedResponse,
          providerReply: trimmedResponse,
          providerRespondedAt: new Date(),
          updatedAt: new Date(),
        },
        include: {
          customer: { select: { fullName: true, avatarUrl: true } },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: providerUserId,
          action: 'PROVIDER_RESPONSE_SUBMITTED',
          resourceType: 'REVIEW',
          resourceId: review.id,
          newState: { providerResponse: trimmedResponse },
        },
      });

      return resp;
    });

    // Notify customer
    await notificationService.notifyProviderResponseReceived(
      review.customerId,
      review.bookingId,
      provider.businessName || 'Service Professional'
    );

    return this.formatPublicReview(updated);
  }

  /**
   * Flag/report an inappropriate review.
   */
  async reportReview(
    userId: string,
    reviewId: string,
    input: ReportReviewInput
  ): Promise<{ message: string; reportId: string }> {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    // Prevent duplicate report by the same user for the same review
    const existingReport = await prisma.reviewReport.findFirst({
      where: {
        reviewId,
        reporterId: userId,
      },
    });

    if (existingReport) {
      throw new ConflictError('You have already reported this review.');
    }

    const report = await prisma.$transaction(async (tx) => {
      const createdReport = await tx.reviewReport.create({
        data: {
          reviewId,
          reporterId: userId,
          reason: input.reason,
          details: input.details ? input.details.trim() : null,
          status: 'PENDING',
        },
      });

      // Mark review as flagged
      await tx.review.update({
        where: { id: reviewId },
        data: {
          isFlagged: true,
          updatedAt: new Date(),
        },
      });

      await tx.auditLog.create({
        data: {
          userId,
          action: 'REVIEW_REPORTED',
          resourceType: 'REVIEW',
          resourceId: reviewId,
          newState: { reason: input.reason, reportId: createdReport.id },
        },
      });

      return createdReport;
    });

    return {
      message: 'Review reported successfully. Our moderation team will investigate.',
      reportId: report.id,
    };
  }

  /**
   * Public retrieval of published reviews for a provider profile with pagination.
   */
  async getProviderReviews(
    providerId: string,
    query: ReviewQueryInput
  ): Promise<{
    providerId: string;
    reviews: PublicReviewDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const provider = await prisma.provider.findUnique({
      where: { id: providerId },
      select: { id: true },
    });

    if (!provider) {
      throw new NotFoundError('Provider not found');
    }

    const page = Math.max(1, query.page || 1);
    const limit = Math.min(REVIEW_CONSTRAINTS.MAX_PAGE_SIZE, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = {
      providerId,
      status: ReviewStatus.PUBLISHED,
    };

    if (query.rating) {
      where.rating = query.rating;
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { fullName: true, avatarUrl: true } },
        },
      }),
      prisma.review.count({ where }),
    ]);

    return {
      providerId,
      reviews: reviews.map((r) => this.formatPublicReview(r)),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Authenticated provider views their own reviews (including responses).
   */
  async getMyProviderReviews(
    providerUserId: string,
    query: ReviewQueryInput
  ): Promise<{
    providerId: string;
    reviews: PublicReviewDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const provider = await prisma.provider.findUnique({
      where: { userId: providerUserId },
      select: { id: true },
    });

    if (!provider) {
      throw new ForbiddenError('Only registered service professionals can access provider reviews.');
    }

    return this.getProviderReviews(provider.id, query);
  }

  /**
   * Admin moderation queue: lists reviews filtered by status, flag, or search.
   * Restricted to ADMIN and CITY_MANAGER roles.
   */
  async adminListReviews(query: ReviewQueryInput): Promise<{
    reviews: any[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  }> {
    const page = Math.max(1, query.page || 1);
    const limit = Math.min(REVIEW_CONSTRAINTS.MAX_PAGE_SIZE, Math.max(1, query.limit || 10));
    const skip = (page - 1) * limit;

    const where: any = {};

    if (query.status) {
      where.status = query.status;
    }
    if (query.flaggedOnly) {
      where.isFlagged = true;
    }
    if (query.rating) {
      where.rating = query.rating;
    }

    const [reviews, total] = await Promise.all([
      prisma.review.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          customer: { select: { id: true, fullName: true, phoneNumber: true, email: true } },
          provider: { select: { id: true, businessName: true, user: { select: { fullName: true, phoneNumber: true } } } },
          reports: { select: { id: true, reason: true, details: true, status: true, createdAt: true } },
        },
      }),
      prisma.review.count({ where }),
    ]);

    return {
      reviews,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit) || 1,
      },
    };
  }

  /**
   * Admin inspects detailed review data including audit history and reports.
   */
  async adminGetReviewDetails(reviewId: string): Promise<any> {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
      include: {
        customer: { select: { id: true, fullName: true, phoneNumber: true, email: true } },
        provider: { select: { id: true, businessName: true, user: { select: { fullName: true, phoneNumber: true } } } },
        booking: { select: { id: true, bookingNumber: true, currentStatus: true, totalAmountPaisa: true } },
        reports: {
          include: {
            reporter: { select: { id: true, fullName: true, phoneNumber: true } },
          },
        },
      },
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    const auditLogs = await prisma.auditLog.findMany({
      where: {
        resourceType: 'REVIEW',
        resourceId: reviewId,
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    return {
      ...review,
      auditLogs,
    };
  }

  /**
   * Admin executes a moderation action (PUBLISH, HIDE, REMOVE, FLAGGED) with mandatory audit reason.
   */
  async adminModerateReview(
    adminUserId: string,
    reviewId: string,
    input: ModerateReviewInput
  ): Promise<any> {
    const review = await prisma.review.findUnique({
      where: { id: reviewId },
    });

    if (!review) {
      throw new NotFoundError('Review not found');
    }

    const trimmedReason = input.moderationReason.trim();
    if (trimmedReason.length < REVIEW_CONSTRAINTS.MIN_MODERATION_REASON_LENGTH) {
      throw new BadRequestError(
        `Moderation reason must be at least ${REVIEW_CONSTRAINTS.MIN_MODERATION_REASON_LENGTH} characters.`
      );
    }

    const previousStatus = review.status;
    const newStatus = input.status;

    const moderated = await prisma.$transaction(async (tx) => {
      const updated = await tx.review.update({
        where: { id: reviewId },
        data: {
          status: newStatus,
          moderatedAt: new Date(),
          moderatedBy: adminUserId,
          moderationReason: trimmedReason,
          isFlagged: newStatus === ReviewStatus.FLAGGED,
          updatedAt: new Date(),
        },
      });

      // If status changed to or from PUBLISHED, recalculate provider reputation immediately!
      if (previousStatus !== newStatus) {
        await this.recalculateAndPersistProviderReputation(review.providerId, tx);
      }

      // Record authoritative audit log
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: 'REVIEW_MODERATED',
          resourceType: 'REVIEW',
          resourceId: reviewId,
          oldState: { status: previousStatus },
          newState: { status: newStatus, reason: trimmedReason, moderatedBy: adminUserId },
        },
      });

      return updated;
    });

    realtimeService.emitToCustomer(review.customerId, 'REVIEW_MODERATED', {
      reviewId,
      status: newStatus,
      reason: trimmedReason,
    });

    return moderated;
  }
}

export const reviewService = new ReviewService();
