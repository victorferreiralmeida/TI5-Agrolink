import { apiFetch } from './http';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return `Erro ${res.status}`;
  try {
    const j = JSON.parse(text) as { message?: string; detail?: string };
    if (typeof j.message === 'string' && j.message.trim()) return j.message.trim();
    if (typeof j.detail === 'string' && j.detail.trim()) return j.detail.trim();
  } catch {
    /* ignore */
  }
  return text.length > 200 ? `Erro ${res.status}` : text;
}

function authJson(token: string): HeadersInit {
  return { ...JSON_HEADERS, Authorization: `Bearer ${token}` };
}

export type NotificacaoDto = {
  id: number;
  tipo: string;
  tag: string;
  tagTone: 'danger' | 'ok' | 'muted';
  icon: 'alert' | 'user' | 'chat' | 'sync' | 'wrench';
  titulo: string;
  mensagem: string;
  refTipo: string | null;
  refId: number | null;
  criadoEm: string;
};

export async function fetchNotificacoes(
  token: string,
  opts?: { silent?: boolean },
): Promise<NotificacaoDto[]> {
  const res = await apiFetch('/api/notificacoes', { headers: authJson(token), silent: opts?.silent });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<NotificacaoDto[]>;
}
