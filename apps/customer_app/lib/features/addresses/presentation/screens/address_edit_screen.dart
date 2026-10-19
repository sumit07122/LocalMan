import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import '../../../../core/theme/app_theme.dart';
import '../controllers/address_provider.dart';
import '../../domain/address.dart';

class AddressEditScreen extends ConsumerStatefulWidget {
  final Address? existingAddress;

  const AddressEditScreen({super.key, this.existingAddress});

  @override
  ConsumerState<AddressEditScreen> createState() => _AddressEditScreenState();
}

class _AddressEditScreenState extends ConsumerState<AddressEditScreen> {
  final _formKey = GlobalKey<FormState>();

  late String _label;
  final _addressLine1Controller = TextEditingController();
  final _addressLine2Controller = TextEditingController();
  final _landmarkController = TextEditingController();
  final _cityController = TextEditingController();
  final _stateController = TextEditingController();
  final _postalCodeController = TextEditingController();
  final _latController = TextEditingController();
  final _lngController = TextEditingController();
  bool _isDefault = false;

  bool get _isEditMode => widget.existingAddress != null;

  @override
  void initState() {
    super.initState();
    final addr = widget.existingAddress;
    if (addr != null) {
      _label = addr.label;
      _addressLine1Controller.text = addr.addressLine1;
      _addressLine2Controller.text = addr.addressLine2 ?? '';
      _landmarkController.text = addr.landmark ?? '';
      _cityController.text = addr.city;
      _stateController.text = addr.state;
      _postalCodeController.text = addr.postalCode;
      _latController.text = addr.latitude.toString();
      _lngController.text = addr.longitude.toString();
      _isDefault = addr.isDefault;
    } else {
      _label = 'Home';
      _cityController.text = 'Bengaluru';
      _stateController.text = 'Karnataka';
      _latController.text = '12.9716';
      _lngController.text = '77.5946';
    }
  }

  @override
  void dispose() {
    _addressLine1Controller.dispose();
    _addressLine2Controller.dispose();
    _landmarkController.dispose();
    _cityController.dispose();
    _stateController.dispose();
    _postalCodeController.dispose();
    _latController.dispose();
    _lngController.dispose();
    super.dispose();
  }

  Future<void> _handleSave() async {
    if (!_formKey.currentState!.validate()) return;

    final lat = double.tryParse(_latController.text.trim()) ?? 0.0;
    final lng = double.tryParse(_lngController.text.trim()) ?? 0.0;

    bool success;
    if (_isEditMode) {
      success = await ref.read(addressProvider.notifier).updateAddress(
            widget.existingAddress!.id,
            label: _label,
            addressLine1: _addressLine1Controller.text.trim(),
            addressLine2: _addressLine2Controller.text.trim().isEmpty ? null : _addressLine2Controller.text.trim(),
            landmark: _landmarkController.text.trim().isEmpty ? null : _landmarkController.text.trim(),
            city: _cityController.text.trim(),
            stateName: _stateController.text.trim(),
            postalCode: _postalCodeController.text.trim(),
            latitude: lat,
            longitude: lng,
            isDefault: _isDefault,
          );
    } else {
      success = await ref.read(addressProvider.notifier).createAddress(
            label: _label,
            addressLine1: _addressLine1Controller.text.trim(),
            addressLine2: _addressLine2Controller.text.trim().isEmpty ? null : _addressLine2Controller.text.trim(),
            landmark: _landmarkController.text.trim().isEmpty ? null : _landmarkController.text.trim(),
            city: _cityController.text.trim(),
            stateName: _stateController.text.trim(),
            postalCode: _postalCodeController.text.trim(),
            latitude: lat,
            longitude: lng,
            isDefault: _isDefault,
          );
    }

    if (mounted) {
      if (success) {
        context.pop();
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(_isEditMode ? 'Address updated successfully' : 'Address added successfully'),
          ),
        );
      } else {
        final err = ref.read(addressProvider).errorMessage ?? 'Failed to save address';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(err), backgroundColor: Colors.red.shade800),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final addressState = ref.watch(addressProvider);

    return Scaffold(
      appBar: AppBar(
        title: Text(_isEditMode ? 'Edit Address' : 'New Address'),
      ),
      body: SingleChildScrollView(
        padding: const EdgeInsets.all(20),
        child: Form(
          key: _formKey,
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Address Label',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(
                      fontWeight: FontWeight.w700,
                      color: AppTheme.brandPrimary,
                    ),
              ),
              const SizedBox(height: 8),
              Row(
                children: ['Home', 'Work', 'Other'].map((l) {
                  final isSelected = _label == l;
                  return Padding(
                    padding: const EdgeInsets.only(right: 8.0),
                    child: ChoiceChip(
                      label: Text(l),
                      selected: isSelected,
                      selectedColor: AppTheme.brandPrimary,
                      labelStyle: TextStyle(
                        color: isSelected ? Colors.white : AppTheme.brandPrimary,
                        fontWeight: FontWeight.w600,
                      ),
                      onSelected: (_) => setState(() => _label = l),
                    ),
                  );
                }).toList(),
              ),
              const SizedBox(height: 20),

              // Address Line 1
              TextFormField(
                controller: _addressLine1Controller,
                decoration: InputDecoration(
                  labelText: 'House / Flat / Block No. & Street *',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                validator: (val) {
                  if (val == null || val.trim().length < 3) {
                    return 'Please enter a valid address (at least 3 characters)';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),

              // Address Line 2
              TextFormField(
                controller: _addressLine2Controller,
                decoration: InputDecoration(
                  labelText: 'Apartment / Area / Locality (Optional)',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 14),

              // Landmark
              TextFormField(
                controller: _landmarkController,
                decoration: InputDecoration(
                  labelText: 'Nearby Landmark (Optional)',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
              const SizedBox(height: 14),

              // City & State
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _cityController,
                      decoration: InputDecoration(
                        labelText: 'City *',
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      validator: (val) => val == null || val.trim().isEmpty ? 'City required' : null,
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _stateController,
                      decoration: InputDecoration(
                        labelText: 'State *',
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      validator: (val) => val == null || val.trim().isEmpty ? 'State required' : null,
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 14),

              // Postal Code
              TextFormField(
                controller: _postalCodeController,
                keyboardType: TextInputType.number,
                maxLength: 6,
                decoration: InputDecoration(
                  labelText: 'PIN Code (6 digits) *',
                  counterText: '',
                  filled: true,
                  fillColor: Colors.white,
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
                validator: (val) {
                  if (val == null || !RegExp(r'^[1-9][0-9]{5}$').hasMatch(val.trim())) {
                    return 'Enter valid 6-digit Indian PIN code';
                  }
                  return null;
                },
              ),
              const SizedBox(height: 14),

              // GPS Coordinates
              Row(
                children: [
                  Expanded(
                    child: TextFormField(
                      controller: _latController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                      decoration: InputDecoration(
                        labelText: 'Latitude *',
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      validator: (val) {
                        final n = double.tryParse(val ?? '');
                        if (n == null || n < -90 || n > 90) return 'Invalid lat (-90..90)';
                        return null;
                      },
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: TextFormField(
                      controller: _lngController,
                      keyboardType: const TextInputType.numberWithOptions(decimal: true, signed: true),
                      decoration: InputDecoration(
                        labelText: 'Longitude *',
                        filled: true,
                        fillColor: Colors.white,
                        border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                      validator: (val) {
                        final n = double.tryParse(val ?? '');
                        if (n == null || n < -180 || n > 180) return 'Invalid lng (-180..180)';
                        return null;
                      },
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 16),

              // Default Switch
              SwitchListTile(
                value: _isDefault,
                onChanged: (val) => setState(() => _isDefault = val),
                title: const Text('Make this my default address', style: TextStyle(fontWeight: FontWeight.w600)),
                subtitle: const Text('Used automatically when requesting local services', style: TextStyle(fontSize: 12)),
                contentPadding: EdgeInsets.zero,
                activeColor: AppTheme.brandPrimary,
              ),

              const SizedBox(height: 24),

              SizedBox(
                width: double.infinity,
                height: 52,
                child: ElevatedButton(
                  onPressed: addressState.isLoading ? null : _handleSave,
                  child: addressState.isLoading
                      ? const SizedBox(
                          width: 24,
                          height: 24,
                          child: CircularProgressIndicator(color: AppTheme.brandPrimary, strokeWidth: 2.5),
                        )
                      : Text(_isEditMode ? 'Update Address' : 'Save Address'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
