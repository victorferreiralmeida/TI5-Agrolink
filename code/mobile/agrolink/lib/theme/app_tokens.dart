import 'package:flutter/material.dart';

/// Tokens de design compartilhados — paridade com as variáveis CSS da web
/// (`--bg`, `--surface`, `--primary`, `--crit`, etc.).
///
/// Toda tela deve usar estes tokens (via `AppTokens.of(context)`) para
/// que o tema claro/escuro fique consistente em todo o app.
class AppTokens {
  final Color bg;
  final Color surface;
  final Color surfaceMuted;
  final Color border;
  final Color borderSoft;
  final Color text;
  final Color textMuted;
  final Color primary;
  final Color primaryDark;
  final Color primarySoft;
  final Color danger;
  final Color dangerSoft;
  final Color warning;
  final Color warningSoft;
  final Color info;
  final Color infoSoft;
  final Color success;
  final Color successSoft;

  const AppTokens._({
    required this.bg,
    required this.surface,
    required this.surfaceMuted,
    required this.border,
    required this.borderSoft,
    required this.text,
    required this.textMuted,
    required this.primary,
    required this.primaryDark,
    required this.primarySoft,
    required this.danger,
    required this.dangerSoft,
    required this.warning,
    required this.warningSoft,
    required this.info,
    required this.infoSoft,
    required this.success,
    required this.successSoft,
  });

  static const AppTokens light = AppTokens._(
    bg: Color(0xFFF3F7F4),
    surface: Color(0xFFFFFFFF),
    surfaceMuted: Color(0xFFF4FAF6),
    border: Color(0xFFD5E0D8),
    borderSoft: Color(0xFFE6ECE8),
    text: Color(0xFF1A2E22),
    textMuted: Color(0xFF5C6D62),
    primary: Color(0xFF1F6B3A),
    primaryDark: Color(0xFF14502A),
    primarySoft: Color(0xFFE6F4EB),
    danger: Color(0xFFC24141),
    dangerSoft: Color(0xFFFCE9E9),
    warning: Color(0xFFB8860B),
    warningSoft: Color(0xFFFFF3D6),
    info: Color(0xFF1565C0),
    infoSoft: Color(0xFFE3F2FD),
    success: Color(0xFF1F6B3A),
    successSoft: Color(0xFFE6F4EB),
  );

  static const AppTokens dark = AppTokens._(
    bg: Color(0xFF0F1411),
    surface: Color(0xFF1A221E),
    surfaceMuted: Color(0xFF1F2A24),
    border: Color(0xFF2F3F35),
    borderSoft: Color(0xFF263027),
    text: Color(0xFFE8F0EB),
    textMuted: Color(0xFF9AAF9F),
    primary: Color(0xFF4CAF6A),
    primaryDark: Color(0xFF3D9A56),
    primarySoft: Color(0xFF1B3D2A),
    danger: Color(0xFFF28B82),
    dangerSoft: Color(0xFF3A1F1E),
    warning: Color(0xFFE3B452),
    warningSoft: Color(0xFF3A2E14),
    info: Color(0xFF7BB7E8),
    infoSoft: Color(0xFF1C2C3D),
    success: Color(0xFF4CAF6A),
    successSoft: Color(0xFF1B3D2A),
  );

  /// Resolve os tokens conforme o brilho do tema vigente.
  static AppTokens of(BuildContext context) {
    return Theme.of(context).brightness == Brightness.dark ? dark : light;
  }
}

/// Espaçamentos canônicos.
class AppSpacing {
  static const double xs = 4;
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 16;
  static const double xl = 22;
  static const double xxl = 32;
}

/// Cantos arredondados canônicos.
class AppRadius {
  static const double sm = 8;
  static const double md = 12;
  static const double lg = 14;
  static const double xl = 18;
  static const double pill = 999;
}
