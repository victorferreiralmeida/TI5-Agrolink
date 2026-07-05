import 'dart:convert';
import 'package:http/http.dart' as http;
import 'package:http_parser/http_parser.dart';
import '../config/api_config.dart';
import '../models/ocorrencia_model.dart';
import 'api_service.dart';

/// Devolve o `MediaType` para um arquivo de imagem com base na extensão.
/// Usado no upload multipart — alguns backends rejeitam `application/octet-stream`.
MediaType _mimeImagem(String filename) {
  final lower = filename.toLowerCase();
  if (lower.endsWith('.png')) return MediaType('image', 'png');
  if (lower.endsWith('.gif')) return MediaType('image', 'gif');
  if (lower.endsWith('.webp')) return MediaType('image', 'webp');
  if (lower.endsWith('.heic') || lower.endsWith('.heif')) {
    return MediaType('image', 'heic');
  }
  return MediaType('image', 'jpeg');
}

class OcorrenciasApi {
  OcorrenciasApi._();

  static Future<String> _readApiError(http.Response res) async {
    final text = res.body;
    if (text.isEmpty) {
      if (res.statusCode == 404) return 'Ocorrência não encontrada.';
      return 'Erro ${res.statusCode}';
    }
    try {
      final j = jsonDecode(text) as Map<String, dynamic>;
      for (final key in ['message', 'detail', 'title', 'error']) {
        final v = j[key];
        if (v is String && v.trim().isNotEmpty) return v.trim();
      }
    } catch (_) {}
    return text.length > 200 ? 'Erro ${res.statusCode}' : text;
  }

  static Future<List<Ocorrencia>> listar() async {
    final headers = await ApiService.headersAuth();
    final res = await http
        .get(Uri.parse('$kApiBaseUrl/api/ocorrencias'), headers: headers)
        .timeout(const Duration(seconds: 20));
    if (res.statusCode != 200) {
      throw ApiException(res.statusCode, await _readApiError(res));
    }
    final lista = jsonDecode(res.body) as List<dynamic>;
    return lista
        .cast<Map<String, dynamic>>()
        .map(Ocorrencia.fromJson)
        .toList();
  }

  static Future<Ocorrencia> buscar(int id) async {
    final headers = await ApiService.headersAuth();
    final res = await http
        .get(Uri.parse('$kApiBaseUrl/api/ocorrencias/$id'), headers: headers)
        .timeout(const Duration(seconds: 20));
    if (res.statusCode != 200) {
      throw ApiException(res.statusCode, await _readApiError(res));
    }
    return Ocorrencia.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>);
  }

  static Future<Ocorrencia> criar(Map<String, dynamic> body) async {
    final headers = await ApiService.headersAuth();
    final res = await http
        .post(
          Uri.parse('$kApiBaseUrl/api/ocorrencias'),
          headers: headers,
          body: jsonEncode(body),
        )
        .timeout(const Duration(seconds: 25));
    if (res.statusCode != 200 && res.statusCode != 201) {
      throw ApiException(res.statusCode, await _readApiError(res));
    }
    return Ocorrencia.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>);
  }

  static Future<Ocorrencia> resolver(int id) async {
    final headers = await ApiService.headersAuth();
    final res = await http
        .post(
          Uri.parse('$kApiBaseUrl/api/ocorrencias/$id/resolver'),
          headers: headers,
        )
        .timeout(const Duration(seconds: 20));
    if (res.statusCode != 200) {
      throw ApiException(res.statusCode, await _readApiError(res));
    }
    return Ocorrencia.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>);
  }

  static Future<Ocorrencia> comentar(int id, String texto) async {
    final headers = await ApiService.headersAuth();
    final res = await http
        .post(
          Uri.parse('$kApiBaseUrl/api/ocorrencias/$id/comentarios'),
          headers: headers,
          body: jsonEncode({'texto': texto.trim()}),
        )
        .timeout(const Duration(seconds: 20));
    if (res.statusCode != 200) {
      throw ApiException(res.statusCode, await _readApiError(res));
    }
    return Ocorrencia.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>);
  }

  /// Comentário com até 3 imagens anexadas (paridade com a web).
  static Future<Ocorrencia> comentarComAnexos(
    int id,
    String texto,
    List<({List<int> bytes, String filename})> arquivos,
  ) async {
    final token = await ApiService.headersAuth();
    final req = http.MultipartRequest(
      'POST',
      Uri.parse('$kApiBaseUrl/api/ocorrencias/$id/comentarios'),
    );
    req.headers.addAll(token);
    req.fields['texto'] = texto.trim();
    for (final a in arquivos) {
      req.files.add(http.MultipartFile.fromBytes(
        'files',
        a.bytes,
        filename: a.filename,
        contentType: _mimeImagem(a.filename),
      ));
    }
    final streamed = await req.send().timeout(const Duration(seconds: 60));
    final res = await http.Response.fromStream(streamed);
    if (res.statusCode != 200) {
      throw ApiException(res.statusCode, await _readApiError(res));
    }
    return Ocorrencia.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>);
  }

  static Future<Ocorrencia> uploadImagens(
    int id,
    List<({List<int> bytes, String filename})> arquivos,
  ) async {
    if (arquivos.isEmpty) return buscar(id);
    final token = await ApiService.headersAuth();
    final req = http.MultipartRequest(
      'POST',
      Uri.parse('$kApiBaseUrl/api/ocorrencias/$id/imagens'),
    );
    req.headers.addAll(token);
    for (final a in arquivos) {
      req.files.add(http.MultipartFile.fromBytes(
        'files',
        a.bytes,
        filename: a.filename,
        contentType: _mimeImagem(a.filename),
      ));
    }
    final streamed = await req.send().timeout(const Duration(seconds: 60));
    final res = await http.Response.fromStream(streamed);
    if (res.statusCode != 200) {
      throw ApiException(res.statusCode, await _readApiError(res));
    }
    return Ocorrencia.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>);
  }

  static Future<Ocorrencia> assumirResponsavel(int id) async {
    final headers = await ApiService.headersAuth();
    final res = await http
        .post(
          Uri.parse('$kApiBaseUrl/api/ocorrencias/$id/responsavel/mim'),
          headers: headers,
        )
        .timeout(const Duration(seconds: 20));
    if (res.statusCode != 200) {
      throw ApiException(res.statusCode, await _readApiError(res));
    }
    return Ocorrencia.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>);
  }

  /// Atribui (ou remove, com [usuarioId] = null) o responsável da ocorrência.
  /// Restrito ao back para PRODUTOR ou GERENTE — paridade com a web.
  static Future<Ocorrencia> definirResponsavel(int id, int? usuarioId) async {
    final headers = await ApiService.headersAuth();
    final res = await http
        .put(
          Uri.parse('$kApiBaseUrl/api/ocorrencias/$id/responsavel'),
          headers: headers,
          body: jsonEncode({'usuarioId': usuarioId}),
        )
        .timeout(const Duration(seconds: 20));
    if (res.statusCode != 200) {
      throw ApiException(res.statusCode, await _readApiError(res));
    }
    return Ocorrencia.fromJson(
        jsonDecode(res.body) as Map<String, dynamic>);
  }
}
