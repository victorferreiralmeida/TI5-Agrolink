const JSON_HEADERS = { 'Content-Type': 'application/json' };

function authJson(token: string): HeadersInit {
  return { ...JSON_HEADERS, Authorization: `Bearer ${token}` };
}

async function readApiError(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return `Erro ${res.status}`;
  try {
    const j = JSON.parse(text) as { message?: string; detail?: string; error?: string; status?: number };
    if (typeof j.message === 'string' && j.message.trim()) return j.message.trim();
    if (typeof j.detail === 'string' && j.detail.trim()) return j.detail.trim();
    if (typeof j.error === 'string' && j.error.trim()) {
      const code = typeof j.status === 'number' ? ` (${j.status})` : '';
      return `${j.error.trim()}${code}`;
    }
  } catch {
    /* ignore */
  }
  return text.length > 200 ? `Erro ${res.status}` : text;
}

export type FazendaSetorDto = {
  id: number;
  nome: string;
  poligonoGeojson: string | null;
};

export type FazendaDto = {
  id: number;
  nome: string;
  perimetroGeojson: string | null;
  setores: FazendaSetorDto[];
};

export type SetorRegistroDto = {
  id: number;
  nome: string;
  fazendaNome: string;
  /** GeoJSON `Polygon` quando o gerente cadastrou polígono do setor; senão `null`. */
  poligonoGeojson: string | null;
};

export type FazendaMapaRegistroDto = {
  id: number;
  nome: string;
  perimetroGeojson: string | null;
};

export type RegistroOcorrenciaMapaDto = {
  fazendas: FazendaMapaRegistroDto[];
  setores: SetorRegistroDto[];
};

/** 404 = gerente ainda sem fazenda cadastrada. */
export async function fetchMinhaFazenda(token: string): Promise<FazendaDto | null> {
  const res = await fetch('/api/fazenda/me', { headers: authJson(token) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<FazendaDto>;
}

export async function salvarMinhaFazenda(
  token: string,
  body: { nome: string; perimetroGeojson?: string | null },
): Promise<FazendaDto> {
  const res = await fetch('/api/fazenda/me', {
    method: 'PUT',
    headers: authJson(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<FazendaDto>;
}

export async function criarSetorFazenda(
  token: string,
  body: { nome: string; poligonoGeojson?: string | null },
): Promise<FazendaSetorDto> {
  const res = await fetch('/api/fazenda/me/setores', {
    method: 'POST',
    headers: authJson(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<FazendaSetorDto>;
}

export async function atualizarSetorFazenda(
  token: string,
  setorId: number,
  body: { nome: string; poligonoGeojson?: string | null },
): Promise<FazendaSetorDto> {
  const res = await fetch(`/api/fazenda/me/setores/${setorId}`, {
    method: 'PUT',
    headers: authJson(token),
    body: JSON.stringify(body),
  });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<FazendaSetorDto>;
}

export async function removerSetorFazenda(token: string, setorId: number): Promise<void> {
  const res = await fetch(`/api/fazenda/me/setores/${setorId}`, {
    method: 'DELETE',
    headers: authJson(token),
  });
  if (!res.ok) throw new Error(await readApiError(res));
}

export async function fetchSetoresParaRegistro(token: string): Promise<SetorRegistroDto[]> {
  const res = await fetch('/api/fazenda/setores-registro', { headers: authJson(token) });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<SetorRegistroDto[]>;
}

/** Perímetros das fazendas + setores para centralizar o mapa e desenhar contornos ao registrar ocorrência. */
export async function fetchMapaRegistroOcorrencia(token: string): Promise<RegistroOcorrenciaMapaDto> {
  const res = await fetch('/api/fazenda/registro-ocorrencia-mapa', { headers: authJson(token) });
  if (!res.ok) throw new Error(await readApiError(res));
  return res.json() as Promise<RegistroOcorrenciaMapaDto>;
}
