import 'dart:convert';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:flutter/foundation.dart' show kIsWeb;
import 'package:http/http.dart' as http;
import 'package:path/path.dart' as p;
import 'package:sqflite/sqflite.dart';

import '../config/api_config.dart';

/// Cache offline em memória para Flutter Web (sqflite não roda no navegador).
class _InMemoryOfflineStore {
  _InMemoryOfflineStore._();
  static final _InMemoryOfflineStore instance = _InMemoryOfflineStore._();

  final Map<String, String> meta = {};
  final Map<int, Map<String, dynamic>> ocorrencias = {};
  final Map<String, Map<String, dynamic>> outbox = {};
  Map<String, dynamic>? fazendaMapa;
}

class OfflineDb {
  OfflineDb._();
  static final OfflineDb instance = OfflineDb._();

  Database? _db;

  Future<Database> get database async {
    if (_db != null) return _db!;
    _db = await _open();
    return _db!;
  }

  Future<Database> _open() async {
    final path = p.join(await getDatabasesPath(), 'agrolink_offline.db');
    return openDatabase(
      path,
      version: 1,
      onCreate: (db, version) async {
        await db.execute('''
          CREATE TABLE ocorrencias (
            id INTEGER PRIMARY KEY,
            json TEXT NOT NULL,
            pending_sync INTEGER NOT NULL DEFAULT 0
          )
        ''');
        await db.execute('''
          CREATE TABLE outbox (
            client_uuid TEXT PRIMARY KEY,
            payload TEXT NOT NULL,
            image_paths TEXT,
            status TEXT NOT NULL,
            error TEXT,
            created_at TEXT NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE fazenda_mapa (
            id INTEGER PRIMARY KEY,
            json TEXT NOT NULL,
            cached_at TEXT NOT NULL
          )
        ''');
        await db.execute('''
          CREATE TABLE meta (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
          )
        ''');
      },
    );
  }
}

/// Verifica se a API Agrolink responde (mais confiável que só Wi‑Fi/celular).
Future<bool> isApiReachable() async {
  try {
    final res = await http
        .get(Uri.parse('$kApiBaseUrl/api/health'))
        .timeout(const Duration(seconds: 2));
    if (res.statusCode != 200) return false;
    final body = jsonDecode(res.body) as Map<String, dynamic>;
    return body['status'] == 'UP';
  } catch (_) {
    return false;
  }
}

Future<bool> isDeviceOnline() async {
  final result = await Connectivity().checkConnectivity();
  if (result.contains(ConnectivityResult.none)) {
    return false;
  }
  return isApiReachable();
}

Future<void> watchConnectivity(void Function(bool online) onChange) async {
  Connectivity().onConnectivityChanged.listen((_) async {
    onChange(await isDeviceOnline());
  });
}

bool _isOutboxPendingStatus(String status) =>
    status == 'pending' || status == 'failed' || status == 'syncing';

Future<String?> getMeta(String key) async {
  if (kIsWeb) return _InMemoryOfflineStore.instance.meta[key];
  final db = await OfflineDb.instance.database;
  final rows = await db.query('meta', where: 'key = ?', whereArgs: [key]);
  if (rows.isEmpty) return null;
  return rows.first['value'] as String?;
}

Future<void> setMeta(String key, String value) async {
  if (kIsWeb) {
    _InMemoryOfflineStore.instance.meta[key] = value;
    return;
  }
  final db = await OfflineDb.instance.database;
  await db.insert('meta', {'key': key, 'value': value},
      conflictAlgorithm: ConflictAlgorithm.replace);
}

Future<void> saveOcorrenciaJson(Map<String, dynamic> json,
    {required bool pendingSync}) async {
  final id = (json['id'] as num).toInt();
  if (kIsWeb) {
    _InMemoryOfflineStore.instance.ocorrencias[id] = {
      'json': jsonEncode(json),
      'pending_sync': pendingSync ? 1 : 0,
    };
    return;
  }
  final db = await OfflineDb.instance.database;
  await db.insert(
    'ocorrencias',
    {
      'id': id,
      'json': jsonEncode(json),
      'pending_sync': pendingSync ? 1 : 0,
    },
    conflictAlgorithm: ConflictAlgorithm.replace,
  );
}

Future<List<Map<String, dynamic>>> readAllOcorrencias() async {
  if (kIsWeb) {
    return _InMemoryOfflineStore.instance.ocorrencias.values
        .map((r) => jsonDecode(r['json'] as String) as Map<String, dynamic>)
        .toList();
  }
  final db = await OfflineDb.instance.database;
  final rows = await db.query('ocorrencias');
  return rows
      .map((r) => jsonDecode(r['json'] as String) as Map<String, dynamic>)
      .toList();
}

Future<void> deleteSyncedOcorrencias() async {
  if (kIsWeb) {
    _InMemoryOfflineStore.instance.ocorrencias
        .removeWhere((_, row) => row['pending_sync'] == 0);
    return;
  }
  final db = await OfflineDb.instance.database;
  await db.delete('ocorrencias', where: 'pending_sync = 0');
}

Future<void> deleteOcorrencia(int id) async {
  if (kIsWeb) {
    _InMemoryOfflineStore.instance.ocorrencias.remove(id);
    return;
  }
  final db = await OfflineDb.instance.database;
  await db.delete('ocorrencias', where: 'id = ?', whereArgs: [id]);
}

Future<void> saveFazendaMapa(Map<String, dynamic> data) async {
  if (kIsWeb) {
    _InMemoryOfflineStore.instance.fazendaMapa = data;
    return;
  }
  final db = await OfflineDb.instance.database;
  await db.insert(
    'fazenda_mapa',
    {
      'id': 1,
      'json': jsonEncode(data),
      'cached_at': DateTime.now().toUtc().toIso8601String(),
    },
    conflictAlgorithm: ConflictAlgorithm.replace,
  );
}

Future<Map<String, dynamic>?> readFazendaMapa() async {
  if (kIsWeb) {
    return _InMemoryOfflineStore.instance.fazendaMapa;
  }
  final db = await OfflineDb.instance.database;
  final rows = await db.query('fazenda_mapa', where: 'id = ?', whereArgs: [1]);
  if (rows.isEmpty) return null;
  return jsonDecode(rows.first['json'] as String) as Map<String, dynamic>;
}

Future<int> pendingOutboxCount() async {
  if (kIsWeb) {
    return _InMemoryOfflineStore.instance.outbox.values
        .where((row) => _isOutboxPendingStatus(row['status'] as String))
        .length;
  }
  final db = await OfflineDb.instance.database;
  final rows = await db.query('outbox',
      where: "status IN ('pending', 'failed', 'syncing')");
  return rows.length;
}

Future<List<Map<String, dynamic>>> readOutboxPending() async {
  if (kIsWeb) {
    return _InMemoryOfflineStore.instance.outbox.values
        .where((row) => _isOutboxPendingStatus(row['status'] as String))
        .toList();
  }
  final db = await OfflineDb.instance.database;
  return db.query('outbox',
      where: "status IN ('pending', 'failed', 'syncing')");
}

Future<void> resetOutboxSyncingToPending() async {
  if (kIsWeb) {
    for (final row in _InMemoryOfflineStore.instance.outbox.values) {
      if (row['status'] == 'syncing') row['status'] = 'pending';
    }
    return;
  }
  final db = await OfflineDb.instance.database;
  await db.update('outbox', {'status': 'pending'}, where: "status = 'syncing'");
}

Future<String?> lastOutboxError() async {
  if (kIsWeb) {
    Map<String, dynamic>? latest;
    for (final row in _InMemoryOfflineStore.instance.outbox.values) {
      if (row['status'] != 'failed' || row['error'] == null) continue;
      if (latest == null ||
          (row['created_at'] as String).compareTo(latest['created_at'] as String) >
              0) {
        latest = row;
      }
    }
    return latest?['error'] as String?;
  }
  final db = await OfflineDb.instance.database;
  final rows = await db.query(
    'outbox',
    columns: ['error'],
    where: "status = 'failed' AND error IS NOT NULL",
    orderBy: 'created_at DESC',
    limit: 1,
  );
  if (rows.isEmpty) return null;
  return rows.first['error'] as String?;
}

Future<int> failedOutboxCount() async {
  if (kIsWeb) {
    return _InMemoryOfflineStore.instance.outbox.values
        .where((row) => row['status'] == 'failed')
        .length;
  }
  final db = await OfflineDb.instance.database;
  final rows =
      await db.query('outbox', where: "status = 'failed'");
  return rows.length;
}

Future<void> insertOutbox({
  required String clientUuid,
  required Map<String, dynamic> payload,
  required List<String> imagePaths,
}) async {
  if (kIsWeb) {
    _InMemoryOfflineStore.instance.outbox[clientUuid] = {
      'client_uuid': clientUuid,
      'payload': jsonEncode(payload),
      'image_paths': jsonEncode(imagePaths),
      'status': 'pending',
      'created_at': DateTime.now().toUtc().toIso8601String(),
    };
    return;
  }
  final db = await OfflineDb.instance.database;
  await db.insert('outbox', {
    'client_uuid': clientUuid,
    'payload': jsonEncode(payload),
    'image_paths': jsonEncode(imagePaths),
    'status': 'pending',
    'created_at': DateTime.now().toUtc().toIso8601String(),
  });
}

Future<void> updateOutboxStatus(String clientUuid, String status,
    {String? error}) async {
  if (kIsWeb) {
    final row = _InMemoryOfflineStore.instance.outbox[clientUuid];
    if (row == null) return;
    row['status'] = status;
    if (error != null) row['error'] = error;
    return;
  }
  final db = await OfflineDb.instance.database;
  await db.update(
    'outbox',
    {'status': status, if (error != null) 'error': error},
    where: 'client_uuid = ?',
    whereArgs: [clientUuid],
  );
}

Future<void> deleteOutbox(String clientUuid) async {
  if (kIsWeb) {
    _InMemoryOfflineStore.instance.outbox.remove(clientUuid);
    return;
  }
  final db = await OfflineDb.instance.database;
  await db.delete('outbox', where: 'client_uuid = ?', whereArgs: [clientUuid]);
}

/// Limpa cache offline ao trocar de usuário (evita vazamento entre contas).
Future<void> clearOfflineData() async {
  if (kIsWeb) {
    final store = _InMemoryOfflineStore.instance;
    store.ocorrencias.clear();
    store.outbox.clear();
    store.fazendaMapa = null;
    store.meta.clear();
    return;
  }
  final db = await OfflineDb.instance.database;
  await db.delete('ocorrencias');
  await db.delete('outbox');
  await db.delete('fazenda_mapa');
  await db.delete('meta');
}

int localIdFromUuid(String uuid) {
  var hash = 0;
  for (var i = 0; i < uuid.length; i++) {
    hash = (hash * 31 + uuid.codeUnitAt(i)) & 0x7fffffff;
  }
  return -hash.clamp(1, 0x7fffffff);
}
