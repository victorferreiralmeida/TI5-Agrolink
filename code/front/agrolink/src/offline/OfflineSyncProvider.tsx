import { useEffect } from 'react';
import { useAuth } from '../auth/AuthContext';
import { initOfflineSync } from '../offline/ocorrenciasStore';

export function OfflineSyncProvider({ children }: { children: React.ReactNode }) {
  const { token } = useAuth();

  useEffect(() => {
    if (!token) return;
    return initOfflineSync(token);
  }, [token]);

  return <>{children}</>;
}
