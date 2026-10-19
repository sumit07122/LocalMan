class UserModel {
  final String id;
  final String phoneNumber;
  final String phoneCountryCode;
  final String? fullName;
  final String? email;
  final String? avatarUrl;
  final List<String> roles;
  final bool isProfileComplete;

  const UserModel({
    required this.id,
    required this.phoneNumber,
    this.phoneCountryCode = '+91',
    this.fullName,
    this.email,
    this.avatarUrl,
    this.roles = const [],
    this.isProfileComplete = false,
  });

  factory UserModel.fromJson(Map<String, dynamic> rawJson) {
    final json = (rawJson['data'] is Map<String, dynamic>)
        ? rawJson['data'] as Map<String, dynamic>
        : rawJson;
    return UserModel(
      id: json['id'] as String? ?? '',
      phoneNumber: json['phoneNumber'] as String? ?? '',
      phoneCountryCode: json['phoneCountryCode'] as String? ?? '+91',
      fullName: json['fullName'] as String?,
      email: json['email'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      roles: (json['roles'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? [],
      isProfileComplete: json['isProfileComplete'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'phoneNumber': phoneNumber,
    'phoneCountryCode': phoneCountryCode,
    'fullName': fullName,
    'email': email,
    'avatarUrl': avatarUrl,
    'roles': roles,
    'isProfileComplete': isProfileComplete,
  };
}
