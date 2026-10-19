export const MessageType = {
  TEXT: 'TEXT',
  SYSTEM: 'SYSTEM',
  IMAGE: 'IMAGE',
  DOCUMENT: 'DOCUMENT',
  LOCATION: 'LOCATION',
  QUOTE_EVENT: 'QUOTE_EVENT',
  BOOKING_EVENT: 'BOOKING_EVENT',
  PAYMENT_EVENT: 'PAYMENT_EVENT',
} as const;

export type MessageTypeValue = (typeof MessageType)[keyof typeof MessageType];

export const ConversationStatus = {
  ACTIVE: 'ACTIVE',
  CLOSED: 'CLOSED',
  ARCHIVED: 'ARCHIVED',
} as const;

export type ConversationStatusValue =
  (typeof ConversationStatus)[keyof typeof ConversationStatus];

export const ParticipantRole = {
  CUSTOMER: 'CUSTOMER',
  PROVIDER: 'PROVIDER',
  ADMIN: 'ADMIN',
  SYSTEM: 'SYSTEM',
} as const;

export type ParticipantRoleValue =
  (typeof ParticipantRole)[keyof typeof ParticipantRole];

export const CHAT_MAX_MESSAGE_LENGTH = 2000;
export const CHAT_DEFAULT_PAGE_SIZE = 50;
export const CHAT_MAX_PAGE_SIZE = 100;
