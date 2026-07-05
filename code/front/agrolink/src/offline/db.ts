import { openDB, type DBSchema, type IDBPDatabase } from 'idb';
import type { OcorrenciaDto, NovaOcorrenciaInput } from '../api/ocorrenciasApi';
import type { RegistroOcorrenciaMapaDto } from '../api/fazendaApi';

export type OutboxItem = {
  clientUuid: string;
  payload: NovaOcorrenciaInput & { clientUuid: string };
  imageBlobs: Blob[];
  createdAt: string;
  status: 'pending' | 'syncing' | 'failed';
  error?: string;
};

export type SyncMeta = {
  key: string;
  value: string;
};

interface AgrolinkOfflineDB extends DBSchema {
  ocorrencias: {
    key: number;
    value: OcorrenciaDto & { clientUuid?: string | null; pendingSync?: boolean };
    indexes: { 'by-clientUuid': string };
  };
  outbox: {
    key: string;
    value: OutboxItem;
  };
  fazendaMapa: {
    key: string;
    value: RegistroOcorrenciaMapaDto & { id: string; cachedAt: string };
  };
  meta: {
    key: string;
    value: SyncMeta;
  };
}

const DB_NAME = 'agrolink-offline';
const DB_VERSION = 2;

let dbPromise: Promise<IDBPDatabase<AgrolinkOfflineDB>> | null = null;

export function getOfflineDb() {
  if (!dbPromise) {
    dbPromise = openDB<AgrolinkOfflineDB>(DB_NAME, DB_VERSION, {
      upgrade(db, oldVersion) {
        if (oldVersion < 1) {
          const occ = db.createObjectStore('ocorrencias', { keyPath: 'id' });
          occ.createIndex('by-clientUuid', 'clientUuid', { unique: false });
          db.createObjectStore('outbox', { keyPath: 'clientUuid' });
          db.createObjectStore('fazendaMapa', { keyPath: 'id' });
          db.createObjectStore('meta', { keyPath: 'key' });
        } else if (oldVersion < 2) {
          if (db.objectStoreNames.contains('fazendaMapa')) {
            db.deleteObjectStore('fazendaMapa');
          }
          if (db.objectStoreNames.contains('meta')) {
            db.deleteObjectStore('meta');
          }
          db.createObjectStore('fazendaMapa', { keyPath: 'id' });
          db.createObjectStore('meta', { keyPath: 'key' });
        }
      },
    });
  }
  return dbPromise;
}

export async function clearOfflineData() {
  const db = await getOfflineDb();
  await Promise.all([
    db.clear('ocorrencias'),
    db.clear('outbox'),
    db.clear('fazendaMapa'),
    db.clear('meta'),
  ]);
}
