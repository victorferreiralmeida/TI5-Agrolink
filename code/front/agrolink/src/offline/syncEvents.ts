export type SyncEvent =
  | { type: 'sync-start' }
  | { type: 'sync-complete'; syncedCount: number }
  | { type: 'sync-idle' };

const listeners = new Set<(event: SyncEvent) => void>();

export function subscribeSyncEvents(listener: (event: SyncEvent) => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitSyncEvent(event: SyncEvent) {
  listeners.forEach((listener) => listener(event));
}
