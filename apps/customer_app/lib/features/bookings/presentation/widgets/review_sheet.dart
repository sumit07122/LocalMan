import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../data/booking_repository.dart';
import '../../domain/review_item.dart';

class ReviewSheet extends ConsumerStatefulWidget {
  final String bookingId;
  final ReviewItem? existingReview;
  final VoidCallback onReviewSubmitted;

  const ReviewSheet({
    super.key,
    required this.bookingId,
    this.existingReview,
    required this.onReviewSubmitted,
  });

  @override
  ConsumerState<ReviewSheet> createState() => _ReviewSheetState();
}

class _ReviewSheetState extends ConsumerState<ReviewSheet> {
  int _selectedRating = 5;
  final TextEditingController _titleController = TextEditingController();
  final TextEditingController _commentController = TextEditingController();
  bool _isSubmitting = false;
  String? _errorMessage;

  @override
  void initState() {
    super.initState();
    if (widget.existingReview != null) {
      _selectedRating = widget.existingReview!.rating;
      _titleController.text = widget.existingReview!.title ?? '';
      _commentController.text = widget.existingReview!.comment ?? '';
    }
  }

  @override
  void dispose() {
    _titleController.dispose();
    _commentController.dispose();
    super.dispose();
  }

  Future<void> _handleSubmit() async {
    if (_selectedRating < 1 || _selectedRating > 5) {
      setState(() => _errorMessage = 'Please select a rating between 1 and 5 stars.');
      return;
    }

    setState(() {
      _isSubmitting = true;
      _errorMessage = null;
    });

    try {
      final repo = ref.read(bookingRepositoryProvider);
      if (widget.existingReview != null) {
        await repo.updateBookingReview(
          widget.bookingId,
          rating: _selectedRating,
          title: _titleController.text.trim().isNotEmpty ? _titleController.text.trim() : null,
          comment: _commentController.text.trim().isNotEmpty ? _commentController.text.trim() : null,
        );
      } else {
        await repo.submitBookingReview(
          widget.bookingId,
          rating: _selectedRating,
          title: _titleController.text.trim().isNotEmpty ? _titleController.text.trim() : null,
          comment: _commentController.text.trim().isNotEmpty ? _commentController.text.trim() : null,
        );
      }

      if (mounted) {
        Navigator.of(context).pop();
        widget.onReviewSubmitted();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              widget.existingReview != null
                  ? 'Your review has been updated successfully.'
                  : 'Thank you! Your review has been submitted.',
            ),
            backgroundColor: const Color(0xFF10B981),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _isSubmitting = false;
          _errorMessage = e.toString().replaceAll('Exception: ', '');
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final isEditing = widget.existingReview != null;

    return Padding(
      padding: EdgeInsets.only(
        bottom: MediaQuery.of(context).viewInsets.bottom,
        left: 20,
        right: 20,
        top: 24,
      ),
      child: SingleChildScrollView(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  isEditing ? 'Edit Your Review' : 'Rate Your Service',
                  style: const TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: Color(0xFF0F172A),
                  ),
                ),
                IconButton(
                  icon: const Icon(Icons.close),
                  onPressed: () => Navigator.of(context).pop(),
                ),
              ],
            ),
            const SizedBox(height: 8),
            Text(
              isEditing
                  ? 'You can edit your review within 48 hours of creation.'
                  : 'How was your experience with the assigned professional? Your verified rating helps build provider reputation.',
              style: const TextStyle(fontSize: 13, color: Color(0xFF64748B)),
            ),
            const SizedBox(height: 20),

            // Star Rating Row
            Center(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: List.generate(5, (index) {
                  final starIndex = index + 1;
                  return IconButton(
                    iconSize: 36,
                    padding: const EdgeInsets.symmetric(horizontal: 4),
                    icon: Icon(
                      starIndex <= _selectedRating ? Icons.star : Icons.star_border,
                      color: const Color(0xFFF59E0B),
                    ),
                    onPressed: _isSubmitting
                        ? null
                        : () => setState(() => _selectedRating = starIndex),
                  );
                }),
              ),
            ),
            Center(
              child: Text(
                _getRatingLabel(_selectedRating),
                style: const TextStyle(
                  fontSize: 14,
                  fontWeight: FontWeight.w700,
                  color: Color(0xFFD97706),
                ),
              ),
            ),
            const SizedBox(height: 20),

            // Review Title
            TextField(
              controller: _titleController,
              enabled: !_isSubmitting,
              maxLength: 100,
              decoration: InputDecoration(
                labelText: 'Review Title (Optional)',
                hintText: 'e.g. Prompt service, thoroughly professional',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
            const SizedBox(height: 12),

            // Review Comment
            TextField(
              controller: _commentController,
              enabled: !_isSubmitting,
              maxLines: 4,
              maxLength: 1000,
              decoration: InputDecoration(
                labelText: 'Detailed Comments (Optional)',
                hintText: 'Share details of your experience, quality of work, and timeliness...',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),

            if (_errorMessage != null) ...[
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(10),
                decoration: BoxDecoration(
                  color: const Color(0xFFFEE2E2),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Text(
                  _errorMessage!,
                  style: const TextStyle(color: Color(0xFFDC2626), fontSize: 12, fontWeight: FontWeight.w600),
                ),
              ),
            ],

            const SizedBox(height: 20),

            // Action Button
            ElevatedButton(
              onPressed: _isSubmitting ? null : _handleSubmit,
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F172A),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: _isSubmitting
                  ? const SizedBox(
                      width: 20,
                      height: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                    )
                  : Text(
                      isEditing ? 'Save Changes' : 'Submit Review',
                      style: const TextStyle(fontSize: 15, fontWeight: FontWeight.w700),
                    ),
            ),
            const SizedBox(height: 20),
          ],
        ),
      ),
    );
  }

  String _getRatingLabel(int rating) {
    switch (rating) {
      case 5:
        return '5 Stars — Excellent Service';
      case 4:
        return '4 Stars — Good Service';
      case 3:
        return '3 Stars — Average Service';
      case 2:
        return '2 Stars — Below Expectations';
      case 1:
        return '1 Star — Poor Service';
      default:
        return '';
    }
  }
}
