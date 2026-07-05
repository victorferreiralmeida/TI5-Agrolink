import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'api_service.dart';

/// Paridade com `NotificacaoDto` da web.
class NotificacaoItem {
  final int id;
  final String tipo;
  final String tag;
  final String tagTone;
  final String icon;
  final String titulo;
  final String mensagem;
  final String? refTipo;
  final int? refId;
  final String criadoEm;

  const NotificacaoItem({
    required this.id,
    required this.tipo,
    required this.tag,
    required this.tagTone,
    required this.icon,
    required this.titulo,
    required this.mensagem,
    this.refTipo,
    this.refId,
    required this.criadoEm,
  });

  factory NotificacaoItem.fromJson(Map<String, dynamic> j) => NotificacaoItem(
        id: (j['id'] as num).toInt(),
        tipo: (j['tipo'] as String?) ?? '',
        tag: (j['tag'] as String?) ?? '',
        tagTone: (j['tagTone'] as String?) ?? 'muted',
        icon: (j['icon'] as String?) ?? 'alert',
        titulo: (j['titulo'] as String?) ?? '',
        mensagem: (j['mensagem'] as String?) ?? '',
        refTipo: j['refTipo'] as String?,
        refId: j['refId'] != null ? (j['refId'] as num).toInt() : null,
        criadoEm: (j['criadoEm'] as String?) ?? '',
      );

  String get textoExibicao =>
      mensagem.trim().isNotEmpty ? mensagem : titulo;
}

class NotificacoesApi {
  NotificacoesApi._();

  static Future<List<NotificacaoItem>> listar() async {
    final headers = await ApiService.headersAuth();
    final res = await http
        .get(
          Uri.parse('$kApiBaseUrl/api/notificacoes'),
          headers: headers,
        )
        .timeout(const Duration(seconds: 15));
    if (res.statusCode != 200) return const [];
    final lista = jsonDecode(res.body) as List<dynamic>;
    return lista
        .cast<Map<String, dynamic>>()
        .map(NotificacaoItem.fromJson)
        .toList();
  }
}
