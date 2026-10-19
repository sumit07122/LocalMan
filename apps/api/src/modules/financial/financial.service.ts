import { prisma } from '../../config/database.js';
import {
  NotFoundError,
  ValidationError,
  ForbiddenError,
  ConflictError,
} from '../../common/errors/app-error.js';
import {
  RequestPayoutInput,
  AdminManualAdjustmentInput,
  UpdatePayoutStatusInput,
  QueryLedgerInput,
} from '@localman/contracts';

export interface CalculatedFinancials {
  grossAmountPaisa: number;
  platformCommissionRate: number;
  platformFeePaisa: number;
  tdsRate: number;
  tdsDeductionPaisa: number;
  providerNetEarningPaisa: number;
}

export class FinancialService {
  /**
   * Authoritative platform commission baseline rate (15.00%)
   */
  public static readonly DEFAULT_COMMISSION_PERCENT = 15.0;

  /**
   * Statutory TDS deduction rate under Section 194O of Indian Income Tax Act (1.00%)
   */
  public static readonly STATUTORY_TDS_PERCENT = 1.0;

  /**
   * Minimum allowable payout withdrawal in paisa (₹100 = 10,000 paisa)
   */
  public static readonly MINIMUM_PAYOUT_PAISA = 10000;

  /**
   * Calculates authoritative financial breakdown for a booking
   */
  static calculateFinancials(params: {
    grossAmountPaisa: number;
    commissionPercentOverride?: number;
    platformFeePaisaPreset?: number;
    tdsPercentOverride?: number;
  }): CalculatedFinancials {
    const grossAmountPaisa = Math.max(0, Math.round(params.grossAmountPaisa));
    const platformCommissionRate =
      params.commissionPercentOverride !== undefined
        ? params.commissionPercentOverride
        : FinancialService.DEFAULT_COMMISSION_PERCENT;

    // Use preset fee if explicitly configured, else compute from commission rate
    const platformFeePaisa =
      params.platformFeePaisaPreset !== undefined
        ? params.platformFeePaisaPreset
        : Math.round((grossAmountPaisa * platformCommissionRate) / 100);

    const tdsRate =
      params.tdsPercentOverride !== undefined
        ? params.tdsPercentOverride
        : FinancialService.STATUTORY_TDS_PERCENT;

    const tdsDeductionPaisa = Math.round((grossAmountPaisa * tdsRate) / 100);
    const providerNetEarningPaisa = Math.max(
      0,
      grossAmountPaisa - platformFeePaisa - tdsDeductionPaisa
    );

    return {
      grossAmountPaisa,
      platformCommissionRate,
      platformFeePaisa,
      tdsRate,
      tdsDeductionPaisa,
      providerNetEarningPaisa,
    };
  }

  /**
   * Retrieves or atomically initializes a provider wallet record
   */
  async getOrCreateWallet(providerId: string, clientTx?: any) {
    const db = clientTx || prisma;
    let wallet = await db.providerWallet.findUnique({
      where: { providerId },
    });

    if (!wallet) {
      wallet = await db.providerWallet.create({
        data: {
          providerId,
          availableBalancePaisa: 0,
          pendingBalancePaisa: 0,
          paidOutBalancePaisa: 0,
          currency: 'INR',
        },
      });
    }

    return wallet;
  }

  /**
   * Settles payment authoritatively: credits provider wallet and appends immutable ledger entry
   */
  async settleBookingPayment(
    paymentId: string,
    gatewayPaymentId: string,
    payload?: any
  ) {
    const payment = await prisma.payment.findUnique({
      where: { id: paymentId },
      include: {
        booking: {
          include: {
            provider: true,
            service: true,
          },
        },
      },
    });

    if (!payment) {
      throw new NotFoundError('Payment record not found');
    }

    if (payment.status === 'CAPTURED') {
      return { message: 'Payment already settled', payment };
    }

    const booking = payment.booking;
    if (!booking) {
      throw new NotFoundError('Associated booking record not found');
    }

    return prisma.$transaction(async (tx) => {
      // Re-fetch inside transaction to ensure concurrency safety
      const freshPay = await tx.payment.findUnique({
        where: { id: paymentId },
      });
      if (freshPay && freshPay.status === 'CAPTURED') {
        return freshPay;
      }

      // Check if ledger entry already exists (idempotency guard)
      if (booking.providerId) {
        const existingLedger = await tx.walletLedgerEntry.findFirst({
          where: {
            idempotencyKey: `ledger_settle_${booking.id}_${payment.id}`,
          },
        });
        if (existingLedger) {
          return freshPay || payment;
        }
      }

      // 1. Mark Payment as CAPTURED
      const capturedPayment = await tx.payment.update({
        where: { id: paymentId },
        data: {
          status: 'CAPTURED',
          gatewayPaymentId,
        },
      });

      // 2. Record Payment Transaction
      await tx.paymentTransaction.create({
        data: {
          paymentId,
          transactionType: 'CHARGE',
          gatewayPayload: payload || {},
          status: 'SUCCESS',
        },
      });

      // 3. Advance Booking Status to PAYMENT_SETTLED
      await tx.booking.update({
        where: { id: booking.id },
        data: { currentStatus: 'PAYMENT_SETTLED' },
      });

      await tx.bookingStatusHistory.create({
        data: {
          bookingId: booking.id,
          fromState: booking.currentStatus,
          toState: 'PAYMENT_SETTLED',
          actorId: booking.customerId,
          actorRole: 'SYSTEM',
          reason: `Payment captured via ${payment.gateway} (Ref: ${gatewayPaymentId})`,
        },
      });

      // 4. Perform Financial Calculation and Wallet Credit if Provider is assigned
      if (booking.providerId) {
        const providerId = booking.providerId;

        // Determine commission rate: provider override > service catalog rate > default 15%
        let commissionRate = FinancialService.DEFAULT_COMMISSION_PERCENT;
        if (booking.provider?.commissionRateOverride !== null && booking.provider?.commissionRateOverride !== undefined) {
          commissionRate = Number(booking.provider.commissionRateOverride);
        } else if (booking.service?.platformCommissionPercent !== null && booking.service?.platformCommissionPercent !== undefined) {
          commissionRate = Number(booking.service.platformCommissionPercent);
        }

        const financials = FinancialService.calculateFinancials({
          grossAmountPaisa: booking.totalAmountPaisa,
          commissionPercentOverride: commissionRate,
          platformFeePaisaPreset: booking.platformFeePaisa > 0 ? booking.platformFeePaisa : undefined,
        });

        // Ensure wallet exists
        const wallet = await this.getOrCreateWallet(providerId, tx);

        // Atomically increment wallet available balance
        const updatedWallet = await tx.providerWallet.update({
          where: { id: wallet.id },
          data: {
            availableBalancePaisa: {
              increment: financials.providerNetEarningPaisa,
            },
          },
        });

        // Create authoritative ProviderPayout record with actual applied rates
        const payout = await tx.providerPayout.create({
          data: {
            providerId,
            bookingId: booking.id,
            grossAmountPaisa: financials.grossAmountPaisa,
            platformDeductionPaisa: financials.platformFeePaisa,
            tdsDeductionPaisa: financials.tdsDeductionPaisa,
            netPayoutPaisa: financials.providerNetEarningPaisa,
            appliedCommissionRate: financials.platformCommissionRate,
            appliedTdsRate: financials.tdsRate,
            payoutMode: 'BANK_TRANSFER',
            status: 'PENDING',
            idempotencyKey: `payout_settle_${booking.id}_${payment.id}`,
          },
        });

        // Record immutable WalletLedgerEntry for the net earning
        await tx.walletLedgerEntry.create({
          data: {
            walletId: wallet.id,
            providerId,
            bookingId: booking.id,
            payoutId: payout.id,
            entryType: 'PROVIDER_NET_EARNING',
            direction: 'CREDIT',
            amountPaisa: financials.providerNetEarningPaisa,
            currency: 'INR',
            resultingAvailablePaisa: updatedWallet.availableBalancePaisa,
            resultingPendingPaisa: updatedWallet.pendingBalancePaisa,
            idempotencyKey: `ledger_settle_${booking.id}_${payment.id}`,
            sourceReferenceId: gatewayPaymentId,
            description: `Net earnings from booking ${booking.bookingNumber} after ${financials.platformCommissionRate}% commission and 1% TDS`,
            metadata: {
              grossAmountPaisa: financials.grossAmountPaisa,
              platformFeePaisa: financials.platformFeePaisa,
              tdsDeductionPaisa: financials.tdsDeductionPaisa,
              appliedCommissionRate: financials.platformCommissionRate,
              appliedTdsRate: financials.tdsRate,
            },
          },
        });
      }

      return capturedPayment;
    });
  }

  /**
   * Adjusts provider wallet and records debit ledger entry when a booking refund is processed
   */
  async processRefundAdjustment(
    bookingId: string,
    refundAmountPaisa: number,
    reason: string,
    adminUserId?: string,
    clientTx?: any
  ) {
    const db = clientTx || prisma;

    const booking = await db.booking.findUnique({
      where: { id: bookingId },
      include: {
        provider: true,
        payouts: true,
      },
    });

    if (!booking || !booking.providerId) {
      return null; // No provider assigned or credited
    }

    const providerId = booking.providerId;

    // Check if provider was previously credited for this booking
    const creditEntry = await db.walletLedgerEntry.findFirst({
      where: {
        bookingId,
        entryType: 'PROVIDER_NET_EARNING',
        direction: 'CREDIT',
      },
    });

    if (!creditEntry) {
      return null; // Provider was never credited for this booking
    }

    // Calculate provider debit share: proportional to refund percentage of total
    let debitPaisa = creditEntry.amountPaisa;
    if (booking.totalAmountPaisa > 0 && refundAmountPaisa < booking.totalAmountPaisa) {
      const refundRatio = refundAmountPaisa / booking.totalAmountPaisa;
      debitPaisa = Math.min(creditEntry.amountPaisa, Math.round(creditEntry.amountPaisa * refundRatio));
    }

    if (debitPaisa <= 0) {
      return null;
    }

    // Atomically decrement provider wallet
    const wallet = await this.getOrCreateWallet(providerId, db);
    const updatedWallet = await db.providerWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalancePaisa: {
          decrement: debitPaisa,
        },
      },
    });

    // Handle associated pending payout if exists
    const pendingPayout = await db.providerPayout.findFirst({
      where: {
        bookingId,
        status: 'PENDING',
      },
    });

    if (pendingPayout) {
      if (debitPaisa >= pendingPayout.netPayoutPaisa) {
        await db.providerPayout.update({
          where: { id: pendingPayout.id },
          data: {
            status: 'CANCELLED',
            failureReason: `Cancelled due to booking refund (${reason})`,
          },
        });
      } else {
        await db.providerPayout.update({
          where: { id: pendingPayout.id },
          data: {
            netPayoutPaisa: {
              decrement: debitPaisa,
            },
          },
        });
      }
    }

    // Append immutable WalletLedgerEntry
    const ledgerEntry = await db.walletLedgerEntry.create({
      data: {
        walletId: wallet.id,
        providerId,
        bookingId,
        payoutId: pendingPayout?.id || null,
        entryType: 'REFUND',
        direction: 'DEBIT',
        amountPaisa: debitPaisa,
        currency: 'INR',
        resultingAvailablePaisa: updatedWallet.availableBalancePaisa,
        resultingPendingPaisa: updatedWallet.pendingBalancePaisa,
        idempotencyKey: `ledger_refund_${booking.id}_${Date.now()}`,
        description: `Refund adjustment for booking ${booking.bookingNumber}: -₹${(debitPaisa / 100).toFixed(2)} (${reason})`,
        metadata: {
          refundAmountPaisa,
          debitPaisa,
          reason,
          adminUserId: adminUserId || null,
        },
      },
    });

    return {
      wallet: updatedWallet,
      ledgerEntry,
      debitPaisa,
    };
  }

  /**
   * Credits provider wallet for cancellation or no-show compensation
   */
  async creditProviderCompensation(
    providerId: string,
    bookingId: string,
    compensationPaisa: number,
    reason: string,
    clientTx?: any
  ) {
    if (compensationPaisa <= 0) return null;
    const db = clientTx || prisma;

    const wallet = await this.getOrCreateWallet(providerId, db);
    const updatedWallet = await db.providerWallet.update({
      where: { id: wallet.id },
      data: {
        availableBalancePaisa: {
          increment: compensationPaisa,
        },
      },
    });

    const ledgerEntry = await db.walletLedgerEntry.create({
      data: {
        walletId: wallet.id,
        providerId,
        bookingId,
        entryType: 'PROVIDER_NET_EARNING',
        direction: 'CREDIT',
        amountPaisa: compensationPaisa,
        currency: 'INR',
        resultingAvailablePaisa: updatedWallet.availableBalancePaisa,
        resultingPendingPaisa: updatedWallet.pendingBalancePaisa,
        idempotencyKey: `comp_${bookingId}_${providerId}_${Date.now()}`,
        description: `Compensation: ${reason}`,
        metadata: {
          reason,
          compensationPaisa,
        },
      },
    });

    return { wallet: updatedWallet, ledgerEntry };
  }

  /**
   * Provider requests a payout withdrawal against their available balance
   */
  async requestPayout(
    providerUserId: string,
    input: RequestPayoutInput,
    idempotencyKey?: string
  ) {
    const provider = await prisma.provider.findUnique({
      where: { userId: providerUserId },
    });

    if (!provider) {
      throw new ForbiddenError('Provider profile not found');
    }

    if (provider.verificationStatus !== 'VERIFIED') {
      throw new ForbiddenError(
        'Partner must be verified by local administration before requesting payouts'
      );
    }

    const key = idempotencyKey || `payout_req_${provider.id}_${Date.now()}`;

    // Check for idempotent duplicate request
    const existingPayout = await prisma.providerPayout.findUnique({
      where: { idempotencyKey: key },
    });
    if (existingPayout) {
      return existingPayout;
    }

    return prisma.$transaction(async (tx) => {
      const wallet = await this.getOrCreateWallet(provider.id, tx);

      // Determine requested withdrawal amount
      const withdrawAmountPaisa =
        input.amountPaisa !== undefined && input.amountPaisa > 0
          ? input.amountPaisa
          : wallet.availableBalancePaisa;

      if (withdrawAmountPaisa < FinancialService.MINIMUM_PAYOUT_PAISA) {
        throw new ValidationError(
          `Minimum withdrawal amount is ₹${(FinancialService.MINIMUM_PAYOUT_PAISA / 100).toFixed(0)} (10,000 paisa)`
        );
      }

      if (wallet.availableBalancePaisa < withdrawAmountPaisa) {
        throw new ValidationError(
          `Insufficient available balance. Available: ₹${(wallet.availableBalancePaisa / 100).toFixed(2)}, Requested: ₹${(withdrawAmountPaisa / 100).toFixed(2)}`
        );
      }

      // Atomically move funds from available to pending
      const updatedWallet = await tx.providerWallet.update({
        where: { id: wallet.id },
        data: {
          availableBalancePaisa: {
            decrement: withdrawAmountPaisa,
          },
          pendingBalancePaisa: {
            increment: withdrawAmountPaisa,
          },
        },
      });

      // Create Payout record in PROCESSING status
      const payout = await tx.providerPayout.create({
        data: {
          providerId: provider.id,
          grossAmountPaisa: withdrawAmountPaisa,
          platformDeductionPaisa: 0,
          tdsDeductionPaisa: 0,
          netPayoutPaisa: withdrawAmountPaisa,
          payoutMode: input.payoutMode || 'BANK_TRANSFER',
          status: 'PROCESSING',
          idempotencyKey: key,
        },
      });

      // Append immutable ledger entry for payout reservation
      await tx.walletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          providerId: provider.id,
          payoutId: payout.id,
          entryType: 'PAYOUT_PROCESSING',
          direction: 'DEBIT',
          amountPaisa: withdrawAmountPaisa,
          currency: 'INR',
          resultingAvailablePaisa: updatedWallet.availableBalancePaisa,
          resultingPendingPaisa: updatedWallet.pendingBalancePaisa,
          idempotencyKey: `ledger_${key}`,
          description: `Withdrawal request of ₹${(withdrawAmountPaisa / 100).toFixed(2)} reserved for bank transfer`,
          metadata: {
            payoutMode: input.payoutMode || 'BANK_TRANSFER',
          },
        },
      });

      return payout;
    });
  }

  /**
   * Gateway callback or Admin updates payout status (PAID or FAILED)
   */
  async updatePayoutStatus(
    payoutId: string,
    input: UpdatePayoutStatusInput,
    adminUserId?: string
  ) {
    const payout = await prisma.providerPayout.findUnique({
      where: { id: payoutId },
    });

    if (!payout) {
      throw new NotFoundError('Payout record not found');
    }

    if (payout.status === 'PAID') {
      throw new ConflictError('Payout has already been settled and paid out.');
    }

    return prisma.$transaction(async (tx) => {
      const wallet = await this.getOrCreateWallet(payout.providerId, tx);

      if (input.status === 'PAID') {
        // Move funds from pending to paid-out
        const updatedWallet = await tx.providerWallet.update({
          where: { id: wallet.id },
          data: {
            pendingBalancePaisa: {
              decrement: payout.netPayoutPaisa,
            },
            paidOutBalancePaisa: {
              increment: payout.netPayoutPaisa,
            },
          },
        });

        const updatedPayout = await tx.providerPayout.update({
          where: { id: payoutId },
          data: {
            status: 'PAID',
            payoutReference: input.payoutReference,
            processedAt: new Date(),
          },
        });

        await tx.walletLedgerEntry.create({
          data: {
            walletId: wallet.id,
            providerId: payout.providerId,
            payoutId: payout.id,
            entryType: 'PAYOUT_COMPLETED',
            direction: 'DEBIT',
            amountPaisa: payout.netPayoutPaisa,
            currency: 'INR',
            resultingAvailablePaisa: updatedWallet.availableBalancePaisa,
            resultingPendingPaisa: updatedWallet.pendingBalancePaisa,
            sourceReferenceId: input.payoutReference,
            description: `Payout completed via bank transfer (Ref: ${input.payoutReference || 'COMPLETED'})`,
          },
        });

        if (adminUserId) {
          await tx.auditLog.create({
            data: {
              userId: adminUserId,
              action: 'PAYOUT_MARKED_PAID',
              resourceType: 'provider_payout',
              resourceId: payout.id,
              newState: { status: 'PAID', reference: input.payoutReference },
            },
          });
        }

        return updatedPayout;
      } else if (input.status === 'FAILED') {
        // Refund reserved funds back to available balance
        const updatedWallet = await tx.providerWallet.update({
          where: { id: wallet.id },
          data: {
            pendingBalancePaisa: {
              decrement: payout.netPayoutPaisa,
            },
            availableBalancePaisa: {
              increment: payout.netPayoutPaisa,
            },
          },
        });

        const updatedPayout = await tx.providerPayout.update({
          where: { id: payoutId },
          data: {
            status: 'FAILED',
            failureReason: input.failureReason || 'Bank transfer rejected by clearing network',
            processedAt: new Date(),
          },
        });

        await tx.walletLedgerEntry.create({
          data: {
            walletId: wallet.id,
            providerId: payout.providerId,
            payoutId: payout.id,
            entryType: 'PAYOUT_REVERSED',
            direction: 'CREDIT',
            amountPaisa: payout.netPayoutPaisa,
            currency: 'INR',
            resultingAvailablePaisa: updatedWallet.availableBalancePaisa,
            resultingPendingPaisa: updatedWallet.pendingBalancePaisa,
            description: `Payout reversed back to wallet balance: ${input.failureReason || 'Transfer failed'}`,
          },
        });

        if (adminUserId) {
          await tx.auditLog.create({
            data: {
              userId: adminUserId,
              action: 'PAYOUT_MARKED_FAILED',
              resourceType: 'provider_payout',
              resourceId: payout.id,
              newState: { status: 'FAILED', reason: input.failureReason },
            },
          });
        }

        return updatedPayout;
      }

      return payout;
    });
  }

  /**
   * Admin executes manual audited financial adjustment
   */
  async adminManualAdjustment(
    adminUserId: string,
    input: AdminManualAdjustmentInput
  ) {
    const provider = await prisma.provider.findUnique({
      where: { id: input.providerId },
    });

    if (!provider) {
      throw new NotFoundError('Target provider not found');
    }

    return prisma.$transaction(async (tx) => {
      const wallet = await this.getOrCreateWallet(provider.id, tx);

      if (input.direction === 'DEBIT' && wallet.availableBalancePaisa < input.amountPaisa) {
        throw new ValidationError(
          `Cannot debit ₹${(input.amountPaisa / 100).toFixed(2)}. Current available balance is ₹${(wallet.availableBalancePaisa / 100).toFixed(2)}.`
        );
      }

      const updatedWallet = await tx.providerWallet.update({
        where: { id: wallet.id },
        data: {
          availableBalancePaisa: {
            [input.direction === 'CREDIT' ? 'increment' : 'decrement']: input.amountPaisa,
          },
        },
      });

      const entry = await tx.walletLedgerEntry.create({
        data: {
          walletId: wallet.id,
          providerId: provider.id,
          entryType: 'ADMIN_ADJUSTMENT',
          direction: input.direction,
          amountPaisa: input.amountPaisa,
          currency: 'INR',
          resultingAvailablePaisa: updatedWallet.availableBalancePaisa,
          resultingPendingPaisa: updatedWallet.pendingBalancePaisa,
          description: `Manual admin adjustment: ${input.reason}`,
          metadata: {
            adminUserId,
            reason: input.reason,
            direction: input.direction,
          },
        },
      });

      await tx.auditLog.create({
        data: {
          userId: adminUserId,
          action: `ADMIN_WALLET_ADJUSTMENT_${input.direction}`,
          resourceType: 'provider_wallet',
          resourceId: wallet.id,
          newState: {
            amountPaisa: input.amountPaisa,
            direction: input.direction,
            reason: input.reason,
            resultingAvailablePaisa: updatedWallet.availableBalancePaisa,
          },
        },
      });

      return {
        wallet: updatedWallet,
        ledgerEntry: entry,
      };
    });
  }

  /**
   * Retrieves comprehensive wallet summary for provider
   */
  async getProviderWalletSummary(providerUserIdOrId: string) {
    const provider = await prisma.provider.findFirst({
      where: {
        OR: [{ id: providerUserIdOrId }, { userId: providerUserIdOrId }],
      },
    });

    if (!provider) {
      throw new ForbiddenError('No provider profile associated with this account');
    }

    const wallet = await this.getOrCreateWallet(provider.id);

    // Fetch recent ledger entries
    const ledger = await prisma.walletLedgerEntry.findMany({
      where: { providerId: provider.id },
      include: {
        booking: {
          include: {
            service: { select: { name: true } },
          },
        },
        payout: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 30,
    });

    // Also fetch recent payouts
    const payouts = await prisma.providerPayout.findMany({
      where: { providerId: provider.id },
      include: {
        booking: {
          include: {
            service: { select: { name: true } },
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 20,
    });

    // Support legacy/unbackfilled pending payouts fallback
    const pendingAgg = await prisma.providerPayout.aggregate({
      _sum: { netPayoutPaisa: true },
      where: { providerId: provider.id, status: 'PENDING' },
    });
    const legacyPendingPaisa = pendingAgg._sum.netPayoutPaisa ?? 0;

    const availableBalancePaisa =
      wallet.availableBalancePaisa > 0
        ? wallet.availableBalancePaisa
        : legacyPendingPaisa;

    const totalEarnedPaisa =
      availableBalancePaisa +
      wallet.pendingBalancePaisa +
      wallet.paidOutBalancePaisa;

    return {
      walletId: wallet.id,
      providerId: provider.id,
      availableBalancePaisa,
      pendingSettlementPaisa: availableBalancePaisa,
      pendingBalancePaisa: wallet.pendingBalancePaisa,
      paidOutBalancePaisa: wallet.paidOutBalancePaisa,
      totalEarnedPaisa,
      ledger: payouts.length > 0 ? payouts : ledger, // preserves backward compatibility for clients reading payout list
      walletLedger: ledger,
      payouts,
    };
  }

  /**
   * Retrieves paginated ledger entries
   */
  async getLedgerEntries(providerId?: string, query?: QueryLedgerInput) {
    const page = query?.page || 1;
    const limit = query?.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (providerId) {
      where.providerId = providerId;
    }
    if (query?.entryType) {
      where.entryType = query.entryType;
    }
    if (query?.direction) {
      where.direction = query.direction;
    }

    const [entries, total] = await Promise.all([
      prisma.walletLedgerEntry.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          booking: {
            select: { bookingNumber: true, service: { select: { name: true } } },
          },
          provider: {
            select: { id: true, businessName: true, user: { select: { fullName: true } } },
          },
        },
      }),
      prisma.walletLedgerEntry.count({ where }),
    ]);

    return { entries, total, page, limit };
  }
}

export const financialService = new FinancialService();
