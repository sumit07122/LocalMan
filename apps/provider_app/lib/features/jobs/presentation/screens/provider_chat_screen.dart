import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/booking_repository.dart';
import '../../../../shared/models/chat_model.dart';

/// Production-grade provider chat screen for LocalMan Phase 3I.
/// Booking-scoped, participant-authorized, resilient to offline/retry states.
class ProviderChatScreen extends ConsumerStatefulWidget {
  final String bookingId;
  final String? customerName;

  const ProviderChatScreen({
    super.key,
    required this.bookingId,
    this.customerName,
  });

  @override
  ConsumerState<ProviderChatScreen> createState() => _ProviderChatScreenState();
}

class _ProviderChatScreenState extends ConsumerState<ProviderChatScreen> {
  final TextEditingController _controller = TextEditingController();
  final ScrollController _scrollController = ScrollController();
  final List<ChatMessage> _messages = [];
  bool _isLoading = true;
  bool _isLoadingMore = false;
  bool _hasMore = false;
  String? _nextCursor;
  String? _errorMessage;
  ChatConversation? _conversation;

  @override
  void initState() {
    super.initState();
    _loadInitialMessages();
    _scrollController.addListener(_onScroll);
  }

  @override
  void dispose() {
    _controller.dispose();
    _scrollController.dispose();
    super.dispose();
  }

  void _onScroll() {
    if (_scrollController.position.pixels >= _scrollController.position.maxScrollExtent - 100 &&
        !_isLoadingMore &&
        _hasMore) {
      _loadMoreMessages();
    }
  }

  Future<void> _loadInitialMessages() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final repo = ref.read(bookingRepositoryProvider);
      final page = await repo.getBookingMessages(widget.bookingId, limit: 50);

      if (mounted) {
        setState(() {
          _messages.clear();
          _messages.addAll(page.messages);
          _hasMore = page.hasMore;
          _nextCursor = page.nextCursor;
          _conversation = page.conversation;
          _isLoading = false;
        });

        // Mark read
        _markRead();
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isLoading = false;
          _errorMessage = 'Unable to load conversation. Please check your connectivity.';
        });
      }
    }
  }

  Future<void> _loadMoreMessages() async {
    if (_isLoadingMore || !_hasMore || _nextCursor == null) return;

    setState(() => _isLoadingMore = true);

    try {
      final repo = ref.read(bookingRepositoryProvider);
      final page = await repo.getBookingMessages(
        widget.bookingId,
        cursor: _nextCursor,
        limit: 50,
      );

      if (mounted) {
        setState(() {
          _messages.insertAll(0, page.messages);
          _hasMore = page.hasMore;
          _nextCursor = page.nextCursor;
          _isLoadingMore = false;
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() => _isLoadingMore = false);
      }
    }
  }

  Future<void> _markRead() async {
    try {
      final repo = ref.read(bookingRepositoryProvider);
      await repo.markBookingMessagesRead(widget.bookingId);
    } catch (_) {
      // Non-critical, ignore silent failures
    }
  }

  Future<void> _sendMessage() async {
    final text = _controller.text.trim();
    if (text.isEmpty) return;

    final clientMsgId = 'pro_${DateTime.now().millisecondsSinceEpoch}_${_messages.length + 1}';
    final pending = ChatMessage.createPending(
      bookingId: widget.bookingId,
      conversationId: _conversation?.id ?? 'conv_${widget.bookingId}',
      clientMessageId: clientMsgId,
      body: text,
    );

    setState(() {
      _messages.add(pending);
      _controller.clear();
    });

    _scrollToBottom();

    try {
      final repo = ref.read(bookingRepositoryProvider);
      final confirmed = await repo.sendBookingMessage(
        widget.bookingId,
        clientMessageId: clientMsgId,
        body: text,
      );

      if (mounted) {
        setState(() {
          final idx = _messages.indexWhere((m) => m.clientMessageId == clientMsgId);
          if (idx != -1) {
            _messages[idx] = confirmed;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          final idx = _messages.indexWhere((m) => m.clientMessageId == clientMsgId);
          if (idx != -1) {
            _messages[idx] = _messages[idx].copyWith(
              deliveryStatus: MessageDeliveryStatus.failed,
            );
          }
        });
      }
    }
  }

  Future<void> _retryMessage(ChatMessage msg) async {
    setState(() {
      final idx = _messages.indexWhere((m) => m.clientMessageId == msg.clientMessageId);
      if (idx != -1) {
        _messages[idx] = _messages[idx].copyWith(
          deliveryStatus: MessageDeliveryStatus.sending,
        );
      }
    });

    try {
      final repo = ref.read(bookingRepositoryProvider);
      final confirmed = await repo.sendBookingMessage(
        widget.bookingId,
        clientMessageId: msg.clientMessageId,
        body: msg.body,
      );

      if (mounted) {
        setState(() {
          final idx = _messages.indexWhere((m) => m.clientMessageId == msg.clientMessageId);
          if (idx != -1) {
            _messages[idx] = confirmed;
          }
        });
      }
    } catch (_) {
      if (mounted) {
        setState(() {
          final idx = _messages.indexWhere((m) => m.clientMessageId == msg.clientMessageId);
          if (idx != -1) {
            _messages[idx] = _messages[idx].copyWith(
              deliveryStatus: MessageDeliveryStatus.failed,
            );
          }
        });
      }
    }
  }

  void _scrollToBottom() {
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (_scrollController.hasClients) {
        _scrollController.animateTo(
          _scrollController.position.maxScrollExtent,
          duration: const Duration(milliseconds: 250),
          curve: Curves.easeOut,
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.customerName != null
        ? 'Chat with ${widget.customerName}'
        : 'Customer Chat';

    return Scaffold(
      appBar: AppBar(
        title: Text(title, style: const TextStyle(fontSize: 18, fontWeight: FontWeight.w600)),
        centerTitle: false,
      ),
      body: SafeArea(
        child: Column(
          children: [
            Expanded(
              child: _isLoading
                  ? const Center(child: CircularProgressIndicator())
                  : _errorMessage != null
                      ? Center(
                          child: Column(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(_errorMessage!, textAlign: TextAlign.center),
                              const SizedBox(height: 12),
                              ElevatedButton(
                                onPressed: _loadInitialMessages,
                                child: const Text('Retry'),
                              ),
                            ],
                          ),
                        )
                      : _messages.isEmpty
                          ? const Center(
                              child: Text(
                                'No messages yet.\nMessage customer to confirm arrival time or ask for details.',
                                textAlign: TextAlign.center,
                                style: TextStyle(color: Colors.grey),
                              ),
                            )
                          : ListView.builder(
                              controller: _scrollController,
                              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                              itemCount: _messages.length + (_isLoadingMore ? 1 : 0),
                              itemBuilder: (context, index) {
                                if (_isLoadingMore && index == 0) {
                                  return const Center(
                                    child: Padding(
                                      padding: EdgeInsets.all(8.0),
                                      child: CircularProgressIndicator(strokeWidth: 2),
                                    ),
                                  );
                                }
                                final actualIndex = _isLoadingMore ? index - 1 : index;
                                final message = _messages[actualIndex];
                                return _buildMessageBubble(message);
                              },
                            ),
            ),
            _buildComposer(),
          ],
        ),
      ),
    );
  }

  Widget _buildMessageBubble(ChatMessage msg) {
    if (msg.isSystem) {
      return Container(
        margin: const EdgeInsets.symmetric(vertical: 8),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.grey.shade100,
          borderRadius: BorderRadius.circular(12),
          border: Border.all(color: Colors.grey.shade300),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Icon(Icons.info_outline, size: 16, color: Colors.blueGrey),
            const SizedBox(width: 8),
            Flexible(
              child: Text(
                msg.body,
                textAlign: TextAlign.center,
                style: const TextStyle(fontSize: 13, color: Colors.blueGrey, fontWeight: FontWeight.w500),
              ),
            ),
          ],
        ),
      );
    }

    final isMe = msg.isSender;
    final isFailed = msg.deliveryStatus == MessageDeliveryStatus.failed;
    final isSending = msg.deliveryStatus == MessageDeliveryStatus.sending;

    return Align(
      alignment: isMe ? Alignment.centerRight : Alignment.centerLeft,
      child: Container(
        margin: const EdgeInsets.symmetric(vertical: 4),
        constraints: BoxConstraints(maxWidth: MediaQuery.of(context).size.width * 0.75),
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
        decoration: BoxDecoration(
          color: isMe ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9),
          borderRadius: BorderRadius.only(
            topLeft: const Radius.circular(16),
            topRight: const Radius.circular(16),
            bottomLeft: Radius.circular(isMe ? 16 : 4),
            bottomRight: Radius.circular(isMe ? 4 : 16),
          ),
        ),
        child: Column(
          crossAxisAlignment: isMe ? CrossAxisAlignment.end : CrossAxisAlignment.start,
          children: [
            Text(
              msg.body,
              style: TextStyle(
                fontSize: 15,
                color: isMe ? Colors.white : Colors.black87,
              ),
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  _formatTime(msg.createdAt),
                  style: TextStyle(
                    fontSize: 11,
                    color: isMe ? Colors.white70 : Colors.black45,
                  ),
                ),
                if (isMe) ...[
                  const SizedBox(width: 4),
                  if (isSending)
                    const SizedBox(
                      width: 10,
                      height: 10,
                      child: CircularProgressIndicator(strokeWidth: 1.5, color: Colors.white70),
                    )
                  else if (isFailed)
                    GestureDetector(
                      onTap: () => _retryMessage(msg),
                      child: const Row(
                        children: [
                          Icon(Icons.error_outline, size: 14, color: Colors.amberAccent),
                          SizedBox(width: 2),
                          Text('Retry', style: TextStyle(fontSize: 10, color: Colors.amberAccent)),
                        ],
                      ),
                    )
                  else
                    const Icon(Icons.done, size: 14, color: Colors.white70),
                ],
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildComposer() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white,
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.05),
            offset: const Offset(0, -2),
            blurRadius: 4,
          ),
        ],
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: _controller,
              maxLength: 2000,
              maxLines: null,
              keyboardType: TextInputType.multiline,
              textCapitalization: TextCapitalization.sentences,
              decoration: const InputDecoration(
                hintText: 'Message customer...',
                counterText: '',
                border: InputBorder.none,
                contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              ),
              onSubmitted: (_) => _sendMessage(),
            ),
          ),
          IconButton(
            icon: const Icon(Icons.send_rounded, color: Color(0xFF0F172A)),
            onPressed: _sendMessage,
          ),
        ],
      ),
    );
  }

  String _formatTime(DateTime dt) {
    final hour = dt.hour.toString().padLeft(2, '0');
    final minute = dt.minute.toString().padLeft(2, '0');
    return '$hour:$minute';
  }
}
