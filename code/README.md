# Código — AGROLINK

Monorepo com três módulos que compartilham a mesma **API REST** (Spring Boot):

| Módulo | Pasta | Documentação |
|--------|--------|----------------|
| **Back-end** | [`back/`](back/) | [`back/README.md`](back/README.md) |
| **Front-end (web)** | [`front/agrolink/`](front/agrolink/) | [`front/README.md`](front/README.md) |
| **Mobile (Flutter)** | [`mobile/agrolink/`](mobile/agrolink/) | [`mobile/README.md`](mobile/README.md) |

Documentação acadêmica (requisitos, diagramas, wireframes): [`../docs/`](../docs/) · Visão geral do projeto: [`../README.md`](../README.md)

---

## Pré-requisitos

| Ferramenta | Obrigatório para |
|------------|------------------|
| **JDK 21** | Back-end |
| **Node.js + npm** | Scripts `npm run dev` (web e mobile) |
| **Flutter (stable)** | Apenas mobile |
| **MySQL 8+** | Opcional — perfil `mysql` no Spring |

Desenvolvimento local padrão: banco **H2 em arquivo** (perfil Spring `dev`).

---

## Como subir o projeto

### Opção 1 — Web + API (mais usada)

```bash
cd code/front/agrolink
npm install
npm run dev
```

| Serviço | URL |
|---------|-----|
| SPA (Vite) | http://localhost:5173 |
| API | http://localhost:8080 |
| Proxy | `/api`, `/h2-console`, `/uploads` → backend |

Detalhes: [`front/README.md`](front/README.md).

### Opção 2 — Mobile + API

```bash
cd code/mobile
npm install
npm run dev
```

Requer emulador Android ou dispositivo conectado. Detalhes: [`mobile/README.md`](mobile/README.md).

### Opção 3 — Só o back-end

```bash
cd code/back
set SPRING_PROFILES_ACTIVE=dev    # Windows
.\gradlew.bat bootRun
```

> Sem `SPRING_PROFILES_ACTIVE=dev`, o `bootRun` tenta **MySQL** (`application.properties`). Os scripts `npm run dev` do front/mobile ativam `dev` automaticamente.

Detalhes: [`back/README.md`](back/README.md).

### Porta da API diferente de 8080

```bash
set SERVER_PORT=8081
set AGROLINK_API_URL=http://localhost:8081
```

---

## Demonstração pública (apresentação)

Link público para o professor acessar **web + API** sem deploy em nuvem: [ngrok](https://ngrok.com) expõe o Vite (`5173`), que faz proxy de `/api` e `/uploads` para o Spring Boot local.

### Antes da aula (checklist)

1. **RabbitMQ** (chat com mensageria):

```bash
docker run -d --name agrolink-rabbit -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

2. **Subir web + API:**

```bash
cd code/front/agrolink
npm install
npm run dev
```

3. **Túnel público** (outro terminal, na pasta `code/front/agrolink`):

```bash
npm run demo:tunnel
```

URL fixo: **https://zoom-gallstone-bootleg.ngrok-free.dev**

4. **Testar pelo celular/4G** (não só no Wi‑Fi da máquina): login `gerente1@agrolink.demo` / `AgrolinkDemo1!`.

> O link só funciona com o notebook **ligado**, Docker/ngrok/`npm run dev` **ativos**.

### Roteiro sugerido (web)

| # | Tela | O que mostrar |
|---|------|----------------|
| 1 | `/login` | Login gerente |
| 2 | `/dashboard` | KPIs e mapa resumido |
| 3 | `/mapa` | Ocorrências georreferenciadas |
| 4 | `/ocorrencias` | Lista e detalhe |
| 5 | `/registrar` | Nova ocorrência |
| 6 | `/mensagens` | Chat da equipe (mensagem + RabbitMQ no log do back) |
| 7 | `/equipe` | Membros e convites |
| 8 | `/relatorios` | Gráficos e exportação |

Mobile (opcional): `cd code/mobile && npm run dev` com `campo1@agrolink.demo`.

---

## Primeiro `npm run dev` em uma máquina nova

Tudo é resolvido automaticamente:

1. **Porta 8080 ocupada por backend antigo** — o script `start-backend.mjs` espera o `/api/health` por 12s; se não responder, **encerra o processo** travado (Windows: `taskkill /F`; Linux/macOS: `kill -9`) e sobe um novo backend.
2. **Banco H2 inconsistente entre máquinas** — o `DemoFazendaSeed` na inicialização:
   - Cria/atualiza a fazenda demo (Parque das Mangabeiras) e seus 3 setores.
   - **Reaponta os usuários `@agrolink.demo` para a fazenda demo**, sobrescrevendo vínculos antigos a fazendas removidas (causa comum de “tela vazia” em clones).
   - Reativa contas demo desativadas e migra ocorrências antigas para o setor correto.
3. **Perfil `dev` e seed demo** — ativados por padrão pelo script (`SPRING_PROFILES_ACTIVE=dev`, `agrolink.demo-seed=true`).

Se mesmo assim algo parecer estranho (banco H2 muito antigo, schema corrompido), o reset duro é:

```bash
# Backend parado
rm -rf code/back/data        # Linux/macOS
Remove-Item code\back\data -Recurse -Force   # Windows
```

Depois `npm run dev` recria o ambiente do zero.

---

## Arquitetura (visão do monorepo)

```
┌─────────────────┐     ┌─────────────────┐
│  React (Vite)   │     │  Flutter App    │
│  localhost:5173 │     │  emulador/device│
└────────┬────────┘     └────────┬────────┘
         │ proxy /api            │ HTTP direto
         └──────────┬────────────┘
                    ▼
         ┌──────────────────────┐
         │  Spring Boot :8080   │
         │  REST + uploads      │
         └──────────┬───────────┘
                    ▼
         ┌──────────────────────┐
         │  H2 (dev) / MySQL    │
         └──────────────────────┘
```

- **Monólito modular** no backend (controllers → services → JPA).
- **Chat:** mensageria **RabbitMQ** no backend; atualização por **polling** na web/mobile.
- **Mapas:** Leaflet (web) — não Google Maps API.
- **Auth MVP:** token `agrolink-{id}` — ver [`back/README.md`](back/README.md#autenticação-mvp-acadêmico).

---

## Contas de demonstração

Com perfil **`dev`** e `agrolink.demo-seed=true` (padrão):

| Papel | E-mail | Senha |
|--------|--------|--------|
| Produtor | `produtor@agrolink.demo` | `AgrolinkDemo1!` |
| Gerente | `gerente1@agrolink.demo`, `gerente2@agrolink.demo` | mesma senha |
| Campo | `campo1@agrolink.demo` … `campo5@agrolink.demo` | mesma senha |

Seed, H2 e perfis MySQL: [`back/README.md`](back/README.md).

---

## Testes (back-end)

```bash
cd code/back
.\gradlew.bat test
```

Relatório: `code/back/build/reports/tests/test/index.html` · Cenários ATAM: [`../docs/7.avaliacao.md`](../docs/7.avaliacao.md).

---

## Estrutura de pastas

```
code/
├── README.md           ← este arquivo (índice)
├── back/
│   ├── README.md       ← API, perfis, endpoints, testes
│   ├── src/main/java/…
│   ├── data/           ← H2 (runtime, dev)
│   └── uploads/        ← mídias (runtime)
├── front/
│   ├── README.md       ← React/Vite, rotas, proxy
│   └── agrolink/       ← projeto npm
│       ├── src/
│       ├── vite.config.ts
│       └── scripts/start-backend.mjs
└── mobile/
    ├── README.md       ← Flutter, emulador, npm run dev
    ├── package.json
    └── agrolink/       ← projeto Flutter
        └── lib/
```

---

## Onde ler mais

| Tema | Arquivo |
|------|---------|
| Endpoints REST completos | [`back/README.md`](back/README.md) |
| Rotas da SPA e build Vite | [`front/README.md`](front/README.md) |
| Emulador, `API_BASE_URL`, troubleshooting | [`mobile/README.md`](mobile/README.md) |
| Requisitos funcionais | [`../docs/3.requisitos.md`](../docs/3.requisitos.md) |
| Modelagem e diagramas | [`../docs/4.modelagem.md`](../docs/4.modelagem.md) |
