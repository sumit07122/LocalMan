import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Phase 4E Professional Partner Palette
  static const Color primaryBlue = Color(0xFF315EFB);
  static const Color deepInk = Color(0xFF101828);
  static const Color dutyOnline = Color(0xFF12A879);
  static const Color dutyOffline = Color(0xFF667085);
  static const Color softBackground = Color(0xFFF5F7FB);
  static const Color surfaceWhite = Colors.white;
  static const Color subtleBorder = Color(0xFFE6EAF0);
  static const Color primaryText = Color(0xFF172033);
  static const Color secondaryText = Color(0xFF667085);
  static const Color mutedText = Color(0xFF98A2B3);

  static const Color warningAmber = Color(0xFFF5A524);
  static const Color errorRed = Color(0xFFE5484D);

  // Legacy aliases
  static const Color brandPrimary = deepInk;
  static const Color brandSecondary = Color(0xFF1D2939);
  static const Color brandAccent = primaryBlue;
  static const Color brandSuccess = dutyOnline;
  static const Color brandInfo = Color(0xFF0EA5E9);
  static const Color brandSurface = softBackground;
  static const Color cardBg = surfaceWhite;

  static ThemeData get lightTheme {
    TextTheme baseTextTheme;
    try {
      baseTextTheme = GoogleFonts.plusJakartaSansTextTheme();
    } catch (_) {
      baseTextTheme = ThemeData.light().textTheme;
    }

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      primaryColor: primaryBlue,
      scaffoldBackgroundColor: softBackground,
      colorScheme: const ColorScheme.light(
        primary: primaryBlue,
        secondary: deepInk,
        surface: softBackground,
        onPrimary: Colors.white,
        onSecondary: Colors.white,
        error: errorRed,
        onError: Colors.white,
      ),
      textTheme: baseTextTheme.copyWith(
        displayLarge: baseTextTheme.displayLarge?.copyWith(
          fontWeight: FontWeight.w800,
          color: primaryText,
          letterSpacing: -0.03,
        ),
        headlineMedium: baseTextTheme.headlineMedium?.copyWith(
          fontWeight: FontWeight.w700,
          color: primaryText,
          letterSpacing: -0.02,
        ),
        titleLarge: baseTextTheme.titleLarge?.copyWith(
          fontWeight: FontWeight.w700,
          color: primaryText,
          fontSize: 18,
          letterSpacing: -0.01,
        ),
        titleMedium: baseTextTheme.titleMedium?.copyWith(
          fontWeight: FontWeight.w600,
          color: primaryText,
          fontSize: 15,
        ),
        bodyLarge: baseTextTheme.bodyLarge?.copyWith(
          color: primaryText,
          fontSize: 15,
          height: 1.45,
        ),
        bodyMedium: baseTextTheme.bodyMedium?.copyWith(
          color: secondaryText,
          fontSize: 13,
          height: 1.4,
        ),
        labelLarge: baseTextTheme.labelLarge?.copyWith(
          fontWeight: FontWeight.w600,
          fontSize: 14,
        ),
      ),
      appBarTheme: AppBarTheme(
        backgroundColor: Colors.white,
        elevation: 0,
        scrolledUnderElevation: 1,
        centerTitle: false,
        titleTextStyle: TextStyle(
          fontSize: 17,
          fontWeight: FontWeight.w700,
          color: primaryText,
          fontFamily: baseTextTheme.titleLarge?.fontFamily,
        ),
        iconTheme: const IconThemeData(color: primaryText, size: 22),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primaryBlue,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          textStyle: const TextStyle(
            fontSize: 15,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      outlinedButtonTheme: OutlinedButtonThemeData(
        style: OutlinedButton.styleFrom(
          foregroundColor: primaryText,
          side: const BorderSide(color: subtleBorder, width: 1.2),
          padding: const EdgeInsets.symmetric(horizontal: 18, vertical: 13),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(10),
          ),
          textStyle: const TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w600,
          ),
        ),
      ),
      cardTheme: CardThemeData(
        color: surfaceWhite,
        elevation: 0,
        margin: EdgeInsets.zero,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(12),
          side: const BorderSide(color: subtleBorder, width: 1),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: Colors.white,
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 13),
        hintStyle: const TextStyle(color: mutedText, fontSize: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: subtleBorder, width: 1),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: subtleBorder, width: 1),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(10),
          borderSide: const BorderSide(color: primaryBlue, width: 1.5),
        ),
      ),
      bottomNavigationBarTheme: const BottomNavigationBarThemeData(
        backgroundColor: Colors.white,
        selectedItemColor: primaryBlue,
        unselectedItemColor: secondaryText,
        type: BottomNavigationBarType.fixed,
        elevation: 8,
        selectedLabelStyle: TextStyle(fontWeight: FontWeight.w600, fontSize: 12),
        unselectedLabelStyle: TextStyle(fontWeight: FontWeight.w500, fontSize: 12),
      ),
    );
  }

  static ThemeData get darkTheme => lightTheme;
}
