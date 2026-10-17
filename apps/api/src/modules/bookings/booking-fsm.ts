import {
  BookingStatus,
  BookingStatusType,
  ALLOWED_BOOKING_TRANSITIONS,
} from '@localman/constants';
import {
  InvalidStateTransitionError,
  ForbiddenError,
  ValidationError,
} from '../../common/errors/app-error.js';

export interface TransitionContext {
  bookingId: string;
  currentState: BookingStatusType;
  targetState: BookingStatusType;
  actorId: string;
  actorRoles: string[];
  isCustomer: boolean;
  isAssignedProvider: boolean;
  isAdmin: boolean;
  startOtpExpected?: string;
  startOtpSubmitted?: string;
  completionPhotos?: string[];
}

export class BookingFSM {
  /**
   * Validates if transition from currentState to targetState is structurally allowed and actor is authorized.
   */
  static validateTransition(context: TransitionContext): void {
    const {
      currentState,
      targetState,
      isCustomer,
      isAssignedProvider,
      isAdmin,
      startOtpExpected,
      startOtpSubmitted,
    } = context;

    // 1. Structural transition check
    const allowedTargets = ALLOWED_BOOKING_TRANSITIONS[currentState];
    if (!allowedTargets || !allowedTargets.includes(targetState)) {
      throw new InvalidStateTransitionError(
        `Invalid status transition: Cannot change booking status from '${currentState}' to '${targetState}'.`
      );
    }

    // 2. Role and permission checks for specific states
    switch (targetState) {
      case BookingStatus.PROVIDER_ACCEPTED:
      case BookingStatus.REJECTED:
        if (!isAssignedProvider && !isAdmin) {
          throw new ForbiddenError('Only the assigned service professional can accept or reject this request.');
        }
        break;

      case BookingStatus.PROVIDER_ON_THE_WAY:
      case BookingStatus.ARRIVED:
        if (!isAssignedProvider && !isAdmin) {
          throw new ForbiddenError('Only the assigned professional can update transit and arrival status.');
        }
        break;

      case BookingStatus.JOB_STARTED:
        if (!isAssignedProvider && !isAdmin) {
          throw new ForbiddenError('Only the assigned professional can initiate job start.');
        }
        // Strict Customer Start OTP Verification
        if (!isAdmin) {
          if (!startOtpSubmitted || startOtpSubmitted.trim().length !== 6) {
            throw new ValidationError('A 6-digit Customer Start OTP is required to start the job.');
          }
          if (startOtpSubmitted !== startOtpExpected) {
            throw new ValidationError('Invalid Customer Start OTP. Please check the code shown in the customer app.');
          }
        }
        break;

      case BookingStatus.JOB_COMPLETED:
        if (!isAssignedProvider && !isAdmin) {
          throw new ForbiddenError('Only the assigned professional can mark the job as completed.');
        }
        break;

      case BookingStatus.CANCELLED:
        if (!isCustomer && !isAssignedProvider && !isAdmin) {
          throw new ForbiddenError('Unauthorized to cancel this booking.');
        }
        break;

      case BookingStatus.REVIEWED:
        if (!isCustomer && !isAdmin) {
          throw new ForbiddenError('Only the customer can submit a review.');
        }
        break;

      case BookingStatus.REFUNDED:
        if (!isAdmin) {
          throw new ForbiddenError('Only an administrator can authorize a refund.');
        }
        break;
    }
  }
}
