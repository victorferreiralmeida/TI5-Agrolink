import 'dart:convert';
import '../config/api_config.dart';

/// Status normalizado (igual ao back-end / web).
enum StatusOcorrencia { aberta, resolvida }

/// Marcador do mapa (visual mobile).
enum TipoMarcadorMapa { critico, alerta, emCurso, resolvido }

class LinhaComentario {
  final String quando;
  final String autor;
  final String texto;

  const LinhaComentario({
    required this.quando,
    required this.autor,
    required this.texto,
  });
}

class Ocorrencia {
  final int id;
  final String titulo;
  final String setor;
  final int? setorFazendaId;
  final String categoria;
  final String prioridade;
  final String? descricao;
  final StatusOcorrencia status;
  final String horario;
  final double coordsX;
  final double coordsY;
  final int? responsavelId;
  final String? responsavelNome;
  final List<String> imagens;
  final String? comentariosRaw;
  final String? clientUuid;
  final bool pendingSync;

  const Ocorrencia({
    required this.id,
    required this.titulo,
    required this.setor,
    this.setorFazendaId,
    required this.categoria,
    required this.prioridade,
    this.descricao,
    required this.status,
    required this.horario,
    required this.coordsX,
    required this.coordsY,
    this.responsavelId,
    this.responsavelNome,
    required this.imagens,
    this.comentariosRaw,
    this.clientUuid,
    this.pendingSync = false,
  });

  factory Ocorrencia.fromJson(Map<String, dynamic> j) {
    final statusRaw = (j['status'] as String? ?? 'ABERTA').toUpperCase();
    return Ocorrencia(
      id: (j['id'] as num).toInt(),
      titulo: j['titulo'] as String? ?? '',
      setor: j['setor'] as String? ?? '',
      setorFazendaId: (j['setorFazendaId'] as num?)?.toInt(),
      categoria: j['categoria'] as String? ?? '',
      prioridade: (j['prioridade'] as String? ?? 'MEDIA').toUpperCase(),
      descricao: j['descricao'] as String?,
      status: statusRaw == 'RESOLVIDA'
          ? StatusOcorrencia.resolvida
          : StatusOcorrencia.aberta,
      horario: j['horario'] as String? ?? '',
      coordsX: (j['coordsX'] as num?)?.toDouble() ?? 0,
      coordsY: (j['coordsY'] as num?)?.toDouble() ?? 0,
      responsavelId: (j['responsavelId'] as num?)?.toInt(),
      responsavelNome: j['responsavelNome'] as String?,
      imagens: (j['imagens'] as List<dynamic>?)
              ?.map((e) => e.toString())
              .where((s) => s.trim().isNotEmpty)
              .toList() ??
          const [],
      comentariosRaw: j['comentarios'] as String?,
      clientUuid: j['clientUuid'] as String?,
      pendingSync: j['pendingSync'] == true,
    );
  }

  Map<String, dynamic> toCreateJson({
    required String titulo,
    required String setor,
    int? setorId,
    required String categoria,
    required String prioridade,
    String? descricao,
    required double coordsX,
    required double coordsY,
    String? horario,
  }) =>
      {
        'titulo': titulo,
        'setor': setor,
        if (setorId != null) 'setorId': setorId,
        'categoria': categoria,
        'prioridade': prioridade,
        if (descricao != null && descricao.isNotEmpty) 'descricao': descricao,
        'status': 'ABERTA',
        if (horario != null) 'horario': horario,
        'coordsX': coordsX,
        'coordsY': coordsY,
      };

  String get descricaoResumo =>
      (descricao ?? '').trim().isEmpty ? 'Sem descrição.' : descricao!.trim();

  String get dataFormatada => formatOcorrenciaHorario(horario);

  String get localizacao {
    final s = setor.trim();
    if (s.isNotEmpty) {
      return '$s · ${coordsY.toStringAsFixed(5)}, ${coordsX.toStringAsFixed(5)}';
    }
    return 'Lat ${coordsY.toStringAsFixed(5)}, Long ${coordsX.toStringAsFixed(5)}';
  }

  /// URL absoluta da primeira imagem real (vazia quando não há imagens).
  /// O fallback visual por categoria é responsabilidade da UI (placeholder
  /// renderizado localmente — o backend não serve `/images/*`).
  String get imageUrl =>
      imagens.isNotEmpty ? resolveApiUrl(imagens.first) : '';

  bool get temImagemReal => imagens.isNotEmpty;

  /// Lista de URLs absolutas de todas as imagens reais.
  List<String> get imagensUrls =>
      imagens.map(resolveApiUrl).where((s) => s.isNotEmpty).toList();

  bool get isCritica =>
      prioridade == 'URGENTE' || prioridade == 'ALTA';

  TipoMarcadorMapa get tipoMarcador {
    if (status == StatusOcorrencia.resolvida) return TipoMarcadorMapa.resolvido;
    if (prioridade == 'URGENTE') return TipoMarcadorMapa.critico;
    if (prioridade == 'ALTA' || prioridade == 'MEDIA') {
      return TipoMarcadorMapa.alerta;
    }
    return TipoMarcadorMapa.emCurso;
  }

  List<LinhaComentario> get linhasComentario {
    final raw = comentariosRaw?.trim();
    if (raw == null || raw.isEmpty) return const [];
    return raw
        .split('\n')
        .map((l) => l.trim())
        .where((l) => l.isNotEmpty)
        .map(parseLinhaComentario)
        .toList();
  }
}

// ── Helpers (paridade com ocorrenciasApi.ts) ────────────────────────────────

const _categoriaLabels = {
  'INCENDIO': 'Incêndio',
  'CERCA': 'Cerca',
  'PRAGA': 'Praga',
  'MANUTENCAO': 'Manutenção',
  'INFRAESTRUTURA': 'Infraestrutura',
  'SOLO': 'Solo',
};

const categoriasRegistro = [
  {'value': 'PRAGA', 'label': 'Praga / doença'},
  {'value': 'INCENDIO', 'label': 'Incêndio'},
  {'value': 'CERCA', 'label': 'Cerca / perímetro'},
  {'value': 'MANUTENCAO', 'label': 'Manutenção'},
  {'value': 'INFRAESTRUTURA', 'label': 'Infraestrutura'},
  {'value': 'SOLO', 'label': 'Solo'},
];

const prioridadesRegistro = [
  {'value': 'BAIXA', 'label': 'Baixa'},
  {'value': 'MEDIA', 'label': 'Média'},
  {'value': 'ALTA', 'label': 'Alta'},
  {'value': 'URGENTE', 'label': 'Crítico'},
];

String labelCategoria(String categoria) {
  final k = categoria.trim().toUpperCase();
  return _categoriaLabels[k] ?? categoria;
}

/// Imagem de fallback por categoria — paridade com `imagemCategoria` da web.
/// Servida pelo back-end em `/images/<categoria>.jpg`.
const Map<String, String> _categoriaImagens = {
  'INCENDIO': '/images/incendio.jpg',
  'CERCA': '/images/cerca.jpg',
  'PRAGA': '/images/praga.jpg',
  'MANUTENCAO': '/images/manutencao.jpg',
  'INFRAESTRUTURA': '/images/infraestrutura.jpg',
  'SOLO': '/images/solo.jpg',
};

String imagemCategoria(String categoria) {
  final k = categoria.trim().toUpperCase();
  return _categoriaImagens[k] ?? '/images/default.jpg';
}

/// Remove diacríticos para buscas acento-insensíveis ("vavula" casa "Válvula").
const Map<int, String> _diacriticosMap = {
  0x00E1: 'a', 0x00E0: 'a', 0x00E2: 'a', 0x00E3: 'a', 0x00E4: 'a', 0x00E5: 'a',
  0x00C1: 'a', 0x00C0: 'a', 0x00C2: 'a', 0x00C3: 'a', 0x00C4: 'a', 0x00C5: 'a',
  0x00E9: 'e', 0x00E8: 'e', 0x00EA: 'e', 0x00EB: 'e',
  0x00C9: 'e', 0x00C8: 'e', 0x00CA: 'e', 0x00CB: 'e',
  0x00ED: 'i', 0x00EC: 'i', 0x00EE: 'i', 0x00EF: 'i',
  0x00CD: 'i', 0x00CC: 'i', 0x00CE: 'i', 0x00CF: 'i',
  0x00F3: 'o', 0x00F2: 'o', 0x00F4: 'o', 0x00F5: 'o', 0x00F6: 'o',
  0x00D3: 'o', 0x00D2: 'o', 0x00D4: 'o', 0x00D5: 'o', 0x00D6: 'o',
  0x00FA: 'u', 0x00F9: 'u', 0x00FB: 'u', 0x00FC: 'u',
  0x00DA: 'u', 0x00D9: 'u', 0x00DB: 'u', 0x00DC: 'u',
  0x00E7: 'c', 0x00C7: 'c',
  0x00F1: 'n', 0x00D1: 'n',
};

/// Normaliza texto para busca: minúsculo + sem acento.
String normalizarBusca(String texto) {
  final lower = texto.toLowerCase();
  final buf = StringBuffer();
  for (final code in lower.runes) {
    buf.write(_diacriticosMap[code] ?? String.fromCharCode(code));
  }
  return buf.toString();
}

String labelPrioridade(String prioridade) {
  switch (prioridade.toUpperCase()) {
    case 'URGENTE':
      return 'Crítico';
    case 'ALTA':
      return 'Alta';
    case 'MEDIA':
      return 'Média';
    case 'BAIXA':
      return 'Baixa';
    default:
      return prioridade;
  }
}

String labelStatus(StatusOcorrencia s) =>
    s == StatusOcorrencia.resolvida ? 'Resolvida' : 'Aberta';

bool ocorrenciaMesmoDiaLocal(String horario, [DateTime? referencia]) {
  final t = DateTime.tryParse(horario)?.toLocal();
  if (t == null) return false;
  final ref = (referencia ?? DateTime.now()).toLocal();
  return t.year == ref.year && t.month == ref.month && t.day == ref.day;
}

String formatOcorrenciaHorario(String horario) {
  final t = DateTime.tryParse(horario);
  if (t == null) return horario;
  final local = t.toLocal();
  final d = '${local.day.toString().padLeft(2, '0')}/'
      '${local.month.toString().padLeft(2, '0')}/'
      '${local.year}';
  final h = '${local.hour.toString().padLeft(2, '0')}:'
      '${local.minute.toString().padLeft(2, '0')}';
  return '$d, $h';
}

LinhaComentario parseLinhaComentario(String linha) {
  final t = linha.trim();
  if (t.startsWith('{')) {
    try {
      final j = jsonDecode(t) as Map<String, dynamic>;
      return LinhaComentario(
        quando: j['ts'] as String? ?? '',
        autor: (j['n'] as String?)?.trim().isNotEmpty == true
            ? (j['n'] as String).trim()
            : 'Equipe',
        texto: j['m'] as String? ?? '',
      );
    } catch (_) {
      return LinhaComentario(quando: '', autor: 'Comentário', texto: t);
    }
  }
  final m = RegExp(r'^\[(.+?)\]\s*(.+?):\s*(.*)$').firstMatch(linha);
  return LinhaComentario(
    quando: m?.group(1) ?? '',
    autor: (m?.group(2) ?? 'Equipe Agrolink').trim(),
    texto: (m?.group(3) ?? linha).trim(),
  );
}

String horarioComentarioLegivel(String quando) {
  if (quando.isEmpty) return '';
  final t = DateTime.tryParse(quando);
  if (t == null) return quando;
  return formatOcorrenciaHorario(t.toIso8601String());
}
