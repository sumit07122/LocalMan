import { prisma } from '../../config/database.js';
import {
  NotFoundError,
  ForbiddenError,
  BadRequestError,
  ConflictError,
  ValidationError,
} from '../../common/errors/app-error.js';
import {
  BookingStatus,
  MessageType,
  ConversationStatus,
  ParticipantRole,
  CHAT_MAX_MESSAGE_LENGTH,
  CHAT_DEFAULT_PAGE_SIZE,
  CHAT_MAX_PAGE_SIZE,
} from '@localman/constants';
import {
  SendMessageInput,
  ListMessagesQueryInput,
  MarkReadInput,
  MessageResponseDto,
  ConversationResponseDto,
  MessageListResponseDto,
} from '@localman/contracts';
import { AuthenticatedUser } from '../../common/middleware/auth.middleware.js';
import { realtimeService } from '../realtime/realtime.service.js';

class ChatLockManager {
  private locks = new Map<string, Promise<void>>();

  async runWithLock<T>(key: string, fn: () => Promise<T>): Promise<T> {
    while (this.locks.has(key)) {
      await this.locks.get(key);
    }
    let resolveLock!: () => void;
    const lockPromise = new Promise<void>((resolve) => {
      resolveLock = resolve;
    });
    this.locks.set(key, lockPromise);
    try {
      return await fn();
    } finally {
      this.locks.delete(key);
      resolveLock();
    }
  }
}

export class ChatService {
  private lockManager = new ChatLockManager();

  /**
   * Allowed booking states where participants may actively send messages
   */
  private static readonly ACTIVE_CHAT_STATES: string[] = [
    BookingStatus.PROVIDER_ACCEPTED,
    BookingStatus.CONFIRMED,
    BookingStatus.PROVIDER_ON_THE_WAY,
    BookingStatus.ARRIVED,
    BookingStatus.JOB_STARTED,
    BookingStatus.JOB_EXTENDED,
    BookingStatus.JOB_COMPLETED,
  ];

  /**
   * Closed states where chat is strictly read-only for historical audit
   */
  private static readonly CLOSED_CHAT_STATES: string[] = [
    BookingStatus.CANCELLED,
    BookingStatus.NO_SHOW,
    BookingStatus.REFUNDED,
    BookingStatus.PAYMENT_SETTLED,
    BookingStatus.EXPIRED,
  ];

  /**
   * Helper to map a raw DB message to MessageResponseDto
   */
  private mapToMessageDto(
    message: any,
    bookingId: string,
    currentUserId?: string
  ): MessageResponseDto {
    const isSender = Boolean(currentUserId && message.senderUserId === currentUserId);
    let senderRole = 'SYSTEM';
    if (message.senderUserId) {
      if (message.sender?.role) {
        senderRole = message.sender.role;
      } else if (message.metadata?.senderRole) {
        senderRole = message.metadata.senderRole;
      } else {
        senderRole = 'USER';
      }
    }

    return {
      id: message.id,
      conversationId: message.conversationId,
      bookingId,
      senderUserId: message.senderUserId,
      senderRole,
      senderName: message.sender?.fullName || message.metadata?.senderName || undefined,
      clientMessageId: message.clientMessageId || null,
      messageType: message.messageType || MessageType.TEXT,
      body: message.body,
      replyToMessageId: message.replyToMessageId || null,
      metadata: message.metadata || null,
      createdAt: message.createdAt instanceof Date ? message.createdAt.toISOString() : new Date(message.createdAt).toISOString(),
      editedAt: message.editedAt ? new Date(message.editedAt).toISOString() : null,
      deletedAt: message.deletedAt ? new Date(message.deletedAt).toISOString() : null,
      isSender,
    };
  }

  /**
   * Helper to map a conversation to ConversationResponseDto
   */
  private mapToConversationDto(
    conversation: any,
    bookingId: string,
    participantRole: string,
    unreadCount: number = 0,
    lastReadAt: string | null = null,
    lastMessage: any = null,
    currentUserId?: string
  ): ConversationResponseDto {
    return {
      id: conversation.id,
      bookingId,
      status: conversation.status || ConversationStatus.ACTIVE,
      lastMessage: lastMessage ? this.mapToMessageDto(lastMessage, bookingId, currentUserId) : null,
      unreadCount,
      lastReadAt,
      participantRole,
      createdAt: conversation.createdAt instanceof Date ? conversation.createdAt.toISOString() : new Date(conversation.createdAt).toISOString(),
      updatedAt: conversation.updatedAt instanceof Date ? conversation.updatedAt.toISOString() : new Date(conversation.updatedAt).toISOString(),
    };
  }

  /**
   * Authorize user access to booking conversation
   */
  private async authorizeBookingParticipant(
    user: AuthenticatedUser,
    bookingId: string,
    requireActiveSending: boolean = false
  ): Promise<{ booking: any; participantRole: string }> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        customer: true,
        provider: { include: { user: true } },
      },
    });

    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    const isCustomer = booking.customerId === user.id;
    const isAssignedProvider = Boolean(
      booking.provider && booking.provider.userId === user.id
    );
    const isAdmin =
      user.roles.includes('ADMIN') ||
      user.roles.includes('CUSTOMER_SUPPORT') ||
      user.roles.includes('CITY_MANAGER') ||
      user.roles.includes('DISPUTE_ARBITRATOR');

    if (!isCustomer && !isAssignedProvider && !isAdmin) {
      throw new ForbiddenError(
        'Access denied: You are not an authorized participant in this booking.'
      );
    }

    let participantRole: string = ParticipantRole.CUSTOMER;
    if (isAssignedProvider) participantRole = ParticipantRole.PROVIDER;
    if (isAdmin && !isCustomer && !isAssignedProvider) participantRole = ParticipantRole.ADMIN;

    if (requireActiveSending) {
      // Admins are read-only observers by default
      if (isAdmin && !isCustomer && !isAssignedProvider) {
        throw new ForbiddenError('Admin access to booking conversation is read-only.');
      }

      // Check provider assignment
      if (!booking.providerId) {
        throw new BadRequestError(
          'Cannot send chat messages until a provider is assigned to this booking.'
        );
      }

      // Check lifecycle policy
      if (ChatService.CLOSED_CHAT_STATES.includes(booking.currentStatus)) {
        throw new BadRequestError(
          `Chat is closed for this booking (${booking.currentStatus}). Historical messages are read-only.`
        );
      }

      if (!ChatService.ACTIVE_CHAT_STATES.includes(booking.currentStatus)) {
        throw new BadRequestError(
          `Chat sending is not permitted while booking is in '${booking.currentStatus}' status.`
        );
      }
    }

    return { booking, participantRole };
  }

  /**
   * Get or create a conversation for a booking idempotently
   */
  async getOrCreateConversation(
    user: AuthenticatedUser,
    bookingId: string
  ): Promise<ConversationResponseDto> {
    const { booking, participantRole } = await this.authorizeBookingParticipant(
      user,
      bookingId,
      false
    );

    return await this.lockManager.runWithLock(`conv_init_${bookingId}`, async () => {
      let conversation = await prisma.conversation.findUnique({
        where: { bookingId },
        include: {
          participants: true,
        },
      });

      if (!conversation) {
        conversation = await prisma.conversation.create({
          data: {
            bookingId,
            status: ConversationStatus.ACTIVE,
          },
          include: {
            participants: true,
          },
        });

        // Seed participants
        await prisma.conversationParticipant.create({
          data: {
            conversationId: conversation.id,
            userId: booking.customerId,
            role: ParticipantRole.CUSTOMER,
          },
        });

        if (booking.provider?.userId) {
          await prisma.conversationParticipant.create({
            data: {
              conversationId: conversation.id,
              userId: booking.provider.userId,
              role: ParticipantRole.PROVIDER,
            },
          });
        }
      } else {
        // Ensure assigned provider is registered as participant if assigned later
        if (booking.provider?.userId) {
          const hasProviderParticipant = conversation.participants?.some(
            (p: any) => p.userId === booking.provider.userId
          );
          if (!hasProviderParticipant) {
            await prisma.conversationParticipant.create({
              data: {
                conversationId: conversation.id,
                userId: booking.provider.userId,
                role: ParticipantRole.PROVIDER,
              },
            });
          }
        }
      }

      // Compute unread count & last read
      const participant = await prisma.conversationParticipant.findFirst({
        where: {
          conversationId: conversation.id,
          userId: user.id,
        },
      });

      const lastReadAt = participant?.lastReadAt ? new Date(participant.lastReadAt).toISOString() : null;
      let unreadCount = 0;
      if (participant?.lastReadAt) {
        unreadCount = await prisma.message.count({
          where: {
            conversationId: conversation.id,
            deletedAt: null,
            createdAt: { gt: participant.lastReadAt },
            senderUserId: { not: user.id },
          },
        });
      } else {
        unreadCount = await prisma.message.count({
          where: {
            conversationId: conversation.id,
            deletedAt: null,
            senderUserId: { not: user.id },
          },
        });
      }

      // Get latest message
      const latestMessage = await prisma.message.findFirst({
        where: { conversationId: conversation.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
        include: { sender: true },
      });

      return this.mapToConversationDto(
        conversation,
        bookingId,
        participantRole,
        unreadCount,
        lastReadAt,
        latestMessage,
        user.id
      );
    });
  }

  /**
   * Send a message with strict idempotency, ordering, and validation
   */
  async sendMessage(
    user: AuthenticatedUser,
    bookingId: string,
    input: SendMessageInput
  ): Promise<MessageResponseDto> {
    // 1. Validation
    const cleanBody = (input.body || '').trim();
    if (!cleanBody) {
      throw new ValidationError('Message body cannot be empty.');
    }
    if (cleanBody.length > CHAT_MAX_MESSAGE_LENGTH) {
      throw new ValidationError(
        `Message exceeds maximum allowed length of ${CHAT_MAX_MESSAGE_LENGTH} characters.`
      );
    }

    // 2. Authorization & Lifecycle Policy Gate
    const { participantRole } = await this.authorizeBookingParticipant(
      user,
      bookingId,
      true
    );

    // 3. Ensure conversation exists
    await this.getOrCreateConversation(user, bookingId);

    const conversation = await prisma.conversation.findUnique({
      where: { bookingId },
    });
    if (!conversation) {
      throw new NotFoundError('Conversation not found for booking.');
    }

    // 4. Lock on (conversationId, clientMessageId) to serialize concurrent retries
    const lockKey = `msg_${conversation.id}_${input.clientMessageId}`;
    return await this.lockManager.runWithLock(lockKey, async () => {
      // 5. Atomic transaction
      return await prisma.$transaction(async (tx) => {
        // Check idempotency: Has this clientMessageId already been processed in this conversation?
        const existing = await tx.message.findFirst({
          where: {
            conversationId: conversation.id,
            clientMessageId: input.clientMessageId,
          },
          include: { sender: true, replyTo: true },
        });

        if (existing) {
          // Idempotent retry: verify sender ownership
          if (existing.senderUserId !== user.id) {
            throw new ConflictError(
              'Conflict: clientMessageId has already been used by another sender.'
            );
          }
          // Return existing message without duplicating or emitting duplicate events
          return this.mapToMessageDto(existing, bookingId, user.id);
        }

        // Validate replyTo target if provided
        if (input.replyToMessageId) {
          const replyTarget = await tx.message.findUnique({
            where: { id: input.replyToMessageId },
          });
          if (!replyTarget || replyTarget.conversationId !== conversation.id) {
            throw new BadRequestError(
              'Reply target message not found in this conversation.'
            );
          }
        }

        const now = new Date();

        // Persist message
        const createdMessage = await tx.message.create({
          data: {
            conversationId: conversation.id,
            senderUserId: user.id,
            clientMessageId: input.clientMessageId,
            messageType: input.messageType || MessageType.TEXT,
            body: cleanBody,
            replyToMessageId: input.replyToMessageId || null,
            metadata: {
              ...(input.metadata || {}),
              senderRole: participantRole,
              senderName: (user as any).name || (user as any).fullName || 'User',
            },
            createdAt: now,
          },
          include: {
            sender: true,
            replyTo: true,
          },
        });

        // Update conversation lastMessageAt
        await tx.conversation.update({
          where: { id: conversation.id },
          data: {
            lastMessageAt: now,
          },
        });

        // Auto-advance sender's own read marker
        await tx.conversationParticipant.upsert({
          where: {
            idx_participant_conversation_user: {
              conversationId: conversation.id,
              userId: user.id,
            },
          },
          update: {
            lastReadMessageId: createdMessage.id,
            lastReadAt: now,
          },
          create: {
            conversationId: conversation.id,
            userId: user.id,
            role: participantRole,
            lastReadMessageId: createdMessage.id,
            lastReadAt: now,
          },
        });

        const dto = this.mapToMessageDto(createdMessage, bookingId, user.id);

        // Transactional outbox event
        await tx.chatOutboxEvent.create({
          data: {
            channel: `booking:${bookingId}`,
            eventType: 'MESSAGE_SENT',
            payload: dto as any,
            isDelivered: false,
          },
        });

        // Realtime publish (non-blocking outside commit)
        realtimeService.publish(`booking:${bookingId}`, 'MESSAGE_SENT', dto);
        realtimeService.publish(`booking:${bookingId}:messages`, 'MESSAGE_SENT', dto);

        return dto;
      });
    });
  }

  /**
   * List messages with cursor-based pagination and deterministic ordering
   */
  async listMessages(
    user: AuthenticatedUser,
    bookingId: string,
    query: ListMessagesQueryInput
  ): Promise<MessageListResponseDto> {
    const { participantRole } = await this.authorizeBookingParticipant(
      user,
      bookingId,
      false
    );

    const conversation = await prisma.conversation.findUnique({
      where: { bookingId },
    });

    if (!conversation) {
      // Return empty conversation response
      const emptyConv: ConversationResponseDto = {
        id: `conv_${bookingId}`,
        bookingId,
        status: ConversationStatus.ACTIVE,
        lastMessage: null,
        unreadCount: 0,
        lastReadAt: null,
        participantRole,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };
      return {
        messages: [],
        nextCursor: null,
        hasMore: false,
        conversation: emptyConv,
      };
    }

    const limit = Math.min(
      Math.max(1, query.limit || CHAT_DEFAULT_PAGE_SIZE),
      CHAT_MAX_PAGE_SIZE
    );

    const findArgs: any = {
      where: {
        conversationId: conversation.id,
        deletedAt: null,
      },
      take: limit + 1, // Fetch +1 to check hasMore
      include: {
        sender: true,
        replyTo: true,
      },
    };

    if (query.direction === 'after') {
      findArgs.orderBy = { createdAt: 'asc' };
      if (query.cursor) {
        findArgs.cursor = { id: query.cursor };
        findArgs.skip = 1;
      }
    } else {
      findArgs.orderBy = { createdAt: 'desc' };
      if (query.cursor) {
        findArgs.cursor = { id: query.cursor };
        findArgs.skip = 1;
      }
    }

    const rawMessages = await prisma.message.findMany(findArgs);

    let hasMore = false;
    let items = rawMessages;
    if (rawMessages.length > limit) {
      hasMore = true;
      items = rawMessages.slice(0, limit);
    }

    // For default 'before' pagination, reverse items so client receives chronological ASC order
    if (query.direction !== 'after') {
      items.reverse();
    }

    const nextCursor = hasMore && items.length > 0
      ? (query.direction === 'after' ? items[items.length - 1].id : items[0].id)
      : null;

    // Participant read tracking
    const participant = await prisma.conversationParticipant.findFirst({
      where: {
        conversationId: conversation.id,
        userId: user.id,
      },
    });

    const lastReadAt = participant?.lastReadAt ? new Date(participant.lastReadAt).toISOString() : null;
    let unreadCount = 0;
    if (participant?.lastReadAt) {
      unreadCount = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          deletedAt: null,
          createdAt: { gt: participant.lastReadAt },
          senderUserId: { not: user.id },
        },
      });
    } else {
      unreadCount = await prisma.message.count({
        where: {
          conversationId: conversation.id,
          deletedAt: null,
          senderUserId: { not: user.id },
        },
      });
    }

    const latestMessage = items.length > 0 ? items[items.length - 1] : null;

    const convDto = this.mapToConversationDto(
      conversation,
      bookingId,
      participantRole,
      unreadCount,
      lastReadAt,
      latestMessage,
      user.id
    );

    return {
      messages: items.map((m: any) => this.mapToMessageDto(m, bookingId, user.id)),
      nextCursor,
      hasMore,
      conversation: convDto,
    };
  }

  /**
   * Mark conversation read up to a message or current timestamp
   */
  async markConversationRead(
    user: AuthenticatedUser,
    bookingId: string,
    input: MarkReadInput
  ): Promise<{ success: boolean; lastReadAt: string; unreadCount: number }> {
    const { participantRole } = await this.authorizeBookingParticipant(
      user,
      bookingId,
      false
    );

    let conversation = await prisma.conversation.findUnique({
      where: { bookingId },
    });

    if (!conversation) {
      await this.getOrCreateConversation(user, bookingId);
      conversation = await prisma.conversation.findUnique({
        where: { bookingId },
      });
    }

    if (!conversation) {
      throw new NotFoundError('Conversation not found.');
    }

    const now = new Date();
    let targetMessageId = input.messageId || null;

    if (input.messageId) {
      const msg = await prisma.message.findUnique({
        where: { id: input.messageId },
      });
      if (!msg || msg.conversationId !== conversation.id) {
        throw new BadRequestError('Specified messageId does not belong to this conversation.');
      }
    } else {
      const latest = await prisma.message.findFirst({
        where: { conversationId: conversation.id, deletedAt: null },
        orderBy: { createdAt: 'desc' },
      });
      targetMessageId = latest?.id || null;
    }

    await prisma.conversationParticipant.upsert({
      where: {
        idx_participant_conversation_user: {
          conversationId: conversation.id,
          userId: user.id,
        },
      },
      update: {
        lastReadMessageId: targetMessageId,
        lastReadAt: now,
      },
      create: {
        conversationId: conversation.id,
        userId: user.id,
        role: participantRole,
        lastReadMessageId: targetMessageId,
        lastReadAt: now,
      },
    });

    // Realtime notification
    realtimeService.publish(`booking:${bookingId}`, 'CONVERSATION_READ', {
      bookingId,
      conversationId: conversation.id,
      userId: user.id,
      lastReadMessageId: targetMessageId,
      lastReadAt: now.toISOString(),
    });

    return {
      success: true,
      lastReadAt: now.toISOString(),
      unreadCount: 0,
    };
  }

  /**
   * Create an automated, server-authoritative system message for booking events
   * Idempotent per (bookingId, eventType, deduplicationKey)
   */
  async createSystemMessage(
    bookingId: string,
    options: {
      eventType: string;
      body: string;
      deduplicationKey?: string;
      metadata?: Record<string, any>;
    }
  ): Promise<MessageResponseDto> {
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundError(`Cannot create system message: Booking ${bookingId} not found.`);
    }

    // Ensure conversation exists
    let conversation = await prisma.conversation.findUnique({
      where: { bookingId },
    });
    if (!conversation) {
      conversation = await prisma.conversation.create({
        data: {
          bookingId,
          status: ConversationStatus.ACTIVE,
        },
      });
    }

    const clientMessageId = options.deduplicationKey
      ? `sys_${options.eventType}_${options.deduplicationKey}`
      : `sys_${options.eventType}_${Date.now()}`;

    // Check idempotency
    const existing = await prisma.message.findFirst({
      where: {
        conversationId: conversation.id,
        clientMessageId,
      },
    });

    if (existing) {
      return this.mapToMessageDto(existing, bookingId);
    }

    const now = new Date();
    const created = await prisma.message.create({
      data: {
        conversationId: conversation.id,
        senderUserId: null, // System sender
        clientMessageId,
        messageType: MessageType.SYSTEM,
        body: options.body,
        metadata: {
          ...(options.metadata || {}),
          eventType: options.eventType,
          isSystem: true,
        },
        createdAt: now,
      },
    });

    await prisma.conversation.update({
      where: { id: conversation.id },
      data: { lastMessageAt: now },
    });

    const dto = this.mapToMessageDto(created, bookingId);

    // Transactional outbox
    await prisma.chatOutboxEvent.create({
      data: {
        channel: `booking:${bookingId}`,
        eventType: 'SYSTEM_MESSAGE',
        payload: dto as any,
        isDelivered: false,
      },
    });

    // Realtime notification
    realtimeService.publish(`booking:${bookingId}`, 'SYSTEM_MESSAGE', dto);
    realtimeService.publish(`booking:${bookingId}:messages`, 'SYSTEM_MESSAGE', dto);

    return dto;
  }

  /**
   * Admin inspection of booking conversation with audit logging
   */
  async getConversationForAdmin(
    adminUser: AuthenticatedUser,
    bookingId: string,
    query: ListMessagesQueryInput
  ): Promise<MessageListResponseDto> {
    const isAdmin =
      adminUser.roles.includes('ADMIN') ||
      adminUser.roles.includes('CUSTOMER_SUPPORT') ||
      adminUser.roles.includes('CITY_MANAGER') ||
      adminUser.roles.includes('DISPUTE_ARBITRATOR');

    if (!isAdmin) {
      throw new ForbiddenError('Unauthorized: Admin access required.');
    }

    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new NotFoundError('Booking not found.');
    }

    // Audit log admin inspection
    await prisma.auditLog.create({
      data: {
        userId: adminUser.id,
        action: 'INSPECT_CHAT_HISTORY',
        resourceType: 'BOOKING_CONVERSATION',
        resourceId: bookingId,
        newState: {
          adminRoles: adminUser.roles,
          timestamp: new Date().toISOString(),
        },
      },
    });

    return this.listMessages(adminUser, bookingId, query);
  }
}

export const chatService = new ChatService();
