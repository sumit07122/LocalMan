import crypto from 'node:crypto';
import { prisma } from '../../config/database.js';
import {
  BookingStatus,
  BookingStatusType,
} from '@localman/constants';
import {
  CreateBookingInput,
  UpdateBookingStatusInput,
  AddBookingMaterialInput,
  SubmitQuoteInput,
} from '@localman/contracts';
import {
  NotFoundError,
  ForbiddenError,
  ValidationError,
  ConflictError,
} from '../../common/errors/app-error.js';
import { generateBookingNumber, generateSecureOtp } from '../../common/utils/crypto.js';
import { BookingFSM } from './booking-fsm.js';
import { BookingOtpService } from './booking-otp.service.js';
import { AuthenticatedUser } from '../../common/middleware/auth.middleware.js';
import { dispatchService } from '../dispatch/dispatch.service.js';
import { realtimeService } from '../realtime/realtime.service.js';
import { FinancialService } from '../financial/financial.service.js';

export class BookingService {
  /**
   * Creates a new authoritative service booking in REQUESTED status with start OTP,
   * immutable address/pricing/service snapshots, and idempotency protection.
   */
  async createBooking(customer: AuthenticatedUser, input: CreateBookingInput) {
    // 1. Idempotency Check & Replay Protection
    let idempotencyPayloadHash: string | null = null;
    if (input.idempotencyKey) {
      const canonicalPayload = JSON.stringify({
        serviceId: input.serviceId,
        addressId: input.addressId,
        scheduledDate: input.scheduledDate,
        scheduledTimeSlot: input.scheduledTimeSlot,
        pricingModel: input.pricingModel,
        jobDescription: (input.jobDescription || input.customerNotes || '').trim(),
        hours: input.hours || null,
      });
      idempotencyPayloadHash = crypto
        .createHash('sha256')
        .update(canonicalPayload)
        .digest('hex');

      const existing = await prisma.booking.findFirst({
        where: {
          customerId: customer.id,
          idempotencyKey: input.idempotencyKey,
        },
        include: {
          service: true,
          address: true,
        },
      });

      if (existing) {
        if (existing.idempotencyPayloadHash === idempotencyPayloadHash) {
          // Idempotent retry: return existing booking
          return existing;
        } else {
          // Idempotency key collision with materially different payload
          throw new ConflictError(
            'Idempotency key collision: a booking with this key was already created with different parameters.'
          );
        }
      }
    }

    // 2. Service & Category Active Validation
    const service = await prisma.service.findUnique({
      where: { id: input.serviceId },
      include: { category: true },
    });

    if (!service) {
      throw new NotFoundError('Selected service does not exist.');
    }

    if (!service.isActive) {
      throw new ValidationError('Selected service is not currently active.');
    }

    if (!service.category || !service.category.isActive) {
      throw new ValidationError('Selected service category is not currently active.');
    }

    // 3. Address Ownership & Existence Validation
    const address = await prisma.address.findUnique({
      where: { id: input.addressId },
    });

    if (!address) {
      throw new NotFoundError('Selected service address not found.');
    }

    if (address.userId !== customer.id) {
      throw new ForbiddenError('You do not have permission to use this address.');
    }

    // 4. Scheduling Validation
    const now = new Date();
    const todayStr = now.toISOString().split('T')[0];
    if (input.scheduledDate < todayStr) {
      throw new ValidationError('Scheduled date cannot be in the past.');
    }

    const maxFutureDate = new Date();
    maxFutureDate.setDate(maxFutureDate.getDate() + 60);
    const maxFutureDateStr = maxFutureDate.toISOString().split('T')[0];
    if (input.scheduledDate > maxFutureDateStr) {
      throw new ValidationError('Bookings can only be scheduled up to 60 days in advance.');
    }

    if (!input.scheduledTimeSlot || input.scheduledTimeSlot.trim().length === 0) {
      throw new ValidationError('A valid scheduled time slot is required.');
    }

    // 5. Job Description & Notes Validation
    const jobDescription = (input.jobDescription || input.customerNotes || '').trim();
    if (input.jobDescription && input.jobDescription.trim().length < 10) {
      throw new ValidationError('Job description must be at least 10 characters.');
    }

    // 6. Pricing Model & Authoritative Financial Derivation
    let baseAmountPaisa = 0;
    const platformCommissionPercent = Number(
      service.platformCommissionPercent || FinancialService.DEFAULT_COMMISSION_PERCENT
    );

    switch (input.pricingModel) {
      case 'FIXED_PRICE': {
        baseAmountPaisa = service.basePricePaisa;
        break;
      }
      case 'HOURLY': {
        const hours = Math.max(1, Math.round(input.hours || 1));
        const hourlyRate = service.hourlyRatePaisa || service.basePricePaisa;
        baseAmountPaisa = hourlyRate * hours;
        break;
      }
      case 'INSPECTION_QUOTE': {
        baseAmountPaisa = service.inspectionFeePaisa || 0;
        break;
      }
      case 'CUSTOM_QUOTE': {
        baseAmountPaisa = 0;
        break;
      }
      default:
        throw new ValidationError(`Unsupported pricing model: ${input.pricingModel}`);
    }

    const {
      platformFeePaisa,
      taxAmountPaisa,
      totalAmountPaisa,
      providerEarningPaisa,
      gstRatePercent,
    } = FinancialService.deriveBookingPricing({
      baseAmountPaisa,
      platformCommissionPercent,
    });

    // 7. Snapshots for Historical Truth Preservation
    const addressSnapshot = {
      id: address.id,
      label: address.label,
      addressLine1: address.addressLine1,
      addressLine2: address.addressLine2 || null,
      landmark: address.landmark || null,
      city: address.city,
      state: address.state,
      postalCode: address.postalCode,
      latitude: address.latitude,
      longitude: address.longitude,
    };

    const serviceSnapshot = {
      id: service.id,
      name: service.name,
      slug: service.slug,
      categoryId: service.categoryId,
      categoryName: service.category.name,
      estimatedDurationMinutes: service.estimatedDurationMinutes,
    };

    const pricingSnapshot = {
      pricingModel: input.pricingModel,
      basePricePaisa: service.basePricePaisa,
      hourlyRatePaisa: service.hourlyRatePaisa || null,
      inspectionFeePaisa: service.inspectionFeePaisa || null,
      requestedHours: input.pricingModel === 'HOURLY' ? (input.hours || 1) : null,
      taxRatePercent: gstRatePercent,
      isQuoteRequired: input.pricingModel === 'CUSTOM_QUOTE',
    };

    const startOtp = generateSecureOtp();
    const startOtpHash = BookingOtpService.hashOtp(startOtp);
    const bookingNumber = generateBookingNumber();

    // 8. Transactional Atomic Creation
    const booking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          bookingNumber,
          customerId: customer.id,
          providerId: null,
          serviceId: service.id,
          addressId: address.id,
          currentStatus: 'REQUESTED',
          pricingModel: input.pricingModel as any,
          scheduledDate: new Date(input.scheduledDate),
          scheduledTimeSlot: input.scheduledTimeSlot,
          startOtp,
          startOtpHash,
          jobDescription: jobDescription || null,
          customerNotes: input.customerNotes || null,
          baseAmountPaisa,
          taxAmountPaisa,
          platformFeePaisa,
          totalAmountPaisa,
          providerEarningPaisa,
          addressSnapshot,
          pricingSnapshot,
          serviceSnapshot,
          attachments: (input.attachments as any) ?? undefined,
          idempotencyKey: input.idempotencyKey || null,
          idempotencyPayloadHash,
        },
        include: {
          service: true,
          address: true,
        },
      });

      // Append immutable status history
      await tx.bookingStatusHistory.create({
        data: {
          bookingId: created.id,
          fromState: null,
          toState: 'REQUESTED',
          actorId: customer.id,
          actorRole: 'CUSTOMER',
          reason: 'Initial booking placed by customer',
        },
      });

      return created;
    });

    // 9. Automated Server-Side Dispatch Trigger
    try {
      const offer = await dispatchService.dispatchBooking(booking.id);
      realtimeService.emitToBooking(booking.id, 'DISPATCH_STARTED', {
        bookingId: booking.id,
        attemptNumber: 1,
        hasEligibleCandidate: !!offer,
      });
    } catch (dispatchErr) {
      console.error(`[BookingService] Automated dispatch failed for booking ${booking.id}:`, dispatchErr);
    }

    return booking;
  }

  /**
   * Updates booking status via Finite State Machine with transition guards
   */
  async updateStatus(
    bookingId: string,
    actor: AuthenticatedUser,
    input: UpdateBookingStatusInput
  ) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: true,
        materials: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const isCustomer = booking.customerId === actor.id;
    const isAssignedProvider = booking.provider?.userId === actor.id;
    const isAdmin = actor.roles.includes('ADMIN') || actor.roles.includes('CITY_MANAGER');

    // Run Finite State Machine validation
    BookingFSM.validateTransition({
      bookingId,
      currentState: booking.currentStatus as BookingStatusType,
      targetState: input.status as BookingStatusType,
      actorId: actor.id,
      actorRoles: actor.roles,
      isCustomer,
      isAssignedProvider,
      isAdmin,
      startOtpExpected: booking.startOtp,
      startOtpHashExpected: (booking as any).startOtpHash || undefined,
      startOtpSubmitted: input.startOtp,
      completionPhotos: input.completionPhotos,
    });

    const updateData: any = {
      currentStatus: input.status,
    };

    if (input.status === BookingStatus.JOB_STARTED) {
      updateData.startedAt = new Date();
    }

    if (input.status === BookingStatus.JOB_COMPLETED) {
      updateData.completedAt = new Date();
      if (booking.startedAt) {
        const durationMs = new Date().getTime() - new Date(booking.startedAt).getTime();
        updateData.durationMinutes = Math.max(1, Math.round(durationMs / 60000));
      }

      // Tally approved materials
      const approvedMaterialsPaisa = booking.materials
        .filter((m) => m.isCustomerApproved)
        .reduce((sum, m) => sum + m.totalPricePaisa, 0);

      updateData.materialsTotalPaisa = approvedMaterialsPaisa;
      updateData.totalAmountPaisa =
        booking.baseAmountPaisa +
        booking.extraDurationAmountPaisa +
        approvedMaterialsPaisa +
        booking.taxAmountPaisa;

      // Automatically move to PAYMENT_PENDING once job is completed
      updateData.currentStatus = BookingStatus.PAYMENT_PENDING;
    }

    if (input.status === BookingStatus.CANCELLED) {
      updateData.cancelledBy = actor.id;
      updateData.cancelledAt = new Date();
      updateData.cancellationReason = input.reason;
    }

    const updatedBooking = await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: updateData,
        include: {
          service: true,
          materials: true,
          address: true,
        },
      });

      // Append immutable history
      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromState: booking.currentStatus,
          toState: updateData.currentStatus,
          actorId: actor.id,
          actorRole: actor.roles[0] || 'USER',
          reason: input.reason || null,
        },
      });

      return updated;
    });

    return updatedBooking;
  }

  /**
   * Adds an itemized material / spare part request to the booking
   */
  async addMaterial(
    bookingId: string,
    actor: AuthenticatedUser,
    input: AddBookingMaterialInput
  ) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { provider: true },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.provider?.userId !== actor.id && !actor.roles.includes('ADMIN')) {
      throw new ForbiddenError('Only the assigned professional can add materials.');
    }

    if (
      booking.currentStatus !== BookingStatus.JOB_STARTED &&
      booking.currentStatus !== BookingStatus.JOB_EXTENDED
    ) {
      throw new ValidationError('Materials can only be added while the job is actively in progress.');
    }

    const totalPricePaisa = Math.round(input.quantity * input.unitPricePaisa);

    const material = await prisma.$transaction(async (tx) => {
      const created = await tx.bookingMaterial.create({
        data: {
          bookingId,
          itemName: input.itemName,
          quantity: input.quantity,
          unitPricePaisa: input.unitPricePaisa,
          totalPricePaisa,
          receiptPhotoUrl: input.receiptPhotoUrl,
          isCustomerApproved: false, // Customer must approve before billing
        },
      });

      await tx.booking.update({
        where: { id: bookingId },
        data: { currentStatus: 'JOB_EXTENDED' },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromState: booking.currentStatus,
          toState: 'JOB_EXTENDED',
          actorId: actor.id,
          actorRole: 'PROVIDER',
          reason: `Added material item: ${input.itemName} (₹${(totalPricePaisa / 100).toFixed(2)})`,
        },
      });

      return created;
    });

    return material;
  }

  /**
   * Customer approves or rejects requested material
   */
  async approveMaterial(
    bookingId: string,
    materialId: string,
    customer: AuthenticatedUser,
    approved: boolean
  ) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking || booking.customerId !== customer.id) {
      throw new ForbiddenError('Unauthorized to approve materials for this booking.');
    }

    const material = await prisma.bookingMaterial.findFirst({
      where: { id: materialId, bookingId },
    });

    if (!material) {
      throw new NotFoundError('Material item not found');
    }

    const updated = await prisma.$transaction(async (tx) => {
      const mat = await tx.bookingMaterial.update({
        where: { id: materialId },
        data: {
          isCustomerApproved: approved,
          approvedAt: approved ? new Date() : null,
        },
      });

      if (approved) {
        await tx.booking.update({
          where: { id: bookingId },
          data: {
            totalAmountPaisa: {
              increment: material.totalPricePaisa,
            },
          },
        });
      }

      return mat;
    });

    return updated;
  }

  /**
   * Provider submits custom quote for inspection/quotation bookings
   */
  async submitQuote(
    bookingId: string,
    actor: AuthenticatedUser,
    input: SubmitQuoteInput
  ) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { provider: true },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (!booking.provider || booking.provider.userId !== actor.id) {
      throw new ForbiddenError('Only the assigned provider can submit a quotation.');
    }

    const quote = await prisma.bookingQuote.create({
      data: {
        bookingId,
        providerId: booking.provider.id,
        quoteAmountPaisa: input.quoteAmountPaisa || input.totalAmountPaisa || 0,
        subtotalPaisa: input.subtotalPaisa || input.quoteAmountPaisa || input.totalAmountPaisa || 0,
        breakdownNotes: input.breakdownNotes,
        estimatedHours: input.estimatedHours,
      },
    });

    return quote;
  }

  /**
   * Retrieves full booking details with items, materials, and timeline
   */
  async getBookingDetails(bookingId: string, actor: AuthenticatedUser) {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        address: true,
        customer: {
          select: { id: true, fullName: true, phoneNumber: true, avatarUrl: true },
        },
        provider: {
          include: {
            user: {
              select: { fullName: true, phoneNumber: true, avatarUrl: true },
            },
          },
        },
        dispatchOffers: {
          orderBy: { attemptNumber: 'desc' },
        },
        materials: true,
        quotes: true,
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          include: {
            actor: { select: { fullName: true } },
          },
        },
        payment: true,
        review: true,
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const isCustomer = booking.customerId === actor.id;
    const isAssignedProvider = booking.provider?.userId === actor.id;
    const isAdmin = actor.roles.includes('ADMIN') || actor.roles.includes('CITY_MANAGER');

    if (!isCustomer && !isAssignedProvider && !isAdmin) {
      throw new ForbiddenError('Access denied to this booking.');
    }

    // Public sanitized provider info (prevent leaking sensitive KYC, banking, internal overrides)
    let assignedProvider: any = null;
    if (booking.provider) {
      assignedProvider = {
        id: booking.provider.id,
        businessName: booking.provider.businessName,
        fullName: booking.provider.user.fullName,
        avatarUrl: booking.provider.user.avatarUrl,
        ratingAverage: Number(booking.provider.ratingAverage),
        ratingCount: booking.provider.ratingCount,
        experienceYears: booking.provider.experienceYears,
      };
    }

    // Authoritative status timeline
    const timeline = (booking.statusHistory || []).map((h: any) => ({
      id: h.id,
      fromState: h.fromState,
      toState: h.toState,
      actorRole: h.actorRole,
      reason: h.reason,
      createdAt: h.createdAt instanceof Date ? h.createdAt.toISOString() : String(h.createdAt),
    }));

    // Dispatch status summary for customer view
    const activeOffer = (booking.dispatchOffers || []).find(
      (o: any) => o.status === 'OFFERED' && new Date(o.expiresAt) > new Date()
    );
    const dispatchStatus = {
      isSearching: booking.currentStatus === 'REQUESTED' && !booking.providerId,
      attemptNumber: (booking.dispatchOffers || []).length,
      hasActiveOffer: !!activeOffer,
      expiresAt: activeOffer
        ? activeOffer.expiresAt instanceof Date
          ? activeOffer.expiresAt.toISOString()
          : String(activeOffer.expiresAt)
        : null,
      assignedProviderId: booking.providerId || null,
    };

    const sanitizedBooking: any = { ...booking };
    delete sanitizedBooking.startOtpHash;
    if (!isCustomer && !isAdmin) {
      delete sanitizedBooking.startOtp;
      delete sanitizedBooking.completionOtp;
    }

    return {
      ...sanitizedBooking,
      assignedProvider,
      timeline,
      dispatchStatus,
    };
  }

  /**
   * Retrieves customer bookings list
   */
  async getCustomerBookings(customerId: string) {
    return prisma.booking.findMany({
      where: { customerId },
      include: {
        service: true,
        address: true,
        provider: {
          include: {
            user: { select: { fullName: true, phoneNumber: true, avatarUrl: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Retrieves provider bookings list
   */
  async getProviderBookings(providerUserId: string) {
    const provider = await prisma.provider.findUnique({
      where: { userId: providerUserId },
    });

    if (!provider) {
      throw new NotFoundError('Provider profile not found');
    }

    return prisma.booking.findMany({
      where: { providerId: provider.id },
      include: {
        service: true,
        address: true,
        customer: { select: { fullName: true, phoneNumber: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * Triggers manual or automated marketplace dispatch for an unassigned booking
   */
  async triggerDispatch(bookingId: string) {
    return dispatchService.dispatchBooking(bookingId);
  }

  /**
   * Retrieves real-time dispatch status and attempt history for a booking
   */
  async getDispatchStatus(bookingId: string) {
    return dispatchService.getBookingDispatchStatus(bookingId);
  }

  /**
   * Retrieves bookings for current actor with pagination and optional status filter
   */
  async listBookings(
    actor: AuthenticatedUser,
    options: { page?: number; limit?: number; status?: string } = {}
  ) {
    const page = Math.max(1, options.page || 1);
    const limit = Math.min(Math.max(1, options.limit || 20), 50);
    const skip = (page - 1) * limit;

    const where: any = {};

    if (actor.roles.includes('CUSTOMER') && !actor.roles.includes('ADMIN')) {
      where.customerId = actor.id;
    } else if (actor.roles.includes('PROVIDER') && !actor.roles.includes('ADMIN')) {
      const provider = await prisma.provider.findUnique({
        where: { userId: actor.id },
      });
      if (!provider) {
        throw new NotFoundError('Provider profile not found');
      }
      where.providerId = provider.id;
    }

    if (options.status) {
      where.currentStatus = options.status;
    }

    const [items, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          service: true,
          address: true,
        },
      }),
      prisma.booking.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
    };
  }
}

