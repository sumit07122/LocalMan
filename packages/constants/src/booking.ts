export const BookingStatus = {
  REQUESTED: 'REQUESTED',
  PROVIDER_ACCEPTED: 'PROVIDER_ACCEPTED',
  CONFIRMED: 'CONFIRMED',
  PROVIDER_ON_THE_WAY: 'PROVIDER_ON_THE_WAY',
  ARRIVED: 'ARRIVED',
  JOB_STARTED: 'JOB_STARTED',
  JOB_EXTENDED: 'JOB_EXTENDED',
  JOB_COMPLETED: 'JOB_COMPLETED',
  PAYMENT_PENDING: 'PAYMENT_PENDING',
  PAYMENT_SETTLED: 'PAYMENT_SETTLED',
  REVIEWED: 'REVIEWED',
  REJECTED: 'REJECTED',
  CANCELLED: 'CANCELLED',
  NO_SHOW: 'NO_SHOW',
  DISPUTED: 'DISPUTED',
  REFUNDED: 'REFUNDED',
  EXPIRED: 'EXPIRED',
} as const;

export type BookingStatusType = (typeof BookingStatus)[keyof typeof BookingStatus];

export const PricingModel = {
  HOURLY: 'HOURLY',
  FIXED_PRICE: 'FIXED_PRICE',
  INSPECTION_QUOTE: 'INSPECTION_QUOTE',
  CUSTOM_QUOTE: 'CUSTOM_QUOTE',
} as const;

export type PricingModelType = (typeof PricingModel)[keyof typeof PricingModel];

export const CancellationReason = {
  CUSTOMER_CHANGED_MIND: 'CUSTOMER_CHANGED_MIND',
  CUSTOMER_UNAVAILABLE: 'CUSTOMER_UNAVAILABLE',
  PROVIDER_UNAVAILABLE: 'PROVIDER_UNAVAILABLE',
  PROVIDER_NO_SHOW: 'PROVIDER_NO_SHOW',
  CUSTOMER_NO_SHOW: 'CUSTOMER_NO_SHOW',
  WRONG_SERVICE: 'WRONG_SERVICE',
  DUPLICATE_BOOKING: 'DUPLICATE_BOOKING',
  PRICE_DISAGREEMENT: 'PRICE_DISAGREEMENT',
  SAFETY_CONCERN: 'SAFETY_CONCERN',
  EMERGENCY: 'EMERGENCY',
  OTHER: 'OTHER',
} as const;

export type CancellationReasonType = (typeof CancellationReason)[keyof typeof CancellationReason];

export const DisputeReason = {
  JOB_NOT_COMPLETED: 'JOB_NOT_COMPLETED',
  POOR_QUALITY: 'POOR_QUALITY',
  WRONG_SERVICE: 'WRONG_SERVICE',
  UNAUTHORIZED_MATERIALS: 'UNAUTHORIZED_MATERIALS',
  INCORRECT_AMOUNT: 'INCORRECT_AMOUNT',
  PROVIDER_NO_SHOW: 'PROVIDER_NO_SHOW',
  CUSTOMER_NO_SHOW: 'CUSTOMER_NO_SHOW',
  PROPERTY_DAMAGE: 'PROPERTY_DAMAGE',
  SAFETY_ISSUE: 'SAFETY_ISSUE',
  PAYMENT_ISSUE: 'PAYMENT_ISSUE',
  OTHER: 'OTHER',
} as const;

export type DisputeReasonType = (typeof DisputeReason)[keyof typeof DisputeReason];

export const DisputeStatus = {
  OPEN: 'OPEN',
  UNDER_REVIEW: 'UNDER_REVIEW',
  RESOLVED_CUSTOMER: 'RESOLVED_CUSTOMER',
  RESOLVED_PROVIDER: 'RESOLVED_PROVIDER',
  RESOLVED_PARTIAL: 'RESOLVED_PARTIAL',
  CLOSED: 'CLOSED',
} as const;

export type DisputeStatusType = (typeof DisputeStatus)[keyof typeof DisputeStatus];

export const RefundStatus = {
  NOT_REQUIRED: 'NOT_REQUIRED',
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SUCCEEDED: 'SUCCEEDED',
  FAILED: 'FAILED',
  PARTIALLY_REFUNDED: 'PARTIALLY_REFUNDED',
  FULLY_REFUNDED: 'FULLY_REFUNDED',
} as const;

export type RefundStatusType = (typeof RefundStatus)[keyof typeof RefundStatus];

export const QuoteStatus = {
  REQUESTED: 'REQUESTED',
  SUBMITTED: 'SUBMITTED',
  UPDATED: 'UPDATED',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
  EXPIRED: 'EXPIRED',
  WITHDRAWN: 'WITHDRAWN',
  SUPERSEDED: 'SUPERSEDED',
} as const;

export type QuoteStatusType = (typeof QuoteStatus)[keyof typeof QuoteStatus];

/**
 * Valid state transitions map: maps current state to allowed next states
 */
export const ALLOWED_BOOKING_TRANSITIONS: Record<BookingStatusType, readonly BookingStatusType[]> = {
  [BookingStatus.REQUESTED]: [
    BookingStatus.PROVIDER_ACCEPTED,
    BookingStatus.CONFIRMED,
    BookingStatus.REJECTED,
    BookingStatus.CANCELLED,
    BookingStatus.EXPIRED,
  ],
  [BookingStatus.PROVIDER_ACCEPTED]: [
    BookingStatus.CONFIRMED,
    BookingStatus.PROVIDER_ON_THE_WAY,
    BookingStatus.CANCELLED,
    BookingStatus.REQUESTED, // when provider cancels and booking is returned to dispatch queue
  ],
  [BookingStatus.CONFIRMED]: [
    BookingStatus.PROVIDER_ON_THE_WAY,
    BookingStatus.CANCELLED,
    BookingStatus.NO_SHOW,
    BookingStatus.REQUESTED, // when provider cancels and booking is returned to dispatch queue
  ],
  [BookingStatus.PROVIDER_ON_THE_WAY]: [
    BookingStatus.ARRIVED,
    BookingStatus.CANCELLED,
    BookingStatus.NO_SHOW,
    BookingStatus.REQUESTED, // when provider cancels en-route and booking is returned to dispatch queue
  ],
  [BookingStatus.ARRIVED]: [
    BookingStatus.JOB_STARTED,
    BookingStatus.NO_SHOW,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.JOB_STARTED]: [
    BookingStatus.JOB_EXTENDED,
    BookingStatus.JOB_COMPLETED,
    BookingStatus.DISPUTED,
  ],
  [BookingStatus.JOB_EXTENDED]: [
    BookingStatus.JOB_STARTED,
    BookingStatus.JOB_COMPLETED,
    BookingStatus.DISPUTED,
  ],
  [BookingStatus.JOB_COMPLETED]: [
    BookingStatus.PAYMENT_PENDING,
    BookingStatus.PAYMENT_SETTLED,
    BookingStatus.DISPUTED,
  ],
  [BookingStatus.PAYMENT_PENDING]: [
    BookingStatus.PAYMENT_SETTLED,
    BookingStatus.DISPUTED,
  ],
  [BookingStatus.PAYMENT_SETTLED]: [
    BookingStatus.REVIEWED,
    BookingStatus.DISPUTED,
    BookingStatus.REFUNDED,
  ],
  [BookingStatus.REVIEWED]: [
    BookingStatus.DISPUTED,
  ],
  [BookingStatus.DISPUTED]: [
    BookingStatus.REFUNDED,
    BookingStatus.PAYMENT_SETTLED,
    BookingStatus.CANCELLED,
    BookingStatus.JOB_COMPLETED,
  ],
  [BookingStatus.NO_SHOW]: [
    BookingStatus.REFUNDED,
    BookingStatus.DISPUTED,
  ],
  [BookingStatus.CANCELLED]: [
    BookingStatus.REFUNDED,
  ],
  // Terminal states (cannot transition further)
  [BookingStatus.REJECTED]: [],
  [BookingStatus.REFUNDED]: [],
  [BookingStatus.EXPIRED]: [],
};
