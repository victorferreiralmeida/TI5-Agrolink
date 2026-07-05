import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../config/api_config.dart';
import 'api_service.dart';
import 'auth_storage.dart';

MediaType _mimeFotoPerfil(String filename) {
  final lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return MediaType('image', 'png');
  if (lower.endsWith('.gif')) return MediaType('image', 'gif');
  if (lower.endsWith('.webp')) return MediaType('image', 'webp');
  return MediaType('image', 'jpeg');
}

/// Cliente HTTP para `/api/usuario/me` — paridade com `usuarioApi.ts` (web).
class UsuarioApi {
  UsuarioApi._();

  static Future<UsuarioLogado> me() async {
    final headers = await ApiService.headersAuth();
    final res = await http
        .get(Uri.parse('$kApiBaseUrl/api/usuario/me'), headers: headers)
        .timeout(const Duration(seconds: 15));
    if (res.statusCode != 200) {
      throw ApiException(res.statusCode, _readErr(res));
    }
    return UsuarioLogado.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>);
  }

  static Future<UsuarioLogado> atualizar({
    required String nome,
    required String telefone,
  }) async {
    final headers = await ApiService.headersAuth();
    final res = await http
        .put(
          Uri.parse('$kApiBaseUrl/api/usuario/me'),
          headers: headers,
          body: jsonEncode({'nome': nome, 'telefone': telefone}),
        )
        .timeout(const Duration(seconds: 15));
    if (res.statusCode != 200) {
      throw ApiException(res.statusCode, _readErr(res));
    }
    final atualizado = UsuarioLogado.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>);
    await _persistir(atualizado);
    return atualizado;
  }

  static Future<UsuarioLogado> uploadFoto({
    required List<int> bytes,
    required String filename,
  }) async {
    final headers = await ApiService.headersAuth();
    final req = http.MultipartRequest(
      'POST',
      Uri.parse('$kApiBaseUrl/api/usuario/me/foto'),
    );
    headers.remove('Content-Type');
    req.headers.addAll(headers);
    req.files.add(http.MultipartFile.fromBytes(
      'file',
      bytes,
      filename: filename,
      contentType: _mimeFotoPerfil(filename),
    ));
    final streamed = await req.send().timeout(const Duration(seconds: 60));
    final res = await http.Response.fromStream(streamed);
    if (res.statusCode != 200) {
      throw ApiException(res.statusCode, _readErr(res));
    }
    final atualizado = UsuarioLogado.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>);
    await _persistir(atualizado);
    return atualizado;
  }

  static Future<void> _persistir(UsuarioLogado u) async {
    final token = await AuthStorage.lerToken();
    if (token != null && token.isNotEmpty) {
      await AuthStorage.salvar(token: token, usuario: u);
    }
  }

  static String _readErr(http.Response res) {
    final body = res.body.trim();
    if (body.isEmpty) return 'Erro ${res.statusCode}';
    try {
      final j = jsonDecode(body) as Map<String, dynamic>;
      for (final k in const ['message', 'detail', 'title', 'error']) {
        final v = j[k];
        if (v is String && v.trim().isNotEmpty) return v.trim();
      }
    } catch (_) {}
    return body.length > 200 ? 'Erro ${res.statusCode}' : body;
  }
}
