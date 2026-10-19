import { prisma } from '../../config/database.js';
import {
  UpdateProviderProfileInput,
  SubmitKycDocumentInput,
  UpdateLocationBeaconInput,
  SetAvailabilityInput,
  UpdateJobStatusInput,
  RequestPayoutInput,
  QueryLedgerInput,
  QueryDispatchOffersInput,
} from '@localman/contracts';
import { BookingStatus, BookingStatusType } from '@localman/constants';
import { BookingFSM } from '../bookings/booking-fsm.js';
import { NotFoundError, ForbiddenError, ValidationError } from '../../common/errors/app-error.js';
import { financialService } from '../financial/financial.service.js';
import { dispatchService } from '../dispatch/dispatch.service.js';
import { locationService } from '../location/location.service.js';
import { notificationService } from '../notifications/notification.service.js';
import { realtimeService } from '../realtime/realtime.service.js';

export class ProviderService {
  /**
   * Updates provider professional profile & bank account details
   */
  async updateProfile(userId: string, input: UpdateProviderProfileInput) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new NotFoundError('Provider profile not found');
    }

    const updated = await prisma.provider.update({
      where: { id: provider.id },
      data: {
        businessName: input.businessName,
        bio: input.bio,
        experienceYears: input.experienceYears,
        bankAccountHolder: input.bankAccountHolder,
        bankAccountNumberEnc: input.bankAccountNumber
          ? (input.bankAccountNumber.length > 4
              ? `XXXX${input.bankAccountNumber.slice(-4)}`
              : input.bankAccountNumber)
          : undefined,
        bankIfscCode: input.bankIfscCode,
        upiId: input.upiId,
      },
    });

    return updated;
  }

  /**
   * Submits a KYC document (Aadhaar, PAN, License, Trade Certificate)
   * Enforces UIDAI masking for Aadhaar and advances verification status
   */
  async submitKycDocument(userId: string, input: SubmitKycDocumentInput) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new NotFoundError('Provider profile not found');
    }

    let docNumberToStore = input.documentNumber.trim();

    if (
      input.documentType === 'AADHAAR_FRONT' ||
      input.documentType === 'AADHAAR_BACK' ||
      (input.documentType as string).includes('AADHAAR')
    ) {
      const cleanAadhaar = docNumberToStore.replace(/[\s-]/g, '');
      if (!/^\d{12}$/.test(cleanAadhaar)) {
        throw new ValidationError('Aadhaar number must be exactly 12 digits.');
      }
      // UIDAI Compliance: Mask the first 8 digits
      docNumberToStore = `XXXXXXXX${cleanAadhaar.slice(8)}`;
    } else if (input.documentType === 'PAN_CARD') {
      const cleanPan = docNumberToStore.toUpperCase().trim();
      if (!/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/.test(cleanPan)) {
        throw new ValidationError('Invalid PAN format (e.g. ABCDE1234F).');
      }
      docNumberToStore = cleanPan;
    }

    const doc = await prisma.providerDocument.create({
      data: {
        providerId: provider.id,
        documentType: input.documentType as any,
        documentNumber: docNumberToStore,
        fileUrl: input.fileUrl || 'https://storage.localman.in/kyc/default_doc.jpg',
        status: 'PENDING',
      },
    });

    // Advance verificationStatus from DRAFT or REJECTED to SUBMITTED
    if (provider.verificationStatus === 'DRAFT' || provider.verificationStatus === 'REJECTED') {
      await prisma.provider.update({
        where: { id: provider.id },
        data: { verificationStatus: 'SUBMITTED', rejectionReason: null },
      });
    }

    return doc;
  }

  /**
   * Sets weekly availability schedule
   */
  async setAvailability(userId: string, input: SetAvailabilityInput) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new NotFoundError('Provider profile not found');
    }

    await prisma.$transaction(async (tx) => {
      // Clear existing availability
      await tx.providerAvailability.deleteMany({
        where: { providerId: provider.id },
      });

      // Insert new schedule
      for (const slot of input.schedule) {
        await tx.providerAvailability.create({
          data: {
            providerId: provider.id,
            dayOfWeek: slot.dayOfWeek,
            startTime: slot.startTime,
            endTime: slot.endTime,
            isActive: slot.isActive,
          },
        });
      }
    });

    return { message: 'Availability schedule updated successfully' };
  }

  /**
   * Updates live GPS location beacon with freshness, rate-throttling, and sanity validation
   */
  async updateLocation(userId: string, input: UpdateLocationBeaconInput) {
    return locationService.updateProviderLocation(userId, input);
  }

  /**
   * Retrieves provider operational location and freshness status
   */
  async getLocationStatus(userId: string) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
      include: {
        bookings: {
          where: {
            currentStatus: {
              in: ['PROVIDER_ON_THE_WAY', 'ARRIVED', 'JOB_STARTED', 'JOB_EXTENDED'],
            },
          },
        },
      },
    });

    if (!provider) {
      throw new NotFoundError('Provider profile not found');
    }

    const freshnessStatus = locationService.getFreshnessStatus(provider.lastLocationAt);
    const operationalStatus = locationService.getOperationalStatus({
      isOnline: provider.isOnline,
      lastLocationAt: provider.lastLocationAt,
      activeBookingsCount: provider.bookings.length,
    });

    return {
      providerId: provider.id,
      latitude: provider.currentLatitude,
      longitude: provider.currentLongitude,
      accuracy: provider.currentAccuracyMeters,
      heading: provider.currentHeading,
      speed: provider.currentSpeed,
      lastLocationAt: provider.lastLocationAt?.toISOString() ?? null,
      freshnessStatus,
      isOnline: provider.isOnline,
      operationalStatus,
    };
  }

  /**
   * Toggles provider online / offline switch
   */
  async toggleOnline(userId: string, isOnline: boolean) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new NotFoundError('Provider profile not found');
    }

    if (isOnline && provider.verificationStatus !== 'VERIFIED') {
      throw new ValidationError(
        'You cannot go online until your KYC documents are approved and your account is VERIFIED.'
      );
    }

    const updated = await prisma.provider.update({
      where: { id: provider.id },
      data: { isOnline },
    });

    return { isOnline: updated.isOnline };
  }

  /**
   * Retrieves provider dashboard profile with KYC docs and ratings
   */
  async getProfile(userId: string) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
      include: {
        documents: true,
        availability: true,
        services: {
          include: { service: true },
        },
      },
    });

    if (!provider) {
      throw new NotFoundError('Provider profile not found');
    }

    return {
      ...provider,
      ratingAverage: Number(provider.ratingAverage),
    };
  }

  /**
   * Retrieves list of bookings assigned to the authenticated provider (Phase 2A)
   */
  async getProviderBookings(userId: string) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new ForbiddenError('No provider profile associated with this account');
    }

    const bookings = await prisma.booking.findMany({
      where: { providerId: provider.id },
      include: {
        service: true,
        address: true,
        customer: {
          select: { id: true, fullName: true, phoneNumber: true, avatarUrl: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bookings.map((b: any) => {
      const copy = { ...b };
      delete copy.startOtp;
      delete copy.completionOtp;
      return copy;
    });
  }

  /**
   * Retrieves booking detail ensuring strict ownership check (Phase 2A)
   */
  async getProviderBookingDetails(userId: string, bookingId: string, isAdmin: boolean) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider && !isAdmin) {
      throw new ForbiddenError('No provider profile associated with this account');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        service: true,
        address: true,
        customer: {
          select: { id: true, fullName: true, phoneNumber: true, avatarUrl: true },
        },
        materials: true,
        quotes: true,
        statusHistory: {
          orderBy: { createdAt: 'asc' },
          include: {
            actor: { select: { fullName: true } },
          },
        },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Strict ownership verification: cannot view other providers' bookings
    if (provider && booking.providerId !== provider.id && !isAdmin) {
      throw new ForbiddenError('Access denied: You are not assigned to this booking.');
    }

    const sanitized: any = { ...booking };
    if (!isAdmin) {
      delete sanitized.startOtp;
      delete sanitized.completionOtp;
    }

    return sanitized;
  }

  /**
   * Provider accepts an assigned booking request (REQUESTED -> PROVIDER_ACCEPTED)
   */
  async acceptBooking(userId: string, bookingId: string, isAdmin: boolean) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider && !isAdmin) {
      throw new ForbiddenError('No provider profile associated with this account');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const isAssigned = Boolean(provider && booking.providerId === provider.id);
    if (!isAssigned && !isAdmin) {
      throw new ForbiddenError('Access denied: You are not assigned to this booking.');
    }

    // Enforce Booking FSM transition rules
    BookingFSM.validateTransition({
      bookingId: booking.id,
      currentState: booking.currentStatus as BookingStatusType,
      targetState: BookingStatus.PROVIDER_ACCEPTED,
      actorId: userId,
      actorRoles: ['PROVIDER'],
      isCustomer: false,
      isAssignedProvider: isAssigned,
      isAdmin,
    });

    const fromState = booking.currentStatus;

    // Execute state transition atomically with audit history
    const updated = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          currentStatus: BookingStatus.PROVIDER_ACCEPTED,
        },
        include: {
          service: true,
          address: true,
          customer: {
            select: { id: true, fullName: true, phoneNumber: true },
          },
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromState,
          toState: BookingStatus.PROVIDER_ACCEPTED,
          actorId: userId,
          actorRole: 'PROVIDER',
          reason: 'Provider accepted booking request',
        },
      });

      return updatedBooking;
    });

    return updated;
  }

  /**
   * Provider rejects an assigned booking request (REQUESTED -> REJECTED)
   */
  async rejectBooking(userId: string, bookingId: string, isAdmin: boolean, reason?: string) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider && !isAdmin) {
      throw new ForbiddenError('No provider profile associated with this account');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    const isAssigned = Boolean(provider && booking.providerId === provider.id);
    if (!isAssigned && !isAdmin) {
      throw new ForbiddenError('Access denied: You are not assigned to this booking.');
    }

    // Enforce Booking FSM transition rules
    BookingFSM.validateTransition({
      bookingId: booking.id,
      currentState: booking.currentStatus as BookingStatusType,
      targetState: BookingStatus.REJECTED,
      actorId: userId,
      actorRoles: ['PROVIDER'],
      isCustomer: false,
      isAssignedProvider: isAssigned,
      isAdmin,
    });

    const fromState = booking.currentStatus;

    // Execute state transition atomically with audit history
    const updated = await prisma.$transaction(async (tx) => {
      const updatedBooking = await tx.booking.update({
        where: { id: booking.id },
        data: {
          currentStatus: BookingStatus.REJECTED,
        },
        include: {
          service: true,
          address: true,
          customer: {
            select: { id: true, fullName: true, phoneNumber: true },
          },
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromState,
          toState: BookingStatus.REJECTED,
          actorId: userId,
          actorRole: 'PROVIDER',
          reason: reason || 'Provider declined booking request',
        },
      });

      return updatedBooking;
    });

    return updated;
  }

  /**
   * Retrieves provider wallet summary: balances and recent payout ledger entries (Phase 2E)
   * All financial values are authoritative backend figures — no client inputs.
   */
  async getProviderWallet(userId: string) {
    return financialService.getProviderWalletSummary(userId);
  }

  /**
   * Provider requests withdrawal of available balance (Phase 2E)
   */
  async requestPayout(userId: string, input: RequestPayoutInput, idempotencyKey?: string) {
    return financialService.requestPayout(userId, input, idempotencyKey);
  }

  /**
   * Retrieves paginated ledger entries for the provider (Phase 2E)
   */
  async getProviderLedger(userId: string, query?: QueryLedgerInput) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });
    if (!provider) {
      throw new ForbiddenError('No provider profile associated with this account');
    }
    return financialService.getLedgerEntries(provider.id, query);
  }

  /**
   * Provider updates job execution status during live job (Phase 2C)
   * Validates ownership, enforces FSM transitions, verifies customer OTP for JOB_STARTED.
   * Never trusts client-supplied status, actorId, or financial fields.
   */
  async updateJobStatus(
    userId: string,
    bookingId: string,
    input: UpdateJobStatusInput
  ) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new ForbiddenError('No provider profile associated with this account');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    // Strict ownership: provider can only update their own assigned booking
    if (booking.providerId !== provider.id) {
      throw new ForbiddenError('Access denied: You are not assigned to this booking.');
    }

    // Validate that the requested status is a valid job execution transition
    const allowedJobTransitions = new Set([
      BookingStatus.PROVIDER_ON_THE_WAY,
      BookingStatus.ARRIVED,
      BookingStatus.JOB_STARTED,
      BookingStatus.JOB_COMPLETED,
    ] as string[]);

    if (!allowedJobTransitions.has(input.status)) {
      throw new ValidationError(
        `Status '${input.status}' cannot be set via job execution update. Use the appropriate provider endpoint.`
      );
    }

    // Run FSM validation (includes OTP enforcement for JOB_STARTED)
    BookingFSM.validateTransition({
      bookingId: booking.id,
      currentState: booking.currentStatus as BookingStatusType,
      targetState: input.status as BookingStatusType,
      actorId: userId,
      actorRoles: ['PROVIDER'],
      isCustomer: false,
      isAssignedProvider: true,
      isAdmin: false,
      startOtpExpected: booking.startOtp,
      startOtpSubmitted: input.startOtp,
    });

    const fromState = booking.currentStatus;
    const updateData: Record<string, unknown> = {
      currentStatus: input.status,
    };

    if (input.status === BookingStatus.JOB_STARTED) {
      updateData.startedAt = new Date();
    }

    if (input.status === BookingStatus.JOB_COMPLETED) {
      const completedAt = new Date();
      updateData.completedAt = completedAt;
      if (booking.startedAt) {
        const durationMs = completedAt.getTime() - new Date(booking.startedAt).getTime();
        updateData.durationMinutes = Math.max(1, Math.round(durationMs / 60000));
      }
      // Server-side: automatically advance to PAYMENT_PENDING
      updateData.currentStatus = BookingStatus.PAYMENT_PENDING;
    }

    const toState = updateData.currentStatus as string;

    const updatedBooking = await prisma.$transaction(async (tx) => {
      const updated = await tx.booking.update({
        where: { id: bookingId },
        data: updateData,
        include: {
          service: true,
          address: true,
          customer: {
            select: { id: true, fullName: true, phoneNumber: true },
          },
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromState: fromState as any,
          toState: toState as any,
          actorId: userId,
          actorRole: 'PROVIDER',
          reason: input.reason || null,
        },
      });

      return updated;
    });

    return updatedBooking;
  }

  /**
   * Phase 3E: Provider starts travel to customer service location (POST /on-the-way)
   * Idempotent if already PROVIDER_ON_THE_WAY.
   */
  async startTravel(userId: string, bookingId: string, reason?: string) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });
    if (!provider) {
      throw new ForbiddenError('No provider profile associated with this account');
    }
    if (provider.verificationStatus !== 'VERIFIED') {
      throw new ForbiddenError('Provider must be KYC verified to perform operational job actions.');
    }
    if ((provider as any).status === 'SUSPENDED' || (provider as any).status === 'INACTIVE') {
      throw new ForbiddenError('Provider account must be active.');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    if (booking.providerId !== provider.id) {
      throw new ForbiddenError('Access denied: You are not assigned to this booking.');
    }

    // Idempotent: safe return if already in desired state
    if (booking.currentStatus === BookingStatus.PROVIDER_ON_THE_WAY) {
      const sanitized: any = { ...booking };
      delete sanitized.startOtp;
      delete sanitized.completionOtp;
      return sanitized;
    }

    BookingFSM.validateTransition({
      bookingId: booking.id,
      currentState: booking.currentStatus as BookingStatusType,
      targetState: BookingStatus.PROVIDER_ON_THE_WAY,
      actorId: userId,
      actorRoles: ['PROVIDER'],
      isCustomer: false,
      isAssignedProvider: true,
      isAdmin: false,
    });

    const fromState = booking.currentStatus;
    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: bookingId },
        data: { currentStatus: BookingStatus.PROVIDER_ON_THE_WAY },
        include: {
          service: true,
          address: true,
          customer: { select: { id: true, fullName: true, phoneNumber: true } },
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromState: fromState as any,
          toState: BookingStatus.PROVIDER_ON_THE_WAY,
          actorId: userId,
          actorRole: 'PROVIDER',
          reason: reason || 'Provider started travel to customer location',
        },
      });

      return b;
    });

    realtimeService.emitToBooking(booking.id, 'JOB_STATUS_CHANGED', {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      status: BookingStatus.PROVIDER_ON_THE_WAY,
      timestamp: new Date().toISOString(),
    });

    await notificationService.notifyCustomerProviderOnTheWay(
      booking.customerId,
      booking.bookingNumber,
      provider.businessName || 'Service Partner'
    );

    const sanitized: any = { ...updated };
    delete sanitized.startOtp;
    delete sanitized.completionOtp;
    return sanitized;
  }

  /**
   * Phase 3E: Provider marks arrival at service location (POST /arrived)
   * Idempotent if already ARRIVED.
   */
  async markArrived(userId: string, bookingId: string, reason?: string) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });
    if (!provider) {
      throw new ForbiddenError('No provider profile associated with this account');
    }
    if (provider.verificationStatus !== 'VERIFIED') {
      throw new ForbiddenError('Provider must be KYC verified to perform operational job actions.');
    }
    if ((provider as any).status === 'SUSPENDED' || (provider as any).status === 'INACTIVE') {
      throw new ForbiddenError('Provider account must be active.');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    if (booking.providerId !== provider.id) {
      throw new ForbiddenError('Access denied: You are not assigned to this booking.');
    }

    // Idempotent: safe return if already in desired state
    if (booking.currentStatus === BookingStatus.ARRIVED) {
      const sanitized: any = { ...booking };
      delete sanitized.startOtp;
      delete sanitized.completionOtp;
      return sanitized;
    }

    BookingFSM.validateTransition({
      bookingId: booking.id,
      currentState: booking.currentStatus as BookingStatusType,
      targetState: BookingStatus.ARRIVED,
      actorId: userId,
      actorRoles: ['PROVIDER'],
      isCustomer: false,
      isAssignedProvider: true,
      isAdmin: false,
    });

    const fromState = booking.currentStatus;
    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: bookingId },
        data: { currentStatus: BookingStatus.ARRIVED },
        include: {
          service: true,
          address: true,
          customer: { select: { id: true, fullName: true, phoneNumber: true } },
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromState: fromState as any,
          toState: BookingStatus.ARRIVED,
          actorId: userId,
          actorRole: 'PROVIDER',
          reason: reason || 'Provider arrived at service location',
        },
      });

      return b;
    });

    realtimeService.emitToBooking(booking.id, 'JOB_STATUS_CHANGED', {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      status: BookingStatus.ARRIVED,
      timestamp: new Date().toISOString(),
    });

    await notificationService.notifyCustomerProviderArrived(
      booking.customerId,
      booking.bookingNumber,
      provider.businessName || 'Service Partner'
    );

    const sanitized: any = { ...updated };
    delete sanitized.startOtp;
    delete sanitized.completionOtp;
    return sanitized;
  }

  /**
   * Phase 3E: Provider verifies start OTP and begins job execution (POST /start)
   * Atomic OTP verification and state progression to JOB_STARTED.
   */
  async startJob(userId: string, bookingId: string, input: { startOtp: string }) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });
    if (!provider) {
      throw new ForbiddenError('No provider profile associated with this account');
    }
    if (provider.verificationStatus !== 'VERIFIED') {
      throw new ForbiddenError('Provider must be KYC verified to perform operational job actions.');
    }
    if ((provider as any).status === 'SUSPENDED' || (provider as any).status === 'INACTIVE') {
      throw new ForbiddenError('Provider account must be active.');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    if (booking.providerId !== provider.id) {
      throw new ForbiddenError('Access denied: You are not assigned to this booking.');
    }

    // Must be in ARRIVED state. Replaying start on already started/completed bookings is forbidden.
    BookingFSM.validateTransition({
      bookingId: booking.id,
      currentState: booking.currentStatus as BookingStatusType,
      targetState: BookingStatus.JOB_STARTED,
      actorId: userId,
      actorRoles: ['PROVIDER'],
      isCustomer: false,
      isAssignedProvider: true,
      isAdmin: false,
      startOtpExpected: booking.startOtp,
      startOtpSubmitted: input.startOtp,
      createdAt: booking.createdAt,
    });

    const fromState = booking.currentStatus;
    const startedAt = new Date();

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: bookingId },
        data: {
          currentStatus: BookingStatus.JOB_STARTED,
          startedAt,
        },
        include: {
          service: true,
          address: true,
          customer: { select: { id: true, fullName: true, phoneNumber: true } },
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromState: fromState as any,
          toState: BookingStatus.JOB_STARTED,
          actorId: userId,
          actorRole: 'PROVIDER',
          reason: 'Customer Start OTP verified. Job started.',
        },
      });

      return b;
    });

    realtimeService.emitToBooking(booking.id, 'JOB_STATUS_CHANGED', {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      status: BookingStatus.JOB_STARTED,
      timestamp: new Date().toISOString(),
    });

    await notificationService.notifyCustomerJobStarted(
      booking.customerId,
      booking.bookingNumber,
      provider.businessName || 'Service Partner'
    );

    const sanitized: any = { ...updated };
    delete sanitized.startOtp;
    delete sanitized.completionOtp;
    return sanitized;
  }

  /**
   * Phase 3E: Provider marks work completed (POST /complete)
   * Idempotent if already JOB_COMPLETED.
   */
  async completeJob(userId: string, bookingId: string, reason?: string) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });
    if (!provider) {
      throw new ForbiddenError('No provider profile associated with this account');
    }
    if (provider.verificationStatus !== 'VERIFIED') {
      throw new ForbiddenError('Provider must be KYC verified to perform operational job actions.');
    }
    if ((provider as any).status === 'SUSPENDED' || (provider as any).status === 'INACTIVE') {
      throw new ForbiddenError('Provider account must be active.');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { materials: true },
    });
    if (!booking) {
      throw new NotFoundError('Booking not found');
    }
    if (booking.providerId !== provider.id) {
      throw new ForbiddenError('Access denied: You are not assigned to this booking.');
    }

    // Idempotent: safe return if already completed
    if (booking.currentStatus === BookingStatus.JOB_COMPLETED) {
      const sanitized: any = { ...booking };
      delete sanitized.startOtp;
      delete sanitized.completionOtp;
      return sanitized;
    }

    // Must be in JOB_STARTED or JOB_EXTENDED
    BookingFSM.validateTransition({
      bookingId: booking.id,
      currentState: booking.currentStatus as BookingStatusType,
      targetState: BookingStatus.JOB_COMPLETED,
      actorId: userId,
      actorRoles: ['PROVIDER'],
      isCustomer: false,
      isAssignedProvider: true,
      isAdmin: false,
    });

    const fromState = booking.currentStatus;
    const completedAt = new Date();
    let durationMinutes = 0;
    if (booking.startedAt) {
      const durationMs = completedAt.getTime() - new Date(booking.startedAt).getTime();
      durationMinutes = Math.max(1, Math.round(durationMs / 60000));
    }

    const approvedMaterialsPaisa = (booking.materials || [])
      .filter((m: any) => m.isCustomerApproved)
      .reduce((sum: number, m: any) => sum + m.totalPricePaisa, 0);

    const totalAmountPaisa =
      booking.baseAmountPaisa +
      booking.extraDurationAmountPaisa +
      approvedMaterialsPaisa +
      booking.taxAmountPaisa;

    const updated = await prisma.$transaction(async (tx) => {
      const b = await tx.booking.update({
        where: { id: bookingId },
        data: {
          currentStatus: BookingStatus.JOB_COMPLETED,
          completedAt,
          durationMinutes,
          materialsTotalPaisa: approvedMaterialsPaisa,
          totalAmountPaisa,
        },
        include: {
          service: true,
          address: true,
          customer: { select: { id: true, fullName: true, phoneNumber: true } },
        },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromState: fromState as any,
          toState: BookingStatus.JOB_COMPLETED,
          actorId: userId,
          actorRole: 'PROVIDER',
          reason: reason || 'Provider completed job execution',
        },
      });

      return b;
    });

    realtimeService.emitToBooking(booking.id, 'JOB_STATUS_CHANGED', {
      bookingId: booking.id,
      bookingNumber: booking.bookingNumber,
      status: BookingStatus.JOB_COMPLETED,
      timestamp: new Date().toISOString(),
    });

    await notificationService.notifyCustomerJobCompleted(
      booking.customerId,
      booking.bookingNumber,
      provider.businessName || 'Service Partner'
    );

    const sanitized: any = { ...updated };
    delete sanitized.startOtp;
    delete sanitized.completionOtp;
    return sanitized;
  }

  /**
   * Adds extra material/spare part to active booking (Phase 2D)
   * IDOR protected: Only the assigned provider can add materials.
   * State guarded: Only allowed in JOB_STARTED or JOB_EXTENDED.
   */
  async addMaterial(
    userId: string,
    bookingId: string,
    input: { itemName: string; quantity: number; unitPricePaisa: number; receiptPhotoUrl?: string }
  ) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new ForbiddenError('No provider profile associated with this account');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found');
    }

    if (booking.providerId !== provider.id) {
      throw new ForbiddenError('Only the assigned professional can add materials.');
    }

    if (
      booking.currentStatus !== BookingStatus.JOB_STARTED &&
      booking.currentStatus !== BookingStatus.JOB_EXTENDED
    ) {
      throw new ValidationError('Materials can only be added while the job is actively in progress.');
    }

    const quantity = Math.max(1, input.quantity || 1);
    const totalPricePaisa = Math.round(quantity * input.unitPricePaisa);

    const material = await prisma.$transaction(async (tx) => {
      const created = await tx.bookingMaterial.create({
        data: {
          bookingId,
          itemName: input.itemName,
          quantity,
          unitPricePaisa: input.unitPricePaisa,
          totalPricePaisa,
          receiptPhotoUrl: input.receiptPhotoUrl,
          isCustomerApproved: false,
        },
      });

      await tx.booking.update({
        where: { id: bookingId },
        data: { currentStatus: BookingStatus.JOB_EXTENDED },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId,
          fromState: booking.currentStatus as any,
          toState: BookingStatus.JOB_EXTENDED,
          actorId: userId,
          actorRole: 'PROVIDER',
          reason: `Added material item: ${input.itemName} (₹${(totalPricePaisa / 100).toFixed(2)})`,
        },
      });

      return created;
    });

    return material;
  }

  /**
   * Fetches active pending dispatch offer for provider
   */
  async getActiveDispatchOffer(userId: string) {
    return dispatchService.getActiveOfferForProvider(userId);
  }

  /**
   * Fetches paginated dispatch offers for provider
   */
  async getDispatchOffers(userId: string, query: QueryDispatchOffersInput) {
    return dispatchService.getOffersForProvider(
      userId,
      query.status,
      query.limit,
      query.offset
    );
  }

  /**
   * Provider accepts a real-time dispatch offer
   */
  async acceptDispatchOffer(userId: string, offerId: string) {
    return dispatchService.acceptOffer(userId, offerId);
  }

  /**
   * Provider rejects a real-time dispatch offer
   */
  async rejectDispatchOffer(userId: string, offerId: string, reason?: string) {
    return dispatchService.rejectOffer(userId, offerId, reason);
  }
}

