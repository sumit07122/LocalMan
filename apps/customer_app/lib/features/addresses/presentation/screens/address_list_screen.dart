import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../../../../shared/widgets/loading_indicator.dart';
import '../../../../shared/widgets/empty_state_view.dart';
import '../../../../shared/widgets/error_view.dart';
import '../controllers/address_provider.dart';
import '../../domain/address.dart';

class AddressListScreen extends ConsumerWidget {
  const AddressListScreen({super.key});

  Future<void> _handleDelete(BuildContext context, WidgetRef ref, Address address) async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (ctx) => AlertDialog(
        title: const Text('Delete Address'),
        content: Text('Are you sure you want to remove "${address.label}"?'),
        actions: [
          TextButton(
            onPressed: () => Navigator.of(ctx).pop(false),
            child: const Text('Cancel'),
          ),
          ElevatedButton(
            onPressed: () => Navigator.of(ctx).pop(true),
            style: ElevatedButton.styleFrom(
              backgroundColor: Colors.red.shade700,
              foregroundColor: Colors.white,
            ),
            child: const Text('Delete'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      final success = await ref.read(addressProvider.notifier).deleteAddress(address.id);
      if (context.mounted && !success) {
        final err = ref.read(addressProvider).errorMessage ?? 'Failed to delete address';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(err), backgroundColor: Colors.red.shade800),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final addressState = ref.watch(addressProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Saved Addresses'),
      ),
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push('/addresses/new'),
        backgroundColor: AppTheme.brandPrimary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_location_alt_outlined),
        label: const Text('Add Address'),
      ),
      body: Builder(
        builder: (context) {
          if (addressState.isLoading && addressState.addresses.isEmpty) {
            return const LoadingIndicator(message: 'Loading your addresses...');
          }

          if (addressState.errorMessage != null && addressState.addresses.isEmpty) {
            return ErrorView(
              message: addressState.errorMessage!,
              onRetry: () => ref.read(addressProvider.notifier).loadAddresses(),
            );
          }

          if (addressState.addresses.isEmpty) {
            return EmptyStateView(
              icon: Icons.location_off_outlined,
              title: 'No saved addresses yet',
              message: 'Add your home or work address so LocalMan providers can reach you quickly.',
              actionLabel: 'Add Your First Address',
              onAction: () => context.push('/addresses/new'),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: addressState.addresses.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final addr = addressState.addresses[index];
              return _AddressCard(
                address: addr,
                onSetDefault: () => ref.read(addressProvider.notifier).setDefaultAddress(addr.id),
                onEdit: () => context.push('/addresses/edit', extra: addr),
                onDelete: () => _handleDelete(context, ref, addr),
              );
            },
          );
        },
      ),
    );
  }
}

class _AddressCard extends StatelessWidget {
  final Address address;
  final VoidCallback onSetDefault;
  final VoidCallback onEdit;
  final VoidCallback onDelete;

  const _AddressCard({
    required this.address,
    required this.onSetDefault,
    required this.onEdit,
    required this.onDelete,
  });

  IconData _getIconForLabel(String label) {
    switch (label.toLowerCase()) {
      case 'home':
        return Icons.home_outlined;
      case 'work':
      case 'office':
        return Icons.business_outlined;
      default:
        return Icons.place_outlined;
    }
  }

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(
          color: address.isDefault ? AppTheme.brandPrimary : Colors.grey.shade200,
          width: address.isDefault ? 1.5 : 1,
        ),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.02),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                padding: const EdgeInsets.all(8),
                decoration: BoxDecoration(
                  color: AppTheme.brandPrimary.withOpacity(0.06),
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(_getIconForLabel(address.label), size: 20, color: AppTheme.brandPrimary),
              ),
              const SizedBox(width: 10),
              Text(
                address.label,
                style: const TextStyle(fontWeight: FontWeight.w700, fontSize: 16),
              ),
              if (address.isDefault) ...[
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppTheme.brandAccent.withOpacity(0.2),
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: const Text(
                    'DEFAULT',
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w800,
                      color: AppTheme.brandPrimary,
                    ),
                  ),
                ),
              ],
              const Spacer(),
              PopupMenuButton<String>(
                icon: const Icon(Icons.more_vert, size: 20, color: Colors.grey),
                onSelected: (val) {
                  if (val == 'default') onSetDefault();
                  if (val == 'edit') onEdit();
                  if (val == 'delete') onDelete();
                },
                itemBuilder: (ctx) => [
                  if (!address.isDefault)
                    const PopupMenuItem(
                      value: 'default',
                      child: Text('Set as Default'),
                    ),
                  const PopupMenuItem(
                    value: 'edit',
                    child: Text('Edit Address'),
                  ),
                  const PopupMenuItem(
                    value: 'delete',
                    child: Text('Delete Address', style: TextStyle(color: Colors.red)),
                  ),
                ],
              ),
            ],
          ),
          const SizedBox(height: 10),
          Text(
            address.formattedAddress,
            style: TextStyle(color: Colors.grey.shade700, fontSize: 14, height: 1.4),
          ),
          const SizedBox(height: 8),
          Text(
            'GPS: ${address.latitude.toStringAsFixed(4)}, ${address.longitude.toStringAsFixed(4)}',
            style: TextStyle(color: Colors.grey.shade400, fontSize: 11),
          ),
        ],
      ),
    );
  }
}
