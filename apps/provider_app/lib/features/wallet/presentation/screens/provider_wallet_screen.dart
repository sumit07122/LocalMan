import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../shared/models/wallet_model.dart';
import '../../data/wallet_repository.dart';

class ProviderWalletScreen extends ConsumerWidget {
  const ProviderWalletScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final walletAsync = ref.watch(walletSummaryFutureProvider);

    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Partner Wallet & Ledger'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () => context.pop(),
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.refresh),
            tooltip: 'Refresh Ledger',
            onPressed: () => ref.refresh(walletSummaryFutureProvider),
          ),
        ],
      ),
      body: walletAsync.when(
        loading: () => const Center(
          child: CircularProgressIndicator(color: Color(0xFFF59E0B)),
        ),
        error: (err, stack) => Center(
          child: Padding(
            padding: const EdgeInsets.all(24.0),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                const Icon(Icons.error_outline, size: 48, color: Colors.redAccent),
                const SizedBox(height: 16),
                const Text(
                  'Failed to load wallet ledger',
                  style: TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
                ),
                const SizedBox(height: 8),
                Text(
                  err.toString(),
                  textAlign: TextAlign.center,
                  style: const TextStyle(color: Color(0xFF64748B), fontSize: 12),
                ),
                const SizedBox(height: 20),
                ElevatedButton.icon(
                  onPressed: () => ref.refresh(walletSummaryFutureProvider),
                  icon: const Icon(Icons.refresh),
                  label: const Text('Try Again'),
                ),
              ],
            ),
          ),
        ),
        data: (summary) => RefreshIndicator(
          color: const Color(0xFFF59E0B),
          onRefresh: () async {
            ref.refresh(walletSummaryFutureProvider);
          },
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.all(16.0),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Available Balance Card
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    borderRadius: BorderRadius.circular(16),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withOpacity(0.15),
                        blurRadius: 16,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text(
                            'AVAILABLE PAYOUT BALANCE',
                            style: TextStyle(
                              color: Color(0xFF94A3B8),
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              letterSpacing: 1.1,
                            ),
                          ),
                          Icon(Icons.account_balance_wallet, color: Color(0xFFF59E0B), size: 22),
                        ],
                      ),
                      const SizedBox(height: 8),
                      Text(
                        '₹${summary.availableBalanceRupees.toStringAsFixed(2)}',
                        style: const TextStyle(
                          color: Colors.white,
                          fontSize: 34,
                          fontWeight: FontWeight.w900,
                        ),
                      ),
                      const SizedBox(height: 12),
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          _buildMetricItem('Total Earned', '₹${summary.totalEarnedRupees.toStringAsFixed(2)}'),
                          _buildMetricItem('Pending Clearance', '₹${summary.pendingBalanceRupees.toStringAsFixed(2)}'),
                          _buildMetricItem('Paid Out', '₹${summary.paidOutBalanceRupees.toStringAsFixed(2)}'),
                        ],
                      ),
                      const SizedBox(height: 16),
                      if (summary.availableBalanceRupees >= 100)
                        SizedBox(
                          width: double.infinity,
                          child: ElevatedButton.icon(
                            onPressed: () => _showWithdrawalDialog(context, ref, summary),
                            icon: const Icon(Icons.arrow_circle_up, size: 18),
                            label: const Text('Request Payout Withdrawal'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFFF59E0B),
                              foregroundColor: const Color(0xFF0F172A),
                              textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                        ),
                      const SizedBox(height: 12),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: const Row(
                          children: [
                            Icon(Icons.info_outline, color: Color(0xFFF59E0B), size: 16),
                            SizedBox(width: 8),
                            Expanded(
                              child: Text(
                                'Daily settlement ledger is managed authoritatively by the backend server. Payouts credit to verified bank account.',
                                style: TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 20),

                // Commission & Transparency Banner
                Container(
                  padding: const EdgeInsets.all(14),
                  decoration: BoxDecoration(
                    color: const Color(0xFFECFDF5),
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFF10B981).withOpacity(0.4)),
                  ),
                  child: const Row(
                    children: [
                      Icon(Icons.shield_outlined, color: Color(0xFF059669), size: 24),
                      SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Backend Authoritative Settlements',
                              style: TextStyle(fontWeight: FontWeight.w700, fontSize: 13, color: Color(0xFF065F46)),
                            ),
                            Text(
                              'Payouts are credited directly upon job completion. Platform fee and TDS are computed authoritatively on the server.',
                              style: TextStyle(fontSize: 12, color: Color(0xFF047857)),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),

                const SizedBox(height: 24),

                const Text(
                  'Settlement History',
                  style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                ),
                const SizedBox(height: 12),

                if (summary.recentLedger.isEmpty)
                  Container(
                    padding: const EdgeInsets.all(24),
                    width: double.infinity,
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: const Column(
                      children: [
                        Icon(Icons.receipt_long, size: 40, color: Color(0xFFCBD5E1)),
                        SizedBox(height: 12),
                        Text(
                          'No settled payouts yet',
                          style: TextStyle(fontWeight: FontWeight.w700, fontSize: 14, color: Color(0xFF0F172A)),
                        ),
                        SizedBox(height: 4),
                        Text(
                          'Completed job earnings will appear here once payment is confirmed.',
                          style: TextStyle(color: Color(0xFF64748B), fontSize: 12),
                          textAlign: TextAlign.center,
                        ),
                      ],
                    ),
                  )
                else
                  ListView.separated(
                    shrinkWrap: true,
                    physics: const NeverScrollableScrollPhysics(),
                    itemCount: summary.recentLedger.length,
                    separatorBuilder: (_, __) => const SizedBox(height: 10),
                    itemBuilder: (ctx, idx) {
                      final entry = summary.recentLedger[idx];
                      return Container(
                        padding: const EdgeInsets.all(14),
                        decoration: BoxDecoration(
                          color: Colors.white,
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Expanded(
                                  child: Text(
                                    entry.serviceTitle,
                                    style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 14),
                                    overflow: TextOverflow.ellipsis,
                                  ),
                                ),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  decoration: BoxDecoration(
                                    color: entry.status == 'SETTLED'
                                        ? const Color(0xFFECFDF5)
                                        : const Color(0xFFFEF3C7),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    entry.status,
                                    style: TextStyle(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      color: entry.status == 'SETTLED'
                                          ? const Color(0xFF047857)
                                          : const Color(0xFFB45309),
                                    ),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            Row(
                              mainAxisAlignment: MainAxisAlignment.spaceBetween,
                              children: [
                                Text(
                                  'Gross: ₹${entry.grossRupees.toStringAsFixed(2)} • Fee: -₹${entry.feeRupees.toStringAsFixed(2)}',
                                  style: const TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                                ),
                                Text(
                                  'Net: ₹${entry.netRupees.toStringAsFixed(2)}',
                                  style: const TextStyle(fontWeight: FontWeight.w800, fontSize: 13, color: Color(0xFF0F172A)),
                                ),
                              ],
                            ),
                          ],
                        ),
                      );
                    },
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  void _showWithdrawalDialog(BuildContext context, WidgetRef ref, WalletSummary summary) {
    final amountController = TextEditingController(text: summary.availableBalanceRupees.toStringAsFixed(0));
    bool isSubmitting = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          title: const Text('Withdraw Payout', style: TextStyle(fontWeight: FontWeight.w700)),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Available to withdraw: ₹${summary.availableBalanceRupees.toStringAsFixed(2)}',
                style: const TextStyle(fontWeight: FontWeight.w600, color: Color(0xFF0F172A), fontSize: 13),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: amountController,
                keyboardType: TextInputType.number,
                decoration: const InputDecoration(
                  labelText: 'Withdrawal Amount (₹)',
                  prefixText: '₹ ',
                  border: OutlineInputBorder(),
                  helperText: 'Minimum withdrawal: ₹100',
                ),
              ),
              const SizedBox(height: 8),
              const Text(
                'Notice: Funds will be transferred directly to your verified bank account on file.',
                style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: isSubmitting ? null : () => Navigator.pop(ctx),
              child: const Text('Cancel'),
            ),
            ElevatedButton(
              onPressed: isSubmitting
                  ? null
                  : () async {
                      final parsed = double.tryParse(amountController.text.trim());
                      if (parsed == null || parsed < 100) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Minimum withdrawal amount is ₹100.')),
                        );
                        return;
                      }

                      if (parsed > summary.availableBalanceRupees) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Amount exceeds available wallet balance.')),
                        );
                        return;
                      }

                      setDialogState(() => isSubmitting = true);
                      try {
                        final repo = ref.read(walletRepositoryProvider);
                        final paisa = (parsed * 100).round();
                        await repo.requestPayout(amountPaisa: paisa);
                        if (context.mounted) {
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('Withdrawal request submitted for processing!'),
                              backgroundColor: Color(0xFF10B981),
                            ),
                          );
                          ref.refresh(walletSummaryFutureProvider);
                        }
                      } catch (e) {
                        setDialogState(() => isSubmitting = false);
                        if (context.mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(content: Text('Withdrawal failed: $e'), backgroundColor: Colors.redAccent),
                          );
                        }
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF0F172A),
                foregroundColor: Colors.white,
              ),
              child: isSubmitting
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : const Text('Confirm Transfer'),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMetricItem(String label, String value) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(label, style: const TextStyle(color: Color(0xFF94A3B8), fontSize: 10, fontWeight: FontWeight.w600)),
        const SizedBox(height: 2),
        Text(value, style: const TextStyle(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w800)),
      ],
    );
  }
}
