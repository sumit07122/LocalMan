import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { BookingFSM } from '../src/modules/bookings/booking-fsm.js';
import { BookingStatus } from '@localman/constants';
import {
  InvalidStateTransitionError,
  ValidationError,
  ForbiddenError,
} from '../src/common/errors/app-error.js';

describe('Booking Finite State Machine (FSM)', () => {
  const baseContext = {
    bookingId: 'bkg_test_123',
    actorId: 'usr_provider_456',
    actorRoles: ['PROVIDER'],
    isCustomer: false,
    isAssignedProvider: true,
    isAdmin: false,
  };

  it('should allow provider to accept a requested booking', () => {
    assert.doesNotThrow(() => {
      BookingFSM.validateTransition({
        ...baseContext,
        currentState: BookingStatus.REQUESTED,
        targetState: BookingStatus.PROVIDER_ACCEPTED,
      });
    });
  });

  it('should reject invalid transition jumping from REQUESTED directly to JOB_COMPLETED', () => {
    assert.throws(
      () => {
        BookingFSM.validateTransition({
          ...baseContext,
          currentState: BookingStatus.REQUESTED,
          targetState: BookingStatus.JOB_COMPLETED,
        });
      },
      (err: any) => {
        assert(err instanceof InvalidStateTransitionError);
        assert.match(err.message, /Cannot change booking status from 'REQUESTED' to 'JOB_COMPLETED'/);
        return true;
      }
    );
  });

  it('should require valid customer Start OTP when transitioning to JOB_STARTED', () => {
    // Missing OTP
    assert.throws(
      () => {
        BookingFSM.validateTransition({
          ...baseContext,
          currentState: BookingStatus.ARRIVED,
          targetState: BookingStatus.JOB_STARTED,
          startOtpExpected: '482910',
          startOtpSubmitted: undefined,
        });
      },
      (err: any) => {
        assert(err instanceof ValidationError);
        assert.match(err.message, /Customer Start OTP is required/);
        return true;
      }
    );

    // Incorrect OTP
    assert.throws(
      () => {
        BookingFSM.validateTransition({
          ...baseContext,
          currentState: BookingStatus.ARRIVED,
          targetState: BookingStatus.JOB_STARTED,
          startOtpExpected: '482910',
          startOtpSubmitted: '123456',
        });
      },
      (err: any) => {
        assert(err instanceof ValidationError);
        assert.match(err.message, /Invalid Customer Start OTP/);
        return true;
      }
    );

    // Matching OTP succeeds
    assert.doesNotThrow(() => {
      BookingFSM.validateTransition({
        ...baseContext,
        currentState: BookingStatus.ARRIVED,
        targetState: BookingStatus.JOB_STARTED,
        startOtpExpected: '482910',
        startOtpSubmitted: '482910',
      });
    });
  });

  it('should prevent non-assigned provider or non-admin from updating transit status', () => {
    assert.throws(
      () => {
        BookingFSM.validateTransition({
          ...baseContext,
          isAssignedProvider: false,
          isAdmin: false,
          currentState: BookingStatus.CONFIRMED,
          targetState: BookingStatus.PROVIDER_ON_THE_WAY,
        });
      },
      (err: any) => {
        assert(err instanceof ForbiddenError);
        return true;
      }
    );
  });

  it('should allow customer to submit review once payment is settled', () => {
    assert.doesNotThrow(() => {
      BookingFSM.validateTransition({
        bookingId: 'bkg_test_123',
        actorId: 'usr_customer_789',
        actorRoles: ['CUSTOMER'],
        isCustomer: true,
        isAssignedProvider: false,
        isAdmin: false,
        currentState: BookingStatus.PAYMENT_SETTLED,
        targetState: BookingStatus.REVIEWED,
      });
    });
  });
});
