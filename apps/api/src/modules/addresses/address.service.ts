import { prisma } from '../../config/database.js';
import { CreateAddressInput, UpdateAddressInput } from '@localman/contracts';
import { NotFoundError, ForbiddenError } from '../../common/errors/app-error.js';

export class AddressService {
  /**
   * List all saved addresses for a user
   */
  async listAddresses(userId: string) {
    return prisma.address.findMany({
      where: { userId },
      orderBy: [
        { isDefault: 'desc' },
        { createdAt: 'desc' },
      ],
    });
  }

  /**
   * Get single address with strict user ownership validation
   */
  async getAddress(userId: string, addressId: string) {
    const address = await prisma.address.findUnique({
      where: { id: addressId },
    });

    if (!address) {
      throw new NotFoundError('Address not found');
    }

    if (address.userId !== userId) {
      throw new ForbiddenError('You do not have permission to access this address');
    }

    return address;
  }

  /**
   * Create a new address for a user
   */
  async createAddress(userId: string, input: CreateAddressInput) {
    // If user has no existing addresses, this one automatically becomes default
    const existingCount = await prisma.address.count({
      where: { userId },
    });

    const shouldBeDefault = input.isDefault || existingCount === 0;

    return prisma.$transaction(async (tx) => {
      if (shouldBeDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.create({
        data: {
          userId,
          label: input.label || 'Home',
          addressLine1: input.addressLine1,
          addressLine2: input.addressLine2 || null,
          landmark: input.landmark || null,
          city: input.city,
          state: input.state,
          postalCode: input.postalCode,
          latitude: input.latitude,
          longitude: input.longitude,
          isDefault: shouldBeDefault,
        },
      });
    });
  }

  /**
   * Update an existing address with strict ownership validation
   */
  async updateAddress(userId: string, addressId: string, input: UpdateAddressInput) {
    const address = await this.getAddress(userId, addressId);

    return prisma.$transaction(async (tx) => {
      if (input.isDefault) {
        await tx.address.updateMany({
          where: { userId, isDefault: true },
          data: { isDefault: false },
        });
      }

      return tx.address.update({
        where: { id: address.id },
        data: {
          ...(input.label !== undefined && { label: input.label }),
          ...(input.addressLine1 !== undefined && { addressLine1: input.addressLine1 }),
          ...(input.addressLine2 !== undefined && { addressLine2: input.addressLine2 }),
          ...(input.landmark !== undefined && { landmark: input.landmark }),
          ...(input.city !== undefined && { city: input.city }),
          ...(input.state !== undefined && { state: input.state }),
          ...(input.postalCode !== undefined && { postalCode: input.postalCode }),
          ...(input.latitude !== undefined && { latitude: input.latitude }),
          ...(input.longitude !== undefined && { longitude: input.longitude }),
          ...(input.isDefault !== undefined && { isDefault: input.isDefault }),
        },
      });
    });
  }

  /**
   * Set an address as the default address
   */
  async setDefaultAddress(userId: string, addressId: string) {
    const address = await this.getAddress(userId, addressId);

    return prisma.$transaction(async (tx) => {
      await tx.address.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });

      return tx.address.update({
        where: { id: address.id },
        data: { isDefault: true },
      });
    });
  }

  /**
   * Delete an address with ownership validation and default fallback
   */
  async deleteAddress(userId: string, addressId: string) {
    const address = await this.getAddress(userId, addressId);

    return prisma.$transaction(async (tx) => {
      await tx.address.delete({
        where: { id: address.id },
      });

      // If deleted address was default, promote the newest remaining address if any
      if (address.isDefault) {
        const remaining = await tx.address.findFirst({
          where: { userId },
          orderBy: { createdAt: 'desc' },
        });

        if (remaining) {
          await tx.address.update({
            where: { id: remaining.id },
            data: { isDefault: true },
          });
        }
      }

      return { success: true };
    });
  }
}
