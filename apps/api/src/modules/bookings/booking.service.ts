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
} from '../../common/errors/app-error.js';
import { generateBookingNumber, generateSecureOtp } from '../../common/utils/crypto.js';
import { BookingFSM } from './booking-fsm.js';
import { AuthenticatedUser } from '../../common/middleware/auth.middleware.js';

export class BookingService {
  /**
   * Creates a new service booking in REQUESTED status with start OTP
   */
  async createBooking(customer: AuthenticatedUser, input: CreateBookingInput) {
    const service = await prisma.service.findUnique({
      where: { id: input.serviceId },
    });

    if (!service || !service.isActive) {
      throw new NotFoundError('Selected service is not currently available.');
    }

    const address = await prisma.address.findFirst({
      where: { id: input.addressId, userId: customer.id },
    });

    if (!address) {
      throw new NotFoundError('Selected service address not found on your profile.');
    }

    // Calculate initial pricing
    const baseAmountPaisa = service.basePricePaisa;
    const platformCommissionPercent = Number(service.platformCommissionPercent);
    const platformFeePaisa = Math.round((baseAmountPaisa * platformCommissionPercent) / 100);
    const gstRatePercent = 18.0; // 18% standard Indian GST on service charges
    const taxAmountPaisa = Math.round((baseAmountPaisa * gstRatePercent) / 100);
    const totalAmountPaisa = baseAmountPaisa + taxAmountPaisa;
    const providerEarningPaisa = baseAmountPaisa - platformFeePaisa;

    const startOtp = generateSecureOtp();
    const bookingNumber = generateBookingNumber();

    const booking = await prisma.$transaction(async (tx) => {
      const created = await tx.booking.create({
        data: {
          bookingNumber,
          customerId: customer.id,
          providerId: input.providerId || null,
          serviceId: service.id,
          addressId: address.id,
          currentStatus: 'REQUESTED',
          pricingModel: input.pricingModel as any,
          scheduledDate: new Date(input.scheduledDate),
          scheduledTimeSlot: input.scheduledTimeSlot,
          startOtp,
          baseAmountPaisa,
          taxAmountPaisa,
          platformFeePaisa,
          totalAmountPaisa,
          providerEarningPaisa,
          customerNotes: input.customerNotes,
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

    const updated = await prisma.bookingMaterial.update({
      where: { id: materialId },
      data: {
        isCustomerApproved: approved,
        approvedAt: approved ? new Date() : null,
      },
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
        quoteAmountPaisa: input.quoteAmountPaisa,
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

    return booking;
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
}
