import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { createPortal } from 'react-dom';
import { LoadingOverlay } from '../components/LoadingOverlay';
import { clearFetchLoadingHandlers, fetchLoadingHandlers } from './fetchLoadingBridge';

const MIN_VISIBLE_MS = 1000;

type LoadingContextValue = {
  /** Executa uma ação assíncrona (sem fetch) com overlay global. */
  runWithLoading: <T>(fn: () => Promise<T>, label?: string) => Promise<T>;
  isLoading: boolean;
};

const LoadingContext = createContext<LoadingContextValue | null>(null);

export function LoadingProvider({ children }: { children: ReactNode }) {
  const [visible, setVisible] = useState(false);
  const [label, setLabel] = useState<string | undefined>();
  const activeRef = useRef(0);
  const manualRef = useRef(0);
  const hideTimerRef = useRef<number | null>(null);
  const visibleSinceRef = useRef<number | null>(null);

  const clearHideTimer = useCallback(() => {
    if (hideTimerRef.current != null) {
      window.clearTimeout(hideTimerRef.current);
      hideTimerRef.current = null;
    }
  }, []);

  const reveal = useCallback((nextLabel?: string) => {
    clearHideTimer();
    if (nextLabel) setLabel(nextLabel);
    if (visibleSinceRef.current == null) {
      visibleSinceRef.current = Date.now();
      setVisible(true);
    }
  }, [clearHideTimer]);

  const conceal = useCallback(() => {
    if (activeRef.current + manualRef.current > 0) return;

    const finish = () => {
      visibleSinceRef.current = null;
      setVisible(false);
      setLabel(undefined);
    };

    if (visibleSinceRef.current == null) {
      finish();
      return;
    }

    const elapsed = Date.now() - visibleSinceRef.current;
    const wait = Math.max(0, MIN_VISIBLE_MS - elapsed);
    clearHideTimer();
    hideTimerRef.current = window.setTimeout(() => {
      hideTimerRef.current = null;
      finish();
    }, wait);
  }, [clearHideTimer]);

  const begin = useCallback(
    (nextLabel?: string) => {
      activeRef.current += 1;
      reveal(nextLabel);
    },
    [reveal],
  );

  const end = useCallback(() => {
    activeRef.current = Math.max(0, activeRef.current - 1);
    if (activeRef.current + manualRef.current === 0) {
      conceal();
    }
  }, [conceal]);

  const beginRef = useRef(begin);
  const endRef = useRef(end);
  beginRef.current = begin;
  endRef.current = end;
  fetchLoadingHandlers.onStart = (nextLabel?: string) => beginRef.current(nextLabel);
  fetchLoadingHandlers.onEnd = () => endRef.current();

  const runWithLoading = useCallback(
    async <T,>(fn: () => Promise<T>, nextLabel?: string): Promise<T> => {
      manualRef.current += 1;
      reveal(nextLabel);
      try {
        return await fn();
      } finally {
        manualRef.current = Math.max(0, manualRef.current - 1);
        if (activeRef.current + manualRef.current === 0) {
          conceal();
        }
      }
    },
    [conceal, reveal],
  );

  useEffect(
    () => () => {
      clearFetchLoadingHandlers();
      clearHideTimer();
    },
    [clearHideTimer],
  );

  const value = useMemo(
    () => ({
      runWithLoading,
      isLoading: visible,
    }),
    [runWithLoading, visible],
  );

  const overlay = <LoadingOverlay visible={visible} label={label} />;

  return (
    <LoadingContext.Provider value={value}>
      {children}
      {typeof document !== 'undefined'
        ? createPortal(overlay, document.body)
        : overlay}
    </LoadingContext.Provider>
  );
}

export function useLoading(): LoadingContextValue {
  const ctx = useContext(LoadingContext);
  if (!ctx) {
    throw new Error('useLoading deve ser usado dentro de LoadingProvider.');
  }
  return ctx;
}
