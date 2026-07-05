import 'package:flutter/material.dart';

enum UserProfile { produtor, gerente, funcionario }

/// Valores aceitos pelo back-end (`PapelUsuario`).
String papelParaCadastro(UserProfile perfil) {
  switch (perfil) {
    case UserProfile.produtor:
      return 'PRODUTOR';
    case UserProfile.gerente:
      return 'GERENTE';
    case UserProfile.funcionario:
      return 'FUNCIONARIO_CAMPO';
  }
}

class AppColors {
  static const Color green      = Color(0xFF2D6A2D);
  static const Color lightGreen = Color(0xFFE8F5E9);
  static const Color borderGrey = Color(0xFFD0D0D0);
  static const Color textGrey   = Color(0xFF9E9E9E);
  static const Color darkText   = Color(0xFF212121);
  static const Color linkText   = Color(0xFF388E3C);
  static const Color bgGrey     = Color(0xFFF5F5F5);
}