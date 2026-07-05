enum SyncEventType { start, complete, idle, failed }

class SyncEvent {
  final SyncEventType type;
  final int syncedCount;
  final String? errorMessage;

  const SyncEvent({
    required this.type,
    this.syncedCount = 0,
    this.errorMessage,
  });
}

typedef SyncEventListener = void Function(SyncEvent event);

final _syncListeners = <SyncEventListener>[];

void subscribeSyncEvents(SyncEventListener listener) {
  _syncListeners.add(listener);
}

void unsubscribeSyncEvents(SyncEventListener listener) {
  _syncListeners.remove(listener);
}

void emitSyncEvent(SyncEvent event) {
  for (final listener in List<SyncEventListener>.from(_syncListeners)) {
    listener(event);
  }
}
