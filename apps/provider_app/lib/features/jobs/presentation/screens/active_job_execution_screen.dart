import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class ActiveJobExecutionScreen extends StatefulWidget {
  final String bookingId;

  const ActiveJobExecutionScreen({
    super.key,
    this.bookingId = 'LM-20261017-X82A',
  });

  @override
  State<ActiveJobExecutionScreen> createState() => _ActiveJobExecutionScreenState();
}

class _ActiveJobExecutionScreenState extends State<ActiveJobExecutionScreen> {
  String _jobState = 'ARRIVED'; // 'PROVIDER_ON_THE_WAY', 'ARRIVED', 'JOB_STARTED', 'JOB_COMPLETED'
  final _otpController = TextEditingController();
  final List<Map<String, dynamic>> _addedMaterials = [];
  double _baseLabor = 499.0;
  final double _platformCommissionPercent = 0.15;

  void _verifyStartOtp() {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Enter Customer Start OTP', style: TextStyle(fontWeight: FontWeight.w700)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            const Text(
              'Ask the customer for their 6-digit Start OTP shown on their screen to begin work.',
              style: TextStyle(fontSize: 13, color: Colors.black87),
            ),
            const SizedBox(height: 16),
            TextField(
              controller: _otpController,
              keyboardType: TextInputType.number,
              maxLength: 6,
              textAlign: TextAlign.center,
              style: const TextStyle(fontSize: 24, fontWeight: FontWeight.w800, letterSpacing: 8),
              decoration: InputDecoration(
                hintText: '482910',
                counterText: '',
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(10)),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () {
              Navigator.pop(ctx);
              setState(() => _jobState = 'JOB_STARTED');
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(
                  content: Text('✅ OTP Verified successfully! Job timer started.'),
                  backgroundColor: Color(0xFF10B981),
                ),
              );
            },
            child: const Text('Start Job'),
          ),
        ],
      ),
    );
  }

  void _showAddMaterialModal() {
    final itemController = TextEditingController();
    final priceController = TextEditingController();

    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Add Spare Part / Material', style: TextStyle(fontWeight: FontWeight.w700)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: itemController,
              decoration: const InputDecoration(labelText: 'Item Name (e.g. Copper Pipe 2ft)'),
            ),
            const SizedBox(height: 10),
            TextField(
              controller: priceController,
              keyboardType: TextInputType.number,
              decoration: const InputDecoration(labelText: 'Price (₹)', prefixText: '₹ '),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(ctx), child: const Text('Cancel')),
          ElevatedButton(
            onPressed: () {
              if (itemController.text.isNotEmpty && priceController.text.isNotEmpty) {
                setState(() {
                  _addedMaterials.add({
                    'name': itemController.text,
                    'price': double.tryParse(priceController.text) ?? 0.0,
                    'isApproved': true,
                  });
                });
                Navigator.pop(ctx);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Material added to customer invoice.')),
                );
              }
            },
            child: const Text('Add Item'),
          ),
        ],
      ),
    );
  }

  double get _totalMaterials => _addedMaterials.fold(0.0, (acc, item) => acc + (item['price'] as double));
  double get _totalBill => _baseLabor + _totalMaterials;
  double get _partnerPayout => (_baseLabor * (1 - _platformCommissionPercent)) + _totalMaterials;

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: Text('Active Job • ${widget.bookingId}'),
        leading: IconButton(
          icon: const Icon(Icons.arrow_back),
          onPressed: () {
            if (Navigator.canPop(context)) {
              Navigator.pop(context);
            } else {
              context.go('/');
            }
          },
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.call, color: Color(0xFF0D9488)),
            onPressed: () {
              ScaffoldMessenger.of(context).showSnackBar(
                const SnackBar(content: Text('Calling customer: +91 9820011223')),
              );
            },
          ),
        ],
      ),
      body: SingleChildScrollView(
        child: Padding(
          padding: const EdgeInsets.all(16.0),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // State Banner
              Container(
                width: double.infinity,
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: _jobState == 'JOB_STARTED'
                      ? const Color(0xFFECFDF5)
                      : (_jobState == 'JOB_COMPLETED' ? const Color(0xFFF0FDF4) : const Color(0xFFFEF3C7)),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: _jobState == 'JOB_STARTED'
                        ? const Color(0xFF10B981)
                        : (_jobState == 'JOB_COMPLETED' ? Colors.green : const Color(0xFFF59E0B)),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      _jobState == 'JOB_STARTED'
                          ? Icons.timer
                          : (_jobState == 'JOB_COMPLETED' ? Icons.check_circle : Icons.location_on),
                      color: _jobState == 'JOB_STARTED'
                          ? const Color(0xFF047857)
                          : (_jobState == 'JOB_COMPLETED' ? Colors.green : const Color(0xFFB45309)),
                      size: 28,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _jobState == 'JOB_STARTED'
                                ? 'JOB IN PROGRESS'
                                : (_jobState == 'JOB_COMPLETED' ? 'JOB COMPLETED' : 'ARRIVED AT CUSTOMER ADDRESS'),
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                              color: _jobState == 'JOB_STARTED'
                                  ? const Color(0xFF065F46)
                                  : (_jobState == 'JOB_COMPLETED' ? Colors.green.shade900 : const Color(0xFF92400E)),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _jobState == 'JOB_STARTED'
                                ? 'Timer: 00:24:18 elapsed • AC Foam Jet Clean'
                                : (_jobState == 'JOB_COMPLETED'
                                    ? 'Payment settled. Ready to accept next booking.'
                                    : 'Verify Start OTP with customer before starting work'),
                            style: TextStyle(
                              fontSize: 12,
                              color: _jobState == 'JOB_STARTED'
                                  ? const Color(0xFF047857)
                                  : (_jobState == 'JOB_COMPLETED' ? Colors.green.shade800 : const Color(0xFFB45309)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Customer & Location Card
              Container(
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Customer & Location', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                    const SizedBox(height: 10),
                    const Row(
                      children: [
                        Icon(Icons.person_outline, size: 20, color: Colors.grey),
                        SizedBox(width: 8),
                        Text('Ananya Deshmukh (+91 9820011223)', style: TextStyle(fontWeight: FontWeight.w600)),
                      ],
                    ),
                    const SizedBox(height: 8),
                    const Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Icon(Icons.location_on_outlined, size: 20, color: Colors.grey),
                        SizedBox(width: 8),
                        Expanded(
                          child: Text(
                            'Flat 402, Sai Residency, 12th Main, HAL 2nd Stage, Indiranagar, Bengaluru - 560038',
                            style: TextStyle(fontSize: 13, color: Colors.black87),
                          ),
                        ),
                      ],
                    ),
                    const Divider(height: 20),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        const Text('Your Net Payout:', style: TextStyle(color: Colors.grey, fontSize: 13)),
                        Text(
                          '₹${_partnerPayout.toStringAsFixed(2)}',
                          style: const TextStyle(fontWeight: FontWeight.w800, color: Color(0xFF0F172A), fontSize: 16),
                        ),
                      ],
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 20),

              // Materials Section
              Row(
                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                children: [
                  const Text('Spare Parts & Materials', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
                  if (_jobState == 'JOB_STARTED')
                    TextButton.icon(
                      onPressed: _showAddMaterialModal,
                      icon: const Icon(Icons.add, size: 18),
                      label: const Text('Add Part'),
                    ),
                ],
              ),
              const SizedBox(height: 8),

              if (_addedMaterials.isEmpty)
                Container(
                  padding: const EdgeInsets.all(16),
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: const Center(
                    child: Text('No extra materials added yet.', style: TextStyle(color: Colors.grey, fontSize: 13)),
                  ),
                )
              else
                ..._addedMaterials.map(
                  (m) => Container(
                    margin: const EdgeInsets.only(bottom: 8),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(10),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(m['name'], style: const TextStyle(fontWeight: FontWeight.w600)),
                        Text('₹${(m['price'] as double).toStringAsFixed(2)}', style: const TextStyle(fontWeight: FontWeight.w700)),
                      ],
                    ),
                  ),
                ),

              const SizedBox(height: 32),

              // Action Trigger Button
              if (_jobState == 'ARRIVED')
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton.icon(
                    onPressed: _verifyStartOtp,
                    icon: const Icon(Icons.key),
                    label: const Text('Enter Customer Start OTP'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFF59E0B),
                      foregroundColor: const Color(0xFF0F172A),
                      textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                )
              else if (_jobState == 'JOB_STARTED')
                SizedBox(
                  width: double.infinity,
                  height: 52,
                  child: ElevatedButton.icon(
                    onPressed: () {
                      setState(() => _jobState = 'JOB_COMPLETED');
                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Job marked completed! Payout credited to your wallet.'),
                          backgroundColor: Color(0xFF10B981),
                        ),
                      );
                    },
                    icon: const Icon(Icons.check_circle_outline),
                    label: const Text('Complete Job & Generate Invoice'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFF10B981),
                      foregroundColor: Colors.white,
                      textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                )
              else
                Column(
                  children: [
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFFECFDF5),
                        borderRadius: BorderRadius.circular(12),
                        border: Border.all(color: const Color(0xFF10B981)),
                      ),
                      child: const Center(
                        child: Text(
                          '🎉 Job Completed Successfully! ₹424.15 credited to your wallet.',
                          style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF047857)),
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      height: 48,
                      child: OutlinedButton(
                        onPressed: () => context.go('/'),
                        child: const Text('Back to Duty Dashboard'),
                      ),
                    ),
                  ],
                ),
            ],
          ),
        ),
      ),
    );
  }
}
