# Front-end — AGROLINK

SPA **React 19** + **TypeScript** + **Vite 7**, consumindo a API Spring Boot via **proxy** em desenvolvimento.

O aplicativo web fica em **`agrolink/`** (esta pasta é o “módulo front” do monorepo).

Documentação do monorepo: [`../README.md`](../README.md) · Back-end: [`../back/README.md`](../back/README.md) · Mobile: [`../mobile/README.md`](../mobile/README.md) · Projeto: [`../../README.md`](../../README.md)

---

## Pré-requisitos

| Ferramenta | Uso |
|------------|-----|
| **Node.js** | LTS (v18+) |
| **npm** | Dependências e scripts |
| **JDK 21** | Opcional aqui — `npm run dev` sobe o backend via Gradle |

---

## Início rápido (recomendado)

Sobe **API (8080) + Vite (5173)** em um comando:

```bash
cd code/front/agrolink
npm install
npm run dev
```

| Serviço | URL |
|---------|-----|
| Interface web | http://localhost:5173 |
| API (proxy `/api`) | http://localhost:8080 |
| H2 Console (proxy) | http://localhost:8080/h2-console |

### Só o front (API já rodando)

```bash
cd code/front/agrolink
npm run dev:web
```

### Só a API (sem Vite)

```bash
cd code/front/agrolink
npm run dev:api
```

Usa `scripts/start-backend.mjs` (define `SPRING_PROFILES_ACTIVE=dev` e reutiliza backend saudável na porta 8080).

---

## Variáveis de ambiente

Lidas pelo Vite (`vite.config.ts`). Arquivo opcional: `code/front/agrolink/.env.local`

| Variável | Descrição | Padrão |
|----------|-----------|--------|
| `AGROLINK_API_URL` | Origem do Spring Boot para o proxy | `http://localhost:8080` |

Exemplo se a API estiver na 8081:

```env
AGROLINK_API_URL=http://localhost:8081
```

No backend, use `SERVER_PORT=8081` (ou equivalente).

### Proxy (desenvolvimento)

O Vite encaminha para o backend:

- `/api` → API REST
- `/h2-console` → console H2
- `/uploads` → arquivos enviados

---

## Scripts npm (`agrolink/package.json`)

| Script | Descrição |
|--------|-----------|
| `npm run dev` | API + Vite (`concurrently`) |
| `npm run dev:web` | Apenas Vite |
| `npm run dev:api` | Apenas Spring Boot |
| `npm run demo:tunnel` | Túnel ngrok → https://zoom-gallstone-bootleg.ngrok-free.dev (com `npm run dev` ativo) |
| `npm run build` | Build de produção → `dist/` |
| `npm run preview` | Preview do build (porta 4173, com proxy) |

---

## Rotas da aplicação

Definidas em `agrolink/src/App.tsx`:

| Rota | Tela | Autenticação |
|------|------|----------------|
| `/` | Landing (início) | Pública |
| `/login` | Login | Pública |
| `/cadastro` | Cadastro | Pública |
| `/dashboard` | Painel | Protegida |
| `/fazenda` | Minha fazenda (perímetro/setores) | Protegida |
| `/ocorrencias` | Lista de ocorrências | Protegida |
| `/ocorrencias/:id` | Detalhe da ocorrência | Protegida |
| `/mapa` | Mapa (Leaflet) | Protegida |
| `/registrar` | Nova ocorrência | Protegida |
| `/mensagens` | Chat (polling ~4,5 s) | Protegida |
| `/equipe` | Equipe e convites | Protegida |
| `/relatorios` | Relatórios (CSV/PDF) | Protegida |
| `/notificacoes` | Notificações | Protegida |
| `/perfil` | Perfil do usuário | Protegida |

Rotas protegidas usam `RequireAuth` + `AuthContext` (token em `localStorage`).

---

## Estrutura (`agrolink/src/`)

```
src/
├── api/              # Clientes HTTP (auth, ocorrências, chat, equipe, fazenda…)
├── auth/             # AuthContext
├── components/       # Header, shell, ícones, avatar…
├── geo/              # Geometria do mapa da fazenda
├── layouts/          # RootLayout
├── pages/            # Uma página por rota
├── theme/            # Tema claro/escuro
├── types/            # Tipos TypeScript da API
└── utils/            # PDF, máscaras, força de senha…
```

### Stack principal

| Pacote | Uso |
|--------|-----|
| `react` / `react-dom` | UI |
| `react-router-dom` | Rotas |
| `leaflet` / `react-leaflet` | Mapas (tiles Esri / OSM) |
| `jspdf` / `jspdf-autotable` | Relatórios PDF |
| `vite` | Build e dev server |

---

## Build para produção

```bash
cd code/front/agrolink
npm run build
```

Saída em `dist/`. Para a **apresentação Sprint 5**, o fluxo adotado é **ngrok + `npm run dev`** (web e API juntos), não build estático isolado. Ver [`../README.md`](../README.md#demonstração-pública-apresentação).

---

## Demonstração (apresentação)

1. RabbitMQ: `docker run -d --name agrolink-rabbit -p 5672:5672 -p 15672:15672 rabbitmq:3-management`
2. `npm run dev` nesta pasta
3. `npm run demo:tunnel` → https://zoom-gallstone-bootleg.ngrok-free.dev
4. Login: `gerente1@agrolink.demo` / `AgrolinkDemo1!`

O proxy do Vite encaminha `/api` e `/uploads` — por isso o link ngrok na porta **5173** expõe a aplicação completa.

---

## Logins demo

Use contas `@agrolink.demo` (senha `AgrolinkDemo1!`) com o backend no perfil `dev`. Detalhes: [`../back/README.md`](../back/README.md#seed-de-equipe-demo).

---

## Referências

- [React](https://react.dev/)
- [Vite](https://vitejs.dev/)
- [Leaflet](https://leafletjs.com/)
- Wireframes: [`../../docs/5.wireframe.md`](../../docs/5.wireframe.md)
