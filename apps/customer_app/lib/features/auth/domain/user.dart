class User {
  final String id;
  final String phoneNumber;
  final String? fullName;
  final String? email;
  final String? avatarUrl;
  final String preferredLanguage;
  final List<String> roles;
  final bool isProfileComplete;

  const User({
    required this.id,
    required this.phoneNumber,
    this.fullName,
    this.email,
    this.avatarUrl,
    this.preferredLanguage = 'en',
    this.roles = const ['CUSTOMER'],
    this.isProfileComplete = false,
  });

  factory User.fromJson(Map<String, dynamic> json) {
    return User(
      id: json['id'] as String? ?? '',
      phoneNumber: json['phoneNumber'] as String? ?? '',
      fullName: json['fullName'] as String?,
      email: json['email'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      preferredLanguage: json['preferredLanguage'] as String? ?? 'en',
      roles: (json['roles'] as List<dynamic>?)?.map((e) => e.toString()).toList() ?? ['CUSTOMER'],
      isProfileComplete: json['isProfileComplete'] as bool? ?? false,
    );
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'phoneNumber': phoneNumber,
    'fullName': fullName,
    'email': email,
    'avatarUrl': avatarUrl,
    'preferredLanguage': preferredLanguage,
    'roles': roles,
    'isProfileComplete': isProfileComplete,
  };

  User copyWith({
    String? id,
    String? phoneNumber,
    String? fullName,
    String? email,
    String? avatarUrl,
    String? preferredLanguage,
    List<String>? roles,
    bool? isProfileComplete,
  }) {
    return User(
      id: id ?? this.id,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      preferredLanguage: preferredLanguage ?? this.preferredLanguage,
      roles: roles ?? this.roles,
      isProfileComplete: isProfileComplete ?? this.isProfileComplete,
    );
  }
}
