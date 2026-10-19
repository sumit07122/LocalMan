/// Production-grade provider chat & messaging models for LocalMan Phase 3I.
/// Booking-scoped, participant-authorized, resilient to offline/retry states.
///
/// Privacy & Authorization Invariants:
/// - Sender identity is server-authoritative.
/// - Customer payment credentials and sensitive tokens are NEVER exposed.
/// - Client message reconciliation is handled via clientMessageId.

enum MessageDeliveryStatus {
  sending,
  sent,
  failed,
}

class ChatMessageReplySummary {
  final String id;
  final String body;
  final String senderRole;

  const ChatMessageReplySummary({
    required this.id,
    required this.body,
    required this.senderRole,
  });

  factory ChatMessageReplySummary.fromJson(Map<String, dynamic> json) {
    return ChatMessageReplySummary(
      id: json['id'] as String,
      body: json['body'] as String? ?? '',
      senderRole: json['senderRole'] as String? ?? 'SYSTEM',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'body': body,
      'senderRole': senderRole,
    };
  }
}

class ChatMessage {
  final String id;
  final String conversationId;
  final String bookingId;
  final String? senderUserId;
  final String senderRole; // 'CUSTOMER' | 'PROVIDER' | 'SYSTEM' | 'ADMIN'
  final String? senderName;
  final String clientMessageId;
  final String messageType; // 'TEXT' | 'SYSTEM' | etc.
  final String body;
  final bool isSender;
  final ChatMessageReplySummary? replyTo;
  final Map<String, dynamic>? metadata;
  final DateTime createdAt;
  final MessageDeliveryStatus deliveryStatus;

  const ChatMessage({
    required this.id,
    required this.conversationId,
    required this.bookingId,
    this.senderUserId,
    required this.senderRole,
    this.senderName,
    required this.clientMessageId,
    required this.messageType,
    required this.body,
    required this.isSender,
    this.replyTo,
    this.metadata,
    required this.createdAt,
    this.deliveryStatus = MessageDeliveryStatus.sent,
  });

  bool get isSystem => messageType == 'SYSTEM' || senderRole == 'SYSTEM';

  factory ChatMessage.fromJson(Map<String, dynamic> json) {
    return ChatMessage(
      id: json['id'] as String,
      conversationId: json['conversationId'] as String,
      bookingId: json['bookingId'] as String,
      senderUserId: json['senderUserId'] as String?,
      senderRole: json['senderRole'] as String? ?? 'SYSTEM',
      senderName: json['senderName'] as String?,
      clientMessageId: json['clientMessageId'] as String? ?? '',
      messageType: json['messageType'] as String? ?? 'TEXT',
      body: json['body'] as String? ?? '',
      isSender: json['isSender'] as bool? ?? false,
      replyTo: json['replyTo'] != null
          ? ChatMessageReplySummary.fromJson(json['replyTo'] as Map<String, dynamic>)
          : null,
      metadata: json['metadata'] as Map<String, dynamic>?,
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      deliveryStatus: MessageDeliveryStatus.sent,
    );
  }

  /// Create local pending message before server confirmation
  factory ChatMessage.createPending({
    required String bookingId,
    required String conversationId,
    required String clientMessageId,
    required String body,
    ChatMessageReplySummary? replyTo,
  }) {
    return ChatMessage(
      id: 'pending_$clientMessageId',
      conversationId: conversationId,
      bookingId: bookingId,
      senderRole: 'PROVIDER',
      clientMessageId: clientMessageId,
      messageType: 'TEXT',
      body: body,
      isSender: true,
      replyTo: replyTo,
      createdAt: DateTime.now(),
      deliveryStatus: MessageDeliveryStatus.sending,
    );
  }

  ChatMessage copyWith({
    String? id,
    MessageDeliveryStatus? deliveryStatus,
    DateTime? createdAt,
  }) {
    return ChatMessage(
      id: id ?? this.id,
      conversationId: conversationId,
      bookingId: bookingId,
      senderUserId: senderUserId,
      senderRole: senderRole,
      senderName: senderName,
      clientMessageId: clientMessageId,
      messageType: messageType,
      body: body,
      isSender: isSender,
      replyTo: replyTo,
      metadata: metadata,
      createdAt: createdAt ?? this.createdAt,
      deliveryStatus: deliveryStatus ?? this.deliveryStatus,
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'conversationId': conversationId,
      'bookingId': bookingId,
      'senderUserId': senderUserId,
      'senderRole': senderRole,
      'senderName': senderName,
      'clientMessageId': clientMessageId,
      'messageType': messageType,
      'body': body,
      'isSender': isSender,
      if (replyTo != null) 'replyTo': replyTo!.toJson(),
      if (metadata != null) 'metadata': metadata,
      'createdAt': createdAt.toIso8601String(),
    };
  }
}

class ChatConversation {
  final String id;
  final String bookingId;
  final String status;
  final DateTime? lastMessageAt;
  final int unreadCount;
  final DateTime? lastReadAt;
  final ChatMessage? latestMessage;
  final String participantRole;

  const ChatConversation({
    required this.id,
    required this.bookingId,
    required this.status,
    this.lastMessageAt,
    required this.unreadCount,
    this.lastReadAt,
    this.latestMessage,
    required this.participantRole,
  });

  bool get isActive => status == 'ACTIVE';

  factory ChatConversation.fromJson(Map<String, dynamic> json) {
    return ChatConversation(
      id: json['id'] as String,
      bookingId: json['bookingId'] as String,
      status: json['status'] as String? ?? 'ACTIVE',
      lastMessageAt: json['lastMessageAt'] != null
          ? DateTime.tryParse(json['lastMessageAt'] as String)
          : null,
      unreadCount: (json['unreadCount'] as num?)?.toInt() ?? 0,
      lastReadAt: json['lastReadAt'] != null
          ? DateTime.tryParse(json['lastReadAt'] as String)
          : null,
      latestMessage: json['latestMessage'] != null
          ? ChatMessage.fromJson(json['latestMessage'] as Map<String, dynamic>)
          : null,
      participantRole: json['participantRole'] as String? ?? 'PROVIDER',
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'id': id,
      'bookingId': bookingId,
      'status': status,
      if (lastMessageAt != null) 'lastMessageAt': lastMessageAt!.toIso8601String(),
      'unreadCount': unreadCount,
      if (lastReadAt != null) 'lastReadAt': lastReadAt!.toIso8601String(),
      if (latestMessage != null) 'latestMessage': latestMessage!.toJson(),
      'participantRole': participantRole,
    };
  }
}

class ChatMessagesPage {
  final List<ChatMessage> messages;
  final String? nextCursor;
  final bool hasMore;
  final ChatConversation? conversation;

  const ChatMessagesPage({
    required this.messages,
    this.nextCursor,
    required this.hasMore,
    this.conversation,
  });

  factory ChatMessagesPage.fromJson(Map<String, dynamic> json) {
    final list = (json['messages'] as List<dynamic>? ?? [])
        .map((m) => ChatMessage.fromJson(m as Map<String, dynamic>))
        .toList();

    return ChatMessagesPage(
      messages: list,
      nextCursor: json['nextCursor'] as String?,
      hasMore: json['hasMore'] as bool? ?? false,
      conversation: json['conversation'] != null
          ? ChatConversation.fromJson(json['conversation'] as Map<String, dynamic>)
          : null,
    );
  }
}
