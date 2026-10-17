import 'package:flutter/material.dart';

class ActiveJobExecutionScreen extends StatefulWidget {
  const ActiveJobExecutionScreen({super.key});

  @override
  State<ActiveJobExecutionScreen> createState() => _ActiveJobExecutionScreenState();
}

class _ActiveJobExecutionScreenState extends State<ActiveJobExecutionScreen> {
  String _jobState = 'ARRIVED'; // 'ON_THE_WAY', 'ARRIVED', 'JOB_STARTED', 'JOB_COMPLETED'
  final _otpController = TextEditingController();
  final List<Map<String, dynamic>> _addedMaterials = [];

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
                  backgroundColor: Colors.green,
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
                  const SnackBar(content: Text('Material added for customer approval.')),
                );
              }
            },
            child: const Text('Add Item'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Active Job • LM-20261017-X82A'),
        actions: [
          IconButton(
            icon: const Icon(Icons.call, color: Color(0xFF0D9488)),
            onPressed: () {},
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
                  color: _jobState == 'JOB_STARTED' ? Colors.green.shade50 : const Color(0xFFFEF3C7),
                  borderRadius: BorderRadius.circular(14),
                  border: Border.all(
                    color: _jobState == 'JOB_STARTED' ? Colors.green.shade300 : const Color(0xFFF59E0B),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      _jobState == 'JOB_STARTED' ? Icons.timer : Icons.lock_clock,
                      color: _jobState == 'JOB_STARTED' ? Colors.green.shade800 : const Color(0xFFB45309),
                      size: 28,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            _jobState == 'JOB_STARTED' ? 'JOB IN PROGRESS' : 'ARRIVED AT CUSTOMER ADDRESS',
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                              color: _jobState == 'JOB_STARTED' ? Colors.green.shade900 : const Color(0xFF92400E),
                            ),
                          ),
                          const SizedBox(height: 2),
                          Text(
                            _jobState == 'JOB_STARTED'
                              ? 'Timer: 00:24:18 elapsed • AC Foam Jet Clean'
                              : 'Verify Start OTP with customer before starting work',
                            style: TextStyle(
                              fontSize: 12,
                              color: _jobState == 'JOB_STARTED' ? Colors.green.shade800 : const Color(0xFFB45309),
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
                  border: Border.all(color: Colors.grey.shade200),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('Customer & Service Details', style: TextStyle(fontWeight: FontWeight.w700, fontSize: 15)),
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
                    const Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text('Base Labor Payout:', style: TextStyle(color: Colors.grey, fontSize: 13)),
                        Text('₹424.15 (after 15% fee)', style: TextStyle(fontWeight: FontWeight.w700, color: Color(0xFF0F172A))),
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
                    border: Border.all(color: Colors.grey.shade200),
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
                      border: Border.all(color: Colors.grey.shade200),
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
                        const SnackBar(content: Text('Job marked completed! Final invoice generated.')),
                      );
                    },
                    icon: const Icon(Icons.check_circle_outline),
                    label: const Text('Complete Job & Generate Invoice'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: Colors.green,
                      foregroundColor: Colors.white,
                      textStyle: const TextStyle(fontWeight: FontWeight.w800, fontSize: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                  ),
                )
              else
                Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: Colors.green.shade50,
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(color: Colors.green),
                  ),
                  child: const Center(
                    child: Text('🎉 Job Completed Successfully! Payment is pending settlement.', style: TextStyle(fontWeight: FontWeight.w700, color: Colors.green)),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
