import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../dashboard/data/provider_repository.dart';

class ProviderKycScreen extends ConsumerStatefulWidget {
  const ProviderKycScreen({super.key});

  @override
  ConsumerState<ProviderKycScreen> createState() => _ProviderKycScreenState();
}

class _ProviderKycScreenState extends ConsumerState<ProviderKycScreen> {
  final _aadhaarController = TextEditingController();
  final _panController = TextEditingController();
  final _accountHolderController = TextEditingController();
  final _bankAccountController = TextEditingController();
  final _ifscController = TextEditingController();
  final _upiController = TextEditingController();

  bool _isLoading = true;
  bool _isSaving = false;
  String? _errorMessage;
  ProviderProfileData? _profile;

  @override
  void initState() {
    super.initState();
    _loadProfile();
  }

  Future<void> _loadProfile() async {
    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      final repo = ref.read(providerRepositoryProvider);
      final profile = await repo.getProfile();
      if (mounted) {
        setState(() {
          _profile = profile;
          _isLoading = false;
          if (profile.bankAccountHolder != null) {
            _accountHolderController.text = profile.bankAccountHolder!;
          }
          if (profile.bankIfscCode != null) {
            _ifscController.text = profile.bankIfscCode!;
          }
          if (profile.upiId != null) {
            _upiController.text = profile.upiId!;
          }
        });
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = e.toString();
          _isLoading = false;
        });
      }
    }
  }

  Future<void> _submitKyc() async {
    final aadhaar = _aadhaarController.text.trim().replaceAll(RegExp(r'[\s-]'), '');
    final pan = _panController.text.trim().toUpperCase();
    final accountHolder = _accountHolderController.text.trim();
    final bankAccount = _bankAccountController.text.trim();
    final ifsc = _ifscController.text.trim().toUpperCase();
    final upi = _upiController.text.trim();

    // Validation
    if (aadhaar.isEmpty && pan.isEmpty && bankAccount.isEmpty && upi.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Please enter at least one document or banking detail to submit.')),
      );
      return;
    }

    if (aadhaar.isNotEmpty && aadhaar.length != 12) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Aadhaar number must be exactly 12 digits.')),
      );
      return;
    }

    if (pan.isNotEmpty && !RegExp(r'^[A-Z]{5}[0-9]{4}[A-Z]{1}$').hasMatch(pan)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invalid PAN format (e.g. ABCDE1234F).')),
      );
      return;
    }

    if (ifsc.isNotEmpty && !RegExp(r'^[A-Z]{4}0[A-Z0-9]{6}$').hasMatch(ifsc)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Invalid Indian IFSC Code format (e.g. HDFC0001234).')),
      );
      return;
    }

    setState(() => _isSaving = true);

    try {
      final repo = ref.read(providerRepositoryProvider);

      // 1. Submit Aadhaar if provided
      if (aadhaar.isNotEmpty) {
        await repo.submitKycDocument(
          documentType: 'AADHAAR',
          documentNumber: aadhaar,
        );
      }

      // 2. Submit PAN if provided
      if (pan.isNotEmpty) {
        await repo.submitKycDocument(
          documentType: 'PAN',
          documentNumber: pan,
        );
      }

      // 3. Update Banking details if provided
      if (accountHolder.isNotEmpty || bankAccount.isNotEmpty || ifsc.isNotEmpty || upi.isNotEmpty) {
        await repo.updateProfile(
          bankAccountHolder: accountHolder.isNotEmpty ? accountHolder : null,
          bankAccountNumber: bankAccount.isNotEmpty ? bankAccount : null,
          bankIfscCode: ifsc.isNotEmpty ? ifsc : null,
          upiId: upi.isNotEmpty ? upi : null,
        );
      }

      // Refresh profile to reflect new verification status
      await _loadProfile();

      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Verification documents and banking details saved successfully!'),
            backgroundColor: Color(0xFF10B981),
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() => _isSaving = false);
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text('Submission failed: ${e.toString()}'),
            backgroundColor: Colors.redAccent,
          ),
        );
      }
    }
  }

  @override
  void dispose() {
    _aadhaarController.dispose();
    _panController.dispose();
    _accountHolderController.dispose();
    _bankAccountController.dispose();
    _ifscController.dispose();
    _upiController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: const Color(0xFFF8FAFC),
      appBar: AppBar(
        title: const Text('Partner Verification & Banking'),
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
            icon: const Icon(Icons.refresh),
            onPressed: _loadProfile,
            tooltip: 'Refresh Status',
          ),
        ],
      ),
      body: _isLoading
          ? const Center(child: CircularProgressIndicator(color: Color(0xFFF59E0B)))
          : SingleChildScrollView(
              padding: const EdgeInsets.all(16),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Dynamic Server Status Header Banner
                  _buildStatusBanner(),

                  const SizedBox(height: 24),

                  const Text(
                    'Identity Verification (KYC)',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 12),

                  // Aadhaar Input Card
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.badge_outlined, color: Color(0xFF0F172A), size: 20),
                            SizedBox(width: 8),
                            Text('Aadhaar Number (12 Digits)', style: TextStyle(fontWeight: FontWeight.w700)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _aadhaarController,
                          keyboardType: TextInputType.number,
                          maxLength: 12,
                          decoration: const InputDecoration(
                            hintText: 'Enter 12-digit Aadhaar number',
                            counterText: '',
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Note: Under UIDAI compliance, first 8 digits are masked on server storage (XXXXXXXX1234).',
                          style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 12),

                  // PAN Input Card
                  Container(
                    padding: const EdgeInsets.all(14),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Row(
                          children: [
                            Icon(Icons.credit_card, color: Color(0xFF0F172A), size: 20),
                            SizedBox(width: 8),
                            Text('PAN Card (For Section 194O TDS Compliance)', style: TextStyle(fontWeight: FontWeight.w700)),
                          ],
                        ),
                        const SizedBox(height: 8),
                        TextField(
                          controller: _panController,
                          textCapitalization: TextCapitalization.characters,
                          maxLength: 10,
                          decoration: const InputDecoration(
                            hintText: 'e.g. ABCDE1234F',
                            counterText: '',
                            contentPadding: EdgeInsets.symmetric(horizontal: 12, vertical: 12),
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 4),
                        const Text(
                          'Government-mandated for tax compliance and 1% TDS deduction on settlements.',
                          style: TextStyle(fontSize: 11, color: Color(0xFF64748B)),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 24),

                  const Text(
                    'Payout Account (Authoritative Settlement)',
                    style: TextStyle(fontSize: 15, fontWeight: FontWeight.w800, color: Color(0xFF0F172A)),
                  ),
                  const SizedBox(height: 12),

                  Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      color: Colors.white,
                      borderRadius: BorderRadius.circular(12),
                      border: Border.all(color: const Color(0xFFE2E8F0)),
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        TextField(
                          controller: _accountHolderController,
                          decoration: const InputDecoration(
                            labelText: 'Bank Account Holder Name',
                            hintText: 'As per bank passbook',
                            prefixIcon: Icon(Icons.person_outline),
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _bankAccountController,
                          keyboardType: TextInputType.number,
                          decoration: InputDecoration(
                            labelText: 'Bank Account Number',
                            hintText: _profile?.bankAccountNumberEnc != null
                                ? 'Existing: ${_profile!.bankAccountNumberEnc}'
                                : 'Enter account number',
                            prefixIcon: const Icon(Icons.account_balance),
                            border: const OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _ifscController,
                          textCapitalization: TextCapitalization.characters,
                          maxLength: 11,
                          decoration: const InputDecoration(
                            labelText: 'Bank IFSC Code',
                            hintText: 'e.g. HDFC0001234',
                            counterText: '',
                            prefixIcon: Icon(Icons.business),
                            border: OutlineInputBorder(),
                          ),
                        ),
                        const SizedBox(height: 12),
                        TextField(
                          controller: _upiController,
                          decoration: const InputDecoration(
                            labelText: 'Instant UPI ID / VPA (Optional)',
                            hintText: 'e.g. name@okhdfcbank',
                            prefixIcon: Icon(Icons.flash_on, color: Color(0xFFF59E0B)),
                            border: OutlineInputBorder(),
                          ),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 28),

                  SizedBox(
                    width: double.infinity,
                    height: 52,
                    child: ElevatedButton(
                      onPressed: _isSaving ? null : _submitKyc,
                      style: ElevatedButton.styleFrom(
                        backgroundColor: const Color(0xFF0F172A),
                        foregroundColor: Colors.white,
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      child: _isSaving
                          ? const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white),
                            )
                          : const Text(
                              'Submit Verification & Banking Details',
                              style: TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
                            ),
                    ),
                  ),
                ],
              ),
            ),
    );
  }

  Widget _buildStatusBanner() {
    final status = _profile?.verificationStatus ?? 'DRAFT';

    if (status == 'VERIFIED') {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFECFDF5),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFF10B981)),
        ),
        child: const Row(
          children: [
            Icon(Icons.verified, color: Color(0xFF047857), size: 32),
            SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'KYC VERIFIED & ACTIVE',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                      color: Color(0xFF047857),
                      letterSpacing: 0.5,
                    ),
                  ),
                  SizedBox(height: 3),
                  Text(
                    'Your documents are verified by administration. Online duty and automated settlements are active.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF065F46)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (status == 'SUBMITTED') {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFEFF6FF),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFF3B82F6)),
        ),
        child: const Row(
          children: [
            Icon(Icons.hourglass_top, color: Color(0xFF1D4ED8), size: 32),
            SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'KYC DOCUMENTS UNDER REVIEW',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                      color: Color(0xFF1D4ED8),
                      letterSpacing: 0.5,
                    ),
                  ),
                  SizedBox(height: 3),
                  Text(
                    'Your documents have been submitted to local administration. You will be activated once verified.',
                    style: TextStyle(fontSize: 12, color: Color(0xFF1E40AF)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    if (status == 'REJECTED') {
      return Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: const Color(0xFFFEF2F2),
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: const Color(0xFFEF4444)),
        ),
        child: Row(
          children: [
            const Icon(Icons.cancel_outlined, color: Color(0xFFB91C1C), size: 32),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const Text(
                    'VERIFICATION REJECTED',
                    style: TextStyle(
                      fontWeight: FontWeight.w800,
                      fontSize: 13,
                      color: Color(0xFFB91C1C),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 3),
                  Text(
                    _profile?.rejectionReason != null && _profile!.rejectionReason!.isNotEmpty
                        ? 'Reason: ${_profile!.rejectionReason}'
                        : 'Your submitted documents did not meet requirements. Please re-submit valid documents.',
                    style: const TextStyle(fontSize: 12, color: Color(0xFF991B1B)),
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    // Default DRAFT banner
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFFFFFBEB),
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: const Color(0xFFF59E0B)),
      ),
      child: const Row(
        children: [
          Icon(Icons.shield_outlined, color: Color(0xFFB45309), size: 32),
          SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'MANDATORY GOVERNMENT COMPLIANCE',
                  style: TextStyle(
                    fontWeight: FontWeight.w800,
                    fontSize: 12,
                    color: Color(0xFF92400E),
                    letterSpacing: 0.5,
                  ),
                ),
                SizedBox(height: 3),
                Text(
                  'Under Indian marketplace guidelines, verified ID and PAN are required before going online and receiving payouts.',
                  style: TextStyle(fontSize: 12, color: Color(0xFFB45309)),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}
