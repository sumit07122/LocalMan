import { prisma } from '../../config/database.js';
import {
  ReviewKycDocumentInput,
  UpdatePayoutStatusInput,
  AdminManualAdjustmentInput,
  QueryLedgerInput,
} from '@localman/contracts';
import { NotFoundError } from '../../common/errors/app-error.js';
import { financialService } from '../financial/financial.service.js';
import { monitoringService } from '../monitoring/monitoring.service.js';

export class AdminService {
  /**
   * Retrieves high-level operational metrics for admin dashboard
   */
  async getDashboardMetrics() {
    const [
      totalBookings,
      activeBookings,
      completedBookings,
      totalCustomers,
      totalProviders,
      pendingKycReviews,
      totalRevenueResult,
    ] = await Promise.all([
      prisma.booking.count(),
      prisma.booking.count({
        where: {
          currentStatus: {
            in: [
              'REQUESTED',
              'PROVIDER_ACCEPTED',
              'CONFIRMED',
              'PROVIDER_ON_THE_WAY',
              'ARRIVED',
              'JOB_STARTED',
              'JOB_EXTENDED',
            ],
          },
        },
      }),
      prisma.booking.count({ where: { currentStatus: 'PAYMENT_SETTLED' } }),
      prisma.user.count({ where: { userRoles: { some: { roleId: 'CUSTOMER' } } } }),
      prisma.provider.count({ where: { verificationStatus: 'VERIFIED' } }),
      prisma.providerDocument.count({ where: { status: 'PENDING' } }),
      prisma.payment.aggregate({
        _sum: { amountPaisa: true },
        where: { status: 'CAPTURED' },
      }),
    ]);

    return {
      totalBookings,
      activeBookings,
      completedBookings,
      totalCustomers,
      totalProviders,
      pendingKycReviews,
      totalRevenuePaisa: totalRevenueResult._sum.amountPaisa || 0,
      totalRevenueInr: ((totalRevenueResult._sum.amountPaisa || 0) / 100).toFixed(2),
      systemHealth: monitoringService.getHealthSummary(),
    };
  }

  /**
   * Retrieves pending KYC documents for review
   */
  async getPendingKycDocuments() {
    const docs = await prisma.providerDocument.findMany({
      where: { status: 'PENDING' },
      include: {
        provider: {
          include: {
            user: { select: { fullName: true, phoneNumber: true, email: true } },
          },
        },
      },
      orderBy: { createdAt: 'asc' },
    });

    // DPDPA & Aadhaar Act Compliance: Return masked document number for dashboard operations
    return docs.map((doc) => ({
      ...doc,
      documentNumber: doc.maskedDocumentNumber || doc.documentNumber,
    }));
  }

  /**
   * Reviews and approves or rejects a provider KYC document
   */
  async reviewKycDocument(adminUserId: string, input: ReviewKycDocumentInput) {
    const document = await prisma.providerDocument.findUnique({
      where: { id: input.documentId },
      include: { provider: true },
    });

    if (!document) {
      throw new NotFoundError('KYC document not found');
    }

    const updatedDoc = await prisma.$transaction(async (tx) => {
      const doc = await tx.providerDocument.update({
        where: { id: input.documentId },
        data: {
          status: input.status as any,
          reviewNotes: input.reviewNotes,
          reviewedBy: adminUserId,
          reviewedAt: new Date(),
        },
      });

      // If document was rejected, set provider status to REJECTED
      if (input.status === 'REJECTED') {
        await tx.provider.update({
          where: { id: document.providerId },
          data: {
            verificationStatus: 'REJECTED',
            rejectionReason: input.reviewNotes,
          },
        });
      } else {
        // Check if provider has approved Aadhaar + PAN
        const allDocs = await tx.providerDocument.findMany({
          where: { providerId: document.providerId },
        });

        const hasApprovedAadhaar = allDocs.some(
          (d) =>
            (d.documentType === 'AADHAAR_FRONT' || d.documentType === 'AADHAAR_BACK') &&
            d.status === 'APPROVED'
        );
        const hasApprovedPan = allDocs.some(
          (d) => d.documentType === 'PAN_CARD' && d.status === 'APPROVED'
        );

        if (hasApprovedAadhaar && hasApprovedPan) {
          await tx.provider.update({
            where: { id: document.providerId },
            data: {
              verificationStatus: 'VERIFIED',
              verifiedAt: new Date(),
              verifiedBy: adminUserId,
            },
          });
        }
      }

      // Log to Audit Log
      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: `KYC_DOCUMENT_${input.status}`,
          resourceType: 'provider_document',
          resourceId: document.id,
          newState: {
            providerId: document.providerId,
            documentType: document.documentType,
            status: input.status,
            notes: input.reviewNotes,
          },
        },
      });

      return doc;
    });

    return updatedDoc;
  }

  /**
   * Retrieves audit logs
   */
  async getAuditLogs(page = 1, limit = 50) {
    const skip = (page - 1) * limit;
    const [logs, total] = await Promise.all([
      prisma.auditLog.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { fullName: true, phoneNumber: true } },
        },
      }),
      prisma.auditLog.count(),
    ]);

    return { logs, total, page, limit };
  }

  /**
   * Admin inspects provider wallet (Phase 2E)
   */
  async getProviderWallet(providerId: string) {
    return financialService.getProviderWalletSummary(providerId);
  }

  /**
   * Admin queries platform-wide financial ledger (Phase 2E)
   */
  async getFinancialLedger(query?: QueryLedgerInput) {
    return financialService.getLedgerEntries(undefined, query);
  }

  /**
   * Admin lists platform payouts with optional status filter (Phase 2E)
   */
  async getPayouts(status?: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const where = status ? { status } : {};
    const [payouts, total] = await Promise.all([
      prisma.providerPayout.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          provider: {
            select: { id: true, businessName: true, user: { select: { fullName: true, phoneNumber: true } } },
          },
          booking: {
            select: { id: true, bookingNumber: true, totalAmountPaisa: true },
          },
        },
      }),
      prisma.providerPayout.count({ where }),
    ]);

    return { payouts, total, page, limit };
  }

  /**
   * Admin updates payout status (PAID or FAILED) (Phase 2E)
   */
  async updatePayoutStatus(adminUserId: string, payoutId: string, input: UpdatePayoutStatusInput) {
    return financialService.updatePayoutStatus(payoutId, input, adminUserId);
  }

  /**
   * Admin executes audited manual balance adjustment (Phase 2E)
   */
  async adminManualAdjustment(adminUserId: string, input: AdminManualAdjustmentInput) {
    return financialService.adminManualAdjustment(adminUserId, input);
  }
}
