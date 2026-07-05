import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { fetchUsuarioMe } from '../api/usuarioApi';
import { usuarioIdFromToken } from '../api/chatApi';
import { clearOfflineData } from '../offline/db';
import type { AuthResponse, PapelConta, UserSummary } from '../types/api';

const STORAGE_KEY = 'agrolink_auth';

type SpringErrorJson = {
  message?: string;
  detail?: string;
  title?: string;
  error?: string;
};

function friendlyMessageForStatus(status: number): string | null {
  if (status === 401) return 'E-mail ou senha incorretos. Verifique e tente de novo.';
  if (status === 403) return 'Você não tem permissão para esta ação.';
  if (status === 404) return 'Recurso não encontrado.';
  if (status === 409) return 'Este e-mail já está cadastrado.';
  if (status >= 500) return 'Servidor indisponível no momento. Tente de novo em instantes.';
  return null;
}

async function parseApiError(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) {
    return friendlyMessageForStatus(res.status) ?? 'Algo deu errado. Tente de novo.';
  }
  try {
    const j = JSON.parse(text) as SpringErrorJson;
    if (typeof j.message === 'string' && j.message.trim()) return j.message.trim();
    if (typeof j.detail === 'string' && j.detail.trim()) return j.detail.trim();
    if (typeof j.title === 'string' && j.title.trim()) return j.title.trim();
    const byStatus = friendlyMessageForStatus(res.status);
    if (byStatus) return byStatus;
  } catch {
    /* corpo não é JSON */
  }
  const fallback = friendlyMessageForStatus(res.status);
  if (fallback) return fallback;
  return text.length > 280 ? 'Algo deu errado. Tente de novo.' : text;
}

/** Rede / proxy: o fetch falha antes de existir Response (mensagem genérica "Failed to fetch"). */
function rethrowNetworkError(err: unknown): never {
  if (err instanceof TypeError || (err instanceof Error && /failed to fetch|networkerror|load failed/i.test(err.message))) {
    throw new Error(
      'Não foi possível conectar à API. Abra o app em http://localhost:5173 (npm run dev) e mantenha um único Spring Boot na porta 8081 — não abra o cadastro em arquivo local nem outra porta sem proxy.',
    );
  }
  throw err;
}

type StoredAuth = {
  token: string;
  usuario: UserSummary;
};

function normalizeUsuario(u: UserSummary, token: string): UserSummary {
  const id = typeof u.id === 'number' && Number.isFinite(u.id) ? u.id : usuarioIdFromToken(token);
  return {
    id: id ?? 0,
    nome: u.nome,
    email: u.email,
    papel: u.papel,
    telefone: u.telefone ?? null,
    fotoUrl: u.fotoUrl ?? null,
    temFazenda: u.temFazenda === true,
  };
}

function readStored(): StoredAuth | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as StoredAuth;
    if (!parsed?.token || !parsed?.usuario) return null;
    parsed.usuario = normalizeUsuario(parsed.usuario, parsed.token);
    return parsed;
  } catch {
    return null;
  }
}

type AuthContextValue = {
  token: string | null;
  user: UserSummary | null;
  login: (email: string, password: string) => Promise<AuthResponse>;
  register: (input: {
    nome: string;
    email: string;
    password: string;
    papel: PapelConta;
  }) => Promise<AuthResponse>;
  logout: () => void;
  /** Atualiza usuário na sessão e persiste no armazenamento local. */
  setUsuario: (usuario: UserSummary) => void;
  /** Recarrega nome, telefone e foto a partir da API. */
  refreshUsuario: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => readStored()?.token ?? null);
  const [user, setUser] = useState<UserSummary | null>(() => readStored()?.usuario ?? null);

  const persist = useCallback(async (data: AuthResponse) => {
    await clearOfflineData();
    const usuario = normalizeUsuario(data.usuario, data.token);
    setToken(data.token);
    setUser(usuario);
    const payload: StoredAuth = { token: data.token, usuario };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
  }, []);

  const setUsuario = useCallback(
    (usuario: UserSummary) => {
      const t = token;
      if (!t) return;
      const next = normalizeUsuario(usuario, t);
      setUser(next);
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ token: t, usuario: next }));
    },
    [token],
  );

  const refreshUsuario = useCallback(async () => {
    const t = token;
    if (!t) return;
    const next = await fetchUsuarioMe(t);
    setUsuario(next);
  }, [token, setUsuario]);

  useEffect(() => {
    if (!token) return;
    void refreshUsuario().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps -- uma vez ao montar com sessão salva
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      let res: Response;
      try {
        res = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password }),
        });
      } catch (e) {
        rethrowNetworkError(e);
      }
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }
      const data = (await res.json()) as AuthResponse;
      await persist(data);
      return data;
    },
    [persist],
  );

  const register = useCallback(
    async (input: { nome: string; email: string; password: string; papel: PapelConta }) => {
      let res: Response;
      try {
        res = await fetch('/api/auth/register', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(input),
        });
      } catch (e) {
        rethrowNetworkError(e);
      }
      if (!res.ok) {
        throw new Error(await parseApiError(res));
      }
      const data = (await res.json()) as AuthResponse;
      await persist(data);
      return data;
    },
    [persist],
  );

  const logout = useCallback(() => {
    setToken(null);
    setUser(null);
    localStorage.removeItem(STORAGE_KEY);
    void clearOfflineData();
  }, []);

  const value = useMemo(
    () => ({ token, user, login, register, logout, setUsuario, refreshUsuario }),
    [token, user, login, register, logout, setUsuario, refreshUsuario],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth deve ser usado dentro de AuthProvider.');
  }
  return ctx;
}
