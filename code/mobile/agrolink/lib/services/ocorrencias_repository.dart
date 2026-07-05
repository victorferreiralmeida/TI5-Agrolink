import 'dart:async';
import 'dart:convert';
import 'dart:io';
import 'dart:typed_data';

import 'package:http/http.dart' as http;
import 'package:path_provider/path_provider.dart';
import 'package:uuid/uuid.dart';

import '../config/api_config.dart';
import '../models/ocorrencia_model.dart';
import 'api_service.dart';
import 'fazenda_api.dart';
import 'ocorrencias_api.dart';
import 'offline_db.dart';
import 'sync_events.dart';

class OcorrenciasRepository {
  OcorrenciasRepository._();
  static final OcorrenciasRepository instance = OcorrenciasRepository._();

  final _uuid = const Uuid();
  bool _flushing = false;

  Future<List<Ocorrencia>> listar() async {
    final online = await isDeviceOnline();
    if (online) {
      try {
        final lastSync = await getMeta('lastSync');
        final remote = lastSync != null
            ? await _listarSince(lastSync)
            : await OcorrenciasApi.listar();
        if (lastSync == null) {
          await _replaceOcorrenciasCache(remote);
        } else if (remote.isNotEmpty) {
          for (final o in remote) {
            await saveOcorrenciaJson(_ocorrenciaToJson(o), pendingSync: false);
          }
        }
        await setMeta('lastSync', DateTime.now().toUtc().toIso8601String());
        return _readSorted();
      } catch (_) {
        final cached = await _readSorted();
        if (cached.isNotEmpty) return cached;
        rethrow;
      }
    }
    return _readSorted();
  }

  Future<List<Ocorrencia>> _listarSince(String since) async {
    final headers = await ApiService.headersAuth();
    final url =
        '$kApiBaseUrl/api/ocorrencias?since=${Uri.encodeComponent(since)}';
    final res = await http.get(Uri.parse(url), headers: headers).timeout(
          const Duration(seconds: 20),
        );
    if (res.statusCode != 200) {
      throw ApiException(res.statusCode, res.body);
    }
    final lista = jsonDecode(res.body) as List<dynamic>;
    return lista
        .cast<Map<String, dynamic>>()
        .map(Ocorrencia.fromJson)
        .toList();
  }

  Future<List<Ocorrencia>> _readSorted() async {
    final rows = await readAllOcorrencias();
    final list = rows.map(Ocorrencia.fromJson).toList();
    list.sort((a, b) => b.horario.compareTo(a.horario));
    return list;
  }

  Future<void> _replaceOcorrenciasCache(List<Ocorrencia> remote) async {
    await deleteSyncedOcorrencias();
    for (final o in remote) {
      await saveOcorrenciaJson(_ocorrenciaToJson(o), pendingSync: false);
    }
  }

  Future<({Ocorrencia ocorrencia, bool queued})> criar({
    required Map<String, dynamic> body,
    required List<({Uint8List bytes, String name})> imagens,
    String? setorNome,
  }) async {
    final clientUuid = _uuid.v4();
    body['clientUuid'] = clientUuid;

    if (await isDeviceOnline()) {
      try {
        final criada = await OcorrenciasApi.criar(body);
        if (imagens.isNotEmpty) {
          await OcorrenciasApi.uploadImagens(
            criada.id,
            imagens.map((i) => (bytes: i.bytes, filename: i.name)).toList(),
          );
        }
        await saveOcorrenciaJson(_ocorrenciaToJson(criada), pendingSync: false);
        return (ocorrencia: criada, queued: false);
      } catch (_) {
        // continua no fluxo offline
      }
    }

    final localJson = _buildLocalJson(body, clientUuid, setorNome);
    final imagePaths = await _persistImages(clientUuid, imagens);
    await saveOcorrenciaJson(localJson, pendingSync: true);
    await insertOutbox(
      clientUuid: clientUuid,
      payload: body,
      imagePaths: imagePaths,
    );
    return (ocorrencia: Ocorrencia.fromJson(localJson), queued: true);
  }

  Map<String, dynamic> _buildLocalJson(
    Map<String, dynamic> body,
    String clientUuid,
    String? setorNome,
  ) {
    return {
      'id': localIdFromUuid(clientUuid),
      'titulo': body['titulo'],
      'setor': setorNome ?? body['setor'] ?? '',
      'setorFazendaId': body['setorId'],
      'categoria': body['categoria'],
      'prioridade': body['prioridade'],
      'descricao': body['descricao'],
      'status': 'ABERTA',
      'horario': body['horario'] ?? DateTime.now().toUtc().toIso8601String(),
      'coordsX': body['coordsX'],
      'coordsY': body['coordsY'],
      'imagens': <String>[],
      'clientUuid': clientUuid,
      'pendingSync': true,
    };
  }

  Map<String, dynamic> _ocorrenciaToJson(Ocorrencia o) => {
        'id': o.id,
        'titulo': o.titulo,
        'setor': o.setor,
        'setorFazendaId': o.setorFazendaId,
        'categoria': o.categoria,
        'prioridade': o.prioridade,
        'descricao': o.descricao,
        'status':
            o.status == StatusOcorrencia.resolvida ? 'RESOLVIDA' : 'ABERTA',
        'horario': o.horario,
        'coordsX': o.coordsX,
        'coordsY': o.coordsY,
        'responsavelId': o.responsavelId,
        'responsavelNome': o.responsavelNome,
        'imagens': o.imagens,
        'comentarios': o.comentariosRaw,
        if (o.clientUuid != null) 'clientUuid': o.clientUuid,
        if (o.pendingSync) 'pendingSync': true,
      };

  Future<List<String>> _persistImages(
    String clientUuid,
    List<({Uint8List bytes, String name})> imagens,
  ) async {
    if (imagens.isEmpty) return [];
    final dir = await getApplicationDocumentsDirectory();
    final folder = Directory('${dir.path}/offline_images/$clientUuid');
    await folder.create(recursive: true);
    final paths = <String>[];
    for (var i = 0; i < imagens.length; i++) {
      final file = File('${folder.path}/img_$i.jpg');
      await file.writeAsBytes(imagens[i].bytes);
      paths.add(file.path);
    }
    return paths;
  }

  Future<int> flushOutbox() async {
    if (_flushing || !await isDeviceOnline()) return 0;

    await resetOutboxSyncingToPending();
    final pending = await readOutboxPending();
    if (pending.isEmpty) return 0;

    _flushing = true;
    emitSyncEvent(const SyncEvent(type: SyncEventType.start));
    var synced = 0;
    String? lastError;

    try {
      for (final row in pending) {
        final clientUuid = row['client_uuid'] as String;
        await updateOutboxStatus(clientUuid, 'syncing');
        try {
          final payload =
              jsonDecode(row['payload'] as String) as Map<String, dynamic>;
          final criada = await OcorrenciasApi.criar(payload);
          final imagePaths =
              (jsonDecode(row['image_paths'] as String? ?? '[]') as List<dynamic>)
                  .cast<String>();
          if (imagePaths.isNotEmpty) {
            final files = <({List<int> bytes, String filename})>[];
            for (var i = 0; i < imagePaths.length; i++) {
              final bytes = await File(imagePaths[i]).readAsBytes();
              files.add((bytes: bytes, filename: 'offline_$i.jpg'));
            }
            await OcorrenciasApi.uploadImagens(criada.id, files);
          }
          await deleteOutbox(clientUuid);
          await deleteOcorrencia(localIdFromUuid(clientUuid));
          await saveOcorrenciaJson(_ocorrenciaToJson(criada), pendingSync: false);
          synced++;
        } catch (e) {
          lastError = e is ApiException ? e.mensagem : e.toString();
          await updateOutboxStatus(clientUuid, 'failed', error: lastError);
        }
      }

      if (synced > 0) {
        await setMeta('lastSync', DateTime.now().toUtc().toIso8601String());
        emitSyncEvent(SyncEvent(type: SyncEventType.complete, syncedCount: synced));
      } else if (lastError != null) {
        emitSyncEvent(SyncEvent(type: SyncEventType.failed, errorMessage: lastError));
      }
    } finally {
      _flushing = false;
      emitSyncEvent(const SyncEvent(type: SyncEventType.idle));
    }
    return synced;
  }

  Future<RegistroOcorrenciaMapa> loadFazendaMapa() async {
    if (await isDeviceOnline()) {
      try {
        final data = await FazendaApi.mapaRegistroOcorrencia();
        await saveFazendaMapa({
          'fazendas':
              data.fazendas.map((f) => {'id': f.id, 'nome': f.nome, 'perimetroGeojson': f.perimetroGeojson}).toList(),
          'setores': data.setores
              .map((s) => {
                    'id': s.id,
                    'nome': s.nome,
                    'fazendaNome': s.fazendaNome,
                    'poligonoGeojson': s.poligonoGeojson,
                  })
              .toList(),
        });
        return data;
      } catch (_) {
        final cached = await _readFazendaMapaCached();
        if (cached != null) return cached;
        rethrow;
      }
    }
    final cached = await _readFazendaMapaCached();
    if (cached != null) return cached;
    throw Exception(
        'Sem conexão. Conecte-se uma vez para baixar os dados da fazenda.');
  }

  Future<RegistroOcorrenciaMapa?> _readFazendaMapaCached() async {
    final raw = await readFazendaMapa();
    if (raw == null) return null;
    final fazendas = (raw['fazendas'] as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map(FazendaMapaRegistro.fromJson)
        .toList();
    final setores = (raw['setores'] as List<dynamic>)
        .cast<Map<String, dynamic>>()
        .map(SetorRegistro.fromJson)
        .toList();
    return RegistroOcorrenciaMapa(fazendas: fazendas, setores: setores);
  }
}

Future<void> initOfflineSync() async {
  Future<void> run() => OcorrenciasRepository.instance.flushOutbox();

  if (await isDeviceOnline()) {
    await run();
  }

  watchConnectivity((online) {
    if (online) unawaited(run());
  });

  // Wi‑Fi pode continuar "ligado" quando só a API cai/volta — polling cobre isso.
  Timer.periodic(const Duration(seconds: 8), (_) async {
    if (await isDeviceOnline()) {
      await run();
    }
  });
}
