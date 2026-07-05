import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'api_service.dart';

class EquipeResumo {
  final int totalMembros;

  const EquipeResumo({required this.totalMembros});

  factory EquipeResumo.fromJson(Map<String, dynamic> j) {
    final membros = j['membros'] as List<dynamic>? ?? [];
    return EquipeResumo(totalMembros: membros.length);
  }
}

/// Membro de equipe — paridade com `MembroDto` da web.
class MembroEquipe {
  final int id;
  final String nome;
  final String? email;
  final String papel;
  final String? fotoUrl;
  final bool ativo;

  const MembroEquipe({
    required this.id,
    required this.nome,
    this.email,
    required this.papel,
    this.fotoUrl,
    required this.ativo,
  });

  factory MembroEquipe.fromJson(Map<String, dynamic> j) => MembroEquipe(
        id: (j['id'] as num).toInt(),
        nome: (j['nome'] as String?)?.trim() ?? '',
        email: j['email'] as String?,
        papel: (j['papel'] as String?)?.toUpperCase() ?? 'FUNCIONARIO_CAMPO',
        fotoUrl: j['fotoUrl'] as String?,
        ativo: (j['ativo'] as bool?) ?? true,
      );
}

class EquipeApi {
  EquipeApi._();

  static Future<List<ConviteEquipe>> meusConvites() async {
    final headers = await ApiService.headersAuth();
    final res = await http
        .get(
          Uri.parse('$kApiBaseUrl/api/equipe/convites/me'),
          headers: headers,
        )
        .timeout(const Duration(seconds: 15));
    if (res.statusCode != 200) return const [];
    final lista = jsonDecode(res.body) as List<dynamic>;
    return lista
        .cast<Map<String, dynamic>>()
        .map(ConviteEquipe.fromJson)
        .toList();
  }

  static Future<bool> aceitarConvite(int id) async {
    final headers = await ApiService.headersAuth();
    final res = await http
        .post(
          Uri.parse('$kApiBaseUrl/api/equipe/convites/$id/aceitar'),
          headers: headers,
        )
        .timeout(const Duration(seconds: 15));
    return res.statusCode >= 200 && res.statusCode < 300;
  }

  static Future<bool> recusarConvite(int id) async {
    final headers = await ApiService.headersAuth();
    final res = await http
        .post(
          Uri.parse('$kApiBaseUrl/api/equipe/convites/$id/recusar'),
          headers: headers,
        )
        .timeout(const Duration(seconds: 15));
    return res.statusCode >= 200 && res.statusCode < 300;
  }

  static Future<EquipeResumo?> carregarResumo() async {
    try {
      final headers = await ApiService.headersAuth();
      final res = await http
          .get(
            Uri.parse('$kApiBaseUrl/api/equipe'),
            headers: headers,
          )
          .timeout(const Duration(seconds: 15));
      if (res.statusCode != 200) return null;
      return EquipeResumo.fromJson(
          jsonDecode(res.body) as Map<String, dynamic>);
    } catch (_) {
      return null;
    }
  }

  /// Lista membros da equipe. Filtro por papel: `FUNCIONARIO_CAMPO`,
  /// `GERENTE`, `PRODUTOR` ou null (todos).
  static Future<List<MembroEquipe>> listarMembros({String? papel}) async {
    final headers = await ApiService.headersAuth();
    final qs = papel != null && papel.isNotEmpty ? '?papel=$papel' : '';
    final res = await http
        .get(
          Uri.parse('$kApiBaseUrl/api/equipe/membros$qs'),
          headers: headers,
        )
        .timeout(const Duration(seconds: 15));
    if (res.statusCode != 200) return const [];
    final lista = jsonDecode(res.body) as List<dynamic>;
    return lista
        .cast<Map<String, dynamic>>()
        .map(MembroEquipe.fromJson)
        .toList();
  }
}

class ConviteEquipe {
  final int id;
  final String? email;
  final String papel;
  final String dataExpiracao;

  const ConviteEquipe({
    required this.id,
    this.email,
    required this.papel,
    required this.dataExpiracao,
  });

  factory ConviteEquipe.fromJson(Map<String, dynamic> j) => ConviteEquipe(
        id: (j['id'] as num).toInt(),
        email: j['email'] as String?,
        papel: (j['papel'] as String?)?.toUpperCase() ?? 'FUNCIONARIO_CAMPO',
        dataExpiracao: (j['dataExpiracao'] as String?) ?? '',
      );

  String get papelLabel => papel == 'GERENTE' ? 'Gerente' : 'Funcionário';
}
