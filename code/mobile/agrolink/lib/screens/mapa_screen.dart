import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../geo/fazenda_map_geometry.dart';
import '../main.dart' show TelaPrincipal;
import '../models/ocorrencia_model.dart';
import '../services/auth_storage.dart';
import '../services/fazenda_api.dart';
import '../services/ocorrencias_api.dart';
import '../theme/app_tokens.dart';
import '../widgets/app_header.dart';
import '../widgets/status_pills.dart';
import 'ocorrencias_screen.dart';

/// Filtro rápido — paridade com `FiltroRapido` da web.
/// `abertas` (default) esconde ocorrências resolvidas; `criticos`/`alertas`
/// destacam por severidade; `todas` inclui resolvidas.
enum _FiltroMapa { abertas, criticos, alertas, todas }

extension _FiltroMapaLabel on _FiltroMapa {
  String get label {
    switch (this) {
      case _FiltroMapa.abertas:
        return 'Abertas';
      case _FiltroMapa.criticos:
        return 'Críticos';
      case _FiltroMapa.alertas:
        return 'Alertas';
      case _FiltroMapa.todas:
        return 'Todas';
    }
  }
}

/// Aba Mapa — ocorrências + perímetro/setores da fazenda.
class TelaMapa extends StatefulWidget {
  const TelaMapa({super.key});

  @override
  State<TelaMapa> createState() => _TelaMapaState();
}

class _TelaMapaState extends State<TelaMapa> {
  static const _defaultCenter = LatLng(-19.9505, -43.9035);

  static const _tileRuas = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
  static const _tileSatelite =
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';

  final _mapController = MapController();
  final _searchCtrl = TextEditingController();

  UsuarioLogado? _usuario;
  LatLng? _userLocation;
  bool _carregando = true;
  String? _erro;

  bool _satelite = true;
  bool _mapaPronto = false;
  bool _enquadrarPendente = false;
  Ocorrencia? _selecionada;

  String _busca = '';
  _FiltroMapa _filtro = _FiltroMapa.abertas;

  List<Ocorrencia> _ocorrencias = const [];
  List<FazendaMapaRegistro> _fazendas = const [];
  List<SetorRegistro> _setores = const [];

  List<({SetorRegistro setor, List<LatLng> poly})> get _setoresComPoly =>
      _setores
          .map((s) => (setor: s, poly: parsePolygonLatLng(s.poligonoGeojson)))
          .where((x) => x.poly.length >= 3)
          .toList();

  @override
  void initState() {
    super.initState();
    _carregarUsuario();
    _inicializar();
  }

  @override
  void dispose() {
    _searchCtrl.dispose();
    super.dispose();
  }

  Future<void> _carregarUsuario() async {
    final u = await AuthStorage.lerUsuario();
    if (mounted) setState(() => _usuario = u);
  }

  Future<void> _inicializar() async {
    setState(() {
      _carregando = true;
      _erro = null;
    });
    final falhas = <String>[];

    final resultados = await Future.wait<Object?>([
      OcorrenciasApi.listar().catchError((e) {
        falhas.add('ocorrências (${_descreverErro(e)})');
        return <Ocorrencia>[];
      }),
      FazendaApi.mapaRegistroOcorrencia().catchError((e) {
        falhas.add('fazenda (${_descreverErro(e)})');
        return const RegistroOcorrenciaMapa(fazendas: [], setores: []);
      }),
    ]);

    final ocorrencias = (resultados[0] as List<Ocorrencia>?) ?? [];
    final mapa = resultados[1] as RegistroOcorrenciaMapa?;
    final fazendas = mapa?.fazendas ?? [];
    final setores = mapa?.setores ?? [];

    LatLng? local;
    try {
      final last = await Geolocator.getLastKnownPosition();
      if (last != null) local = LatLng(last.latitude, last.longitude);
    } catch (_) {}

    if (!mounted) return;
    final houveDados = ocorrencias.isNotEmpty || fazendas.isNotEmpty;
    setState(() {
      _ocorrencias = ocorrencias;
      _fazendas = fazendas;
      _setores = setores;
      _userLocation = local;
      _carregando = false;
      _enquadrarPendente = true;
      _erro = !houveDados && falhas.isNotEmpty
          ? 'Não foi possível conectar ao servidor. Detalhes: ${falhas.join('; ')}.'
          : null;
    });
    _enquadrarMapa();
    unawaited(_atualizarLocalizacaoBackground());
  }

  String _descreverErro(Object e) {
    final msg = e.toString();
    return msg.length > 100 ? '${msg.substring(0, 100)}…' : msg;
  }

  Future<void> _atualizarLocalizacaoBackground() async {
    try {
      final habilitado = await Geolocator.isLocationServiceEnabled();
      if (!habilitado) return;
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm != LocationPermission.whileInUse &&
          perm != LocationPermission.always) {
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.medium,
        timeLimit: const Duration(seconds: 5),
      );
      if (!mounted) return;
      final novo = LatLng(pos.latitude, pos.longitude);
      if (_userLocation == null ||
          _userLocation!.latitude != novo.latitude ||
          _userLocation!.longitude != novo.longitude) {
        setState(() => _userLocation = novo);
      }
    } catch (_) {}
  }

  void _onMapaPronto() {
    _mapaPronto = true;
    if (_enquadrarPendente) _enquadrarMapa();
  }

  List<LatLng> _pontosEnquadramento() {
    final rings = <List<LatLng>>[];
    for (final f in _fazendas) {
      final p = parsePolygonLatLng(f.perimetroGeojson);
      if (p.length >= 3) rings.add(p);
    }
    for (final s in _setoresComPoly) {
      rings.add(s.poly);
    }
    final pts = allPointsFromPolygons(rings);
    for (final o in _ocorrencias) {
      if (o.coordsY != 0 || o.coordsX != 0) {
        pts.add(LatLng(o.coordsY, o.coordsX));
      }
    }
    if (_userLocation != null) pts.add(_userLocation!);
    return pts;
  }

  void _enquadrarMapa() {
    if (!mounted) return;
    final pts = _pontosEnquadramento();

    if (!_mapaPronto) {
      _enquadrarPendente = true;
      return;
    }
    _enquadrarPendente = false;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      try {
        if (pts.isEmpty) {
          _mapController.move(_defaultCenter, 14);
        } else {
          _mapController.fitCamera(
            CameraFit.coordinates(
              coordinates: pts,
              padding: const EdgeInsets.all(48),
            ),
          );
        }
      } catch (_) {
        Future.delayed(const Duration(milliseconds: 150), _enquadrarMapa);
      }
    });
  }

  void _focarOcorrencia(Ocorrencia o) {
    setState(() => _selecionada = o);
    if (o.coordsY != 0 || o.coordsX != 0) {
      _mapController.move(LatLng(o.coordsY, o.coordsX), 16);
    }
  }

  void _centralizarUsuario() {
    if (_userLocation != null) {
      _mapController.move(_userLocation!, 16);
    } else {
      _enquadrarMapa();
    }
  }

  // ── Filtragem ──────────────────────────────────────────────────
  List<Ocorrencia> get _visiveis {
    final termo = normalizarBusca(_busca.trim());
    return _ocorrencias
        .where((o) => o.coordsY != 0 || o.coordsX != 0)
        .where((o) {
      switch (_filtro) {
        case _FiltroMapa.abertas:
          if (o.status != StatusOcorrencia.aberta) return false;
          break;
        case _FiltroMapa.criticos:
          if (o.tipoMarcador != TipoMarcadorMapa.critico) return false;
          break;
        case _FiltroMapa.alertas:
          if (o.tipoMarcador != TipoMarcadorMapa.alerta &&
              o.tipoMarcador != TipoMarcadorMapa.critico) {
            return false;
          }
          break;
        case _FiltroMapa.todas:
          break;
      }
      if (termo.isEmpty) return true;
      return normalizarBusca(o.titulo).contains(termo) ||
          normalizarBusca(o.setor).contains(termo) ||
          normalizarBusca(labelCategoria(o.categoria)).contains(termo) ||
          o.id.toString().contains(termo);
    }).toList();
  }

  Color _corMarcador(AppTokens t, TipoMarcadorMapa tipo) {
    switch (tipo) {
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

  IconData _iconeMarcador(TipoMarcadorMapa tipo) {
    switch (tipo) {
      case TipoMarcadorMapa.critico:
        return Icons.warning_rounded;
      case TipoMarcadorMapa.alerta:
        return Icons.warning_amber_rounded;
      case TipoMarcadorMapa.emCurso:
        return Icons.access_time_rounded;
      case TipoMarcadorMapa.resolvido:
        return Icons.check_circle_outline_rounded;
    }
  }

  void _abrirDetalhe(Ocorrencia o) {
    Navigator.push(
      context,
      MaterialPageRoute(builder: (_) => TelaDetalheOcorrencia(ocorrencia: o)),
    ).then((_) => _inicializar());
  }

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final visiveis = _visiveis;
    final fazendaNome = _fazendas.isNotEmpty ? _fazendas.first.nome : null;

    return Scaffold(
      backgroundColor: t.bg,
      appBar: AppHeader(
        title: 'Mapa',
        subtitle: fazendaNome,
        usuario: _usuario,
        onAvatarTap: () =>
            TelaPrincipal.estadoDe(context)?.selecionarAba(TelaPrincipal.abaPerfil),
      ),
      body: Stack(
        children: [
          Column(
            children: [
              _buildToolbar(t),
              Expanded(
                child: _carregando
                    ? Center(
                        child: CircularProgressIndicator(
                          color: t.primary,
                          strokeWidth: 2.5,
                        ),
                      )
                    : _erro != null
                        ? _buildErro(t)
                        : _buildMapaArea(t, visiveis),
              ),
              if (!_carregando && _erro == null)
                _buildPainelLista(t, visiveis),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildToolbar(AppTokens t) {
    return Container(
      decoration: BoxDecoration(
        color: t.surface,
        border: Border(bottom: BorderSide(color: t.border)),
      ),
      padding: const EdgeInsets.fromLTRB(
          AppSpacing.lg, AppSpacing.md, AppSpacing.lg, AppSpacing.md),
      child: Column(
        children: [
          TextField(
            controller: _searchCtrl,
            onChanged: (v) => setState(() => _busca = v),
            decoration: const InputDecoration(
              hintText: 'Buscar por tipo, área ou código…',
              prefixIcon: Icon(Icons.search_rounded, size: 20),
              isDense: true,
              contentPadding:
                  EdgeInsets.symmetric(horizontal: 14, vertical: 12),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: _FiltroMapa.values.map((f) {
              final selected = f == _filtro;
              return Expanded(
                child: Padding(
                  padding: EdgeInsets.only(
                      right: f == _FiltroMapa.values.last ? 0 : 6),
                  child: GestureDetector(
                    onTap: () => setState(() => _filtro = f),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      height: 36,
                      alignment: Alignment.center,
                      decoration: BoxDecoration(
                        color: selected ? t.primary : t.surface,
                        borderRadius: BorderRadius.circular(AppRadius.pill),
                        border: Border.all(
                            color: selected ? t.primary : t.border),
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
                ),
              );
            }).toList(),
          ),
        ],
      ),
    );
  }

  Widget _buildMapaArea(AppTokens t, List<Ocorrencia> visiveis) {
    return Stack(
      children: [
        FlutterMap(
          mapController: _mapController,
          options: MapOptions(
            initialCenter: _defaultCenter,
            initialZoom: 14,
            onMapReady: _onMapaPronto,
            interactionOptions: const InteractionOptions(
              flags: InteractiveFlag.all,
            ),
          ),
          children: [
            TileLayer(
              urlTemplate: _satelite ? _tileSatelite : _tileRuas,
              userAgentPackageName: 'com.agrolink.app',
              maxZoom: 19,
            ),
            if (_fazendas.isNotEmpty)
              PolygonLayer(
                polygons: _fazendas
                    .map((f) {
                      final poly = parsePolygonLatLng(f.perimetroGeojson);
                      if (poly.length < 3) return null;
                      final est = estiloPerimetroFazenda(satelite: _satelite);
                      return Polygon(
                        points: poly,
                        color: est.fill,
                        borderColor: est.border,
                        borderStrokeWidth: est.borderWidth,
                      );
                    })
                    .whereType<Polygon>()
                    .toList(),
              ),
            if (_setoresComPoly.isNotEmpty)
              PolygonLayer(
                polygons: _setoresComPoly.map((s) {
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
              markers: [
                if (_userLocation != null)
                  Marker(
                    point: _userLocation!,
                    width: 24,
                    height: 24,
                    child: Container(
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        color: t.info,
                        border: Border.all(color: Colors.white, width: 2.5),
                        boxShadow: [
                          BoxShadow(
                            color: t.info.withValues(alpha: 0.4),
                            blurRadius: 8,
                          ),
                        ],
                      ),
                    ),
                  ),
                ...visiveis.map((oc) {
                  final selected = _selecionada?.id == oc.id;
                  final cor = _corMarcador(t, oc.tipoMarcador);
                  return Marker(
                    point: LatLng(oc.coordsY, oc.coordsX),
                    width: selected ? 52 : 40,
                    height: selected ? 52 : 40,
                    child: GestureDetector(
                      onTap: () => _focarOcorrencia(oc),
                      child: Container(
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: cor,
                          border: Border.all(
                            color: Colors.white,
                            width: selected ? 3 : 2,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: cor.withValues(alpha: 0.5),
                              blurRadius: selected ? 12 : 8,
                            ),
                          ],
                        ),
                        child: Icon(
                          _iconeMarcador(oc.tipoMarcador),
                          size: selected ? 24 : 18,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  );
                }),
              ],
            ),
          ],
        ),
        // Segmented control (Satélite / Mapa)
        Positioned(
          left: AppSpacing.md,
          bottom: AppSpacing.md,
          child: _BaseLayerSegmented(
            satelite: _satelite,
            onChange: (v) => setState(() => _satelite = v),
          ),
        ),
        // Botões de controle
        Positioned(
          right: AppSpacing.md,
          bottom: AppSpacing.md,
          child: Column(
            children: [
              _MapButton(
                icon: Icons.add_rounded,
                onTap: () => _mapController.move(
                  _mapController.camera.center,
                  _mapController.camera.zoom + 1,
                ),
              ),
              const SizedBox(height: 6),
              _MapButton(
                icon: Icons.remove_rounded,
                onTap: () => _mapController.move(
                  _mapController.camera.center,
                  _mapController.camera.zoom - 1,
                ),
              ),
              const SizedBox(height: 6),
              _MapButton(
                icon: Icons.my_location_rounded,
                onTap: _centralizarUsuario,
              ),
              const SizedBox(height: 6),
              _MapButton(
                icon: Icons.center_focus_strong_rounded,
                onTap: _enquadrarMapa,
              ),
            ],
          ),
        ),
      ],
    );
  }

  Widget _buildErro(AppTokens t) {
    return Center(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.xxl),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.map_outlined, size: 56, color: t.textMuted),
            const SizedBox(height: AppSpacing.md),
            Text(
              _erro ?? '',
              textAlign: TextAlign.center,
              style: TextStyle(color: t.textMuted, fontSize: 13),
            ),
            const SizedBox(height: AppSpacing.lg),
            ElevatedButton.icon(
              onPressed: _inicializar,
              icon: const Icon(Icons.refresh_rounded),
              label: const Text('Tentar novamente'),
              style: ElevatedButton.styleFrom(
                backgroundColor: t.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadius.md),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPainelLista(AppTokens t, List<Ocorrencia> visiveis) {
    return Container(
      constraints: const BoxConstraints(maxHeight: 240),
      decoration: BoxDecoration(
        color: t.surface,
        border: Border(top: BorderSide(color: t.border)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        mainAxisSize: MainAxisSize.min,
        children: [
          Padding(
            padding: const EdgeInsets.fromLTRB(
                AppSpacing.lg, AppSpacing.md, AppSpacing.lg, 4),
            child: Row(
              children: [
                Text(
                  'Ocorrências visíveis',
                  style: TextStyle(
                    fontSize: 13,
                    fontWeight: FontWeight.w700,
                    color: t.text,
                  ),
                ),
                const SizedBox(width: 8),
                Container(
                  padding: const EdgeInsets.symmetric(
                      horizontal: 8, vertical: 2),
                  decoration: BoxDecoration(
                    color: t.surfaceMuted,
                    borderRadius: BorderRadius.circular(AppRadius.pill),
                    border: Border.all(color: t.border),
                  ),
                  child: Text(
                    '${visiveis.length}',
                    style: TextStyle(
                      fontSize: 11,
                      fontWeight: FontWeight.w700,
                      color: t.textMuted,
                    ),
                  ),
                ),
              ],
            ),
          ),
          Flexible(
            child: visiveis.isEmpty
                ? Padding(
                    padding: const EdgeInsets.all(AppSpacing.lg),
                    child: Text(
                      'Nenhuma ocorrência para o filtro atual.',
                      style: TextStyle(color: t.textMuted, fontSize: 13),
                    ),
                  )
                : ListView.separated(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.lg, vertical: 6),
                    itemCount: visiveis.length,
                    separatorBuilder: (_, __) =>
                        const SizedBox(height: AppSpacing.sm),
                    itemBuilder: (_, idx) {
                      final o = visiveis[idx];
                      final selected = _selecionada?.id == o.id;
                      return _CardLista(
                        ocorrencia: o,
                        selected: selected,
                        onFocus: () => _focarOcorrencia(o),
                        onAbrir: () => _abrirDetalhe(o),
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }
}

class _BaseLayerSegmented extends StatelessWidget {
  final bool satelite;
  final ValueChanged<bool> onChange;

  const _BaseLayerSegmented({required this.satelite, required this.onChange});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    return Container(
      padding: const EdgeInsets.all(3),
      decoration: BoxDecoration(
        color: t.surface,
        borderRadius: BorderRadius.circular(AppRadius.pill),
        border: Border.all(color: t.border),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.08),
            blurRadius: 8,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          _seg(t, label: 'Satélite', on: satelite, onTap: () => onChange(true)),
          _seg(t, label: 'Mapa', on: !satelite, onTap: () => onChange(false)),
        ],
      ),
    );
  }

  Widget _seg(AppTokens t,
      {required String label,
      required bool on,
      required VoidCallback onTap}) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
        decoration: BoxDecoration(
          color: on ? t.primary : Colors.transparent,
          borderRadius: BorderRadius.circular(AppRadius.pill),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: on ? Colors.white : t.text,
          ),
        ),
      ),
    );
  }
}

class _MapButton extends StatelessWidget {
  final IconData icon;
  final VoidCallback onTap;

  const _MapButton({required this.icon, required this.onTap});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    return Material(
      color: t.surface,
      borderRadius: BorderRadius.circular(AppRadius.md),
      elevation: 2,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(color: t.border),
          ),
          child: Icon(icon, size: 20, color: t.text),
        ),
      ),
    );
  }
}

class _CardLista extends StatelessWidget {
  final Ocorrencia ocorrencia;
  final bool selected;
  final VoidCallback onFocus;
  final VoidCallback onAbrir;

  const _CardLista({
    required this.ocorrencia,
    required this.selected,
    required this.onFocus,
    required this.onAbrir,
  });

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    final critica = ocorrencia.prioridade == 'URGENTE';
    return Material(
      color: selected ? t.primarySoft : t.surface,
      borderRadius: BorderRadius.circular(AppRadius.md),
      child: InkWell(
        onTap: onFocus,
        borderRadius: BorderRadius.circular(AppRadius.md),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            borderRadius: BorderRadius.circular(AppRadius.md),
            border: Border.all(
              color: selected
                  ? t.primary
                  : (critica ? t.danger.withValues(alpha: 0.3) : t.border),
              width: selected ? 1.5 : 1,
            ),
          ),
          child: Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Text(
                          'OC-${ocorrencia.id.toString().padLeft(4, '0')}',
                          style: TextStyle(
                            fontSize: 11,
                            color: t.textMuted,
                            fontFeatures: const [
                              FontFeature.tabularFigures()
                            ],
                          ),
                        ),
                        const SizedBox(width: 6),
                        Text('·',
                            style: TextStyle(color: t.textMuted)),
                        const SizedBox(width: 6),
                        Expanded(
                          child: Text(
                            ocorrencia.dataFormatada,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              color: t.textMuted,
                            ),
                          ),
                        ),
                        PrioridadePill(prioridade: ocorrencia.prioridade),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Text(
                      ocorrencia.titulo,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: t.text,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Wrap(
                      spacing: 4,
                      runSpacing: 4,
                      children: [
                        _Tag(text: labelCategoria(ocorrencia.categoria)),
                        _Tag(text: ocorrencia.setor),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              IconButton(
                onPressed: onAbrir,
                icon: Icon(Icons.arrow_forward_rounded,
                    color: t.primary, size: 22),
                tooltip: 'Ver detalhes',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  final String text;
  const _Tag({required this.text});

  @override
  Widget build(BuildContext context) {
    final t = AppTokens.of(context);
    if (text.trim().isEmpty) return const SizedBox.shrink();
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
      decoration: BoxDecoration(
        color: t.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadius.sm),
        border: Border.all(color: t.border),
      ),
      child: Text(
        text,
        style: TextStyle(fontSize: 10, color: t.textMuted),
      ),
    );
  }
}
