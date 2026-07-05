import { useCallback, useEffect, useState } from 'react';
import { isOnline, subscribeConnectivity } from '../offline/connectivity';
import { getPendingCount } from '../offline/ocorrenciasStore';
import { subscribeSyncEvents } from '../offline/syncEvents';

export function useConnectivity() {
  const [online, setOnline] = useState(isOnline);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncMessage, setSyncMessage] = useState<string | null>(null);
  const [syncVersion, setSyncVersion] = useState(0);

  const refreshPending = useCallback(() => {
    void getPendingCount().then(setPendingCount);
  }, []);

  useEffect(() => subscribeConnectivity(setOnline), []);

  useEffect(() => {
    refreshPending();
    const id = window.setInterval(refreshPending, 2000);
    return () => window.clearInterval(id);
  }, [online, refreshPending]);

  useEffect(() => {
    return subscribeSyncEvents((event) => {
      if (event.type === 'sync-start') {
        setIsSyncing(true);
        setSyncMessage(null);
      }
      if (event.type === 'sync-complete') {
        setIsSyncing(false);
        refreshPending();
        setSyncVersion((v) => v + 1);
        const label =
          event.syncedCount === 1
            ? 'Sincronização concluída — 1 ocorrência enviada.'
            : `Sincronização concluída — ${event.syncedCount} ocorrências enviadas.`;
        setSyncMessage(label);
      }
      if (event.type === 'sync-idle') {
        setIsSyncing(false);
        refreshPending();
      }
    });
  }, [refreshPending]);

  useEffect(() => {
    if (!syncMessage) return;
    const id = window.setTimeout(() => setSyncMessage(null), 4000);
    return () => window.clearTimeout(id);
  }, [syncMessage]);

  return { online, pendingCount, isSyncing, syncMessage, syncVersion };
}
