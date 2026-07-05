import 'dart:math' as math;
import 'dart:typed_data';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:geolocator/geolocator.dart';
import 'package:image_picker/image_picker.dart';
import 'package:latlong2/latlong.dart';

import '../config/api_config.dart';
import '../geo/fazenda_map_geometry.dart';
import '../models/ocorrencia_model.dart';
import '../services/api_service.dart';
import '../services/fazenda_api.dart';
import '../services/ocorrencias_repository.dart';
import 'ocorrencias_screen.dart' show TelaDetalheOcorrencia;

/// Centro padrão da demo (Parque das Mangabeiras / BH) — paridade com a web.
const _defaultLat = -19.9505;
const _defaultLng = -43.9035;
const _maxImagens = 6;

/// Registro de ocorrência — paridade com a web (`RegistrarOcorrenciaPage`).
class TelaNovaOcorrencia extends StatefulWidget {
  const TelaNovaOcorrencia({super.key});

  @override
  State<TelaNovaOcorrencia> createState() => _TelaNovaOcorrenciaState();
}

class _TelaNovaOcorrenciaState extends State<TelaNovaOcorrencia> {
  final _mapController = MapController();
  final _tituloController = TextEditingController();
  final _descricaoController = TextEditingController();
  final _latController = TextEditingController();
  final _lngController = TextEditingController();
  final _picker = ImagePicker();

  List<FazendaMapaRegistro> _fazendas = [];
  List<SetorRegistro> _setores = [];
  List<({Uint8List bytes, String name})> _imagens = [];

  String _categoria = categoriasRegistro.first['value']!;
  String _prioridade = 'MEDIA';
  int? _setorId;
  DateTime _ocorridoEm = DateTime.now();
  String _modoMapa = 'local'; // local | setor
  String? _geoStatus;

  double _lat = _defaultLat;
  double _lng = _defaultLng;
  bool _carregandoMapa = true;
  bool _mapaPronto = false;
  bool _enquadrarPendente = false;
  bool _enquadrouFazenda = false;
  bool _loadingGps = false;
  bool _salvando = false;
  String? _erroMapa;

  List<({SetorRegistro setor, List<LatLng> poly})> get _setoresComPoligono =>
      _setores
          .map((s) => (setor: s, poly: parsePolygonLatLng(s.poligonoGeojson)))
          .where((x) => x.poly.length >= 3)
          .toList();

  SetorRegistro? get _setorSelecionado {
    if (_setorId == null) return null;
    for (final s in _setores) {
      if (s.id == _setorId) return s;
    }
    return null;
  }

  @override
  void initState() {
    super.initState();
    _syncCoordControllers();
    _carregarMapa();
  }

  @override
  void dispose() {
    _tituloController.dispose();
    _descricaoController.dispose();
    _latController.dispose();
    _lngController.dispose();
    super.dispose();
  }

  void _syncCoordControllers() {
    _latController.text = _lat.toString();
    _lngController.text = _lng.toString();
  }

  Future<void> _carregarMapa() async {
    try {
      final data = await OcorrenciasRepository.instance.loadFazendaMapa();
      if (!mounted) return;
      setState(() {
        _fazendas = data.fazendas;
        _setores = data.setores;
        _setorId = _setores.isNotEmpty ? _setores.first.id : null;
        _carregandoMapa = false;
        _enquadrarPendente = true;
        if (_fazendas.isEmpty && _setores.isEmpty) {
          _erroMapa =
              'Nenhuma fazenda vinculada à sua conta. Cadastre a fazenda (gerente) ou aceite um convite da equipe.';
        } else {
          _erroMapa = null;
        }
      });
      _enquadrarNaFazenda();
    } on ApiException catch (e) {
      if (!mounted) return;
      setState(() {
        _carregandoMapa = false;
        _erroMapa = e.mensagem;
      });
    } catch (_) {
      if (!mounted) return;
      setState(() {
        _carregandoMapa = false;
        _erroMapa = 'Falha ao carregar mapa. Verifique a API em $kApiBaseUrl';
      });
    }
  }

  List<LatLng> _pontosEnquadramento() {
    final rings = <List<LatLng>>[];
    for (final f in _fazendas) {
      final p = parsePolygonLatLng(f.perimetroGeojson);
      if (p.length >= 3) rings.add(p);
    }
    for (final s in _setoresComPoligono) {
      rings.add(s.poly);
    }
    return allPointsFromPolygons(rings);
  }

  /// Igual à web: `fitBounds` no perímetro da fazenda + setores (uma vez ao abrir).
  void _enquadrarNaFazenda() {
    if (!mounted) return;
    final pts = _pontosEnquadramento();

    if (pts.isEmpty) {
      if (_mapaPronto) {
        _mapController.move(const LatLng(_defaultLat, _defaultLng), 14);
      }
      return;
    }

    if (!_enquadrouFazenda) {
      final c = LatLng(
        pts.map((p) => p.latitude).reduce((a, b) => a + b) / pts.length,
        pts.map((p) => p.longitude).reduce((a, b) => a + b) / pts.length,
      );
      setState(() {
        _lat = c.latitude;
        _lng = c.longitude;
        _syncCoordControllers();
      });
    }

    if (!_mapaPronto) {
      _enquadrarPendente = true;
      return;
    }

    _enquadrarPendente = false;
    _enquadrouFazenda = true;

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) return;
      try {
        _mapController.fitCamera(
          CameraFit.coordinates(
            coordinates: pts,
            padding: const EdgeInsets.all(40),
          ),
        );
      } catch (_) {
        Future.delayed(
          const Duration(milliseconds: 150),
          _enquadrarNaFazenda,
        );
      }
    });
  }

  void _onMapaPronto() {
    _mapaPronto = true;
    if (_enquadrarPendente || !_enquadrouFazenda) {
      _enquadrarNaFazenda();
    }
  }

  SetorRegistro? _setorNoPonto(double lat, double lng) {
    final matches = _setoresComPoligono
        .where((x) => pointInPolygon(lat, lng, x.poly))
        .toList();
    if (matches.isEmpty) return null;
    matches.sort((a, b) =>
        areaPoligonoAprox(a.poly).compareTo(areaPoligonoAprox(b.poly)));
    return matches.first.setor;
  }

  void _onMapTap(TapPosition _, LatLng p) {
    final sec = _setorNoPonto(p.latitude, p.longitude);
    if (sec != null) {
      setState(() {
        _setorId = sec.id;
        if (_modoMapa == 'setor') {
          _geoStatus = 'Setor selecionado: ${sec.nome} (${sec.fazendaNome}).';
        }
      });
    } else if (_modoMapa == 'setor') {
      setState(() =>
          _geoStatus = 'Nenhum setor cobre este ponto. Tente outro clique.');
      return;
    }
    if (_modoMapa == 'setor') return;

    setState(() {
      _lat = p.latitude;
      _lng = p.longitude;
      _syncCoordControllers();
      _geoStatus = sec != null
          ? 'Local atualizado e setor: ${sec.nome}.'
          : 'Local da ocorrência atualizado.';
    });
  }

  Future<void> _usarMinhaLocalizacao() async {
    setState(() {
      _loadingGps = true;
      _geoStatus = 'Obtendo localização…';
    });
    try {
      var perm = await Geolocator.checkPermission();
      if (perm == LocationPermission.denied) {
        perm = await Geolocator.requestPermission();
      }
      if (perm == LocationPermission.denied ||
          perm == LocationPermission.deniedForever) {
        setState(() => _geoStatus = 'Permissão de localização negada.');
        return;
      }
      final pos = await Geolocator.getCurrentPosition(
        desiredAccuracy: LocationAccuracy.high,
        timeLimit: const Duration(seconds: 15),
      );
      setState(() {
        _lat = pos.latitude;
        _lng = pos.longitude;
        _syncCoordControllers();
        _geoStatus = pos.accuracy > 0
            ? 'Precisão de ~${pos.accuracy.round()} m.'
            : 'Localização atualizada.';
      });
      _mapController.move(LatLng(_lat, _lng), 17);
    } catch (_) {
      setState(() =>
          _geoStatus = 'Não foi possível obter a localização.');
    } finally {
      if (mounted) setState(() => _loadingGps = false);
    }
  }

  void _aplicarCoordsDosCampos() {
    final la = double.tryParse(_latController.text.replaceAll(',', '.'));
    final ln = double.tryParse(_lngController.text.replaceAll(',', '.'));
    if (la == null || ln == null) return;
    setState(() {
      _lat = la;
      _lng = ln;
    });
    _mapController.move(LatLng(_lat, _lng), _mapController.camera.zoom);
  }

  Future<void> _escolherDataHora() async {
    final data = await showDatePicker(
      context: context,
      initialDate: _ocorridoEm,
      firstDate: DateTime(2020),
      lastDate: DateTime.now().add(const Duration(days: 1)),
    );
    if (data == null || !mounted) return;
    final hora = await showTimePicker(
      context: context,
      initialTime: TimeOfDay.fromDateTime(_ocorridoEm),
    );
    if (hora == null) return;
    setState(() {
      _ocorridoEm = DateTime(
        data.year,
        data.month,
        data.day,
        hora.hour,
        hora.minute,
      );
    });
  }

  Future<void> _adicionarFotos() async {
    if (_imagens.length >= _maxImagens) {
      _snack('Máximo de $_maxImagens fotos.', erro: true);
      return;
    }
    final picked = await _picker.pickMultiImage(imageQuality: 85);
    if (picked.isEmpty) return;
    final vagas = _maxImagens - _imagens.length;
    final novas = <({Uint8List bytes, String name})>[];
    for (final f in picked.take(vagas)) {
      final bytes = await f.readAsBytes();
      novas.add((bytes: bytes, name: f.name));
    }
    setState(() => _imagens = [..._imagens, ...novas]);
  }

  Future<void> _salvar() async {
    final titulo = _tituloController.text.trim();
    if (titulo.isEmpty) {
      _snack('Preencha o título.', erro: true);
      return;
    }
    if (_setorId == null) {
      _snack('Selecione um setor cadastrado.', erro: true);
      return;
    }

    setState(() => _salvando = true);
    try {
      final body = {
        'titulo': titulo,
        'setor': '',
        'setorId': _setorId,
        'categoria': _categoria,
        'prioridade': _prioridade,
        'descricao': _descricaoController.text.trim(),
        'horario': _ocorridoEm.toUtc().toIso8601String(),
        'coordsX': _lng,
        'coordsY': _lat,
      };

      final setorNome = _setorSelecionado?.nome;
      final result = await OcorrenciasRepository.instance.criar(
        body: body,
        imagens: _imagens,
        setorNome: setorNome,
      );
      final criada = result.ocorrencia;

      if (!mounted) return;
      if (result.queued) {
        _snack('Ocorrência salva offline. Será sincronizada quando houver conexão.');
        Navigator.pop(context, true);
        return;
      }
      _snack('Ocorrência registrada.');
      await Navigator.pushReplacement(
        context,
        MaterialPageRoute(
          builder: (_) => TelaDetalheOcorrencia(ocorrencia: criada),
        ),
      );
    } on ApiException catch (e) {
      _snack(e.mensagem, erro: true);
    } catch (_) {
      _snack('Falha ao registrar. API em $kApiBaseUrl', erro: true);
    } finally {
      if (mounted) setState(() => _salvando = false);
    }
  }

  void _snack(String msg, {bool erro = false}) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(SnackBar(
      content: Text(msg),
      backgroundColor: erro ? const Color(0xFFD32F2F) : const Color(0xFF224F2E),
    ));
  }

  @override
  Widget build(BuildContext context) {
    final alturaMapa =
        math.max(300.0, MediaQuery.sizeOf(context).height * 0.42);
    final fazendaNome =
        _fazendas.isNotEmpty ? _fazendas.first.nome : null;

    return Scaffold(
      backgroundColor: Theme.of(context).scaffoldBackgroundColor,
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(8, 8, 16, 0),
              child: Row(
                children: [
                  IconButton(
                    onPressed: () => Navigator.pop(context),
                    icon: const Icon(Icons.arrow_back),
                  ),
                  const Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Registrar nova ocorrência',
                          style: TextStyle(
                            fontSize: 17,
                            fontWeight: FontWeight.bold,
                          ),
                        ),
                        Text(
                          'Toque no mapa para marcar o local do evento.',
                          style: TextStyle(fontSize: 12, color: Colors.grey),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
            if (_erroMapa != null)
              Padding(
                padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
                child: Material(
                  color: const Color(0xFFFFF3E0),
                  borderRadius: BorderRadius.circular(8),
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Icon(Icons.info_outline,
                            size: 20, color: Color(0xFFE65100)),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _erroMapa!,
                            style: const TextStyle(
                              fontSize: 12,
                              color: Color(0xFF5D4037),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      _secaoTitulo('Mapa da fazenda'),
                      if (fazendaNome != null) ...[
                        const Spacer(),
                        Text(
                          fazendaNome,
                          style: const TextStyle(
                            fontSize: 12,
                            fontWeight: FontWeight.w600,
                            color: Color(0xFF224F2E),
                          ),
                        ),
                      ],
                    ],
                  ),
                  Text(
                    _modoMapa == 'local'
                        ? 'Contorno verde = perímetro. Toque no mapa para marcar o ponto da ocorrência.'
                        : 'Toque dentro do polígono do setor desejado.',
                    style:
                        const TextStyle(fontSize: 12, color: Colors.grey),
                  ),
                  const SizedBox(height: 8),
                  Row(
                    children: [
                      _chipModo('Marcar local', 'local'),
                      const SizedBox(width: 8),
                      _chipModo(
                        'Escolher setor no mapa',
                        'setor',
                        enabled: _setoresComPoligono.isNotEmpty,
                      ),
                    ],
                  ),
                ],
              ),
            ),
            Padding(
              padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
              child: SizedBox(
                height: alturaMapa,
                width: double.infinity,
                child: DecoratedBox(
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(12),
                    border: Border.all(
                      color: const Color(0xFF224F2E),
                      width: 2,
                    ),
                  ),
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(10),
                    child: Stack(
                      fit: StackFit.expand,
                      children: [
                        _buildMapaInterativo(),
                        if (_carregandoMapa)
                          Container(
                            color: Colors.white.withValues(alpha: 0.9),
                            child: const Center(
                              child: Column(
                                mainAxisSize: MainAxisSize.min,
                                children: [
                                  CircularProgressIndicator(),
                                  SizedBox(height: 12),
                                  Text('Carregando mapa da fazenda…'),
                                ],
                              ),
                            ),
                          ),
                        if (!_carregandoMapa && _fazendas.isEmpty)
                          Container(
                            color: Colors.grey.shade100,
                            alignment: Alignment.center,
                            padding: const EdgeInsets.all(16),
                            child: const Text(
                              'Sem dados da fazenda para exibir no mapa.',
                              textAlign: TextAlign.center,
                              style: TextStyle(color: Colors.grey),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text(
                      'Coordenadas (WGS84)',
                      style: TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 13,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _latController,
                            keyboardType:
                                const TextInputType.numberWithOptions(
                                    decimal: true),
                            decoration: const InputDecoration(
                              labelText: 'Latitude (°)',
                              isDense: true,
                              border: OutlineInputBorder(),
                            ),
                            onSubmitted: (_) => _aplicarCoordsDosCampos(),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: _lngController,
                            keyboardType:
                                const TextInputType.numberWithOptions(
                                    decimal: true),
                            decoration: const InputDecoration(
                              labelText: 'Longitude (°)',
                              isDense: true,
                              border: OutlineInputBorder(),
                            ),
                            onSubmitted: (_) => _aplicarCoordsDosCampos(),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        TextButton(
                          onPressed: _aplicarCoordsDosCampos,
                          child: const Text('Aplicar coordenadas'),
                        ),
                        TextButton.icon(
                          onPressed:
                              _loadingGps ? null : _usarMinhaLocalizacao,
                          icon: _loadingGps
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(
                                      strokeWidth: 2),
                                )
                              : const Icon(Icons.my_location_outlined,
                                  size: 18),
                          label: const Text('Usar minha localização'),
                        ),
                      ],
                    ),
                    if (_geoStatus != null)
                      Padding(
                        padding: const EdgeInsets.only(bottom: 8),
                        child: Text(
                          _geoStatus!,
                          style: const TextStyle(
                              fontSize: 12, color: Colors.grey),
                        ),
                      ),
                    const Divider(height: 24),
                    _secaoTitulo('Classificação e área'),
                          _dropdown(
                            label: 'Tipo de ocorrência',
                            value: categoriasRegistro.firstWhere(
                                (c) => c['value'] == _categoria)['label']!,
                            items: categoriasRegistro
                                .map((c) => c['label']!)
                                .toList(),
                            onChanged: (label) {
                              final c = categoriasRegistro
                                  .firstWhere((x) => x['label'] == label);
                              setState(() => _categoria = c['value']!);
                            },
                          ),
                          _dropdown(
                            label: 'Setor',
                            value: _setorSelecionado?.label,
                            items: _setores.map((s) => s.label).toList(),
                            onChanged: _setores.isEmpty
                                ? null
                                : (label) {
                                    final s = _setores
                                        .firstWhere((x) => x.label == label);
                                    setState(() => _setorId = s.id);
                                  },
                          ),
                          if (_setorSelecionado != null)
                            Padding(
                              padding: const EdgeInsets.only(bottom: 8),
                              child: Text(
                                'Selecionado: ${_setorSelecionado!.nome}',
                                style: const TextStyle(
                                  fontSize: 12,
                                  color: Color(0xFF224F2E),
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          _dropdown(
                            label: 'Prioridade',
                            value: prioridadesRegistro.firstWhere(
                                (p) => p['value'] == _prioridade)['label']!,
                            items: prioridadesRegistro
                                .map((p) => p['label']!)
                                .toList(),
                            onChanged: (label) {
                              final p = prioridadesRegistro
                                  .firstWhere((x) => x['label'] == label);
                              setState(() => _prioridade = p['value']!);
                            },
                          ),
                          TextField(
                            controller: _tituloController,
                            decoration: const InputDecoration(
                              labelText: 'Título resumido',
                              hintText: 'Ex.: Foco de pragas na borda do talhão',
                              border: OutlineInputBorder(),
                            ),
                          ),
                          const SizedBox(height: 8),
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            title: const Text('Data e hora da ocorrência'),
                            subtitle: Text(
                              '${_ocorridoEm.day.toString().padLeft(2, '0')}/'
                              '${_ocorridoEm.month.toString().padLeft(2, '0')}/'
                              '${_ocorridoEm.year} '
                              '${_ocorridoEm.hour.toString().padLeft(2, '0')}:'
                              '${_ocorridoEm.minute.toString().padLeft(2, '0')}',
                            ),
                            trailing: const Icon(Icons.calendar_today_outlined),
                            onTap: _escolherDataHora,
                          ),

                          const SizedBox(height: 16),
                          _secaoTitulo('Evidências visuais'),
                          OutlinedButton.icon(
                            onPressed: _adicionarFotos,
                            icon: const Icon(Icons.add_photo_alternate_outlined),
                            label: Text(
                                'Adicionar fotos (${_imagens.length}/$_maxImagens)'),
                          ),
                          if (_imagens.isNotEmpty)
                            SizedBox(
                              height: 90,
                              child: ListView.separated(
                                scrollDirection: Axis.horizontal,
                                itemCount: _imagens.length,
                                separatorBuilder: (_, __) =>
                                    const SizedBox(width: 8),
                                itemBuilder: (_, i) => Stack(
                                  children: [
                                    ClipRRect(
                                      borderRadius: BorderRadius.circular(8),
                                      child: Image.memory(
                                        _imagens[i].bytes,
                                        width: 80,
                                        height: 90,
                                        fit: BoxFit.cover,
                                      ),
                                    ),
                                    Positioned(
                                      top: 2,
                                      right: 2,
                                      child: GestureDetector(
                                        onTap: () => setState(
                                            () => _imagens.removeAt(i)),
                                        child: const CircleAvatar(
                                          radius: 10,
                                          backgroundColor: Colors.red,
                                          child: Icon(Icons.close,
                                              size: 12, color: Colors.white),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ),

                          const SizedBox(height: 16),
                          _secaoTitulo('Relato detalhado'),
                          TextField(
                            controller: _descricaoController,
                            maxLines: 4,
                            decoration: const InputDecoration(
                              labelText: 'Observações',
                              hintText:
                                  'Descreva detalhes importantes da ocorrência.',
                              border: OutlineInputBorder(),
                            ),
                          ),

                          const SizedBox(height: 24),
                    Row(
                      children: [
                        Expanded(
                          child: OutlinedButton(
                            onPressed: _salvando
                                ? null
                                : () => Navigator.pop(context),
                            child: const Text('Cancelar'),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          flex: 2,
                          child: ElevatedButton(
                            onPressed: _salvando ? null : _salvar,
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF224F2E),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 14),
                            ),
                            child: _salvando
                                ? const SizedBox(
                                    width: 22,
                                    height: 22,
                                    child: CircularProgressIndicator(
                                      color: Colors.white,
                                      strokeWidth: 2,
                                    ),
                                  )
                                : const Text('Enviar ocorrência'),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMapaInterativo() {
    return FlutterMap(
      mapController: _mapController,
      options: MapOptions(
        initialCenter: LatLng(_lat, _lng),
        initialZoom: 15,
        onTap: _onMapTap,
        onMapReady: _onMapaPronto,
        interactionOptions: const InteractionOptions(
          flags: InteractiveFlag.all,
        ),
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.agrolink.app',
          maxZoom: 19,
        ),
        if (_fazendas.isNotEmpty)
          PolygonLayer(
            polygons: _fazendas
                .map((f) {
                  final poly = parsePolygonLatLng(f.perimetroGeojson);
                  if (poly.length < 3) return null;
                  final estilo = estiloPerimetroFazenda(satelite: false);
                  return Polygon(
                    points: poly,
                    color: estilo.fill,
                    borderColor: estilo.border,
                    borderStrokeWidth: estilo.borderWidth,
                  );
                })
                .whereType<Polygon>()
                .toList(),
          ),
        if (_setoresComPoligono.isNotEmpty)
          PolygonLayer(
            polygons: () {
              // Renderiza o setor selecionado por último (em cima dos demais)
              // para o destaque amarelo ficar sempre visível.
              final ordenados = [..._setoresComPoligono]..sort((a, b) {
                final aSel = _setorId == a.setor.id ? 1 : 0;
                final bSel = _setorId == b.setor.id ? 1 : 0;
                return aSel - bSel;
              });
              return ordenados.map((s) {
                final cor = corSetorMapaFlutter(s.setor.id);
                final sel = _setorId == s.setor.id;
                final estilo = estiloPoligonoSetor(cor, destacado: sel);
                return Polygon(
                  points: s.poly,
                  color: estilo.fill,
                  borderColor: estilo.border,
                  borderStrokeWidth: estilo.borderWidth,
                );
              }).toList();
            }(),
          ),
        MarkerLayer(
          markers: [
            // Etiqueta do setor selecionado — fica fixa no centróide do
            // polígono e some quando nada está selecionado.
            if (_setorSelecionado != null) _markerLabelSetorSelecionado(),
            Marker(
              point: LatLng(_lat, _lng),
              width: 40,
              height: 40,
              alignment: Alignment.bottomCenter,
              child: const Icon(
                Icons.location_on,
                color: Color(0xFF2F6DF6),
                size: 36,
              ),
            ),
          ].whereType<Marker>().toList(),
        ),
      ],
    );
  }

  Marker? _markerLabelSetorSelecionado() {
    final sel = _setorSelecionado;
    if (sel == null) return null;
    final entry = _setoresComPoligono.firstWhere(
      (x) => x.setor.id == sel.id,
      orElse: () => (setor: sel, poly: const <LatLng>[]),
    );
    if (entry.poly.isEmpty) return null;
    final lat = entry.poly.map((p) => p.latitude).reduce((a, b) => a + b) /
        entry.poly.length;
    final lng = entry.poly.map((p) => p.longitude).reduce((a, b) => a + b) /
        entry.poly.length;
    return Marker(
      point: LatLng(lat, lng),
      width: 220,
      height: 36,
      alignment: Alignment.center,
      child: IgnorePointer(
        child: Center(
          child: Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFFFCC00),
              borderRadius: BorderRadius.circular(999),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x33000000),
                  blurRadius: 4,
                  offset: Offset(0, 2),
                ),
              ],
            ),
            child: Text(
              'Setor: ${sel.nome}',
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(
                fontSize: 12,
                fontWeight: FontWeight.w800,
                color: Color(0xFF1B1F1A),
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _secaoTitulo(String t) => Padding(
        padding: const EdgeInsets.only(bottom: 10),
        child: Text(
          t,
          style: const TextStyle(fontSize: 16, fontWeight: FontWeight.bold),
        ),
      );

  Widget _chipModo(String label, String modo, {bool enabled = true}) {
    final sel = _modoMapa == modo;
    return Expanded(
      child: Material(
        color: sel ? const Color(0xFFE8F5E9) : Colors.grey.shade100,
        borderRadius: BorderRadius.circular(8),
        child: InkWell(
          onTap: !enabled
              ? null
              : () => setState(() {
                    _modoMapa = modo;
                    _geoStatus = modo == 'setor'
                        ? 'Toque dentro do setor desejado.'
                        : null;
                  }),
          borderRadius: BorderRadius.circular(8),
          child: Padding(
            padding: const EdgeInsets.symmetric(vertical: 10, horizontal: 8),
            child: Text(
              label,
              textAlign: TextAlign.center,
              style: TextStyle(
                fontSize: 12,
                fontWeight: sel ? FontWeight.w700 : FontWeight.w500,
                color: enabled
                    ? (sel ? const Color(0xFF224F2E) : Colors.black87)
                    : Colors.grey,
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _dropdown({
    required String label,
    required String? value,
    required List<String> items,
    required ValueChanged<String?>? onChanged,
  }) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: DropdownButtonFormField<String>(
        // `value` foi deprecado em favor de `initialValue` no Flutter 3.33+,
        // mas precisamos de um valor *controlado* (sincroniza quando o setor
        // é escolhido pelo mapa). `initialValue` só efetua no primeiro frame.
        // ignore: deprecated_member_use
        value: items.contains(value) ? value : null,
        isExpanded: true,
        decoration: InputDecoration(
          labelText: label,
          border: const OutlineInputBorder(),
        ),
        selectedItemBuilder: (ctx) => items
            .map((i) => Align(
                  alignment: Alignment.centerLeft,
                  child: Text(
                    i,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                ))
            .toList(),
        items: items
            .map((i) => DropdownMenuItem(
                  value: i,
                  child: Text(
                    i,
                    overflow: TextOverflow.ellipsis,
                  ),
                ))
            .toList(),
        onChanged: onChanged,
      ),
    );
  }

}
