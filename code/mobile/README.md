# Mobile — AGROLINK

Aplicativo **Flutter** para uso em campo: login, mapa, ocorrências, mensagens e perfil. Consome a mesma API REST do back-end Spring Boot.

O projeto Flutter fica em **`agrolink/`**.

Documentação do monorepo: [`../README.md`](../README.md) · Back-end: [`../back/README.md`](../back/README.md) · Front-end: [`../front/README.md`](../front/README.md) · Projeto: [`../../README.md`](../../README.md)

---

## Pré-requisitos

| Ferramenta | Para quê |
|------------|----------|
| **Flutter** (stable) | SDK — [instalação](https://docs.flutter.dev/get-started/install) |
| **Android Studio** | SDK Android, emulador, plugins Flutter/Dart |
| **JDK 21** | Backend (Gradle) |

Após instalar:

```powershell
flutter doctor
flutter doctor --android-licenses
```

### Emulador Android (recomendado)

1. Android Studio → **Device Manager** → **Create Device** (ex.: Pixel 6, API 34+).
2. Inicie o emulador **antes** de `npm run dev` ou `flutter run`.
3. Confirme: `cd agrolink && flutter devices`.

---

## Web + mobile ao mesmo tempo (forma certa)

**Só pode existir um backend (porta 8080) por máquina.** Web e mobile compartilham a mesma API.

### Recomendado — 2 terminais

| Terminal | Pasta | Comando | O que sobe |
|----------|--------|---------|------------|
| **1** | `code/front/agrolink` | `npm run dev` | API (8080) + site (5173) |
| **2** | `code/mobile` | `npm run dev:flutter` | Só o app Flutter |

```powershell
# Terminal 1 — web + API
cd code\front\agrolink
npm install   # só na 1ª vez
npm run dev

# Terminal 2 — mobile (com a API do terminal 1 já no ar)
cd code\mobile
npm install   # só na 1ª vez
npm run dev:flutter
```

**Antes do terminal 2:** emulador Android ligado ou celular com depuração USB.

### Evite — `npm run dev` nos dois ao mesmo tempo

Rodar `npm run dev` no **web** e no **mobile** juntos faz os **dois** scripts tentarem cuidar da API. O segundo costuma **reutilizar** a porta 8080 (não sobe outro Spring), mas gera processo extra e, em máquinas lentas ou na primeira subida, ainda pode dar conflito.

| Situação | Use |
|----------|-----|
| Só mobile, sem web aberto | `cd code/mobile` → `npm run dev` (sobe API + Flutter) |
| Web **e** mobile juntos | Terminal 1: `npm run dev` no **front** · Terminal 2: `npm run dev:flutter` no **mobile** |
| API já rodando (outro colega ou terminal 1) | `npm run dev:flutter` |

---

## Início rápido (só mobile)

Um comando sobe backend e app (quando o web **não** está rodando):

```powershell
cd code\mobile
npm install
npm run dev
```

### Navegador (Chrome) — um comando

Sobe API + Flutter Web no Chrome (funciona no CMD, PowerShell e bash):

```powershell
cd code\mobile
npm run dev:chrome
```

Se a API **já** estiver no ar (ex.: `npm run dev` no front):

```powershell
npm run dev:flutter:chrome
```

Não precisa mais de `set MOBILE_TARGET=chrome` — o script detecta `-d chrome` e usa `http://127.0.0.1:8080` automaticamente.

1. **[api]** — Spring Boot em `code/back` (perfil `dev`, porta 8080), ou reutiliza API já saudável.
2. **[mobile]** — Aguarda `/api/health` e executa `flutter run` com `API_BASE_URL` adequada.

### Variáveis (`npm run dev` / `dev:flutter`)

| Variável | Padrão | Descrição |
|----------|--------|-----------|
| `MOBILE_TARGET` | `emulator` | `emulator` · `physical` · `windows` |
| `MOBILE_LAN_IP` | — | Obrigatório se `MOBILE_TARGET=physical` (IPv4 do PC) |
| `MOBILE_API_BASE_URL` | — | Sobrescreve URL completa |
| `AGROLINK_API_URL` | — | Altera porta detectada pelo script da API |

Exemplos:

```powershell
# Celular físico na mesma Wi‑Fi
$env:MOBILE_TARGET = "physical"
$env:MOBILE_LAN_IP = "192.168.0.15"
npm run dev

# Só Flutter (API já no ar)
npm run dev:flutter
```

Device específico:

```powershell
npm run dev:flutter -- -d emulator-5554
```

---

## Execução manual

### 1) Subir a API (porta 8080)

| Opção | Comando | Depois, no mobile |
|-------|---------|-------------------|
| A — **Web + API** (recomendado se for usar os dois) | `cd code/front/agrolink && npm run dev` | `cd code/mobile && npm run dev:flutter` |
| B — Só API | `cd code/back` + `SPRING_PROFILES_ACTIVE=dev` + `gradlew bootRun` | `flutter run` com `API_BASE_URL` |
| C — API pelo script mobile | `cd code/mobile && npm run dev:api` | `npm run dev:flutter` |

Teste: http://localhost:8080/api/health → `"status":"UP"`.

### 2) Rodar o app

```powershell
cd code\mobile\agrolink
flutter pub get
flutter run --dart-define=API_BASE_URL=http://10.0.2.2:8080
```

| Onde roda | `API_BASE_URL` |
|-----------|----------------|
| Emulador Android | `http://10.0.2.2:8080` |
| Celular físico (mesma Wi‑Fi) | `http://SEU_IP_LAN:8080` |
| `flutter run -d windows` | `http://127.0.0.1:8080` |

Atalhos no terminal: **r** = hot reload · **R** = restart · **q** = sair.

---

## Scripts npm (`code/mobile`)

| Comando | Efeito |
|---------|--------|
| `npm run dev` | API + `flutter run` (emulador Android por padrão) |
| `npm run dev:chrome` | API + Flutter no Chrome |
| `npm run dev:api` | Só Spring Boot |
| `npm run dev:flutter` | Só Flutter |
| `npm run dev:flutter:chrome` | Só Flutter no Chrome (API já no ar) |
| `npm run devices` | `flutter devices` |
| `npm run emulators` | `flutter emulators` |

O script de API é compartilhado: [`../front/agrolink/scripts/start-backend.mjs`](../front/agrolink/scripts/start-backend.mjs).

---

## Telas (Flutter)

Navegação em `agrolink/lib/main.dart` — após login, **BottomNavigationBar** com 5 abas:

| Índice | Aba | Arquivo principal |
|--------|-----|-------------------|
| 0 | Home | `screens/home_screen.dart` |
| 1 | Mapa | `screens/mapa_screen.dart` |
| 2 | Mensagens | `screens/mensagens_screen.dart` |
| 3 | Ocorrências | `screens/ocorrencias_screen.dart` (+ `registrar_ocorrencia_screen.dart`) |
| 4 | Perfil | `screens/perfil_screen.dart` |

Login/cadastro: `login_screen.dart`, `cadastro_screen.dart`.

---

## Estrutura (`agrolink/`)

```
agrolink/
├── lib/
│   ├── main.dart
│   ├── config/api_config.dart   # API_BASE_URL (--dart-define)
│   ├── models/
│   ├── screens/
│   ├── services/                # api_service, ocorrencias_api, fazenda_api…
│   └── geo/
├── android/ / ios/ / windows/ …
└── pubspec.yaml
```

URL da API: `lib/config/api_config.dart`, sobrescrita com `--dart-define=API_BASE_URL=...`.

---

## Android Studio (opcional)

1. **File → Open** → pasta `code/mobile/agrolink` (onde está o `pubspec.yaml`).
2. Plugins **Flutter** e **Dart**.
3. Emulador ligado → **Run ▶**.

**Run → Edit Configurations** → *Additional run args*:

```text
--dart-define=API_BASE_URL=http://10.0.2.2:8080
```

---

## Logins demo

| Papel | E-mail | Senha |
|--------|--------|--------|
| Funcionário | `campo1@agrolink.demo` | `AgrolinkDemo1!` |
| Gerente | `gerente1@agrolink.demo` | `AgrolinkDemo1!` |

Lista completa: [`../back/README.md`](../back/README.md#seed-de-equipe-demo).

---

## Demonstração (apresentação)

1. API rodando (`npm run dev` em `code/mobile` sobe o back automaticamente, ou use `code/front/agrolink`).
2. Emulador Android: URL padrão `http://10.0.2.2:8080` (ver [`README.md`](README.md)).
3. Login sugerido: `campo1@agrolink.demo` / `AgrolinkDemo1!`.
4. Mostrar: mapa → ocorrências → registrar → mensagens.

Capturas de tela mobile: [`../../docs/imagens/`](../../docs/imagens/) e [`../../README.md`](../../README.md#-aplicativo-mobile).

---

## Web vs Mobile

| | Web | Mobile |
|---|-----|--------|
| UI | React (Vite) | Flutter |
| Sobe API + app | `npm run dev` em `code/front/agrolink` | `npm run dev` em `code/mobile` |
| Só o app (API já no ar) | `npm run dev:web` | `npm run dev:flutter` |
| Chamadas à API | Proxy `/api` | HTTP direto para `API_BASE_URL` |
| Pasta do app | `front/agrolink` | `mobile/agrolink` |

**Trabalhando nos dois:** `npm run dev` no front + `npm run dev:flutter` no mobile (não dois `npm run dev` completos).

---

## Problemas comuns

| Sintoma | Solução |
|---------|---------|
| `flutter` não reconhecido | Adicione o SDK ao PATH; reinicie o terminal |
| Emulador não aparece em `flutter devices` | Crie/ligue AVD no Device Manager |
| Login falha / timeout | API na 8080? URL correta (`10.0.2.2` no emulador)? Firewall? |
| Hibernate / dialect no `[api]` | Use `npm run dev` (força perfil `dev`) ou `SPRING_PROFILES_ACTIVE=dev` |
| Porta 8080 ocupada | Feche terminal antigo com API ou use só `dev:flutter` se o web já subiu a API |
| Dois `npm run dev` (web + mobile) | Prefira `npm run dev` no front + `npm run dev:flutter` no mobile |
| Windows — symlink / Developer Mode | Ative **Modo de desenvolvedor** nas configurações do Windows |

---

## Referências

- [Flutter docs](https://docs.flutter.dev/)
- API REST: [`../back/README.md`](../back/README.md)
