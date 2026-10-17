export const ProviderVerificationStatus = {
  DRAFT: 'DRAFT',
  SUBMITTED: 'SUBMITTED',
  UNDER_REVIEW: 'UNDER_REVIEW',
  VERIFIED: 'VERIFIED',
  REJECTED: 'REJECTED',
  SUSPENDED: 'SUSPENDED',
} as const;

export type ProviderVerificationStatusType =
  (typeof ProviderVerificationStatus)[keyof typeof ProviderVerificationStatus];

export const KycDocumentType = {
  AADHAAR_FRONT: 'AADHAAR_FRONT',
  AADHAAR_BACK: 'AADHAAR_BACK',
  PAN_CARD: 'PAN_CARD',
  POLICE_VERIFICATION: 'POLICE_VERIFICATION',
  TRADE_CERTIFICATE: 'TRADE_CERTIFICATE',
  DRIVING_LICENSE: 'DRIVING_LICENSE',
} as const;

export type KycDocumentType = (typeof KycDocumentType)[keyof typeof KycDocumentType];

export const DocumentReviewStatus = {
  PENDING: 'PENDING',
  APPROVED: 'APPROVED',
  REJECTED: 'REJECTED',
} as const;

export type DocumentReviewStatusType =
  (typeof DocumentReviewStatus)[keyof typeof DocumentReviewStatus];
