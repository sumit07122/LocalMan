import crypto from 'node:crypto';
import { prisma } from '../../config/database.js';
import {
  MediaPurpose,
  MediaPurposeType,
  MEDIA_CONSTRAINTS,
  ALL_ALLOWED_MEDIA_MIME_TYPES,
  BookingStatus,
} from '@localman/constants';
import {
  BadRequestError,
  NotFoundError,
  ForbiddenError,
} from '../../common/errors/app-error.js';
import {
  RequestPresignedUploadUrlInput,
  PresignedUploadUrlResponse,
  ConfirmMediaAttachmentInput,
  MediaAttachmentResponse,
  BookingMediaListResponse,
} from '@localman/contracts';
import { getStorageProvider } from '../storage/storage-provider.js';

export class MediaService {
  /**
   * Helper to determine appropriate file extension from content-type or filename.
   */
  private getExtension(fileName: string, contentType: string): string {
    const mimeMap: Record<string, string> = {
      'image/jpeg': 'jpg',
      'image/png': 'png',
      'image/webp': 'webp',
      'image/heic': 'heic',
      'application/pdf': 'pdf',
    };

    if (mimeMap[contentType]) {
      return mimeMap[contentType];
    }

    const dotIndex = fileName.lastIndexOf('.');
    if (dotIndex !== -1 && dotIndex < fileName.length - 1) {
      return fileName.slice(dotIndex + 1).toLowerCase().replace(/[^a-z0-9]/g, '');
    }

    return 'bin';
  }

  /**
   * Validates user authorization for requested media upload purpose and target entity.
   */
  private async validateUploadAuthorization(
    userId: string,
    userRoles: string[],
    purpose: MediaPurposeType,
    entityId: string
  ): Promise<{ booking?: any; provider?: any }> {
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('CITY_MANAGER');

    switch (purpose) {
      case MediaPurpose.BOOKING_PROBLEM_PHOTO: {
        const booking = await prisma.booking.findUnique({
          where: { id: entityId },
          include: { provider: true },
        });

        if (!booking) {
          throw new NotFoundError('Booking not found');
        }

        // Ownership: Customer who booked or Admin
        if (booking.customerId !== userId && !isAdmin) {
          throw new ForbiddenError('You can only upload problem photos for your own bookings.');
        }

        // State Machine validation: Cannot upload problem photos for cancelled or terminal failure states
        const invalidStates: string[] = [
          BookingStatus.CANCELLED,
          BookingStatus.REJECTED,
          BookingStatus.EXPIRED,
          BookingStatus.NO_SHOW,
        ];
        if (invalidStates.includes(booking.currentStatus)) {
          throw new BadRequestError(
            `Cannot attach problem photos to a booking in ${booking.currentStatus} status.`
          );
        }

        // Check max problem photos
        const existingAttachments = Array.isArray(booking.attachments) ? booking.attachments : [];
        const existingCount = existingAttachments.filter(
          (a: any) => a.purpose === MediaPurpose.BOOKING_PROBLEM_PHOTO
        ).length;
        if (existingCount >= MEDIA_CONSTRAINTS.MAX_PROBLEM_PHOTOS_PER_BOOKING) {
          throw new BadRequestError(
            `Maximum ${MEDIA_CONSTRAINTS.MAX_PROBLEM_PHOTOS_PER_BOOKING} problem photos allowed per booking.`
          );
        }

        return { booking };
      }

      case MediaPurpose.JOB_BEFORE_WORK: {
        const booking = await prisma.booking.findUnique({
          where: { id: entityId },
          include: { provider: true },
        });

        if (!booking) {
          throw new NotFoundError('Booking not found');
        }

        // Authorization: Assigned provider or Admin
        const isAssignedProvider = booking.provider?.userId === userId;
        if (!isAssignedProvider && !isAdmin) {
          throw new ForbiddenError(
            'Only the assigned service professional can upload before-work photos.'
          );
        }

        // State Machine Validation: Must be in transit or active execution
        const allowedTransitStates: string[] = [
          BookingStatus.PROVIDER_ON_THE_WAY,
          BookingStatus.ARRIVED,
          BookingStatus.JOB_STARTED,
          BookingStatus.JOB_EXTENDED,
        ];
        if (!allowedTransitStates.includes(booking.currentStatus)) {
          throw new BadRequestError(
            `Before-work photos can only be uploaded when on the way, arrived, or executing the job. Current status: ${booking.currentStatus}`
          );
        }

        const existingAttachments = Array.isArray(booking.attachments) ? booking.attachments : [];
        const existingBeforeCount = existingAttachments.filter(
          (a: any) => a.purpose === MediaPurpose.JOB_BEFORE_WORK
        ).length;
        if (existingBeforeCount >= MEDIA_CONSTRAINTS.MAX_BEFORE_PHOTOS_PER_JOB) {
          throw new BadRequestError(
            `Maximum ${MEDIA_CONSTRAINTS.MAX_BEFORE_PHOTOS_PER_JOB} before-work photos allowed.`
          );
        }

        return { booking };
      }

      case MediaPurpose.JOB_AFTER_WORK: {
        const booking = await prisma.booking.findUnique({
          where: { id: entityId },
          include: { provider: true },
        });

        if (!booking) {
          throw new NotFoundError('Booking not found');
        }

        // Authorization: Assigned provider or Admin
        const isAssignedProvider = booking.provider?.userId === userId;
        if (!isAssignedProvider && !isAdmin) {
          throw new ForbiddenError(
            'Only the assigned service professional can upload after-work photos.'
          );
        }

        // State Machine Validation: Must be in active execution (JOB_STARTED or JOB_EXTENDED)
        const allowedExecutionStates: string[] = [
          BookingStatus.JOB_STARTED,
          BookingStatus.JOB_EXTENDED,
        ];
        if (!allowedExecutionStates.includes(booking.currentStatus)) {
          throw new BadRequestError(
            `After-work photos can only be uploaded while the job is actively in progress. Current status: ${booking.currentStatus}`
          );
        }

        const existingAttachments = Array.isArray(booking.attachments) ? booking.attachments : [];
        const existingAfterCount = existingAttachments.filter(
          (a: any) => a.purpose === MediaPurpose.JOB_AFTER_WORK
        ).length;
        if (existingAfterCount >= MEDIA_CONSTRAINTS.MAX_AFTER_PHOTOS_PER_JOB) {
          throw new BadRequestError(
            `Maximum ${MEDIA_CONSTRAINTS.MAX_AFTER_PHOTOS_PER_JOB} after-work photos allowed.`
          );
        }

        return { booking };
      }

      case MediaPurpose.REVIEW_PHOTO: {
        const booking = await prisma.booking.findUnique({
          where: { id: entityId },
          include: { review: true },
        });

        if (!booking) {
          throw new NotFoundError('Booking not found');
        }

        // Authorization: Customer of booking or Admin
        if (booking.customerId !== userId && !isAdmin) {
          throw new ForbiddenError('You can only upload review photos for your own bookings.');
        }

        // Review photos can only be uploaded for completed or reviewable bookings
        const reviewableStates: string[] = [
          BookingStatus.JOB_COMPLETED,
          BookingStatus.PAYMENT_PENDING,
          BookingStatus.PAYMENT_SETTLED,
          BookingStatus.REVIEWED,
        ];
        if (!reviewableStates.includes(booking.currentStatus)) {
          throw new BadRequestError(
            `Review photos can only be uploaded for completed bookings. Current status: ${booking.currentStatus}`
          );
        }

        return { booking };
      }

      case MediaPurpose.KYC_DOCUMENT: {
        const provider = await prisma.provider.findFirst({
          where: { userId },
        });

        if (!provider && !isAdmin) {
          throw new ForbiddenError('Only registered service professionals can upload KYC documents.');
        }

        return { provider };
      }

      case MediaPurpose.DISPUTE_EVIDENCE: {
        const booking = await prisma.booking.findUnique({
          where: { id: entityId },
          include: { provider: true },
        });

        if (!booking) {
          throw new NotFoundError('Booking not found');
        }

        const isParty =
          booking.customerId === userId || booking.provider?.userId === userId || isAdmin;
        if (!isParty) {
          throw new ForbiddenError('You are not authorized to attach evidence to this booking.');
        }

        return { booking };
      }

      default:
        return {};
    }
  }

  /**
   * Generates a pre-signed upload URL after validating RBAC, mime-type, and state boundaries.
   */
  async generatePresignedUploadUrl(
    userId: string,
    userRoles: string[],
    input: RequestPresignedUploadUrlInput
  ): Promise<PresignedUploadUrlResponse> {
    // 1. Whitelist content-type validation
    if (!ALL_ALLOWED_MEDIA_MIME_TYPES.includes(input.contentType as any)) {
      throw new BadRequestError(
        `Unsupported media type: ${input.contentType}. Allowed types: ${ALL_ALLOWED_MEDIA_MIME_TYPES.join(', ')}`
      );
    }

    // 2. File size validation
    const isDoc = input.contentType === 'application/pdf';
    const maxSize = isDoc
      ? MEDIA_CONSTRAINTS.MAX_DOCUMENT_SIZE_BYTES
      : MEDIA_CONSTRAINTS.MAX_PHOTO_SIZE_BYTES;

    if (input.fileSizeBytes > maxSize) {
      const maxMb = maxSize / (1024 * 1024);
      throw new BadRequestError(`File size exceeds maximum permitted limit of ${maxMb} MB.`);
    }

    // 3. Authorization & Entity State Validation
    await this.validateUploadAuthorization(userId, userRoles, input.purpose as MediaPurposeType, input.entityId);

    // 4. Construct unique, deterministic, non-guessable storage key
    const extension = this.getExtension(input.fileName, input.contentType);
    const uniqueSuffix = crypto.randomBytes(8).toString('hex');
    const timestamp = Date.now();
    const sanitizedPurpose = input.purpose.toLowerCase();
    const storageKey = `media/${sanitizedPurpose}/${input.entityId}/${timestamp}_${uniqueSuffix}.${extension}`;

    // 5. Generate Pre-signed URL via Storage Provider abstraction
    const storageProvider = getStorageProvider();
    const presigned = await storageProvider.generatePresignedUploadUrl({
      storageKey,
      contentType: input.contentType,
      fileSizeBytes: input.fileSizeBytes,
      expiresInSeconds: MEDIA_CONSTRAINTS.PRESIGNED_URL_EXPIRY_SECONDS,
      metadata: {
        uploaderUserId: userId,
        purpose: input.purpose,
        entityId: input.entityId,
      },
    });

    return {
      uploadUrl: presigned.uploadUrl,
      fileUrl: presigned.fileUrl,
      storageKey: presigned.storageKey,
      purpose: input.purpose,
      entityId: input.entityId,
      expiresInSeconds: presigned.expiresInSeconds,
      headers: presigned.headers,
    };
  }

  /**
   * Confirms and persists an uploaded media attachment to the database/booking.
   */
  async confirmMediaAttachment(
    userId: string,
    userRoles: string[],
    input: ConfirmMediaAttachmentInput
  ): Promise<MediaAttachmentResponse> {
    // 1. Validate authorization
    const { booking } = await this.validateUploadAuthorization(
      userId,
      userRoles,
      input.purpose as MediaPurposeType,
      input.entityId
    );

    const attachmentId = `med_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;
    const primaryRole = userRoles.includes('ADMIN')
      ? 'ADMIN'
      : userRoles.includes('PROVIDER')
      ? 'PROVIDER'
      : 'CUSTOMER';

    const attachmentRecord = {
      id: attachmentId,
      storageKey: input.storageKey,
      fileUrl: input.fileUrl,
      purpose: input.purpose,
      entityId: input.entityId,
      bookingId: booking ? booking.id : input.entityId,
      uploaderUserId: userId,
      uploaderRole: primaryRole,
      caption: input.caption || null,
      contentType: input.contentType || 'image/jpeg',
      fileSizeBytes: input.fileSizeBytes || 0,
      createdAt: new Date().toISOString(),
    };

    // 2. Persist to Prisma MediaAttachment if model exists
    if ((prisma as any).mediaAttachment) {
      await (prisma as any).mediaAttachment.create({
        data: {
          id: attachmentRecord.id,
          storageKey: attachmentRecord.storageKey,
          fileUrl: attachmentRecord.fileUrl,
          purpose: attachmentRecord.purpose,
          entityId: attachmentRecord.entityId,
          bookingId: attachmentRecord.bookingId,
          uploaderUserId: attachmentRecord.uploaderUserId,
          uploaderRole: attachmentRecord.uploaderRole,
          caption: attachmentRecord.caption,
          contentType: attachmentRecord.contentType,
          fileSizeBytes: attachmentRecord.fileSizeBytes,
          createdAt: new Date(),
        },
      });
    }

    // 3. If attached to a booking, sync to Booking.attachments JSON array
    if (booking) {
      const currentAttachments = Array.isArray(booking.attachments) ? booking.attachments : [];
      const updatedAttachments = [...currentAttachments, attachmentRecord];

      await prisma.booking.update({
        where: { id: booking.id },
        data: { attachments: updatedAttachments },
      });
    }

    // 4. If purpose is REVIEW_PHOTO, sync to Review.photos array
    if (input.purpose === MediaPurpose.REVIEW_PHOTO) {
      const review = await prisma.review.findFirst({
        where: { bookingId: input.entityId },
      });

      if (review) {
        const currentPhotos = Array.isArray((review as any).photos) ? (review as any).photos : [];
        if (!currentPhotos.includes(input.fileUrl) && currentPhotos.length < MEDIA_CONSTRAINTS.MAX_PHOTOS_PER_REVIEW) {
          const updatedPhotos = [...currentPhotos, input.fileUrl];
          await prisma.review.update({
            where: { id: review.id },
            data: { photos: updatedPhotos } as any,
          });
        }
      }
    }

    return {
      id: attachmentRecord.id,
      storageKey: attachmentRecord.storageKey,
      fileUrl: attachmentRecord.fileUrl,
      purpose: attachmentRecord.purpose,
      entityId: attachmentRecord.entityId,
      uploaderUserId: attachmentRecord.uploaderUserId,
      uploaderRole: attachmentRecord.uploaderRole,
      caption: attachmentRecord.caption,
      contentType: attachmentRecord.contentType,
      fileSizeBytes: attachmentRecord.fileSizeBytes,
      createdAt: attachmentRecord.createdAt,
    };
  }

  /**
   * Retrieves all media attachments associated with a booking, categorized by purpose.
   * Strictly enforces Anti-IDOR boundaries.
   */
  async getBookingMedia(
    bookingId: string,
    userId: string,
    userRoles: string[]
  ): Promise<BookingMediaListResponse> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: { select: { userId: true } },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // IDOR Check
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('CITY_MANAGER');
    const isCustomer = booking.customerId === userId;
    const isAssignedProvider = booking.provider?.userId === userId;

    if (!isCustomer && !isAssignedProvider && !isAdmin) {
      throw new ForbiddenError('You are not authorized to view media for this booking.');
    }

    let attachments: any[] = [];

    // Query from MediaAttachment table if present, else fallback to booking.attachments JSON
    if ((prisma as any).mediaAttachment) {
      const dbAttachments = await (prisma as any).mediaAttachment.findMany({
        where: { bookingId },
        orderBy: { createdAt: 'desc' },
      });
      if (dbAttachments.length > 0) {
        attachments = dbAttachments.map((a: any) => ({
          ...a,
          createdAt: a.createdAt instanceof Date ? a.createdAt.toISOString() : String(a.createdAt),
        }));
      }
    }

    if (attachments.length === 0 && Array.isArray(booking.attachments)) {
      attachments = booking.attachments;
    }

    const problemPhotos = attachments.filter(
      (a) => a.purpose === MediaPurpose.BOOKING_PROBLEM_PHOTO
    );
    const beforeWorkPhotos = attachments.filter(
      (a) => a.purpose === MediaPurpose.JOB_BEFORE_WORK
    );
    const afterWorkPhotos = attachments.filter(
      (a) => a.purpose === MediaPurpose.JOB_AFTER_WORK
    );
    const otherAttachments = attachments.filter(
      (a) =>
        a.purpose !== MediaPurpose.BOOKING_PROBLEM_PHOTO &&
        a.purpose !== MediaPurpose.JOB_BEFORE_WORK &&
        a.purpose !== MediaPurpose.JOB_AFTER_WORK
    );

    return {
      bookingId,
      problemPhotos,
      beforeWorkPhotos,
      afterWorkPhotos,
      otherAttachments,
      totalCount: attachments.length,
    };
  }

  /**
   * Deletes a media attachment. Only the uploader or an Admin can delete.
   */
  async deleteMediaAttachment(
    attachmentId: string,
    userId: string,
    userRoles: string[]
  ): Promise<{ success: boolean; message: string }> {
    const isAdmin = userRoles.includes('ADMIN') || userRoles.includes('CITY_MANAGER');

    let attachment: any = null;

    if ((prisma as any).mediaAttachment) {
      attachment = await (prisma as any).mediaAttachment.findUnique({
        where: { id: attachmentId },
      });
    }

    // Fallback: search across bookings attachments
    if (!attachment) {
      const allBookings = await prisma.booking.findMany({
        where: { attachments: { not: null } as any },
      });
      for (const b of allBookings) {
        if (Array.isArray(b.attachments)) {
          const match = b.attachments.find((a: any) => a.id === attachmentId);
          if (match) {
            attachment = match;
            attachment._booking = b;
            break;
          }
        }
      }
    }

    if (!attachment) {
      throw new NotFoundError('Media attachment not found');
    }

    if (attachment.uploaderUserId !== userId && !isAdmin) {
      throw new ForbiddenError('You can only delete your own uploaded media.');
    }

    // Delete from storage provider
    const storageProvider = getStorageProvider();
    await storageProvider.deleteFile(attachment.storageKey);

    // Delete record
    if ((prisma as any).mediaAttachment) {
      await (prisma as any).mediaAttachment.delete({
        where: { id: attachmentId },
      }).catch(() => null);
    }

    if (attachment._booking) {
      const updated = (attachment._booking.attachments as any[]).filter(
        (a: any) => a.id !== attachmentId
      );
      await prisma.booking.update({
        where: { id: attachment._booking.id },
        data: { attachments: updated },
      });
    }

    return {
      success: true,
      message: 'Media attachment deleted successfully.',
    };
  }
}

export const mediaService = new MediaService();
