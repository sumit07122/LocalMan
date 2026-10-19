class LedgerEntry {
  final String id;
  final String? bookingId;
  final String? bookingNumber;
  final String serviceTitle;
  final DateTime createdAt;
  final int grossAmountPaisa;
  final int platformDeductionPaisa;
  final int tdsDeductionPaisa;
  final int netPayoutPaisa;
  final String status; // 'PENDING', 'SETTLED', 'FAILED'
  final String payoutMode;

  const LedgerEntry({
    required this.id,
    this.bookingId,
    this.bookingNumber,
    required this.serviceTitle,
    required this.createdAt,
    required this.grossAmountPaisa,
    required this.platformDeductionPaisa,
    this.tdsDeductionPaisa = 0,
    required this.netPayoutPaisa,
    this.status = 'PENDING',
    this.payoutMode = 'BANK_TRANSFER',
  });

  double get grossRupees => grossAmountPaisa / 100.0;
  double get feeRupees => platformDeductionPaisa / 100.0;
  double get netRupees => netPayoutPaisa / 100.0;

  factory LedgerEntry.fromJson(Map<String, dynamic> json) {
    return LedgerEntry(
      id: json['id'] as String? ?? '',
      bookingId: json['bookingId'] as String?,
      bookingNumber: json['booking']?['bookingNumber'] as String?,
      serviceTitle: json['booking']?['service']?['name'] as String? ?? 'Service Settlement',
      createdAt: json['createdAt'] != null
          ? DateTime.tryParse(json['createdAt'] as String) ?? DateTime.now()
          : DateTime.now(),
      grossAmountPaisa: json['grossAmountPaisa'] as int? ?? 0,
      platformDeductionPaisa: json['platformDeductionPaisa'] as int? ?? 0,
      tdsDeductionPaisa: json['tdsDeductionPaisa'] as int? ?? 0,
      netPayoutPaisa: json['netPayoutPaisa'] as int? ?? 0,
      status: json['status'] as String? ?? 'PENDING',
      payoutMode: json['payoutMode'] as String? ?? 'BANK_TRANSFER',
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'bookingId': bookingId,
    'grossAmountPaisa': grossAmountPaisa,
    'platformDeductionPaisa': platformDeductionPaisa,
    'tdsDeductionPaisa': tdsDeductionPaisa,
    'netPayoutPaisa': netPayoutPaisa,
    'status': status,
    'payoutMode': payoutMode,
    'createdAt': createdAt.toIso8601String(),
  };
}

class WalletSummary {
  final int availableBalancePaisa;
  final int pendingSettlementPaisa;
  final int pendingBalancePaisa;
  final int paidOutBalancePaisa;
  final int totalEarnedPaisa;
  final List<LedgerEntry> recentLedger;
  final bool isBackendLedgerAvailable;

  const WalletSummary({
    this.availableBalancePaisa = 0,
    this.pendingSettlementPaisa = 0,
    this.pendingBalancePaisa = 0,
    this.paidOutBalancePaisa = 0,
    this.totalEarnedPaisa = 0,
    this.recentLedger = const [],
    this.isBackendLedgerAvailable = false,
  });

  double get availableBalanceRupees => availableBalancePaisa / 100.0;
  double get pendingSettlementRupees => pendingSettlementPaisa / 100.0;
  double get pendingBalanceRupees => pendingBalancePaisa / 100.0;
  double get paidOutBalanceRupees => paidOutBalancePaisa / 100.0;
  double get totalEarnedRupees => totalEarnedPaisa / 100.0;

  factory WalletSummary.unavailable() {
    return const WalletSummary(
      availableBalancePaisa: 0,
      pendingSettlementPaisa: 0,
      pendingBalancePaisa: 0,
      paidOutBalancePaisa: 0,
      totalEarnedPaisa: 0,
      recentLedger: [],
      isBackendLedgerAvailable: false,
    );
  }

  factory WalletSummary.fromJson(Map<String, dynamic> json) {
    final ledgerList = json['ledger'] as List<dynamic>? ?? [];
    return WalletSummary(
      availableBalancePaisa: json['availableBalancePaisa'] as int? ?? 0,
      pendingSettlementPaisa: json['pendingSettlementPaisa'] as int? ?? (json['pendingBalancePaisa'] as int? ?? 0),
      pendingBalancePaisa: json['pendingBalancePaisa'] as int? ?? 0,
      paidOutBalancePaisa: json['paidOutBalancePaisa'] as int? ?? 0,
      totalEarnedPaisa: json['totalEarnedPaisa'] as int? ?? 0,
      recentLedger: ledgerList
          .map((entry) => LedgerEntry.fromJson(entry as Map<String, dynamic>))
          .toList(),
      isBackendLedgerAvailable: true,
    );
  }

  Map<String, dynamic> toJson() => {
    'availableBalancePaisa': availableBalancePaisa,
    'pendingSettlementPaisa': pendingSettlementPaisa,
    'pendingBalancePaisa': pendingBalancePaisa,
    'paidOutBalancePaisa': paidOutBalancePaisa,
    'totalEarnedPaisa': totalEarnedPaisa,
    'ledger': recentLedger.map((e) => e.toJson()).toList(),
    'isBackendLedgerAvailable': isBackendLedgerAvailable,
  };
}
