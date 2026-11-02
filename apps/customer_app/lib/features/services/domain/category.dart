import 'service.dart';

class ServiceCategoryItem {
  final String id;
  final String? parentId;
  final String name;
  final String slug;
  final String? iconUrl;
  final String? imageUrl;
  final int displayOrder;
  final bool isActive;
  final int serviceCount;
  final List<ServiceCategoryItem> children;
  final List<ServiceItem> services;

  const ServiceCategoryItem({
    required this.id,
    this.parentId,
    required this.name,
    required this.slug,
    this.iconUrl,
    this.imageUrl,
    this.displayOrder = 0,
    this.isActive = true,
    this.serviceCount = 0,
    this.children = const [],
    this.services = const [],
  });

  factory ServiceCategoryItem.fromJson(Map<String, dynamic> json) {
    return ServiceCategoryItem(
      id: json['id'] as String? ?? '',
      parentId: json['parentId'] as String? ?? json['parent_id'] as String?,
      name: json['name'] as String? ?? '',
      slug: json['slug'] as String? ?? '',
      iconUrl: json['iconUrl'] as String? ?? json['icon_url'] as String?,
      imageUrl: json['imageUrl'] as String? ?? json['image_url'] as String?,
      displayOrder: (json['displayOrder'] as num?)?.toInt() ?? 0,
      isActive: json['isActive'] as bool? ?? true,
      serviceCount: (json['serviceCount'] as num?)?.toInt() ??
          (json['_count'] is Map && (json['_count'] as Map)['services'] != null
              ? ((json['_count'] as Map)['services'] as num).toInt()
              : 0),
      children: (json['children'] as List<dynamic>?)
              ?.map((item) => ServiceCategoryItem.fromJson(item as Map<String, dynamic>))
              .toList() ??
          const [],
      services: (json['services'] as List<dynamic>?)
              ?.map((item) => ServiceItem.fromJson(item as Map<String, dynamic>))
              .toList() ??
          const [],
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    if (parentId != null) 'parentId': parentId,
    'name': name,
    'slug': slug,
    if (iconUrl != null) 'iconUrl': iconUrl,
    if (imageUrl != null) 'imageUrl': imageUrl,
    'displayOrder': displayOrder,
    'isActive': isActive,
    'serviceCount': serviceCount,
    if (children.isNotEmpty) 'children': children.map((c) => c.toJson()).toList(),
    if (services.isNotEmpty) 'services': services.map((s) => s.toJson()).toList(),
  };

  ServiceCategoryItem copyWith({
    String? id,
    String? parentId,
    String? name,
    String? slug,
    String? iconUrl,
    String? imageUrl,
    int? displayOrder,
    bool? isActive,
    int? serviceCount,
    List<ServiceCategoryItem>? children,
    List<ServiceItem>? services,
  }) {
    return ServiceCategoryItem(
      id: id ?? this.id,
      parentId: parentId ?? this.parentId,
      name: name ?? this.name,
      slug: slug ?? this.slug,
      iconUrl: iconUrl ?? this.iconUrl,
      imageUrl: imageUrl ?? this.imageUrl,
      displayOrder: displayOrder ?? this.displayOrder,
      isActive: isActive ?? this.isActive,
      serviceCount: serviceCount ?? this.serviceCount,
      children: children ?? this.children,
      services: services ?? this.services,
    );
  }

  String? get icon => iconUrl;
  String? get description => null;
  int get servicesCount => serviceCount;
}
