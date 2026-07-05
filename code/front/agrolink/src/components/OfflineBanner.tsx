import { useAuth } from '../auth/AuthContext';
import { useConnectivity } from '../hooks/useConnectivity';

export function OfflineBanner() {
  const { token } = useAuth();
  const { online, pendingCount, isSyncing, syncMessage } = useConnectivity();

  if (!token) return null;

  if (syncMessage) {
    return (
      <div className="offline-banner offline-banner--success" role="status">
        {syncMessage}
      </div>
    );
  }

  if (online && pendingCount === 0 && !isSyncing) return null;

  let text: string;
  if (!online) {
    text =
      pendingCount > 0
        ? `Modo offline — ${pendingCount} ocorrência(s) aguardando sincronização.`
        : 'Modo offline — exibindo dados salvos localmente.';
  } else if (isSyncing || pendingCount > 0) {
    text = `Sincronizando ${pendingCount} ocorrência(s) pendente(s)…`;
  } else {
    return null;
  }

  return (
    <div className={`offline-banner ${online ? 'offline-banner--syncing' : 'offline-banner--offline'}`} role="status">
      {text}
    </div>
  );
}
