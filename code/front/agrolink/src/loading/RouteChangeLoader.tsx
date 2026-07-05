import { useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { useLoading } from './LoadingContext';

const ROUTE_LOADING_MS = 700;

/** Mostra o overlay global a cada troca de rota, mesmo sem chamada à API. */
export function RouteChangeLoader() {
  const location = useLocation();
  const { runWithLoading } = useLoading();
  const firstRef = useRef(true);

  useEffect(() => {
    if (firstRef.current) {
      firstRef.current = false;
      return;
    }
    void runWithLoading(
      () => new Promise<void>((resolve) => window.setTimeout(resolve, ROUTE_LOADING_MS)),
      'Carregando…',
    );
  }, [location.pathname, runWithLoading]);

  return null;
}
