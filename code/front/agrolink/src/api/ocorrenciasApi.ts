export type OcorrenciaDto = {
  id: number;
  titulo: string;
  setor: string;
  setorFazendaId?: number | null;
  categoria: string;
  prioridade: string | null;
  descricao: string | null;
  status: string | null;
  comentarios: string | null;
  coordsX: number;
  coordsY: number;
  horario: string;
  responsavelId?: number | null;
  responsavelNome?: string | null;
  imagens: string[];
  clientUuid?: string | null;
  updatedAt?: string | null;
  /** Apenas local — ocorrência aguardando sync. */
  pendingSync?: boolean;
};

export type PrioridadeOcorrencia = 'BAIXA' | 'MEDIA' | 'ALTA' | 'URGENTE';

export type NovaOcorrenciaInput = {
  titulo: string;
  setor: string;
  setorId?: number | null;
  categoria: string;
  prioridade: PrioridadeOcorrencia;
  descricao?: string;
  horario?: string;
  coordsX: number;
  coordsY: number;
  clientUuid?: string;
};

export type EditarOcorrenciaInput = {
  titulo: string;
  setor: string;
  setorId?: number | null;
  categoria: string;
  prioridade: PrioridadeOcorrencia;
  descricao?: string;
  status?: 'ABERTA' | 'RESOLVIDA';
  horario?: string;
  coordsX: number;
  coordsY: number;
};

const JSON_HEADERS = { 'Content-Type': 'application/json' };

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) {
    if (res.status === 404) return 'Ocorrência não encontrada.';
    if (res.status === 400) return 'Dados inválidos. Verifique os campos.';
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

export async function fetchOcorrencias(token: string): Promise<OcorrenciaDto[]> {
  const res = await fetch('/api/ocorrencias', {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<OcorrenciaDto[]>;
}

export async function fetchOcorrenciasSince(token: string, since: string): Promise<OcorrenciaDto[]> {
  const url = `/api/ocorrencias?since=${encodeURIComponent(since)}`;
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<OcorrenciaDto[]>;
}

export async function fetchOcorrencia(id: number, token: string): Promise<OcorrenciaDto> {
  const res = await fetch(`/api/ocorrencias/${id}`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<OcorrenciaDto>;
}

function withAuthJson(token?: string | null): HeadersInit {
  if (!token) return JSON_HEADERS;
  return { ...JSON_HEADERS, Authorization: `Bearer ${token}` };
}

export async function criarOcorrencia(body: NovaOcorrenciaInput, token: string): Promise<OcorrenciaDto> {
  const res = await fetch('/api/ocorrencias', {
    method: 'POST',
    headers: withAuthJson(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<OcorrenciaDto>;
}

export async function editarOcorrencia(id: number, body: EditarOcorrenciaInput, token?: string | null): Promise<OcorrenciaDto> {
  const res = await fetch(`/api/ocorrencias/${id}`, {
    method: 'PUT',
    headers: withAuthJson(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<OcorrenciaDto>;
}

export async function resolverOcorrencia(id: number, token: string): Promise<OcorrenciaDto> {
  const res = await fetch(`/api/ocorrencias/${id}/resolver`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<OcorrenciaDto>;
}

export async function comentarOcorrencia(id: number, texto: string, token: string): Promise<OcorrenciaDto> {
  const res = await fetch(`/api/ocorrencias/${id}/comentarios`, {
    method: 'POST',
    headers: withAuthJson(token),
    body: JSON.stringify({ texto }),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<OcorrenciaDto>;
}

/** Até 3 imagens; exige token. Texto pode ficar vazio se houver arquivos. */
export async function comentarOcorrenciaComAnexos(
  id: number,
  texto: string,
  files: File[],
  token: string,
): Promise<OcorrenciaDto> {
  const body = new FormData();
  body.append('texto', texto.trim());
  files.forEach((f) => body.append('files', f));
  const res = await fetch(`/api/ocorrencias/${id}/comentarios`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<OcorrenciaDto>;
}

export async function uploadOcorrenciaImagens(id: number, files: File[], token: string): Promise<OcorrenciaDto> {
  const body = new FormData();
  files.forEach((f) => body.append('files', f));
  const res = await fetch(`/api/ocorrencias/${id}/imagens`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
    body,
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<OcorrenciaDto>;
}

export async function assumirResponsavelOcorrencia(id: number, token: string): Promise<OcorrenciaDto> {
  const res = await fetch(`/api/ocorrencias/${id}/responsavel/mim`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<OcorrenciaDto>;
}

export async function definirResponsavelOcorrencia(
  id: number,
  usuarioId: number | null,
  token: string,
): Promise<OcorrenciaDto> {
  const res = await fetch(`/api/ocorrencias/${id}/responsavel`, {
    method: 'PUT',
    headers: withAuthJson(token),
    body: JSON.stringify({ usuarioId }),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<OcorrenciaDto>;
}

const CATEGORIA_LABELS: Record<string, string> = {
  INCENDIO: 'Incêndio',
  CERCA: 'Cerca',
  PRAGA: 'Praga',
  MANUTENCAO: 'Manutenção',
  INFRAESTRUTURA: 'Infraestrutura',
  SOLO: 'Solo',
};

const CATEGORIA_IMAGENS: Record<string, string> = {
  INCENDIO: '/images/incendio.jpg',
  CERCA: '/images/cerca.jpg',
  PRAGA: '/images/praga.jpg',
  MANUTENCAO: '/images/manutencao.jpg',
  INFRAESTRUTURA: '/images/infraestrutura.jpg',
  SOLO: '/images/solo.jpg',
};

/** Valores aceitos pelo backend (`categoria` livre em texto; estes são o padrão da UI). */
export const CATEGORIAS_REGISTRO: ReadonlyArray<{ value: string; label: string }> = [
  { value: 'PRAGA', label: 'Praga / doença' },
  { value: 'INCENDIO', label: 'Incêndio' },
  { value: 'CERCA', label: 'Cerca / perímetro' },
  { value: 'MANUTENCAO', label: 'Manutenção' },
  { value: 'INFRAESTRUTURA', label: 'Infraestrutura' },
  { value: 'SOLO', label: 'Solo' },
];

export const PRIORIDADES_REGISTRO: ReadonlyArray<{ value: PrioridadeOcorrencia; label: string }> = [
  { value: 'BAIXA', label: 'Baixa' },
  { value: 'MEDIA', label: 'Media' },
  { value: 'ALTA', label: 'Alta' },
  { value: 'URGENTE', label: 'Critico' },
];

export function labelCategoria(categoria: string): string {
  return CATEGORIA_LABELS[categoria] ?? categoria;
}

export function imagemCategoria(categoria: string): string {
  const key = categoria.trim().toUpperCase();
  return CATEGORIA_IMAGENS[key] ?? '/images/default.jpg';
}

export function formatOcorrenciaHorario(horario: string): string {
  const t = Date.parse(horario);
  if (Number.isNaN(t)) return horario;
  return new Date(t).toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export function prioridadeOcorrencia(value: string | null | undefined): PrioridadeOcorrencia {
  const p = String(value ?? '').trim().toUpperCase();
  if (p === 'BAIXA' || p === 'MEDIA' || p === 'ALTA' || p === 'URGENTE') return p;
  return 'MEDIA';
}

const PRIORIDADE_RANK: Record<PrioridadeOcorrencia, number> = {
  URGENTE: 4,
  ALTA: 3,
  MEDIA: 2,
  BAIXA: 1,
};

/** Maior = mais crítico (URGENTE primeiro). */
export function rankPrioridadeOcorrencia(prioridade: string | null | undefined): number {
  return PRIORIDADE_RANK[prioridadeOcorrencia(prioridade)] ?? 2;
}

/** Ordena por criticidade (URGENTE → BAIXA) e, em empate, pela data mais recente. */
export function compararOcorrenciasPorCriticidade(a: OcorrenciaDto, b: OcorrenciaDto): number {
  const diff = rankPrioridadeOcorrencia(b.prioridade) - rankPrioridadeOcorrencia(a.prioridade);
  if (diff !== 0) return diff;
  return Date.parse(b.horario) - Date.parse(a.horario);
}

/**
 * Garante ao menos {@link minimo} itens: se o filtro retornar menos, completa com as mais
 * críticas do conjunto completo (sem duplicar).
 */
export function garantirMinimoOcorrencias(
  filtradas: OcorrenciaDto[],
  todas: OcorrenciaDto[],
  minimo = 3,
): OcorrenciaDto[] {
  if (filtradas.length >= minimo) return filtradas;
  const ids = new Set(filtradas.map((o) => o.id));
  const extras = [...todas]
    .filter((o) => !ids.has(o.id))
    .sort(compararOcorrenciasPorCriticidade)
    .slice(0, minimo - filtradas.length);
  return [...filtradas, ...extras];
}

export function prioridadeOcorrenciaLabel(prioridade: PrioridadeOcorrencia): string {
  if (prioridade === 'URGENTE') return 'Critico';
  if (prioridade === 'ALTA') return 'Alta';
  if (prioridade === 'MEDIA') return 'Media';
  return 'Baixa';
}

export function prioridadeOcorrenciaTone(prioridade: PrioridadeOcorrencia): 'urgente' | 'alta' | 'media' | 'baixa' {
  if (prioridade === 'URGENTE') return 'urgente';
  if (prioridade === 'ALTA') return 'alta';
  if (prioridade === 'MEDIA') return 'media';
  return 'baixa';
}

export function statusOcorrencia(status: string | null | undefined): 'ABERTA' | 'RESOLVIDA' {
  return String(status ?? '').trim().toUpperCase() === 'RESOLVIDA' ? 'RESOLVIDA' : 'ABERTA';
}

export function statusOcorrenciaLabel(status: 'ABERTA' | 'RESOLVIDA'): string {
  return status === 'RESOLVIDA' ? 'Resolvida' : 'Aberta';
}

export function statusOcorrenciaTone(status: 'ABERTA' | 'RESOLVIDA'): 'resolvida' | 'aberta' {
  return status === 'RESOLVIDA' ? 'resolvida' : 'aberta';
}

/** Remove acentos e normaliza para busca insensível a diacríticos (ex.: "valvula" encontra "Válvula"). */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export type LinhaComentarioParsed = {
  quando: string;
  autor: string;
  texto: string;
  fotoUrl: string | null;
  anexos: string[];
};

/** Comentário novo (JSON) ou legado (`[data] autor: texto`). */
export function parseLinhaComentarioOcorrencia(linha: string): LinhaComentarioParsed {
  const t = linha.trim();
  if (t.startsWith('{')) {
    try {
      const j = JSON.parse(t) as { ts?: string; n?: string; e?: string; f?: string; m?: string; a?: string[] };
      const anexos = Array.isArray(j.a) ? j.a.filter((u): u is string => typeof u === 'string' && u.trim().length > 0) : [];
      return {
        quando: typeof j.ts === 'string' ? j.ts : '',
        autor: typeof j.n === 'string' && j.n.trim() ? j.n.trim() : 'Equipe',
        texto: typeof j.m === 'string' ? j.m : '',
        fotoUrl: typeof j.f === 'string' && j.f.trim() ? j.f.trim() : null,
        anexos,
      };
    } catch {
      return { quando: '', autor: 'Comentário', texto: t, fotoUrl: null, anexos: [] };
    }
  }
  const m = linha.match(/^\[(.+?)\]\s*(.+?):\s*(.*)$/);
  const legado = linha.match(/^\[(.+?)\]\s*(.*)$/);
  return {
    quando: m?.[1] ?? legado?.[1] ?? '',
    autor: (m?.[2] ?? 'Equipe Agrolink').trim(),
    texto: (m?.[3] ?? legado?.[2] ?? linha).trim(),
    fotoUrl: null,
    anexos: [],
  };
}
