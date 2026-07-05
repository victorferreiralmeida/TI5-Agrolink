import 'dart:convert';

import 'package:http/http.dart' as http;

import '../config/api_config.dart';
import 'auth_storage.dart';

class ChatApi {
  static Future<List<dynamic>> listarSalas() async {
    final token = await AuthStorage.lerToken();

    final response = await http.get(
      Uri.parse('$kApiBaseUrl/api/chat/salas'),
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      return jsonDecode(utf8.decode(response.bodyBytes));
    }

    throw Exception('Erro ao listar salas de chat');
  }

  static Future<List<dynamic>> listarMensagens(int salaId) async {
    final token = await AuthStorage.lerToken();

    final response = await http.get(
      Uri.parse('$kApiBaseUrl/api/chat/salas/$salaId/mensagens'),
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
    );

    if (response.statusCode == 200) {
      return jsonDecode(utf8.decode(response.bodyBytes));
    }

    throw Exception('Erro ao listar mensagens');
  }

  static Future<Map<String, dynamic>> enviarMensagem({
    required int salaId,
    required String texto,
  }) async {
    final token = await AuthStorage.lerToken();

    final response = await http.post(
      Uri.parse('$kApiBaseUrl/api/chat/salas/$salaId/mensagens'),
      headers: {
        'Content-Type': 'application/json',
        if (token != null) 'Authorization': 'Bearer $token',
      },
      body: jsonEncode({
        'texto': texto,
      }),
    );

    if (response.statusCode == 200 || response.statusCode == 201) {
      return jsonDecode(utf8.decode(response.bodyBytes));
    }

    throw Exception('Erro ao enviar mensagem');
  }
}