import type { MembroDto } from './equipeApi';

import { apiFetch } from './http';

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) {
    if (res.status === 401) return 'Faça login novamente para enviar mensagens.';
    if (res.status === 403) return 'Sem permissão para esta ação.';
    if (res.status === 404) return 'Sala ou recurso não encontrado.';
    return `Erro ${res.status}`;
  }
  try {
    const j = JSON.parse(text) as { message?: string; detail?: string; title?: string };
    if (typeof j.message === 'string' && j.message.trim()) return j.message.trim();
    if (typeof j.detail === 'string' && j.detail.trim()) return j.detail.trim();
    if (typeof j.title === 'string' && j.title.trim()) return j.title.trim();
  } catch {
    /* ignore */
  }
  return text.length > 200 ? `Erro ${res.status}` : text;
}

function authHeaders(token: string | null): HeadersInit {
  if (!token) return JSON_HEADERS;
  return { ...JSON_HEADERS, Authorization: `Bearer ${token}` };
}

function bearerHeaders(token: string | null): HeadersInit {
  if (!token) return {};
  return { Authorization: `Bearer ${token}` };
}

/** Id do usuário a partir do token do login (`agrolink-{id}`). */
export function usuarioIdFromToken(token: string | null): number | null {
  if (!token) return null;
  const t = token.trim();
  if (!t.toLowerCase().startsWith('agrolink-')) return null;
  const n = Number.parseInt(t.slice(9), 10);
  return Number.isFinite(n) ? n : null;
}

export type SalaChatDto = {
  id: number;
  nome: string;
  /** Foto do canal; URL relativa servida em `/uploads/...`. */
  imagemUrl?: string | null;
  ultimaPreview: string | null;
  ultimaEm: string | null;
  ultimaMensagemId: number | null;
  ultimaAutorEmail: string | null;
};

export type MensagemChatDto = {
  id: number;
  autorNome: string;
  autorEmail: string;
  autorFotoUrl?: string | null;
  texto: string;
  midiaUrl: string | null;
  criadoEm: string;
};

export async function fetchSalasChat(
  token: string | null,
  opts?: { silent?: boolean },
): Promise<SalaChatDto[]> {
  const res = await apiFetch('/api/chat/salas', { headers: bearerHeaders(token), silent: opts?.silent });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<SalaChatDto[]>;
}

export async function criarSalaChat(nome: string, membroIds: number[], token: string | null): Promise<SalaChatDto> {
  const res = await apiFetch('/api/chat/salas', {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ nome, membroIds }),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<SalaChatDto>;
}

export async function atualizarSalaChat(salaId: number, nome: string, token: string | null): Promise<SalaChatDto> {
  const res = await apiFetch(`/api/chat/salas/${salaId}`, {
    method: 'PATCH',
    headers: authHeaders(token),
    body: JSON.stringify({ nome: nome.trim() }),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<SalaChatDto>;
}

export async function fetchMensagensChat(
  salaId: number,
  token: string | null,
  opts?: { silent?: boolean },
): Promise<MensagemChatDto[]> {
  const res = await apiFetch(`/api/chat/salas/${salaId}/mensagens`, {
    headers: bearerHeaders(token),
    silent: opts?.silent,
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<MensagemChatDto[]>;
}

/** Membros vinculados a este canal (não a equipe inteira). */
export async function fetchMembrosDoCanal(salaId: number, token: string | null): Promise<MembroDto[]> {
  const res = await apiFetch(`/api/chat/salas/${salaId}/membros`, { headers: bearerHeaders(token) });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<MembroDto[]>;
}

export async function enviarMensagemChat(
  salaId: number,
  texto: string,
  token: string | null,
  midiaUrl?: string | null,
): Promise<MensagemChatDto> {
  const res = await apiFetch(`/api/chat/salas/${salaId}/mensagens`, {
    method: 'POST',
    headers: authHeaders(token),
    body: JSON.stringify({ texto: texto.trim() || null, midiaUrl: midiaUrl?.trim() || null }),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<MensagemChatDto>;
}

export async function enviarMensagemComArquivo(
  salaId: number,
  file: File,
  legenda: string | null,
  token: string | null,
): Promise<MensagemChatDto> {
  const fd = new FormData();
  fd.append('file', file);
  if (legenda?.trim()) fd.append('texto', legenda.trim());
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await apiFetch(`/api/chat/salas/${salaId}/mensagens/com-arquivo`, {
    method: 'POST',
    headers,
    body: fd,
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<MensagemChatDto>;
}

/** Atualiza a imagem de capa do grupo (qualquer membro do canal). */
export async function uploadImagemSalaCapa(salaId: number, file: File, token: string | null): Promise<SalaChatDto> {
  const fd = new FormData();
  fd.append('file', file);
  const headers: HeadersInit = {};
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await apiFetch(`/api/chat/salas/${salaId}/imagem`, {
    method: 'POST',
    headers,
    body: fd,
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<SalaChatDto>;
}

/** Rótulo curto de papel para a lista lateral (membro da equipe). */
export function papelMembroLabel(m: MembroDto): string {
  switch (m.papel) {
    case 'PRODUTOR':
      return 'Produtor';
    case 'GERENTE':
      return 'Gerente';
    case 'FUNCIONARIO_CAMPO':
      return 'Funcionário de campo';
    default:
      return m.papel;
  }
}
