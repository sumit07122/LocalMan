export const ReviewStatus = {
  PENDING: 'PENDING',
  PUBLISHED: 'PUBLISHED',
  HIDDEN: 'HIDDEN',
  REMOVED: 'REMOVED',
  FLAGGED: 'FLAGGED',
} as const;

export type ReviewStatusType = (typeof ReviewStatus)[keyof typeof ReviewStatus];

export const ReviewReportReason = {
  INAPPROPRIATE_CONTENT: 'INAPPROPRIATE_CONTENT',
  OFFENSIVE_LANGUAGE: 'OFFENSIVE_LANGUAGE',
  SPAM: 'SPAM',
  FAKE_REVIEW: 'FAKE_REVIEW',
  HARASSMENT: 'HARASSMENT',
  OTHER: 'OTHER',
} as const;

export type ReviewReportReasonType = (typeof ReviewReportReason)[keyof typeof ReviewReportReason];

/**
 * Review edit window: Customers can edit their review within 48 hours of creation.
 * After 48 hours, the review becomes immutable by the customer.
 */
export const REVIEW_EDIT_WINDOW_HOURS = 48;
export const REVIEW_EDIT_WINDOW_MS = REVIEW_EDIT_WINDOW_HOURS * 60 * 60 * 1000;

export const REVIEW_CONSTRAINTS = {
  MIN_RATING: 1,
  MAX_RATING: 5,
  MAX_TITLE_LENGTH: 120,
  MAX_BODY_LENGTH: 2000,
  MIN_RESPONSE_LENGTH: 5,
  MAX_RESPONSE_LENGTH: 1500,
  MIN_MODERATION_REASON_LENGTH: 5,
  MAX_MODERATION_REASON_LENGTH: 500,
  MAX_REPORT_DETAILS_LENGTH: 500,
  DEFAULT_PAGE_SIZE: 10,
  MAX_PAGE_SIZE: 50,
} as const;
