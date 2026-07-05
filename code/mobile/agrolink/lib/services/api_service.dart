import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'auth_storage.dart';
import 'offline_db.dart';

/// Exceção lançada quando o servidor retorna erro HTTP
class ApiException implements Exception {
  final int    statusCode;
  final String mensagem;
  ApiException(this.statusCode, this.mensagem);

  @override
  String toString() => mensagem;
}

class ApiService {
  ApiService._();

  static String get _base => kApiBaseUrl;

  static const _headers = {'Content-Type': 'application/json; charset=UTF-8'};

  // ── POST /api/auth/login ────────────────────────────────────────────────
  /// Autentica o usuário, salva token + dados no SharedPreferences
  /// e retorna o [UsuarioLogado].
  static Future<UsuarioLogado> login({
    required String email,
    required String password,
  }) async {
    final response = await http
        .post(
          Uri.parse('$_base/api/auth/login'),
          headers: _headers,
          body: jsonEncode({'email': email, 'password': password}),
        )
        .timeout(const Duration(seconds: 15));

    return _processarAuthResponse(response);
  }

  // ── POST /api/auth/register ─────────────────────────────────────────────
  /// Cria a conta, salva token + dados no SharedPreferences
  /// e retorna o [UsuarioLogado].
  static Future<UsuarioLogado> register({
    required String nome,
    required String email,
    required String password,
    required String papel, // PRODUTOR | GERENTE | FUNCIONARIO_CAMPO
  }) async {
    final response = await http
        .post(
          Uri.parse('$_base/api/auth/register'),
          headers: _headers,
          body: jsonEncode({
            'nome':     nome,
            'email':    email,
            'password': password,
            'papel':    papel,
          }),
        )
        .timeout(const Duration(seconds: 15));

    return _processarAuthResponse(response);
  }

  // ── GET /api/ocorrencias ────────────────────────────────────────────────
  /// Retorna todas as ocorrências visíveis para o usuário logado.
  static Future<List<Map<String, dynamic>>> listarOcorrencias() async {
    final headers = await headersAuth();
    final response = await http
        .get(Uri.parse('$_base/api/ocorrencias'), headers: headers)
        .timeout(const Duration(seconds: 15));

    if (response.statusCode == 200) {
      final lista = jsonDecode(response.body) as List<dynamic>;
      return lista.cast<Map<String, dynamic>>();
    }
    throw ApiException(response.statusCode, 'Erro ao buscar ocorrências');
  }

  // ── Logout (só limpa o storage local) ──────────────────────────────────
  static Future<void> logout() async {
    await clearOfflineData();
    await AuthStorage.limpar();
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  /// Processa a resposta de /login ou /register:
  /// { "token": "...", "usuario": { ... } }
  static Future<UsuarioLogado> _processarAuthResponse(
      http.Response response) async {
    if (response.statusCode == 200 || response.statusCode == 201) {
      final data    = jsonDecode(response.body) as Map<String, dynamic>;
      final token   = data['token']   as String;
      final usuario = UsuarioLogado.fromJson(
          data['usuario'] as Map<String, dynamic>);

      await clearOfflineData();
      await AuthStorage.salvar(token: token, usuario: usuario);

      return usuario;
    }

    // Tenta extrair mensagem de erro do body
    String mensagem = 'Erro (HTTP ${response.statusCode})';
    if (response.body.isNotEmpty) {
      try {
        final data = jsonDecode(response.body) as Map<String, dynamic>;
        mensagem = data['message']  ??
                   data['mensagem'] ??
                   data['erro']     ??
                   data['error']    ??
                   mensagem;
      } catch (_) {
        final raw = response.body.trim();
        if (raw.isNotEmpty) {
          mensagem = raw.length > 120 ? '${raw.substring(0, 120)}…' : raw;
        }
      }
    }

    throw ApiException(response.statusCode, mensagem);
  }

  /// Retorna o header Authorization para rotas protegidas
  static Future<Map<String, String>> headersAuth() async {
    final token = await AuthStorage.lerToken();
    return {
      ..._headers,
      if (token != null) 'Authorization': 'Bearer $token',
    };
  }
}