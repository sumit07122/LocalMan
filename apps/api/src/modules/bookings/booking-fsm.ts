import {
  BookingStatus,
  BookingStatusType,
  ALLOWED_BOOKING_TRANSITIONS,
} from '@localman/constants';
import {
  InvalidStateTransitionError,
  ForbiddenError,
} from '../../common/errors/app-error.js';
import { bookingOtpService } from './booking-otp.service.js';

export interface TransitionContext {
  bookingId: string;
  currentState: BookingStatusType;
  targetState: BookingStatusType;
  actorId: string;
  actorRoles: string[];
  actorRole?: string;
  isCustomer: boolean;
  isAssignedProvider: boolean;
  isAdmin: boolean;
  startOtpExpected?: string;
  startOtpSubmitted?: string;
  completionPhotos?: string[];
  createdAt?: Date | string;
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
        if (!isAssignedProvider && !isCustomer && !isAdmin && context.actorRole !== 'SYSTEM') {
          throw new ForbiddenError('Only the assigned service professional, customer, or admin can accept this request.');
        }
        break;

      case BookingStatus.CONFIRMED:
        if (!isCustomer && !isAssignedProvider && !isAdmin && context.actorRole !== 'SYSTEM') {
          throw new ForbiddenError('Only the customer, assigned professional, or admin can confirm this booking.');
        }
        break;

      case BookingStatus.REJECTED:
        if (!isAssignedProvider && !isAdmin) {
          throw new ForbiddenError('Only the assigned service professional can reject this request.');
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
          bookingOtpService.verifyStartOtp(
            { id: context.bookingId, startOtp: startOtpExpected || '', createdAt: context.createdAt },
            startOtpSubmitted
          );
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

      case BookingStatus.NO_SHOW:
        if (currentState === BookingStatus.ARRIVED) {
          // Provider marking customer no-show after arrival
          if (!isAssignedProvider && !isAdmin) {
            throw new ForbiddenError('Only the assigned professional or admin can record customer no-show.');
          }
        } else {
          // Customer reporting provider no-show
          if (!isCustomer && !isAdmin) {
            throw new ForbiddenError('Only the customer or admin can record provider no-show.');
          }
        }
        break;

      case BookingStatus.DISPUTED:
        if (!isCustomer && !isAssignedProvider && !isAdmin) {
          throw new ForbiddenError('Unauthorized to raise a dispute for this booking.');
        }
        break;

      case BookingStatus.REVIEWED:
        if (!isCustomer && !isAdmin) {
          throw new ForbiddenError('Only the customer can submit a review.');
        }
        break;

      case BookingStatus.REFUNDED:
        if (!isAdmin && context.actorRole !== 'SYSTEM') {
          throw new ForbiddenError('Only an administrator or authoritative refund service can authorize a refund.');
        }
        break;

      case BookingStatus.REQUESTED:
        // When an assigned provider cancels, returning booking to dispatch pool
        if (!isAssignedProvider && !isAdmin && context.actorRole !== 'SYSTEM') {
          throw new ForbiddenError('Only the assigned professional or system can return booking to dispatch.');
        }
        break;
    }
  }
}
