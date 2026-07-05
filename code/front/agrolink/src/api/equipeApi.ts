import { apiFetch } from './http';

const JSON_HEADERS = { 'Content-Type': 'application/json' };
function withAuth(token?: string | null): HeadersInit {
  if (!token) return JSON_HEADERS;
  return { ...JSON_HEADERS, Authorization: `Bearer ${token}` };
}

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) {
    if (res.status === 404) return 'Recurso não encontrado.';
    if (res.status === 400) return 'Dados inválidos.';
    if (res.status === 403) return 'Sem permissão para esta ação.';
    if (res.status === 409) return 'Conflito: verifique capacidade ou duplicidade.';
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

export type MembroDto = {
  id: number;
  nome: string;
  email: string;
  telefone: string | null;
  papel: string;
  fotoUrl: string | null;
  dataIngresso: string | null;
  ativo: boolean;
};

export type ConviteDto = {
  id: number;
  email: string | null;
  telefone: string | null;
  papel: string;
  status: string;
  dataEnvio: string;
  dataExpiracao: string;
  fazendaId: number | null;
};

export type EquipeResumoDto = {
  membros: MembroDto[];
  convitesPendentes: ConviteDto[];
  totalGerentes: number;
  totalFuncionarios: number;
  totalProdutores: number;
  vagasOcupadas: number;
  capacidadeMaxima: number;
};

export async function fetchEquipeResumo(token: string): Promise<EquipeResumoDto> {
  const res = await fetch('/api/equipe', { headers: withAuth(token) });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<EquipeResumoDto>;
}

export async function fetchMembrosEquipe(token: string, papel?: string): Promise<MembroDto[]> {
  const qs = papel ? `?papel=${encodeURIComponent(papel)}` : '';
  const res = await fetch(`/api/equipe/membros${qs}`, { headers: withAuth(token) });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<MembroDto[]>;
}

/** Corpo de convite: apenas e-mail; `telefone` deve ser `null`. */
export type ConvidarMembroBody = {
  email: string;
  telefone: null;
  /** `GERENTE` ou `FUNCIONARIO_CAMPO` (funcionário de campo) */
  papel: string;
};

export async function convidarMembro(body: ConvidarMembroBody, token?: string | null): Promise<ConviteDto> {
  const res = await fetch('/api/equipe/convites', {
    method: 'POST',
    headers: withAuth(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<ConviteDto>;
}

export async function reenviarConvite(id: number, token: string): Promise<ConviteDto> {
  const res = await fetch(`/api/equipe/convites/${id}/reenviar`, { method: 'POST', headers: withAuth(token) });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<ConviteDto>;
}

export async function cancelarConvite(id: number, token: string): Promise<void> {
  const res = await fetch(`/api/equipe/convites/${id}`, { method: 'DELETE', headers: withAuth(token) });
  if (!res.ok) throw new Error(await readApiError(res));
}

export async function removerMembro(id: number, token: string): Promise<void> {
  const res = await fetch(`/api/equipe/membros/${id}`, { method: 'DELETE', headers: withAuth(token) });
  if (!res.ok) throw new Error(await readApiError(res));
}

export async function fetchMeusConvites(
  token: string,
  opts?: { silent?: boolean },
): Promise<ConviteDto[]> {
  const res = await apiFetch('/api/equipe/convites/me', {
    headers: { Authorization: `Bearer ${token}` },
    silent: opts?.silent,
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<ConviteDto[]>;
}

export async function aceitarConviteEquipe(id: number, token: string): Promise<ConviteDto> {
  const res = await fetch(`/api/equipe/convites/${id}/aceitar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<ConviteDto>;
}

export async function recusarConviteEquipe(id: number, token: string): Promise<ConviteDto> {
  const res = await fetch(`/api/equipe/convites/${id}/recusar`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<ConviteDto>;
}
