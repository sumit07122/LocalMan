class CustomerProfile {
  final String id;
  final String phoneNumber;
  final String? fullName;
  final String? email;
  final String? avatarUrl;
  final String preferredLanguage;
  final bool isProfileComplete;

  const CustomerProfile({
    required this.id,
    required this.phoneNumber,
    this.fullName,
    this.email,
    this.avatarUrl,
    this.preferredLanguage = 'en',
    this.isProfileComplete = false,
  });

  factory CustomerProfile.fromJson(Map<String, dynamic> json) {
    return CustomerProfile(
      id: json['id'] as String? ?? '',
      phoneNumber: json['phoneNumber'] as String? ?? '',
      fullName: json['fullName'] as String?,
      email: json['email'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      preferredLanguage: json['preferredLanguage'] as String? ?? 'en',
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
    'isProfileComplete': isProfileComplete,
  };

  CustomerProfile copyWith({
    String? id,
    String? phoneNumber,
    String? fullName,
    String? email,
    String? avatarUrl,
    String? preferredLanguage,
    bool? isProfileComplete,
  }) {
    return CustomerProfile(
      id: id ?? this.id,
      phoneNumber: phoneNumber ?? this.phoneNumber,
      fullName: fullName ?? this.fullName,
      email: email ?? this.email,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      preferredLanguage: preferredLanguage ?? this.preferredLanguage,
      isProfileComplete: isProfileComplete ?? this.isProfileComplete,
    );
  }
}
