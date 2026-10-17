export const PaymentGateway = {
  RAZORPAY: 'RAZORPAY',
  CASHFREE: 'CASHFREE',
  PHONEPE: 'PHONEPE',
  CASH_ON_DELIVERY: 'CASH_ON_DELIVERY',
} as const;

export type PaymentGatewayType = (typeof PaymentGateway)[keyof typeof PaymentGateway];

export const PaymentStatus = {
  INITIATED: 'INITIATED',
  AUTHORIZED: 'AUTHORIZED',
  CAPTURED: 'CAPTURED',
  FAILED: 'FAILED',
  REFUNDED: 'REFUNDED',
} as const;

export type PaymentStatusType = (typeof PaymentStatus)[keyof typeof PaymentStatus];

export const PayoutStatus = {
  PENDING: 'PENDING',
  PROCESSING: 'PROCESSING',
  SETTLED: 'SETTLED',
  FAILED: 'FAILED',
  ON_HOLD: 'ON_HOLD',
} as const;

export type PayoutStatusType = (typeof PayoutStatus)[keyof typeof PayoutStatus];

export const PayoutMode = {
  BANK_TRANSFER: 'BANK_TRANSFER',
  UPI: 'UPI',
  IMPS: 'IMPS',
  NEFT: 'NEFT',
} as const;

export type PayoutModeType = (typeof PayoutMode)[keyof typeof PayoutMode];
