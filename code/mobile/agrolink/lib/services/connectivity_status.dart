import 'dart:async';

import 'package:flutter/material.dart';

import 'offline_db.dart';
import 'ocorrencias_repository.dart';
import 'sync_events.dart';

/// Estado global de conectividade e fila de sync (paridade com o web).
class ConnectivityStatus extends ChangeNotifier {
  bool online = true;
  int pendingCount = 0;
  int failedCount = 0;
  bool isSyncing = false;
  String? syncMessage;
  String? syncError;
  int syncVersion = 0;

  Timer? _pollTimer;
  Timer? _syncMsgTimer;
  SyncEventListener? _syncListener;
  bool _started = false;

  Future<void> start() async {
    if (_started) return;
    _started = true;

    online = await isDeviceOnline();
    await refreshPending();
    notifyListeners();

    watchConnectivity((nextOnline) {
      unawaited(_setOnline(nextOnline));
    });

    _pollTimer = Timer.periodic(const Duration(seconds: 2), (_) {
      unawaited(_refreshOnline());
      unawaited(refreshPending());
    });

    _syncListener = (event) {
      if (event.type == SyncEventType.start) {
        isSyncing = true;
        syncMessage = null;
        syncError = null;
        notifyListeners();
        return;
      }
      if (event.type == SyncEventType.complete) {
        isSyncing = false;
        syncVersion++;
        syncError = null;
        syncMessage = event.syncedCount == 1
            ? 'Sincronização concluída — 1 ocorrência enviada.'
            : 'Sincronização concluída — ${event.syncedCount} ocorrências enviadas.';
        notifyListeners();
        unawaited(refreshPending());
        _syncMsgTimer?.cancel();
        _syncMsgTimer = Timer(const Duration(seconds: 4), () {
          syncMessage = null;
          notifyListeners();
        });
        return;
      }
      if (event.type == SyncEventType.failed) {
        isSyncing = false;
        syncError = event.errorMessage;
        notifyListeners();
        return;
      }
      if (event.type == SyncEventType.idle) {
        isSyncing = false;
        unawaited(refreshPending());
        notifyListeners();
      }
    };
    subscribeSyncEvents(_syncListener!);
  }

  Future<void> _refreshOnline() async {
    await _setOnline(await isDeviceOnline());
  }

  Future<void> _setOnline(bool nextOnline) async {
    final goingOnline = !online && nextOnline;
    if (online != nextOnline) {
      online = nextOnline;
      notifyListeners();
    }
    if (goingOnline) {
      await OcorrenciasRepository.instance.flushOutbox();
      await refreshPending();
    }
  }

  Future<void> refreshPending() async {
    final count = await pendingOutboxCount();
    final failed = await failedOutboxCount();
    final error = await lastOutboxError();
    final changed = pendingCount != count ||
        failedCount != failed ||
        (failed > 0 && syncError == null && error != null);
    pendingCount = count;
    failedCount = failed;
    if (failed == 0) {
      syncError = null;
    } else if (error != null && syncError != error) {
      syncError = error;
    }
    if (changed) notifyListeners();
  }

  bool get isBannerVisible {
    if (syncMessage != null) return true;
    if (!online) return true;
    if (isSyncing) return true;
    if (pendingCount > 0) return true;
    return false;
  }

  ({Color color, String text}) bannerStyle() {
    if (syncMessage != null) {
      return (color: const Color(0xFF15803D), text: syncMessage!);
    }
    if (!online) {
      final text = pendingCount > 0
          ? 'Modo offline — $pendingCount ocorrência(s) aguardando sincronização.'
          : 'Modo offline — exibindo dados salvos localmente.';
      return (color: const Color(0xFF8B4513), text: text);
    }
    if (isSyncing) {
      return (
        color: const Color(0xFF1F6B3A),
        text: 'Sincronizando $pendingCount ocorrência(s) pendente(s)…',
      );
    }
    if (failedCount > 0 && syncError != null) {
      return (
        color: const Color(0xFFB45309),
        text: 'Falha ao sincronizar — $syncError',
      );
    }
    return (
      color: const Color(0xFF1F6B3A),
      text: '$pendingCount ocorrência(s) aguardando sincronização.',
    );
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _syncMsgTimer?.cancel();
    if (_syncListener != null) {
      unsubscribeSyncEvents(_syncListener!);
    }
    super.dispose();
  }
}
