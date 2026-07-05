type Listener = (online: boolean) => void;

const listeners = new Set<Listener>();

export function isOnline(): boolean {
  return typeof navigator !== 'undefined' ? navigator.onLine : true;
}

export function subscribeConnectivity(listener: Listener): () => void {
  listeners.add(listener);
  const onOnline = () => listeners.forEach((l) => l(true));
  const onOffline = () => listeners.forEach((l) => l(false));
  window.addEventListener('online', onOnline);
  window.addEventListener('offline', onOffline);
  return () => {
    listeners.delete(listener);
    window.removeEventListener('online', onOnline);
    window.removeEventListener('offline', onOffline);
  };
}

export function notifyConnectivityListeners() {
  listeners.forEach((l) => l(isOnline()));
}
