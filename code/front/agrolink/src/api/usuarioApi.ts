import type { UserSummary } from '../types/api';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) {
    if (res.status === 401) return 'Faça login novamente.';
    if (res.status === 400) return 'Dados inválidos.';
    return `Erro ${res.status}`;
  }
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

function bearer(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}` };
}

export async function fetchUsuarioMe(token: string): Promise<UserSummary> {
  const res = await fetch('/api/usuario/me', { headers: bearer(token) });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<UserSummary>;
}

export type AtualizarPerfilBody = {
  nome: string;
  telefone: string;
};

export async function atualizarUsuarioMe(token: string, body: AtualizarPerfilBody): Promise<UserSummary> {
  const res = await fetch('/api/usuario/me', {
    method: 'PUT',
    headers: authJson(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<UserSummary>;
}

export async function uploadFotoUsuarioMe(token: string, file: File): Promise<UserSummary> {
  const fd = new FormData();
  fd.append('file', file);
  const res = await fetch('/api/usuario/me/foto', {
    method: 'POST',
    headers: bearer(token),
    body: fd,
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<UserSummary>;
}
