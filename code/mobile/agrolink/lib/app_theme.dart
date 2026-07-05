import 'package:flutter/material.dart';
import 'theme/app_tokens.dart';

class AppTheme {
  static ThemeData _buildBase(AppTokens t, Brightness brightness) {
    final scheme = ColorScheme.fromSeed(
      seedColor: t.primary,
      brightness: brightness,
      surface: t.surface,
      onSurface: t.text,
      primary: t.primary,
      onPrimary: brightness == Brightness.dark
          ? const Color(0xFF0F1411)
          : Colors.white,
      error: t.danger,
    );

    return ThemeData(
      useMaterial3: true,
      fontFamily: 'Roboto',
      colorScheme: scheme,
      scaffoldBackgroundColor: t.bg,
      cardColor: t.surface,
      dividerColor: t.border,
      canvasColor: t.surface,
      appBarTheme: AppBarTheme(
        backgroundColor: t.surface,
        foregroundColor: t.text,
        elevation: 0,
      ),
      bottomNavigationBarTheme: BottomNavigationBarThemeData(
        backgroundColor: t.surface,
        selectedItemColor: t.primary,
        unselectedItemColor: t.textMuted,
        type: BottomNavigationBarType.fixed,
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: t.surface,
        hintStyle: TextStyle(color: t.textMuted),
        prefixIconColor: t.textMuted,
        suffixIconColor: t.textMuted,
        contentPadding:
            const EdgeInsets.symmetric(vertical: 12, horizontal: 14),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: t.border, width: 1.2),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(AppRadius.md),
          borderSide: BorderSide(color: t.primary, width: 1.5),
        ),
      ),
      dividerTheme: DividerThemeData(color: t.border, thickness: 1),
      iconTheme: IconThemeData(color: t.text),
      textTheme: ThemeData(brightness: brightness).textTheme.apply(
            bodyColor: t.text,
            displayColor: t.text,
          ),
    );
  }

  static ThemeData get light => _buildBase(AppTokens.light, Brightness.light);
  static ThemeData get dark => _buildBase(AppTokens.dark, Brightness.dark);
}
