import { BookingStatus } from '@localman/constants';

export interface CancellationPolicyConfig {
  feeBeforeAcceptancePaisa: number;
  customerFeeAcceptedPaisa: number;
  customerFeeEnRoutePaisa: number;
  customerFeeArrivedPaisa: number;
  providerCompensationSharePercent: number;
  customerNoShowWaitMinutes: number;
  providerNoShowGraceMinutes: number;
  customerNoShowFeePaisa: number;
}

export const DEFAULT_CANCELLATION_POLICY_CONFIG: CancellationPolicyConfig = {
  feeBeforeAcceptancePaisa: 0,
  customerFeeAcceptedPaisa: 5000, // ₹50
  customerFeeEnRoutePaisa: 10000, // ₹100
  customerFeeArrivedPaisa: 15000, // ₹150
  providerCompensationSharePercent: 80, // 80% to provider, 20% platform retention
  customerNoShowWaitMinutes: 15,
  providerNoShowGraceMinutes: 30,
  customerNoShowFeePaisa: 20000, // ₹200
};

export interface CancellationEvaluation {
  isAllowed: boolean;
  blockReason?: string;
  cancellationFeePaisa: number;
  providerCompensationPaisa: number;
  refundAmountPaisa: number;
  policyExplanation: string;
}

export class CancellationPolicyService {
  private config: CancellationPolicyConfig;

  constructor(config: CancellationPolicyConfig = DEFAULT_CANCELLATION_POLICY_CONFIG) {
    this.config = { ...config };
  }

  public setConfig(config: Partial<CancellationPolicyConfig>): void {
    this.config = { ...this.config, ...config };
  }

  public getConfig(): CancellationPolicyConfig {
    return { ...this.config };
  }

  /**
   * Evaluates customer-initiated cancellation eligibility, fees, and refunds
   */
  evaluateCustomerCancellation(booking: {
    currentStatus: string;
    totalAmountPaisa: number;
    payment?: { status: string; amountPaisa: number } | null;
  }): CancellationEvaluation {
    const status = booking.currentStatus;
    const paidAmountPaisa =
      booking.payment && booking.payment.status === 'CAPTURED'
        ? booking.payment.amountPaisa
        : 0;

    switch (status) {
      case BookingStatus.REQUESTED: {
        const fee = this.config.feeBeforeAcceptancePaisa;
        return {
          isAllowed: true,
          cancellationFeePaisa: fee,
          providerCompensationPaisa: 0,
          refundAmountPaisa: Math.max(0, paidAmountPaisa - fee),
          policyExplanation: 'Cancellation before partner assignment is free of charge.',
        };
      }

      case BookingStatus.PROVIDER_ACCEPTED:
      case BookingStatus.CONFIRMED: {
        const fee = this.config.customerFeeAcceptedPaisa;
        const comp = Math.round((fee * this.config.providerCompensationSharePercent) / 100);
        return {
          isAllowed: true,
          cancellationFeePaisa: fee,
          providerCompensationPaisa: comp,
          refundAmountPaisa: Math.max(0, paidAmountPaisa - fee),
          policyExplanation: `A cancellation fee of ₹${(fee / 100).toFixed(2)} applies as a service partner has reserved their schedule.`,
        };
      }

      case BookingStatus.PROVIDER_ON_THE_WAY: {
        const fee = this.config.customerFeeEnRoutePaisa;
        const comp = Math.round((fee * this.config.providerCompensationSharePercent) / 100);
        return {
          isAllowed: true,
          cancellationFeePaisa: fee,
          providerCompensationPaisa: comp,
          refundAmountPaisa: Math.max(0, paidAmountPaisa - fee),
          policyExplanation: `A cancellation fee of ₹${(fee / 100).toFixed(2)} applies as the partner is already en route.`,
        };
      }

      case BookingStatus.ARRIVED: {
        const fee = this.config.customerFeeArrivedPaisa;
        const comp = Math.round((fee * this.config.providerCompensationSharePercent) / 100);
        return {
          isAllowed: true,
          cancellationFeePaisa: fee,
          providerCompensationPaisa: comp,
          refundAmountPaisa: Math.max(0, paidAmountPaisa - fee),
          policyExplanation: `An on-site callout fee of ₹${(fee / 100).toFixed(2)} applies as the partner has already arrived at your address.`,
        };
      }

      case BookingStatus.JOB_STARTED:
      case BookingStatus.JOB_EXTENDED: {
        return {
          isAllowed: false,
          blockReason: 'Service work is currently in progress. Normal cancellation is blocked; please raise a dispute or contact support.',
          cancellationFeePaisa: 0,
          providerCompensationPaisa: 0,
          refundAmountPaisa: 0,
          policyExplanation: 'In-progress jobs cannot be cancelled directly.',
        };
      }

      case BookingStatus.JOB_COMPLETED:
      case BookingStatus.PAYMENT_PENDING:
      case BookingStatus.PAYMENT_SETTLED:
      case BookingStatus.REVIEWED: {
        return {
          isAllowed: false,
          blockReason: 'The service has already been completed. Cancellation is blocked; please raise a dispute if there are issues.',
          cancellationFeePaisa: 0,
          providerCompensationPaisa: 0,
          refundAmountPaisa: 0,
          policyExplanation: 'Completed jobs cannot be cancelled.',
        };
      }

      default: {
        return {
          isAllowed: false,
          blockReason: `Booking in status '${status}' cannot be cancelled.`,
          cancellationFeePaisa: 0,
          providerCompensationPaisa: 0,
          refundAmountPaisa: 0,
          policyExplanation: 'Invalid booking state for cancellation.',
        };
      }
    }
  }

  /**
   * Evaluates provider-initiated cancellation eligibility
   */
  evaluateProviderCancellation(booking: {
    currentStatus: string;
    payment?: { status: string; amountPaisa: number } | null;
  }): CancellationEvaluation {
    const status = booking.currentStatus;
    const paidAmountPaisa =
      booking.payment && booking.payment.status === 'CAPTURED'
        ? booking.payment.amountPaisa
        : 0;

    const allowedPreStartStatuses = [
      BookingStatus.PROVIDER_ACCEPTED,
      BookingStatus.CONFIRMED,
      BookingStatus.PROVIDER_ON_THE_WAY,
      BookingStatus.ARRIVED,
    ];

    if (!allowedPreStartStatuses.includes(status as any)) {
      return {
        isAllowed: false,
        blockReason: `Partner cancellation is only permitted prior to service start. Partner cannot cancel booking in '${status}' status. Work must be completed or disputed.`,
        cancellationFeePaisa: 0,
        providerCompensationPaisa: 0,
        refundAmountPaisa: 0,
        policyExplanation: 'Partner cancellation is only allowed prior to service start.',
      };
    }

    // Provider cancellation never penalizes customer: 0 fee, 100% refund
    return {
      isAllowed: true,
      cancellationFeePaisa: 0,
      providerCompensationPaisa: 0,
      refundAmountPaisa: paidAmountPaisa,
      policyExplanation: 'Partner cancelled the appointment. Customer is eligible for an automatic full refund or reassignment.',
    };
  }

  /**
   * Evaluates customer no-show policy (marked by provider)
   */
  evaluateCustomerNoShow(booking: {
    currentStatus: string;
    payment?: { status: string; amountPaisa: number } | null;
  }): CancellationEvaluation {
    const paidAmountPaisa =
      booking.payment && booking.payment.status === 'CAPTURED'
        ? booking.payment.amountPaisa
        : 0;

    const fee = this.config.customerNoShowFeePaisa;
    const comp = Math.round((fee * this.config.providerCompensationSharePercent) / 100);

    return {
      isAllowed: true,
      cancellationFeePaisa: fee,
      providerCompensationPaisa: comp,
      refundAmountPaisa: Math.max(0, paidAmountPaisa - fee),
      policyExplanation: `Customer no-show recorded after on-site waiting. A fee of ₹${(fee / 100).toFixed(2)} applies.`,
    };
  }

  /**
   * Evaluates provider no-show policy (reported by customer)
   */
  evaluateProviderNoShow(booking: {
    currentStatus: string;
    payment?: { status: string; amountPaisa: number } | null;
  }): CancellationEvaluation {
    const paidAmountPaisa =
      booking.payment && booking.payment.status === 'CAPTURED'
        ? booking.payment.amountPaisa
        : 0;

    return {
      isAllowed: true,
      cancellationFeePaisa: 0,
      providerCompensationPaisa: 0,
      refundAmountPaisa: paidAmountPaisa,
      policyExplanation: 'Partner no-show verified. 100% full refund issued to customer.',
    };
  }
}

export const cancellationPolicyService = new CancellationPolicyService();
