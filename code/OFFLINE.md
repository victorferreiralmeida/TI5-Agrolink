# Modo offline — AGROLINK

Branch **`feature/offline-support`**: suporte offline-first para uso em campo (sem sinal).

## Estratégia

Padrão **cache local + outbox + sync incremental**:

| Camada | Tecnologia | Escopo offline |
|--------|------------|--------------|
| **Back-end** | `clientUuid` + `updatedAt` + `GET /api/ocorrencias?since=` | Idempotência e delta sync |
| **Web** | IndexedDB (`idb`) + PWA (`vite-plugin-pwa`) | Listar/criar ocorrências; cache do mapa da fazenda |
| **Mobile** | SQLite (`sqflite`) + `connectivity_plus` | Listar/criar ocorrências; cache do mapa da fazenda |

### Fora do escopo (fase 1)

- Chat, notificações e equipe continuam **online-only**
- Resolver/comentar ocorrências offline (somente **criação** na outbox)

## Como testar

### Web

```powershell
cd code\front\agrolink
npm install
npm run dev
```

1. Faça login e abra **Ocorrências** (popula o cache).
2. No DevTools → **Network** → marque **Offline**.
3. Registre uma nova ocorrência em **Registrar** — ela aparece na lista com sync pendente.
4. Volte online — a faixa inferior sincroniza automaticamente.

### Mobile

```powershell
cd code\mobile\agrolink
flutter pub get
flutter run
```

1. Login + abra Ocorrências (cache).
2. Ative modo avião no emulador/dispositivo.
3. Registre ocorrência — mensagem “salva offline”.
4. Desative modo avião — sync automático na reconexão.

## API (back-end)

- `POST /api/ocorrencias` aceita `clientUuid` (UUID v4) — reenvio idempotente.
- `GET /api/ocorrencias?since=2026-05-31T12:00:00Z` — delta sync.

## Contas demo

Inalteradas — ver `code/README.md`.
