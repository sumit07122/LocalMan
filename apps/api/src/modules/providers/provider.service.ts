import { prisma } from '../../config/database.js';
import {
  UpdateProviderProfileInput,
  SubmitKycDocumentInput,
  UpdateLocationBeaconInput,
  SetAvailabilityInput,
} from '@localman/contracts';
import { NotFoundError, ValidationError } from '../../common/errors/app-error.js';

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
        bankAccountNumberEnc: input.bankAccountNumber,
        bankIfscCode: input.bankIfscCode,
        upiId: input.upiId,
      },
    });

    return updated;
  }

  /**
   * Submits a KYC document (Aadhaar, PAN, License, Trade Certificate)
   */
  async submitKycDocument(userId: string, input: SubmitKycDocumentInput) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new NotFoundError('Provider profile not found');
    }

    const doc = await prisma.providerDocument.create({
      data: {
        providerId: provider.id,
        documentType: input.documentType as any,
        documentNumber: input.documentNumber,
        fileUrl: input.fileUrl,
        status: 'PENDING',
      },
    });

    // If status was DRAFT, advance it to SUBMITTED
    if (provider.verificationStatus === 'DRAFT') {
      await prisma.provider.update({
        where: { id: provider.id },
        data: { verificationStatus: 'SUBMITTED' },
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
   * Updates live GPS location beacon and toggle online status
   */
  async updateLocation(userId: string, input: UpdateLocationBeaconInput) {
    const provider = await prisma.provider.findUnique({
      where: { userId },
    });

    if (!provider) {
      throw new NotFoundError('Provider profile not found');
    }

    const updated = await prisma.provider.update({
      where: { id: provider.id },
      data: {
        currentLatitude: input.latitude,
        currentLongitude: input.longitude,
      },
    });

    return {
      latitude: updated.currentLatitude,
      longitude: updated.currentLongitude,
      isOnline: updated.isOnline,
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
}
