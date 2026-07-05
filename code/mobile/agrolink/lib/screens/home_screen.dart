import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../geo/fazenda_map_geometry.dart';
import '../main.dart';
import '../models/ocorrencia_model.dart';
import '../services/auth_storage.dart';
import '../services/fazenda_api.dart';
import '../services/ocorrencias_api.dart';
import '../theme/app_tokens.dart';
import '../widgets/app_header.dart';
import 'ocorrencias_screen.dart';
import 'registrar_ocorrencia_screen.dart';

// ═══════════════════════════════════════════════════════════════
// MODELO DE ESTATÍSTICAS — paridade com `kpis` do DashboardPage web
// ═══════════════════════════════════════════════════════════════

class EstatisticasOcorrencias {
  final int total;
  final int abertas;
  final int aguardando; // abertas que NÃO são URGENTE
  final int resolvidas;
  final int resolvidasHoje;
  final int criticas;

  const EstatisticasOcorrencias({
    required this.total,
    required this.abertas,
    required this.aguardando,
    required this.resolvidas,
    required this.resolvidasHoje,
    required this.criticas,
  });

  factory EstatisticasOcorrencias.fromLista(List<Ocorrencia> lista) {
    int abertas = 0;
    int aguardando = 0;
    int resolvidas = 0;
    int resolvidasHoje = 0;
    int criticas = 0;
    final hoje = DateTime.now();

    for (final o in lista) {
      if (o.status == StatusOcorrencia.aberta) {
        abertas++;
        if (o.prioridade == 'URGENTE') {
          criticas++;
        } else {
          aguardando++;
        }
      } else {
        resolvidas++;
        if (ocorrenciaMesmoDiaLocal(o.horario, hoje)) resolvidasHoje++;
      }
    }

    return EstatisticasOcorrencias(
      total: lista.length,
      abertas: abertas,
      aguardando: aguardando,
      resolvidas: resolvidas,
      resolvidasHoje: resolvidasHoje,
      criticas: criticas,
    );
  }
}

/// Filtro do bloco "Ocorrências recentes" — paridade com `FiltroDash` da web.
enum _FiltroRecentes { hoje, semana, importante, resolvidas }

extension _FiltroRecentesLabel on _FiltroRecentes {
  String get label {
    switch (this) {
      case _FiltroRecentes.hoje:
        return 'Hoje';
      case _FiltroRecentes.semana:
        return 'Semana';
      case _FiltroRecentes.importante:
        return 'Importante';
      case _FiltroRecentes.resolvidas:
        return 'Resolvidas';
    }
  }
}

// ═══════════════════════════════════════════════════════════════
// TELA HOME / DASHBOARD
// ═══════════════════════════════════════════════════════════════

class TelaHome extends StatefulWidget {
  const TelaHome({super.key});

  @override
  State<TelaHome> createState() => _TelaHomeState();
}

class _TelaHomeState extends State<TelaHome> {
  static const _defaultLat = -19.9505;
  static const _defaultLng = -43.9035;

  UsuarioLogado? _usuario;
  EstatisticasOcorrencias? _stats;
  bool _loading = true;
  String? _erro;

  List<Ocorrencia> _ocorrencias = const [];
  List<FazendaMapaRegistro> _fazendas = const [];
  List<SetorRegistro> _setores = const [];
  List<({SetorRegistro setor, List<LatLng> poly})> _setoresComPoly = const [];
  List<Polygon> _poligonosFazenda = const [];

  _FiltroRecentes _filtroRecentes = _FiltroRecentes.hoje;

  final _mapController = MapController();
  bool _mapaPronto = false;
  bool _enquadrarPendente = false;
  int _enquadrarTentativas = 0;
  static const _maxEnquadrarTentativas = 5;

  @override
  void initState() {
    super.initState();
    _carregarUsuario();
    _carregarDados();
  }

  @override
  void dispose() {
    _mapController.dispose();
    super.dispose();
  }

  void _atualizarGeometriaMapa() {
    _setoresComPoly = _setores
        .map((s) => (setor: s, poly: parsePolygonLatLng(s.poligonoGeojson)))
        .where((x) => x.poly.length >= 3)
        .toList();
    _poligonosFazenda = _fazendas
        .map((f) {
          final poly = parsePolygonLatLng(f.perimetroGeojson);
          if (poly.length < 3) return null;
          final est = estiloPerimetroFazenda(satelite: false);
          return Polygon(
            points: poly,
            color: est.fill,
            borderColor: est.border,
            borderStrokeWidth: est.borderWidth,
          );
        })
        .whereType<Polygon>()
        .toList();
  }

  Future<void> _carregarUsuario() async {
    final u = await AuthStorage.lerUsuario();
    if (mounted) setState(() => _usuario = u);
  }

  Future<void> _carregarDados() async {
    setState(() {
      _loading = true;
      _erro = null;
    });
    final u = _usuario ?? await AuthStorage.lerUsuario();
    if (u != null && !u.temFazenda) {
      if (!mounted) return;
      setState(() {
        _usuario = u;
        _ocorrencias = const [];
        _fazendas = const [];
        _setores = const [];
        _stats = const EstatisticasOcorrencias(
          total: 0,
          abertas: 0,
          aguardando: 0,
          resolvidas: 0,
          resolvidasHoje: 0,
          criticas: 0,
        );
        _loading = false;
      });
      _atualizarGeometriaMapa();
      return;
    }
    try {
      final lista = await OcorrenciasApi.listar();
      RegistroOcorrenciaMapa mapa;
      try {
        mapa = await FazendaApi.mapaRegistroOcorrencia();
      } catch (_) {
        mapa = const RegistroOcorrenciaMapa(fazendas: [], setores: []);
      }
      if (!mounted) return;
      setState(() {
        _ocorrencias = lista;
        _fazendas = mapa.fazendas;
        _setores = mapa.setores;
        _stats = EstatisticasOcorrencias.fromLista(lista);
        _loading = false;
        _enquadrarPendente = true;
        _enquadrarTentativas = 0;
        _atualizarGeometriaMapa();
      });
      _enquadrarMapa();
    } catch (e) {
      if (!mounted) return;
      setState(() {
        _erro = 'Não foi possível carregar o painel.';
        _loading = false;
      });
    }
  }

  void _selecionarAba(int indice) {
    final shell = TelaPrincipal.estadoDe(context);
    if (shell != null) shell.selecionarAba(indice);
  }

  void _abrirMapa() => _selecionarAba(TelaPrincipal.abaMapa);
  void _abrirOcorrencias() => _selecionarAba(TelaPrincipal.abaOcorrencias);

  Future<void> _abrirRegistrar() async {
    final criou = await Navigator.push<bool>(
      context,
      MaterialPageRoute(builder: (_) => const TelaNovaOcorrencia()),
    );
    if (criou == true) _carregarDados();
  }

  void _abrirDetalhe(Ocorrencia o) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => TelaDetalheOcorrencia(ocorrencia: o),
      ),
    ).then((_) => _carregarDados());
  }

  // ── Mapa preview ────────────────────────────────────────────────

  /// Marcadores do "Mapa da fazenda" no dashboard — somente ocorrências
  /// abertas (paridade com o filtro padrão da web/mobile).
  List<Ocorrencia> get _ocorrenciasComCoords => _ocorrencias
      .where((o) =>
          o.status == StatusOcorrencia.aberta &&
          (o.coordsY != 0 || o.coordsX != 0))
      .toList();

  void _onMapaPronto() {
    _mapaPronto = true;
    if (_enquadrarPendente) _enquadrarMapa();
  }

  void _enquadrarMapa() {
    if (!mounted) return;
    if (_enquadrarTentativas >= _maxEnquadrarTentativas) {
      _enquadrarPendente = false;
      return;
    }

    final rings = <List<LatLng>>[];
    for (final f in _fazendas) {
      final p = parsePolygonLatLng(f.perimetroGeojson);
      if (p.length >= 3) rings.add(p);
    }
    for (final s in _setoresComPoly) {
      rings.add(s.poly);
    }
    final pts = <LatLng>[
      ...allPointsFromPolygons(rings),
      ..._ocorrenciasComCoords.map((o) => LatLng(o.coordsY, o.coordsX)),
    ];

    if (!_mapaPronto) {
      _enquadrarPendente = true;
      return;
    }
    _enquadrarPendente = false;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      try {
        if (pts.isEmpty) {
          _mapController.move(const LatLng(_defaultLat, _defaultLng), 14);
        } else {
          _mapController.fitCamera(
            CameraFit.coordinates(
              coordinates: pts,
              padding: const EdgeInsets.all(28),
            ),
          );
        }
        _enquadrarTentativas = 0;
      } catch (_) {
        _enquadrarTentativas++;
        if (_enquadrarTentativas < _maxEnquadrarTentativas) {
          Future.delayed(const Duration(milliseconds: 300), _enquadrarMapa);
        }
      }
    });
  }

  // ── Listas / filtros ────────────────────────────────────────────
  List<Ocorrencia> get _recentes {
    final agora = DateTime.now();
    final filtradas = _ocorrencias.where((o) {
      final t = DateTime.tryParse(o.horario)?.toLocal();
      switch (_filtroRecentes) {
        case _FiltroRecentes.hoje:
          if (t == null) return false;
          return agora.difference(t).inHours <= 24;
        case _FiltroRecentes.semana:
          if (t == null) return false;
          return agora.difference(t).inDays <= 7;
        case _FiltroRecentes.importante:
          return o.prioridade == 'URGENTE' || o.prioridade == 'ALTA';
        case _FiltroRecentes.resolvidas:
          return o.status == StatusOcorrencia.resolvida;
      }
    }).toList()
      ..sort(_compararCriticidade);

    // Garante ao menos 3 itens visíveis (paridade com `garantirMinimoOcorrencias`).
    if (filtradas.length < 3) {
      final extras = _ocorrencias
          .where((o) => !filtradas.contains(o))
          .toList()
        ..sort(_compararCriticidade);
      filtradas.addAll(extras.take(3 - filtradas.length));
    }

    return filtradas.take(6).toList();
  }

  int _pesoCriticidade(Ocorrencia o) {
    if (o.status == StatusOcorrencia.resolvida) return 4;
    switch (o.prioridade) {
      case 'URGENTE':
        return 0;
      case 'ALTA':
        return 1;
      case 'MEDIA':
        return 2;
      default:
        return 3;
    }
  }

  int _compararCriticidade(Ocorrencia a, Ocorrencia b) {
    final pa = _pesoCriticidade(a);
    final pb = _pesoCriticidade(b);
    if (pa != pb) return pa.compareTo(pb);
    final ta = DateTime.tryParse(a.horario)?.millisecondsSinceEpoch ?? 0;
    final tb = DateTime.tryParse(b.horario)?.millisecondsSinceEpoch ?? 0;
    return tb.compareTo(ta);
  }

  String get _saudacao {
    final n = _usuario?.nome.trim() ?? '';
    if (n.isEmpty) return 'Olá!';
    return 'Olá, ${n.split(' ').first}!';
  }

  String get _papelLabel {
    switch (_usuario?.papel.toLowerCase()) {
      case 'gerente':
        return 'Gerente';
      case 'funcionario':
      case 'funcionario_campo':
        return 'Funcionário';
      case 'produtor':
      default:
        return 'Produtor';
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final semFazenda = _usuario != null && !_usuario!.temFazenda;

    return Scaffold(
      backgroundColor: t.bg,
      appBar: AppHeader(
        title: 'Dashboard',
        subtitle: _papelLabel,
        usuario: _usuario,
        onAvatarTap: () => _selecionarAba(TelaPrincipal.abaPerfil),
      ),
      floatingActionButton: semFazenda
          ? null
          : FloatingActionButton.extended(
        onPressed: _abrirRegistrar,
        backgroundColor: t.primary,
        foregroundColor: Colors.white,
        icon: const Icon(Icons.add_rounded),
        label: const Text('Registrar'),
      ),
      body: RefreshIndicator(
        onRefresh: _carregarDados,
        color: t.primary,
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
              AppSpacing.lg, AppSpacing.lg, AppSpacing.lg, 96),
          children: [
            _SaudacaoCard(
              saudacao: _saudacao,
              email: _usuario?.email ?? '',
              papel: _papelLabel,
            ),
            const SizedBox(height: AppSpacing.lg),
            if (semFazenda) ...[
              _SemFazendaCard(papel: _usuario?.papel ?? ''),
            ] else ...[
            if (_erro != null) _ErroBanner(erro: _erro!, onRetry: _carregarDados),
            _SecaoTitulo(
              titulo: 'Indicadores',
              acaoLabel: 'Ver tudo',
              onAcao: _abrirOcorrencias,
            ),
            const SizedBox(height: AppSpacing.sm),
            _GridIndicadores(
              loading: _loading,
              stats: _stats,
              onAbertas: _abrirOcorrencias,
              onAguardando: _abrirOcorrencias,
              onResolvidas: _abrirOcorrencias,
              onCriticas: _abrirOcorrencias,
            ),
            const SizedBox(height: AppSpacing.xl),
            _SecaoTitulo(
              titulo: 'Mapa da fazenda',
              acaoLabel: 'Abrir mapa',
              onAcao: _abrirMapa,
            ),
            const SizedBox(height: AppSpacing.sm),
            _MapaPreview(
              loading: _loading,
              controller: _mapController,
              onPronto: _onMapaPronto,
              poligonosFazenda: _poligonosFazenda,
              setoresComPoly: _setoresComPoly,
              ocorrencias: _ocorrenciasComCoords,
              onAbrir: _abrirMapa,
            ),
            const SizedBox(height: AppSpacing.xl),
            const _SecaoTitulo(titulo: 'Ocorrências recentes'),
            const SizedBox(height: AppSpacing.sm),
            _ChipsRecentes(
              atual: _filtroRecentes,
              onChange: (f) => setState(() => _filtroRecentes = f),
            ),
            const SizedBox(height: AppSpacing.md),
            _ListaRecentes(
              loading: _loading,
              ocorrencias: _recentes,
              onTap: _abrirDetalhe,
            ),
            const SizedBox(height: AppSpacing.xl),
            const _SecaoTitulo(titulo: 'Ações rápidas'),
            const SizedBox(height: AppSpacing.sm),
            _AcoesRapidas(
              onMapa: _abrirMapa,
              onOcorrencias: _abrirOcorrencias,
              onRegistrar: _abrirRegistrar,
              onMensagens: () => _selecionarAba(TelaPrincipal.abaMensagens),
            ),
            ],
          ],
        ),
      ),
    );
  }
}

// ═══════════════════════════════════════════════════════════════
// COMPONENTES VISUAIS
// ═══════════════════════════════════════════════════════════════

class _SemFazendaCard extends StatelessWidget {
  final String papel;

  const _SemFazendaCard({required this.papel});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final gerente = papel == 'GERENTE';
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: t.border),
      ),
      child: Text(
        gerente
            ? 'Cadastre sua fazenda para começar a registrar ocorrências e convidar sua equipe.'
            : 'Você ainda não está vinculado a uma fazenda. Aguarde o convite do gestor ou aceite-o nas notificações.',
        style: TextStyle(color: t.textMuted, height: 1.45),
      ),
    );
  }
}

class _SaudacaoCard extends StatelessWidget {
  final String saudacao;
  final String email;
  final String papel;

  const _SaudacaoCard({
    required this.saudacao,
    required this.email,
    required this.papel,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    return Container(
      padding: const EdgeInsets.all(AppSpacing.lg),
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: t.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(saudacao,
                    style: TextStyle(
                      fontSize: 20,
                      fontWeight: FontWeight.bold,
                      color: t.text,
                    )),
                const SizedBox(height: 4),
                Text(
                  'Bem-vindo de volta. Veja o resumo da sua fazenda.',
                  style: TextStyle(fontSize: 13, color: t.textMuted),
                ),
                if (email.isNotEmpty) ...[
                  const SizedBox(height: 8),
                  Text(email,
                      style: TextStyle(
                          fontSize: 12, color: t.textMuted)),
                ],
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.md),
          Container(
            padding: const EdgeInsets.symmetric(
                horizontal: 12, vertical: 6),
            decoration: BoxDecoration(
              color: t.primarySoft,
              borderRadius: BorderRadius.circular(AppRadius.pill),
              border: Border.all(color: t.primary.withValues(alpha: 0.25)),
            ),
            child: Text(
              papel,
              style: TextStyle(
                fontSize: 12,
                color: t.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _SecaoTitulo extends StatelessWidget {
  final String titulo;
  final String? acaoLabel;
  final VoidCallback? onAcao;

  const _SecaoTitulo({
    required this.titulo,
    this.acaoLabel,
    this.onAcao,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    return Row(
      children: [
        Text(
          titulo,
          style: TextStyle(
            fontSize: 14,
            fontWeight: FontWeight.w700,
            color: t.text,
            letterSpacing: 0.2,
          ),
        ),
        const Spacer(),
        if (acaoLabel != null && onAcao != null)
          GestureDetector(
            onTap: onAcao,
            child: Text(
              '$acaoLabel ›',
              style: TextStyle(
                fontSize: 12,
                color: t.primary,
                fontWeight: FontWeight.w600,
              ),
            ),
          ),
      ],
    );
  }
}

class _GridIndicadores extends StatelessWidget {
  final bool loading;
  final EstatisticasOcorrencias? stats;
  final VoidCallback onAbertas;
  final VoidCallback onAguardando;
  final VoidCallback onResolvidas;
  final VoidCallback onCriticas;

  const _GridIndicadores({
    required this.loading,
    required this.stats,
    required this.onAbertas,
    required this.onAguardando,
    required this.onResolvidas,
    required this.onCriticas,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    if (loading) {
      return Container(
        height: 130,
        decoration: BoxDecoration(
          color: t.surface,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: t.border),
        ),
        child: Center(
          child: CircularProgressIndicator(color: t.primary, strokeWidth: 2.5),
        ),
      );
    }

    final s = stats;
    final abertas = s?.abertas ?? 0;
    final aguardando = s?.aguardando ?? 0;
    final resolvidas = s?.resolvidas ?? 0;
    final criticas = s?.criticas ?? 0;

    return Column(
      children: [
        Row(
          children: [
            Expanded(
              child: _CardKpi(
                icone: Icons.error_outline_rounded,
                tone: t.info,
                toneSoft: t.infoSoft,
                titulo: 'Total aberta',
                valor: '$abertas',
                onTap: onAbertas,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _CardKpi(
                icone: Icons.schedule_rounded,
                tone: t.warning,
                toneSoft: t.warningSoft,
                titulo: 'Aguardando',
                valor: '$aguardando',
                onTap: onAguardando,
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.sm),
        Row(
          children: [
            Expanded(
              child: _CardKpi(
                icone: Icons.check_circle_outline_rounded,
                tone: t.success,
                toneSoft: t.successSoft,
                titulo: 'Resolvidas',
                valor: '$resolvidas',
                onTap: onResolvidas,
              ),
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: _CardKpi(
                icone: Icons.warning_amber_rounded,
                tone: t.danger,
                toneSoft: t.dangerSoft,
                titulo: 'Críticas',
                valor: '$criticas',
                onTap: onCriticas,
              ),
            ),
          ],
        ),
      ],
    );
  }
}

class _CardKpi extends StatelessWidget {
  final IconData icone;
  final Color tone;
  final Color toneSoft;
  final String titulo;
  final String valor;
  final VoidCallback onTap;

  const _CardKpi({
    required this.icone,
    required this.tone,
    required this.toneSoft,
    required this.titulo,
    required this.valor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    return Material(
      color: t.surface,
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.lg),
            border: Border.all(color: t.border),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 28,
                height: 28,
                decoration: BoxDecoration(
                  color: toneSoft,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: Icon(icone, color: tone, size: 16),
              ),
              const SizedBox(height: 6),
              Text(
                titulo,
                style: TextStyle(
                  fontSize: 11,
                  color: t.textMuted,
                  fontWeight: FontWeight.w500,
                ),
              ),
              const SizedBox(height: 2),
              Text(
                valor,
                style: TextStyle(
                  fontSize: 20,
                  fontWeight: FontWeight.bold,
                  color: t.text,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _MapaPreview extends StatefulWidget {
  final bool loading;
  final MapController controller;
  final VoidCallback onPronto;
  final List<Polygon> poligonosFazenda;
  final List<({SetorRegistro setor, List<LatLng> poly})> setoresComPoly;
  final List<Ocorrencia> ocorrencias;
  final VoidCallback onAbrir;

  const _MapaPreview({
    required this.loading,
    required this.controller,
    required this.onPronto,
    required this.poligonosFazenda,
    required this.setoresComPoly,
    required this.ocorrencias,
    required this.onAbrir,
  });

  @override
  State<_MapaPreview> createState() => _MapaPreviewState();
}

class _MapaPreviewState extends State<_MapaPreview> {
  /// Adia a criação do FlutterMap para não bloquear a UI ao abrir o dashboard.
  bool _mapaAtivo = false;

  @override
  void initState() {
    super.initState();
    _agendarMapa();
  }

  @override
  void didUpdateWidget(covariant _MapaPreview oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (!oldWidget.loading && widget.loading) {
      setState(() => _mapaAtivo = false);
      _agendarMapa();
    } else if (oldWidget.loading && !widget.loading && !_mapaAtivo) {
      _agendarMapa();
    }
  }

  void _agendarMapa() {
    if (widget.loading) return;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || widget.loading) return;
      Future.delayed(const Duration(milliseconds: 350), () {
        if (mounted && !widget.loading) {
          setState(() => _mapaAtivo = true);
        }
      });
    });
  }

  Color _corMarcador(AppTokens t, Ocorrencia o) {
    switch (o.tipoMarcador) {
      case TipoMarcadorMapa.critico:
        return t.danger;
      case TipoMarcadorMapa.alerta:
        return t.warning;
      case TipoMarcadorMapa.emCurso:
        return t.info;
      case TipoMarcadorMapa.resolvido:
        return t.success;
    }
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final mostrarMapa = _mapaAtivo && !widget.loading;

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadius.lg),
      child: Container(
        height: 200,
        decoration: BoxDecoration(
          color: t.surfaceMuted,
          border: Border.all(color: t.border),
          borderRadius: BorderRadius.circular(AppRadius.lg),
        ),
        child: Stack(
          children: [
            if (!mostrarMapa)
              Center(
                child: widget.loading
                    ? CircularProgressIndicator(
                        color: t.primary,
                        strokeWidth: 2.5,
                      )
                    : Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(Icons.map_outlined,
                              size: 32, color: t.textMuted),
                          const SizedBox(height: 8),
                          Text(
                            'Carregando mapa…',
                            style: TextStyle(
                              fontSize: 12,
                              color: t.textMuted,
                            ),
                          ),
                        ],
                      ),
              )
            else
              RepaintBoundary(
                child: IgnorePointer(
                  child: FlutterMap(
                    mapController: widget.controller,
                    options: MapOptions(
                      initialCenter: const LatLng(-19.9505, -43.9035),
                      initialZoom: 14,
                      onMapReady: widget.onPronto,
                      // Preview estático — interação fica na aba Mapa.
                      interactionOptions: const InteractionOptions(
                        flags: InteractiveFlag.none,
                      ),
                    ),
                    children: [
                      TileLayer(
                        urlTemplate:
                            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        userAgentPackageName: 'com.agrolink.app',
                        maxZoom: 16,
                        maxNativeZoom: 16,
                      ),
                      if (widget.poligonosFazenda.isNotEmpty)
                        PolygonLayer(polygons: widget.poligonosFazenda),
                      if (widget.setoresComPoly.isNotEmpty)
                        PolygonLayer(
                          polygons: widget.setoresComPoly.map((s) {
                            final cor = corSetorMapaFlutter(s.setor.id);
                            final est = estiloPoligonoSetor(cor);
                            return Polygon(
                              points: s.poly,
                              color: est.fill,
                              borderColor: est.border,
                              borderStrokeWidth: est.borderWidth,
                            );
                          }).toList(),
                        ),
                      MarkerLayer(
                        markers: widget.ocorrencias.map((oc) {
                          final cor = _corMarcador(t, oc);
                          return Marker(
                            point: LatLng(oc.coordsY, oc.coordsX),
                            width: 20,
                            height: 20,
                            child: DecoratedBox(
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: cor,
                                border: Border.all(
                                    color: Colors.white, width: 2),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                  ),
                ),
              ),
            Positioned(
              right: 10,
              bottom: 10,
              child: Material(
                color: t.surface,
                borderRadius: BorderRadius.circular(AppRadius.sm),
                elevation: 2,
                child: InkWell(
                  onTap: widget.onAbrir,
                  borderRadius: BorderRadius.circular(AppRadius.sm),
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                        horizontal: 12, vertical: 6),
                    child: Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.open_in_full_rounded,
                            size: 14, color: t.text),
                        const SizedBox(width: 4),
                        Text(
                          'Expandir',
                          style: TextStyle(
                            fontSize: 11,
                            fontWeight: FontWeight.w600,
                            color: t.text,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ChipsRecentes extends StatelessWidget {
  final _FiltroRecentes atual;
  final ValueChanged<_FiltroRecentes> onChange;

  const _ChipsRecentes({required this.atual, required this.onChange});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: _FiltroRecentes.values.map((f) {
          final selected = f == atual;
          return Padding(
            padding: const EdgeInsets.only(right: 8),
            child: GestureDetector(
              onTap: () => onChange(f),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 180),
                padding: const EdgeInsets.symmetric(
                    horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: selected ? t.primary : t.surface,
                  borderRadius: BorderRadius.circular(AppRadius.pill),
                  border: Border.all(
                    color: selected ? t.primary : t.border,
                  ),
                ),
                child: Text(
                  f.label,
                  style: TextStyle(
                    fontSize: 12,
                    fontWeight: FontWeight.w600,
                    color: selected ? Colors.white : t.text,
                  ),
                ),
              ),
            ),
          );
        }).toList(),
      ),
    );
  }
}

class _ListaRecentes extends StatelessWidget {
  final bool loading;
  final List<Ocorrencia> ocorrencias;
  final ValueChanged<Ocorrencia> onTap;

  const _ListaRecentes({
    required this.loading,
    required this.ocorrencias,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    if (loading) {
      return Container(
        height: 120,
        alignment: Alignment.center,
        child:
            CircularProgressIndicator(color: t.primary, strokeWidth: 2.5),
      );
    }
    if (ocorrencias.isEmpty) {
      return Container(
        padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.lg, vertical: AppSpacing.xl),
        decoration: BoxDecoration(
          color: t.surface,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          border: Border.all(color: t.border),
        ),
        child: Center(
          child: Text(
            'Nenhuma ocorrência para este filtro.',
            style: TextStyle(color: t.textMuted, fontSize: 13),
          ),
        ),
      );
    }
    return Column(
      children: ocorrencias
          .map((o) => _LinhaRecente(ocorrencia: o, onTap: () => onTap(o)))
          .toList(),
    );
  }
}

class _LinhaRecente extends StatelessWidget {
  final Ocorrencia ocorrencia;
  final VoidCallback onTap;

  const _LinhaRecente({required this.ocorrencia, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final critica = ocorrencia.prioridade == 'URGENTE';
    final resolvida = ocorrencia.status == StatusOcorrencia.resolvida;
    final tone = resolvida
        ? t.success
        : (critica ? t.danger : t.warning);
    final toneSoft = resolvida
        ? t.successSoft
        : (critica ? t.dangerSoft : t.warningSoft);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Material(
        color: t.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadius.lg),
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(AppRadius.lg),
              border: Border.all(color: t.border),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    color: toneSoft,
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: Icon(
                    resolvida
                        ? Icons.check_circle_outline_rounded
                        : Icons.warning_rounded,
                    color: tone,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        ocorrencia.titulo,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 14,
                          fontWeight: FontWeight.w600,
                          color: t.text,
                        ),
                      ),
                      const SizedBox(height: 2),
                      Text(
                        '${labelCategoria(ocorrencia.categoria)} · ${ocorrencia.setor}',
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 12,
                          color: t.textMuted,
                        ),
                      ),
                      const SizedBox(height: 4),
                      Text(
                        '#OC-${ocorrencia.id.toString().padLeft(4, '0')} · ${ocorrencia.dataFormatada}',
                        style: TextStyle(
                          fontSize: 11,
                          color: t.textMuted,
                        ),
                      ),
                    ],
                  ),
                ),
                Icon(Icons.chevron_right_rounded,
                    color: t.textMuted, size: 22),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _AcoesRapidas extends StatelessWidget {
  final VoidCallback onMapa;
  final VoidCallback onOcorrencias;
  final VoidCallback onRegistrar;
  final VoidCallback onMensagens;

  const _AcoesRapidas({
    required this.onMapa,
    required this.onOcorrencias,
    required this.onRegistrar,
    required this.onMensagens,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final itens = [
      (Icons.warning_rounded, 'Nova\nocorrência', t.danger, onRegistrar),
      (Icons.map_outlined, 'Mapa', t.primary, onMapa),
      (Icons.list_alt_rounded, 'Ocorrências', t.info, onOcorrencias),
      (Icons.chat_bubble_outline_rounded, 'Mensagens', t.warning, onMensagens),
    ];
    return Container(
      padding: const EdgeInsets.symmetric(vertical: 14, horizontal: 6),
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(AppRadius.lg),
        border: Border.all(color: t.border),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceAround,
        children: itens
            .map((it) => _AcaoRapida(
                  icone: it.$1,
                  label: it.$2,
                  cor: it.$3,
                  onTap: it.$4,
                ))
            .toList(),
      ),
    );
  }
}

class _AcaoRapida extends StatelessWidget {
  final IconData icone;
  final String label;
  final Color cor;
  final VoidCallback onTap;

  const _AcaoRapida({
    required this.icone,
    required this.label,
    required this.cor,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    return Expanded(
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Padding(
          padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  color: cor,
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
                child: Icon(icone, color: Colors.white, size: 22),
              ),
              const SizedBox(height: 6),
              Text(
                label,
                textAlign: TextAlign.center,
                style: TextStyle(fontSize: 11, color: t.textMuted),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ErroBanner extends StatelessWidget {
  final String erro;
  final VoidCallback onRetry;
  const _ErroBanner({required this.erro, required this.onRetry});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.md),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.md),
        decoration: BoxDecoration(
          color: t.dangerSoft,
          borderRadius: BorderRadius.circular(AppRadius.md),
          border: Border.all(color: t.danger.withValues(alpha: 0.3)),
        ),
        child: Row(
          children: [
            Icon(Icons.error_outline, color: t.danger),
            const SizedBox(width: 8),
            Expanded(
                child: Text(erro,
                    style: TextStyle(color: t.danger, fontSize: 13))),
            TextButton(
              onPressed: onRetry,
              child: Text('Tentar', style: TextStyle(color: t.danger)),
            ),
          ],
        ),
      ),
    );
  }
}
