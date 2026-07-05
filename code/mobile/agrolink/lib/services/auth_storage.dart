import 'dart:convert';
import 'package:shared_preferences/shared_preferences.dart';
 
/// Chaves usadas no SharedPreferences
class _Keys {
  static const token   = 'auth_token';
  static const usuario = 'auth_usuario';
}
 
/// Modelo simples do usuário autenticado
class UsuarioLogado {
  final int    id;
  final String nome;
  final String email;
  final String papel;
  final String telefone;
  final String fotoUrl;
  final bool   temFazenda;

  const UsuarioLogado({
    required this.id,
    required this.nome,
    required this.email,
    required this.papel,
    required this.telefone,
    required this.fotoUrl,
    required this.temFazenda,
  });

  factory UsuarioLogado.fromJson(Map<String, dynamic> j) => UsuarioLogado(
        id:       j['id']       as int,
        nome:     j['nome']     as String? ?? '',
        email:    j['email']    as String? ?? '',
        papel:    j['papel']    as String? ?? '',
        telefone: j['telefone'] as String? ?? '',
        fotoUrl:  j['fotoUrl']  as String? ?? '',
        temFazenda: j['temFazenda'] == true,
      );

  Map<String, dynamic> toJson() => {
        'id':       id,
        'nome':     nome,
        'email':    email,
        'papel':    papel,
        'telefone': telefone,
        'fotoUrl':  fotoUrl,
        'temFazenda': temFazenda,
      };
}
 
/// Camada de persistência local (SharedPreferences)
class AuthStorage {
  AuthStorage._();
 
  // ── Salvar após login / cadastro ────────────────────────────────────────
  static Future<void> salvar({
    required String token,
    required UsuarioLogado usuario,
  }) async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_Keys.token,   token);
    await prefs.setString(_Keys.usuario, jsonEncode(usuario.toJson()));
  }
 
  // ── Ler token ───────────────────────────────────────────────────────────
  static Future<String?> lerToken() async {
    final prefs = await SharedPreferences.getInstance();
    return prefs.getString(_Keys.token);
  }
 
  // ── Ler usuário ─────────────────────────────────────────────────────────
  static Future<UsuarioLogado?> lerUsuario() async {
    final prefs = await SharedPreferences.getInstance();
    final raw   = prefs.getString(_Keys.usuario);
    if (raw == null) return null;
    return UsuarioLogado.fromJson(jsonDecode(raw) as Map<String, dynamic>);
  }
 
  // ── Limpar tudo (logout) ────────────────────────────────────────────────
  static Future<void> limpar() async {
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_Keys.token);
    await prefs.remove(_Keys.usuario);
  }
 
  // ── Verificar se está logado ────────────────────────────────────────────
  static Future<bool> estaLogado() async {
    final token = await lerToken();
    return token != null && token.isNotEmpty;
  }
}
 