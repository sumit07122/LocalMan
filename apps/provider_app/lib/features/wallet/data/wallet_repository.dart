import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../../../core/network/api_client.dart';
import '../../../core/constants/api_constants.dart';
import '../../../shared/models/wallet_model.dart';

abstract class IWalletRepository {
  Future<WalletSummary> getWalletSummary();
  Future<dynamic> requestPayout({int? amountPaisa});
}

class WalletRepository implements IWalletRepository {
  final ApiClient _apiClient;

  WalletRepository({required ApiClient apiClient}) : _apiClient = apiClient;

  @override
  Future<WalletSummary> getWalletSummary() async {
    final response = await _apiClient.get(ApiConstants.providerWallet);
    final raw = response.data;
    Map<String, dynamic> data = {};
    if (raw is Map<String, dynamic>) {
      if (raw['data'] is Map<String, dynamic>) {
        data = raw['data'] as Map<String, dynamic>;
      } else {
        data = raw;
      }
    }
    return WalletSummary.fromJson(data);
  }

  @override
  Future<dynamic> requestPayout({int? amountPaisa}) async {
    final response = await _apiClient.post(
      ApiConstants.requestPayout,
      data: {
        if (amountPaisa != null) 'amountPaisa': amountPaisa,
        'payoutMode': 'BANK_TRANSFER',
      },
    );
    return response.data;
  }
}

final walletRepositoryProvider = Provider<IWalletRepository>((ref) {
  final apiClient = ref.watch(apiClientProvider);
  return WalletRepository(apiClient: apiClient);
});

final walletSummaryFutureProvider = FutureProvider.autoDispose<WalletSummary>((ref) async {
  final repo = ref.watch(walletRepositoryProvider);
  return repo.getWalletSummary();
});
