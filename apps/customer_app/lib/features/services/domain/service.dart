import 'service_pricing.dart';

class CategorySummary {
  final String id;
  final String name;
  const CategorySummary({required this.id, required this.name});
}

class ServiceItem {
  final String id;
  final String categoryId;
  final String? categoryName;
  final String name;
  final String slug;
  final String? description;
  final ServicePricing pricing;
  final int? estimatedDurationMinutes;
  final bool isMaterialAllowed;
  final bool isActive;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  CategorySummary? get category => categoryName != null ? CategorySummary(id: categoryId, name: categoryName!) : null;

  const ServiceItem({
    required this.id,
    required this.categoryId,
    this.categoryName,
    required this.name,
    required this.slug,
    this.description,
    required this.pricing,
    this.estimatedDurationMinutes,
    this.isMaterialAllowed = true,
    this.isActive = true,
    this.createdAt,
    this.updatedAt,
  });

  factory ServiceItem.fromJson(Map<String, dynamic> json) {
    return ServiceItem(
      id: json['id'] as String? ?? '',
      categoryId: json['categoryId'] as String? ?? json['category_id'] as String? ?? '',
      categoryName: json['categoryName'] as String? ?? (json['category'] is Map ? json['category']['name'] as String? : null),
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      description: json['description'] as String?,
      pricing: ServicePricing.fromJson(json),
      estimatedDurationMinutes: (json['estimatedDurationMinutes'] as num?)?.toInt(),
      isMaterialAllowed: json['isMaterialAllowed'] as bool? ?? true,
      isActive: json['isActive'] as bool? ?? true,
      createdAt: json['createdAt'] != null ? DateTime.tryParse(json['createdAt'].toString()) : null,
      updatedAt: json['updatedAt'] != null ? DateTime.tryParse(json['updatedAt'].toString()) : null,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'categoryId': categoryId,
    if (categoryName != null) 'categoryName': categoryName,
    'name': name,
    'slug': slug,
    if (description != null) 'description': description,
    ...pricing.toJson(),
    if (estimatedDurationMinutes != null) 'estimatedDurationMinutes': estimatedDurationMinutes,
    'isMaterialAllowed': isMaterialAllowed,
    'isActive': isActive,
    if (createdAt != null) 'createdAt': createdAt!.toIso8601String(),
    if (updatedAt != null) 'updatedAt': updatedAt!.toIso8601String(),
  };

  String? get formattedDuration {
    if (estimatedDurationMinutes == null) return null;
    if (estimatedDurationMinutes! < 60) {
      return '$estimatedDurationMinutes mins';
    }
    final hours = estimatedDurationMinutes! ~/ 60;
    final mins = estimatedDurationMinutes! % 60;
    if (mins == 0) {
      return '$hours hr${hours > 1 ? 's' : ''}';
    }
    return '$hours hr${hours > 1 ? 's' : ''} $mins mins';
  }
}
