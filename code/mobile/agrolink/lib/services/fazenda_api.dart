import 'dart:convert';
import 'package:http/http.dart' as http;
import '../config/api_config.dart';
import 'api_service.dart';

class SetorRegistro {
  final int id;
  final String nome;
  final String fazendaNome;
  final String? poligonoGeojson;

  const SetorRegistro({
    required this.id,
    required this.nome,
    required this.fazendaNome,
    this.poligonoGeojson,
  });

  factory SetorRegistro.fromJson(Map<String, dynamic> j) => SetorRegistro(
        id: (j['id'] as num).toInt(),
        nome: j['nome'] as String? ?? '',
        fazendaNome: j['fazendaNome'] as String? ?? '',
        poligonoGeojson: j['poligonoGeojson'] as String?,
      );

  String get label =>
      fazendaNome.isNotEmpty ? '$nome ($fazendaNome)' : nome;
}

class FazendaMapaRegistro {
  final int id;
  final String nome;
  final String? perimetroGeojson;

  const FazendaMapaRegistro({
    required this.id,
    required this.nome,
    this.perimetroGeojson,
  });

  factory FazendaMapaRegistro.fromJson(Map<String, dynamic> j) =>
      FazendaMapaRegistro(
        id: (j['id'] as num).toInt(),
        nome: j['nome'] as String? ?? '',
        perimetroGeojson: j['perimetroGeojson'] as String?,
      );
}

class RegistroOcorrenciaMapa {
  final List<FazendaMapaRegistro> fazendas;
  final List<SetorRegistro> setores;

  const RegistroOcorrenciaMapa({
    required this.fazendas,
    required this.setores,
  });
}

class FazendaApi {
  FazendaApi._();

  static Future<RegistroOcorrenciaMapa> mapaRegistroOcorrencia() async {
    final headers = await ApiService.headersAuth();
    final res = await http
        .get(
          Uri.parse('$kApiBaseUrl/api/fazenda/registro-ocorrencia-mapa'),
          headers: headers,
        )
        .timeout(const Duration(seconds: 20));
    if (res.statusCode != 200) {
      throw ApiException(
        res.statusCode,
        _lerMensagemErro(res) ??
            'Não foi possível carregar o mapa da fazenda (${res.statusCode}).',
      );
    }
    final j = jsonDecode(res.body) as Map<String, dynamic>;
    final fazendas = (j['fazendas'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>()
        .map(FazendaMapaRegistro.fromJson)
        .toList();
    final setores = (j['setores'] as List<dynamic>? ?? [])
        .cast<Map<String, dynamic>>()
        .map(SetorRegistro.fromJson)
        .toList();
    return RegistroOcorrenciaMapa(fazendas: fazendas, setores: setores);
  }

  static Future<List<SetorRegistro>> listarSetoresRegistro() async {
    final mapa = await mapaRegistroOcorrencia();
    return mapa.setores;
  }

  static String? _lerMensagemErro(http.Response res) {
    try {
      final j = jsonDecode(res.body);
      if (j is Map && j['message'] != null) {
        return j['message'].toString();
      }
    } catch (_) {}
    return null;
  }
}
