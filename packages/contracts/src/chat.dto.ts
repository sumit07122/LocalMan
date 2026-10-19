import { z } from 'zod';
import {
  MessageType,
  CHAT_MAX_MESSAGE_LENGTH,
  CHAT_DEFAULT_PAGE_SIZE,
  CHAT_MAX_PAGE_SIZE,
} from '@localman/constants';

export const SendMessageSchema = z.object({
  clientMessageId: z
    .string()
    .min(1, 'Client message ID is required')
    .max(100, 'Client message ID too long'),
  messageType: z
    .enum([
      MessageType.TEXT,
      MessageType.SYSTEM,
      MessageType.IMAGE,
      MessageType.DOCUMENT,
      MessageType.LOCATION,
      MessageType.QUOTE_EVENT,
      MessageType.BOOKING_EVENT,
      MessageType.PAYMENT_EVENT,
    ])
    .default(MessageType.TEXT),
  body: z
    .string()
    .min(1, 'Message body cannot be empty')
    .max(CHAT_MAX_MESSAGE_LENGTH, `Message exceeds max length of ${CHAT_MAX_MESSAGE_LENGTH} characters`),
  replyToMessageId: z.string().max(100).optional().nullable(),
  metadata: z.record(z.any()).optional().nullable(),
});

export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export const ListMessagesQuerySchema = z.object({
  cursor: z.string().optional(),
  limit: z
    .coerce
    .number()
    .int()
    .min(1)
    .max(CHAT_MAX_PAGE_SIZE)
    .default(CHAT_DEFAULT_PAGE_SIZE),
  direction: z.enum(['before', 'after']).default('before'),
});

export type ListMessagesQueryInput = z.infer<typeof ListMessagesQuerySchema>;

export const MarkReadSchema = z.object({
  messageId: z.string().max(100).optional().nullable(),
});

export type MarkReadInput = z.infer<typeof MarkReadSchema>;

export interface MessageResponseDto {
  id: string;
  conversationId: string;
  bookingId: string;
  senderUserId: string | null;
  senderRole: string;
  senderName?: string;
  clientMessageId: string | null;
  messageType: string;
  body: string;
  replyToMessageId: string | null;
  metadata: Record<string, any> | null;
  createdAt: string;
  editedAt: string | null;
  deletedAt: string | null;
  isSender: boolean;
}

export interface ConversationParticipantDto {
  userId: string;
  role: string;
  lastReadMessageId: string | null;
  lastReadAt: string | null;
}

export interface ConversationResponseDto {
  id: string;
  bookingId: string;
  status: string;
  lastMessage: MessageResponseDto | null;
  unreadCount: number;
  lastReadAt: string | null;
  participantRole: string;
  createdAt: string;
  updatedAt: string;
}

export interface MessageListResponseDto {
  messages: MessageResponseDto[];
  nextCursor: string | null;
  hasMore: boolean;
  conversation: ConversationResponseDto;
}
