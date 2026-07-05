import {
  criarOcorrencia,
  fetchOcorrencias,
  fetchOcorrenciasSince,
  uploadOcorrenciaImagens,
  type NovaOcorrenciaInput,
  type OcorrenciaDto,
} from '../api/ocorrenciasApi';
import { fetchMapaRegistroOcorrencia, type RegistroOcorrenciaMapaDto } from '../api/fazendaApi';
import { getOfflineDb, type OutboxItem } from './db';
import { isOnline, subscribeConnectivity } from './connectivity';
import { emitSyncEvent } from './syncEvents';

export type ListResult = {
  items: OcorrenciaDto[];
  fromCache: boolean;
  pendingCount: number;
};

export type CreateResult = {
  ocorrencia: OcorrenciaDto;
  queued: boolean;
};

function newClientUuid(): string {
  return crypto.randomUUID();
}

function localIdFromUuid(uuid: string): number {
  let hash = 0;
  for (let i = 0; i < uuid.length; i++) {
    hash = (hash * 31 + uuid.charCodeAt(i)) | 0;
  }
  return -Math.abs(hash || 1);
}

function buildLocalOcorrencia(input: NovaOcorrenciaInput & { clientUuid: string }, setorNome?: string): OcorrenciaDto {
  return {
    id: localIdFromUuid(input.clientUuid),
    titulo: input.titulo,
    setor: setorNome ?? input.setor,
    setorFazendaId: input.setorId ?? null,
    categoria: input.categoria,
    prioridade: input.prioridade,
    descricao: input.descricao ?? null,
    status: 'ABERTA',
    comentarios: null,
    coordsX: input.coordsX,
    coordsY: input.coordsY,
    horario: input.horario ?? new Date().toISOString(),
    responsavelId: null,
    responsavelNome: null,
    imagens: [],
    clientUuid: input.clientUuid,
    updatedAt: new Date().toISOString(),
    pendingSync: true,
  };
}

async function replaceOcorrenciasCache(items: OcorrenciaDto[]) {
  const db = await getOfflineDb();
  const tx = db.transaction('ocorrencias', 'readwrite');
  await tx.store.clear();
  for (const item of items) {
    if (item.pendingSync) continue;
    await tx.store.put({ ...item, pendingSync: false });
  }
  await tx.done;
}

async function mergeIntoCache(items: OcorrenciaDto[]) {
  const db = await getOfflineDb();
  const tx = db.transaction('ocorrencias', 'readwrite');
  for (const item of items) {
    if (item.pendingSync) continue;
    await tx.store.put({ ...item, pendingSync: false });
  }
  await tx.done;
}

async function readCachedOcorrencias(): Promise<OcorrenciaDto[]> {
  const db = await getOfflineDb();
  return db.getAll('ocorrencias');
}

async function getLastSync(): Promise<string | null> {
  const db = await getOfflineDb();
  const meta = await db.get('meta', 'lastSync');
  return meta?.value ?? null;
}

async function setLastSync(iso: string) {
  const db = await getOfflineDb();
  await db.put('meta', { key: 'lastSync', value: iso });
}

export async function listOcorrencias(token: string): Promise<ListResult> {
  const db = await getOfflineDb();
  const pendingCount = (await db.getAll('outbox')).filter((o) => o.status !== 'syncing').length;

  if (isOnline()) {
    try {
      const lastSync = await getLastSync();
      let remote = lastSync
        ? await fetchOcorrenciasSince(token, lastSync)
        : await fetchOcorrencias(token);
      const cachedBefore = await readCachedOcorrencias();
      if (lastSync && remote.length === 0 && cachedBefore.length === 0) {
        remote = await fetchOcorrencias(token);
        await replaceOcorrenciasCache(remote);
      } else if (!lastSync) {
        await replaceOcorrenciasCache(remote);
      } else if (remote.length > 0) {
        await mergeIntoCache(remote);
      }
      await setLastSync(new Date().toISOString());
      const cached = await readCachedOcorrencias();
      return { items: sortOcorrencias(cached), fromCache: false, pendingCount };
    } catch {
      const cached = await readCachedOcorrencias();
      if (cached.length > 0) {
        return { items: sortOcorrencias(cached), fromCache: true, pendingCount };
      }
      throw new Error('Sem conexão e nenhum dado em cache.');
    }
  }

  const cached = await readCachedOcorrencias();
  return { items: sortOcorrencias(cached), fromCache: true, pendingCount };
}

function sortOcorrencias(items: OcorrenciaDto[]): OcorrenciaDto[] {
  return [...items].sort((a, b) => Date.parse(b.horario) - Date.parse(a.horario));
}

export async function getOcorrenciaCached(id: number): Promise<OcorrenciaDto | undefined> {
  const db = await getOfflineDb();
  return db.get('ocorrencias', id);
}

export async function createOcorrenciaOffline(
  input: NovaOcorrenciaInput,
  images: File[],
  token: string,
  setorNome?: string,
): Promise<CreateResult> {
  const clientUuid = newClientUuid();
  const payload = { ...input, clientUuid };

  if (isOnline()) {
    try {
      const criada = await criarOcorrencia(payload, token);
      if (images.length > 0) {
        await uploadOcorrenciaImagens(criada.id, images, token);
      }
      await mergeIntoCache([{ ...criada, pendingSync: false }]);
      return { ocorrencia: criada, queued: false };
    } catch (err) {
      if (!isNetworkError(err)) throw err;
    }
  }

  const local = buildLocalOcorrencia(payload, setorNome);
  const outboxItem: OutboxItem = {
    clientUuid,
    payload,
    imageBlobs: images,
    createdAt: new Date().toISOString(),
    status: 'pending',
  };

  const db = await getOfflineDb();
  await db.put('ocorrencias', local);
  await db.put('outbox', outboxItem);

  return { ocorrencia: local, queued: true };
}

function isNetworkError(err: unknown): boolean {
  if (err instanceof TypeError) return true;
  if (err instanceof Error && /fetch|network|Failed to fetch/i.test(err.message)) return true;
  return false;
}

export async function getPendingCount(): Promise<number> {
  const db = await getOfflineDb();
  return (await db.getAll('outbox')).filter((o) => o.status === 'pending' || o.status === 'failed' || o.status === 'syncing').length;
}

let flushing = false;

export async function flushOutbox(token: string): Promise<number> {
  if (!isOnline() || flushing) return 0;
  const db = await getOfflineDb();
  const pending = (await db.getAll('outbox')).filter((o) => o.status === 'pending' || o.status === 'failed');
  if (pending.length === 0) return 0;

  flushing = true;
  emitSyncEvent({ type: 'sync-start' });
  let synced = 0;

  try {
    for (const item of pending) {
      item.status = 'syncing';
      await db.put('outbox', item);
      try {
        const criada = await criarOcorrencia(item.payload, token);
        if (item.imageBlobs.length > 0) {
          const files = item.imageBlobs.map(
            (blob, i) => new File([blob], `offline-${i}.jpg`, { type: blob.type || 'image/jpeg' }),
          );
          await uploadOcorrenciaImagens(criada.id, files, token);
        }
        await db.delete('outbox', item.clientUuid);
        const oldId = localIdFromUuid(item.clientUuid);
        await db.delete('ocorrencias', oldId);
        await mergeIntoCache([{ ...criada, pendingSync: false }]);
        synced++;
      } catch (err) {
        item.status = 'failed';
        item.error = err instanceof Error ? err.message : 'Falha ao sincronizar';
        await db.put('outbox', item);
      }
    }

    if (synced > 0) {
      await setLastSync(new Date().toISOString());
      emitSyncEvent({ type: 'sync-complete', syncedCount: synced });
    }
  } finally {
    flushing = false;
    emitSyncEvent({ type: 'sync-idle' });
  }

  return synced;
}

export function initOfflineSync(token: string | null, onSynced?: (count: number) => void) {
  if (!token) return () => {};
  const run = async () => {
    if (!isOnline()) return;
    const count = await flushOutbox(token);
    if (count > 0) onSynced?.(count);
  };
  void run();
  const unsub = subscribeConnectivityOnline(run);
  const interval = window.setInterval(run, 8_000);
  return () => {
    unsub();
    window.clearInterval(interval);
  };
}

const FAZENDA_MAPA_CACHE_ID = 'current';

function subscribeConnectivityOnline(fn: () => void) {
  return subscribeConnectivity((online) => {
    if (online) void fn();
  });
}

async function cacheFazendaMapa(data: RegistroOcorrenciaMapaDto): Promise<void> {
  try {
    const db = await getOfflineDb();
    await db.put('fazendaMapa', {
      id: FAZENDA_MAPA_CACHE_ID,
      ...data,
      cachedAt: new Date().toISOString(),
    });
  } catch {
    /* cache opcional — não bloqueia o fluxo online */
  }
}

export async function getCachedFazendaMapa(): Promise<RegistroOcorrenciaMapaDto | null> {
  const db = await getOfflineDb();
  const cached = await db.get('fazendaMapa', FAZENDA_MAPA_CACHE_ID);
  if (!cached) return null;
  const { id: _id, cachedAt: _c, ...data } = cached;
  return data;
}

export async function loadFazendaMapa(token: string): Promise<RegistroOcorrenciaMapaDto> {
  if (isOnline()) {
    try {
      const data = await fetchMapaRegistroOcorrencia(token);
      await cacheFazendaMapa(data);
      return data;
    } catch (err) {
      const cached = await getCachedFazendaMapa();
      if (cached) return cached;
      throw err instanceof Error ? err : new Error('Não foi possível carregar os setores da fazenda.');
    }
  }
  const cached = await getCachedFazendaMapa();
  if (cached) return cached;
  throw new Error('Sem conexão. Conecte-se uma vez para baixar os dados da fazenda.');
}
