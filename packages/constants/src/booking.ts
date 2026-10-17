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

/**
 * Valid state transitions map: maps current state to allowed next states
 */
export const ALLOWED_BOOKING_TRANSITIONS: Record<BookingStatusType, readonly BookingStatusType[]> = {
  [BookingStatus.REQUESTED]: [
    BookingStatus.PROVIDER_ACCEPTED,
    BookingStatus.REJECTED,
    BookingStatus.CANCELLED,
    BookingStatus.EXPIRED,
  ],
  [BookingStatus.PROVIDER_ACCEPTED]: [
    BookingStatus.CONFIRMED,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.CONFIRMED]: [
    BookingStatus.PROVIDER_ON_THE_WAY,
    BookingStatus.CANCELLED,
  ],
  [BookingStatus.PROVIDER_ON_THE_WAY]: [
    BookingStatus.ARRIVED,
    BookingStatus.CANCELLED,
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
  ],
  // Terminal states (cannot transition further)
  [BookingStatus.REJECTED]: [],
  [BookingStatus.CANCELLED]: [],
  [BookingStatus.NO_SHOW]: [],
  [BookingStatus.REFUNDED]: [],
  [BookingStatus.EXPIRED]: [],
};
