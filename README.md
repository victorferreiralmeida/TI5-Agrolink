<!-- Este template foi criado para servir como referência e pode ser facilmente adaptado para diferentes projetos de desenvolvimento -->

<!-- [![Open in Visual Studio Code](https://classroom.github.com/assets/open-in-vscode-2e0aaae1b6195c2367325f4f02e2d04e9abb55f0b24a779b69b11b9e10269abc.svg)](https://classroom.github.com/online_ide?assignment_repo_id=23046375&assignment_repo_type=AssignmentRepo) [![Open in Codespaces](https://classroom.github.com/assets/launch-codespace-2972f46106e565e64193e422d61a12cf1da4916b45550586e14ef0a7c637dd04.svg)](https://classroom.github.com/open-in-codespaces?assignment_repo_id=23046375)
-->

<a href="https://classroom.github.com/online_ide?assignment_repo_id=23046375&assignment_repo_type=AssignmentRepo"><img src="https://classroom.github.com/assets/open-in-vscode-2e0aaae1b6195c2367325f4f02e2d04e9abb55f0b24a779b69b11b9e10269abc.svg" width="200"/></a> <a href="https://classroom.github.com/open-in-codespaces?assignment_repo_id=23046375"><img src="https://classroom.github.com/assets/launch-codespace-2972f46106e565e64193e422d61a12cf1da4916b45550586e14ef0a7c637dd04.svg" width="250"/></a>

---

# 🏷️ AGROLINK 👨‍💻

> [!NOTE]
> Sistema inteligente de **monitoramento e gestão rural** para produtores e gerentes de fazendas de médio e grande porte. **Valor principal:** centralizar ocorrências, equipe, mapa da propriedade e comunicação no campo, com **localização** das ocorrências e histórico estruturado — reduzindo perdas e acelerando decisões.

<table>
  <tr>
    <td width="800px">
      <div align="justify">
        O <b>AGROLINK</b> melhora a comunicação e o controle operacional no campo: registro de ocorrências com coordenadas, painel de acompanhamento, gestão de equipe e fazenda (perímetros e setores no mapa), canais de mensagens e relatórios. O objetivo é <b>reduzir perdas</b>, aumentar a eficiência da equipe e apoiar a tomada de decisão na operação agrícola. O sistema <b>não</b> é um ERP agrícola completo nem financeiro — foca na <b>comunicação operacional</b> e na <b>rastreabilidade</b> de problemas. Projeto desenvolvido no contexto acadêmico da <b>PUC Minas</b>, com referência às boas práticas de documentação recomendadas pelo <a href="https://github.com/joaopauloaramuni">Prof. Dr. João Paulo Aramuni</a>.
      </div>
    </td>
    <td>
      <div>
        <img src="https://joaopauloaramuni.github.io/image/logo_ES_vertical.png" alt="Logo do Projeto" width="120px"/>
      </div>
    </td>
  </tr> 
</table>

---

## 🚧 Status do Projeto

![Versão](https://img.shields.io/badge/versão-0.1.0-blue?style=for-the-badge) ![React](https://img.shields.io/badge/React-19.2.0-007ec6?style=for-the-badge&logo=react&logoColor=white) ![Vite](https://img.shields.io/badge/Vite-7.1.0-007ec6?style=for-the-badge&logo=vite&logoColor=white) ![Flutter](https://img.shields.io/badge/Flutter-stable-007ec6?style=for-the-badge&logo=flutter&logoColor=white) ![Java](https://img.shields.io/badge/Java-21-007ec6?style=for-the-badge&logo=openjdk&logoColor=white) ![Gradle](https://img.shields.io/badge/Gradle-Wrapper-007ec6?style=for-the-badge&logo=gradle&logoColor=white) ![Spring Boot](https://img.shields.io/badge/Spring_Boot-4.0.5-007ec6?style=for-the-badge&logo=springboot&logoColor=white)

---

## 📚 Índice
- [Links Úteis](#-links-úteis)
- [Sobre o Projeto](#-sobre-o-projeto)
- [Funcionalidades Principais](#-funcionalidades-principais)
- [Tecnologias Utilizadas](#-tecnologias-utilizadas)
- [Arquitetura](#-arquitetura)
  - [Diagramas](#diagramas)
- [Instalação e Execução](#-instalação-e-execução)
  - [Pré-requisitos](#pré-requisitos)
  - [Variáveis de Ambiente](#-variáveis-de-ambiente)
     - [1 Back-end (Spring Boot)](#1-back-end-spring-boot)
     - [2 Front-end (React, Vite)](#2-front-end-react-vite)
     - [3 Variáveis de Ambiente na Vercel](#3-variáveis-de-ambiente-na-vercel)
  - [Instalação de Dependências](#-instalação-de-dependências)
    - [Front-end (React)](#front-end-react)
    - [Back-end (Spring Boot)](#back-end-spring-boot)
  - [Banco de dados (H2 e MySQL)](#-banco-de-dados-h2-e-mysql)
  - [Como Executar a Aplicação](#-como-executar-a-aplicação)
    - [Terminal 1: Back-end (Spring Boot)](#terminal-1-back-end-spring-boot)
    - [Terminal 2: Front-end (React, Vite)](#terminal-2-front-end-react-vite)
    - [Docker Compose](#-docker-compose)
- [Deploy](#-deploy)
- [Estrutura de Pastas](#-estrutura-de-pastas)
- [Demonstração](#-demonstração)
  - [Aplicativo Mobile](#-aplicativo-mobile)
  - [Aplicação Web](#-aplicação-web)
  - [Exemplo de saída no Terminal (para Back-end, API, CLI)](#-exemplo-de-saída-no-terminal-para-back-end-api-cli)
- [Testes](#-testes)
- [Documentações utilizadas](#-documentações-utilizadas)
- [Autores](#-autores)
- [Contribuição](#-contribuição)
- [Agradecimentos](#-agradecimentos)
- [Licença](#-licença)

---

## 🔗 Links Úteis
* 🌐 **Demo online (apresentação):** [Acesse a Aplicação Web](https://zoom-gallstone-bootleg.ngrok-free.dev)
  > 💻 **Hospedagem:** [ngrok](https://ngrok.com) em **https://zoom-gallstone-bootleg.ngrok-free.dev** (`npm run dev` + `npm run demo:tunnel`). O notebook deve permanecer ligado durante a avaliação. Guia: [`code/README.md`](./code/README.md#demonstração-pública-apresentação).
* 📱 **Mobile:** app Flutter em `code/mobile/agrolink` — demonstração local/emulador (não publicado em loja).
* 📁 **Documentação acadêmica / diagramas:** pasta [`docs/`](./docs/) — apresentação, requisitos, [`modelagem`](./docs/4.modelagem.md), [`wireframes`](./docs/5.wireframe.md), solução e [`avaliação ATAM`](./docs/7.avaliacao.md).

### Documentação técnica (código)

| Nível | README |
|-------|--------|
| **Monorepo** | [`code/README.md`](./code/README.md) — índice, início rápido, arquitetura |
| **Back-end** | [`code/back/README.md`](./code/back/README.md) — API, perfis H2/MySQL, endpoints, testes |
| **Front-end** | [`code/front/README.md`](./code/front/README.md) — React/Vite, rotas, proxy |
| **Mobile** | [`code/mobile/README.md`](./code/mobile/README.md) — Flutter, emulador, `npm run dev` |

---

## 📝 Sobre o Projeto

**Por que existe:** substituir fluxos reativos baseados só em mensagens informais no campo por um **registro estruturado** de ocorrências com localização e priorização.

**Qual problema resolve:** informação dispersa entre pessoas e canais, pouca rastreabilidade de incidentes e decisões tardias frente a focos de pragas, cercas, incêndios e manutenção.

**Qual o contexto:** projeto **acadêmico** (PUC Minas — Engenharia de Software).

**Onde pode ser utilizado:** fazendas de médio e grande porte que precisam alinhar produtor, gerentes e equipe de campo em torno das mesmas informações.

- *Qual foi a ideia inicial do projeto?* Centralizar **ocorrências**, **mapa** da propriedade (fazenda/setores), **equipe** e **comunicação** operacional.

- *O que ele entrega de valor ao usuário?* Visão única do que acontece no campo, com histórico e localização.

- *Por que alguém utilizaria ou contribuiria com esse projeto?* Para experimentar um MVP de **gestão rural orientada a dados** sem a complexidade de um ERP.

- *O que o torna relevante ou interessante?* Foco em **simplicidade**, **geolocalização** e **tomada de decisão rápida**.

> [!NOTE]
> Esta seção segue boas práticas de documentação profissional e deve ser ajustada conforme o tipo e o objetivo do seu projeto.

---

## ✨ Funcionalidades Principais

- 🔐 **Autenticação:** cadastro e login (papéis produtor, gerente, funcionário de campo).
- 📍 **Ocorrências:** registro com categoria, prioridade, setor e coordenadas; listagem e detalhe.
- 🗺️ **Mapa:** visualização de ocorrências e **delimitação da fazenda e setores** (polígonos cadastrados pelo gerente).
- 🏡 **Minha fazenda:** cadastro de perímetro e setores (geo JSON).
- 👥 **Equipe:** membros, convites e resumo da equipe.
- 💬 **Mensagens:** salas de chat com histórico e envio de texto/arquivo; mensageria **RabbitMQ** no backend (atualização por **polling** na web).
- 📊 **Dashboard e relatórios:** conforme evolução das telas do produto.
- 📱 **Mobile:** app Flutter (`code/mobile/agrolink`) — login, mapa, ocorrências, mensagens e perfil.

---

## 🛠 Tecnologias Utilizadas

As seguintes ferramentas, frameworks e bibliotecas foram utilizados na construção deste projeto. Recomenda-se o uso das versões listadas (ou superiores) para garantir a compatibilidade.

### 💻 Front-end

* **Framework/Biblioteca:** React 19.x
* **Linguagem/Superset:** TypeScript (~5.9)
* **Estilização:** CSS global (`index.css`), temas via React Context
* **Gerenciamento de Estado:** React Context (Auth, tema)
* **Build Tool:** Vite ~7.1
* **Mapas:** Leaflet + react-leaflet (tiles Esri / OpenStreetMap)

### 🖥️ Back-end

* **Linguagem/Runtime:** Java **21** (JDK)
* **Framework:** Spring Boot **4.0.5**
* **Banco de Dados:** **H2** (arquivo, perfil `dev`) / **MySQL** (perfil `mysql`, opcional)
* **ORM / Query Builder:** Hibernate / Spring Data JPA
* **Autenticação:** senhas com BCrypt; token simples (`agrolink-{id}`) — MVP acadêmico (ver [`code/back/README.md`](./code/back/README.md))

### 📱 Mobile (Opcional)

* **Framework:** Flutter — projeto em `code/mobile/agrolink`
* **Ferramentas:** Android Studio / Xcode conforme plataforma alvo

### ⚙️ Infraestrutura & DevOps

* **Containerização:** Docker (opcional para MySQL local) — `docker-compose` ainda não versionado no repositório
* **Cloud / Deploy:** Vercel, Netlify ou similar para o front estático; JAR Spring Boot para a API
* **CI/CD:** [A definir — ex.: GitHub Actions]

---

## 🏗 Arquitetura

O AGROLINK segue um **monólito modular** no backend: API REST Spring Boot (**controllers** → **services** → **repositórios JPA**) com persistência em **H2** ou **MySQL**. O frontend é uma **SPA** React (Vite) que consome `/api` via **proxy** do Vite; uploads em tempo de execução ficam em `code/back/uploads/`. O app mobile Flutter consome os mesmos endpoints quando aplicável.

**Componentes principais da API:** `AuthController`, `OcorrenciaController`, `FazendaController`, `EquipeController`, `ChatController`, `NotificacaoController`, `UsuarioPerfilController`, `HealthController`. **Fluxo de dados:** JSON sobre HTTP; chat com **polling**. Detalhes dos endpoints: [`code/back/README.md`](./code/back/README.md).

### Diagramas

Os diagramas de modelagem estão descritos em [`docs/4.modelagem.md`](./docs/4.modelagem.md) (referências a `docs/imagens/visao.png`, `docs/imagens/classes.png`, `docs/imagens/componentes.png`). **Enquanto esses ficheiros não estiverem versionados** em `docs/imagens/`, mantém-se o **placeholder** abaixo; após adicioná-los ao repositório, substitua os `src` das primeiras três células por `./docs/imagens/visao.png`, `./docs/imagens/classes.png` e `./docs/imagens/componentes.png`.

| Diagrama de Arquitetura | Detalhe da Arquitetura |
| :---: | :---: |
| **Visão Geral (Macro)** | **Diagrama de componentes** |
| <img src="./docs/imagens/visao.png" alt="Visão Geral da Solução" width="400px"> | <img src="./docs/imagens/componentes.png" alt="Diagrama de Componentes" width="400px"> |
| **Modelo de Dados (classes)** | **Fluxo de Autenticação** |
| <img src="./docs/imagens/classes.png" alt="Diagrama de Classes" width="400px"> | <img src="./docs/imagens/fluxo-auth.png" alt="Fluxo de Autenticação" width="400px"> |
| **Infraestrutura (Cloud)** | **API / Rotas** |
| <img src="./docs/imagens/infra-cloud.png" alt="Diagrama de Infraestrutura" width="400px"> | <img src="./docs/imagens/api-rotas.png" alt="Diagrama de API e Rotas" width="400px"> |

---

## 🔧 Instalação e Execução

> [!TIP]
> **Atalho:** o passo a passo completo do monorepo está em [`code/README.md`](./code/README.md). Cada módulo tem README próprio: [back](./code/back/README.md) · [front](./code/front/README.md) · [mobile](./code/mobile/README.md).

### Início rápido (web + API)

```bash
cd code/front/agrolink
npm install
npm run dev
```

Interface em **http://localhost:5173** · API em **http://localhost:8080**.

### Início rápido (mobile + API)

```bash
cd code/mobile
npm install
npm run dev
```

Requer emulador Android ou dispositivo com depuração USB. Ver [`code/mobile/README.md`](./code/mobile/README.md).

### Pré-requisitos

| Ferramenta | Versão / observação |
|------------|---------------------|
| **Java JDK** | **21** — back-end ([`code/back/build.gradle`](./code/back/build.gradle)) |
| **Node.js** | LTS (v18+) — scripts `npm run dev` (web e mobile) |
| **Flutter** | stable — apenas para o app mobile |
| **MySQL** | Opcional — perfil Spring `mysql` ([`code/back/README.md`](./code/back/README.md)) |

Em desenvolvimento, o perfil padrão dos scripts npm é **`dev`** (banco **H2** em arquivo em `code/back/data/`).

---

### 🔑 Variáveis de Ambiente

Crie arquivos `.env` específicos e/ou configure as variáveis de ambiente no seu sistema para cada parte da aplicação.

#### 1 Back-end (Spring Boot)

Configure estas variáveis como **variáveis de ambiente do sistema** ou em um arquivo de configuração do Spring (ex: `application.properties`/`application.yml`).

| Variável | Descrição | Exemplo |
| :--- | :--- | :--- |
| `SERVER_PORT` | Porta onde o Back-end será executado. | `8080` |
| `SPRING_PROFILES_ACTIVE` | Perfil Spring (`dev` = H2; `mysql` = MySQL). | `dev` ou `mysql` |
| `SPRING_DATASOURCE_URL` | URL JDBC (quando não usar defaults do perfil). | *(perfil `mysql`: ver `application-mysql.properties`)* |
| `MYSQL_HOST` | Host MySQL (perfil `mysql`). | `localhost` |
| `MYSQL_PORT` | Porta MySQL. | `3306` |
| `MYSQL_DATABASE` | Nome do schema. | `agrolink` |
| `MYSQL_USER` / `MYSQL_PASSWORD` | Credenciais MySQL. | `root` / `sua_senha` |

#### 2 Front-end (React, Vite)

Variáveis lidas pelo `vite.config.ts` na pasta **`code/front/agrolink`** (prefixo livre para este projeto — o proxy usa `AGROLINK_API_URL`).

| Variável | Descrição | Exemplo |
| :--- | :--- | :--- |
| `AGROLINK_API_URL` | Origem do Spring Boot quando não for `http://localhost:8080`. | `http://localhost:8081` |

---

#### 3. Variáveis de Ambiente na Vercel

A Vercel permite configurar variáveis no painel (Project Settings > Environment Variables).
Referências comuns em aplicações front-end e full-stack:

---

##### **Exemplo 1 – Front-end com Next.js usando API externa**

```
NEXT_PUBLIC_API_URL=https://meu-backend.vercel.app/api
NEXT_PUBLIC_GOOGLE_ANALYTICS_ID=G-seu_google_analytics_id_aqui
```

---

##### **Exemplo 2 – Aplicação Full-stack (Next.js + Prisma + PostgreSQL)**

```
DATABASE_URL=postgresql://admin:senha-super-segura@ep-meu-banco.aws.neon.tech:5432/verceldb
NEXTAUTH_SECRET=uma_chave_muito_longa_e_segura
NEXTAUTH_URL=https://meu-sistema.vercel.app
```

---

##### **Exemplo 3 – Integração com APIs externas**

```
STRIPE_SECRET_KEY=sk_live_seu_stripe_key_aqui
OPENAI_API_KEY=sk-sua_openai_key_aqui
SENDGRID_API_KEY=SG.sua_sendgrid_key_aqui
```

---

##### **Exemplo 4 – Frontend com Vite (EmailJS)**

```
VITE_EMAILJS_SERVICE_ID=seu_service_id_aqui
VITE_EMAILJS_TEMPLATE_ID_FOR_ME=seu_template_id_for_me_aqui
VITE_EMAILJS_TEMPLATE_ID_FOR_SENDER=seu_template_id_for_sender_aqui
VITE_EMAILJS_PUBLIC_KEY=sua_public_key_aqui
```

> **Obs:** Em projetos **Vite**, variáveis expostas ao cliente costumam usar o prefixo `VITE_`. No AGROLINK web, o proxy também pode ser ajustado via **`AGROLINK_API_URL`** no ambiente ao rodar o Vite.

---

Para adicionar essas variáveis:

1.  Acesse a página de Environment Variables do seu projeto no Vercel (ex.: `https://vercel.com/<seu-usuario>/<seu-projeto>/settings/environment-variables`)
2.  Clique em **"Add"** para adicionar cada variável com o nome e valor correspondente.

Alternativamente, se estiver desenvolvendo localmente, crie um arquivo **`.env.local`** na pasta do front (`code/front/agrolink`) conforme necessário:

```
AGROLINK_API_URL=http://localhost:8080
```

> 💡 **Localização:** Arquivos `.env.local` na pasta do front (`code/front/agrolink`) são carregados pelo Vite durante o desenvolvimento.

### 📦 Instalação de Dependências

Clone o repositório e instale as dependências.

1.  **Clone o Repositório:**

```bash
git clone <URL_DO_SEU_REPOSITÓRIO>
cd <pasta-do-projeto>
```

2.  **Instale as Dependências (Monorepo):**

Como o projeto está dividido, você precisa instalar as dependências separadamente para o Front-end (React, usando NPM/Yarn) e garantir que o Back-end (Spring Boot, usando Gradle Wrapper) tenha suas dependências resolvidas.

#### Front-end (React)

Acesse a pasta do Front-end e instale as dependências do Node.js:

```bash
cd code/front/agrolink
npm install
# ou
yarn install
cd ../.. # Retorna para a raiz do repositório (ajuste conforme sua estrutura local)
```

#### Back-end (Spring Boot)

O Spring Boot utiliza o **Gradle Wrapper** (`./gradlew` ou `.\gradlew.bat`) para gerenciar dependências.

* **Usando Gradle (`build.gradle`):**
    ```bash
    cd code/back
    .\gradlew.bat clean build
    cd ..\..
    ```

---

### 💾 Banco de dados (H2 e MySQL)

| Ambiente | Perfil Spring | Banco |
|----------|---------------|--------|
| Desenvolvimento local (recomendado) | `dev` | **H2** em arquivo — `code/back/data/` |
| Produção / homologação | `mysql` | **MySQL 8+** |

O Hibernate cria/atualiza o schema na subida (`ddl-auto=update`). Console H2 (perfil `dev`): http://localhost:8080/h2-console — credenciais em [`code/back/README.md`](./code/back/README.md).

**MySQL via Docker (opcional):**

```bash
docker run --name agrolink-mysql -e MYSQL_ROOT_PASSWORD=root -e MYSQL_DATABASE=agrolink -p 3306:3306 -d mysql:8
```

Depois: `SPRING_PROFILES_ACTIVE=mysql` e variáveis `MYSQL_*` (ver [`code/back/README.md`](./code/back/README.md)).

> **Atenção:** `gradlew bootRun` **sem** perfil `dev` usa MySQL de `application.properties`. Use `SPRING_PROFILES_ACTIVE=dev` ou `npm run dev` do front/mobile.

---

### ⚡ Como Executar a Aplicação

**Forma recomendada (front + API juntos):** na pasta `code/front/agrolink`, após `npm install`, execute **`npm run dev`**. Esse script sobe o **Vite** (interface em http://localhost:5173) e o **Spring Boot** na porta **8080** em paralelo (via `concurrently` e `scripts/start-backend.mjs`).

Alternativa em **dois terminais** (só front, ou API já em execução):

#### Terminal 1: Back-end (Spring Boot)

Inicie a API do Spring Boot.

```bash
cd code/back
.\gradlew.bat bootRun
```
🚀 *O Back-end estará disponível em **http://localhost:8080**.*

*(Linux/macOS: `./gradlew bootRun`)*

---

#### Terminal 2: Front-end (React, Vite)

Se a API já estiver na porta 8080, pode subir **apenas** o front:

```bash
cd code/front/agrolink
npm run dev:web
# ou
yarn dev:web
```
🎨 *O Front-end estará disponível em **http://localhost:5173** (ou a porta configurada no Vite/CRA).*

---

#### 🐳 Docker Compose

> [!NOTE]
> Este repositório **ainda não inclui** `docker-compose.yml` versionado. Hoje o fluxo recomendado é `npm run dev` (web ou mobile) + perfil Spring `dev` (H2). Para MySQL, use container Docker avulso (seção [Banco de dados](#-banco-de-dados-h2-e-mysql)) ou instalação local.

---

## 🚀 Deploy
Instruções claras para deploy em produção.

1.  **Build do Projeto:**
    Execute o build separadamente para os dois artefatos (JAR para o Back-end e arquivos estáticos para o Front-end).

```bash
# 1. Build do Front-end (React/Vite) - Gera a pasta /dist com arquivos estáticos
cd code/front/agrolink
npm run build

# 2. Build do Back-end (Spring Boot / Gradle) - Gera o arquivo .jar em /build/libs
cd ../../back
.\gradlew.bat clean bootJar
```

2.  **Configuração do Ambiente de Produção:** Defina as variáveis de ambiente no seu provedor (e.g., Vercel, Railway, Heroku, DigitalOcean).

> 🔑 **Variáveis Cruciais:** Certifique-se de configurar as variáveis de **conexão com o banco de dados** para o Back-end e a **URL da API de produção** para o Front-end (proxy ou CORS).

3.  **Execução em Produção:**
    A forma de execução depende do seu provedor, mas geralmente envolve o seguinte:

```bash
# ☕ Execução do Back-end Spring Boot (Java JAR)
java -jar code/back/build/libs/agrolink-0.0.1-SNAPSHOT.jar

# 🟢 Execução do Front-end (React/Vite)
# O Front-end (arquivos estáticos) não é executado via Node, mas servido por um servidor web.
# Exemplo de servidor de arquivos estáticos (usando Nginx, Vercel, Netlify, etc.)
# Para simular a produção localmente ou rodar em uma VPS simples, use o pacote 'serve':
npm install -g serve
serve -s code/front/agrolink/dist
```

---

## 📂 Estrutura de Pastas

Visão alinhada ao repositório atual (monorepo na pasta `code/`):

```
.
├── README.md                      # Este arquivo (visão do projeto — template PUC)
├── code/
│   ├── README.md                  # Índice do monorepo + início rápido
│   ├── back/
│   │   ├── README.md              # API REST, perfis, endpoints, testes
│   │   ├── build.gradle
│   │   ├── src/main/java/...
│   │   ├── data/                  # H2 (dev, runtime)
│   │   └── uploads/               # mídias (runtime)
│   ├── front/
│   │   ├── README.md              # React/Vite, rotas, proxy
│   │   └── agrolink/              # Projeto npm da SPA
│   └── mobile/
│       ├── README.md              # Flutter, emulador, npm run dev
│       └── agrolink/              # Projeto Flutter
├── docs/                          # Documentação acadêmica
├── assets/
└── divulge/
```

---

## 🎥 Demonstração

### 🎯 Acesso ao vivo (apresentação Sprint 5)

| Item | Valor |
|------|--------|
| **Link público** | https://zoom-gallstone-bootleg.ngrok-free.dev |
| **Login sugerido (web)** | `gerente1@agrolink.demo` / `AgrolinkDemo1!` |
| **Login sugerido (mobile)** | `campo1@agrolink.demo` / `AgrolinkDemo1!` |
| **Fazenda demo** | Parque das Mangabeiras (3 setores, ocorrências de exemplo) |

**Checklist antes de abrir para o professor:** RabbitMQ rodando → `npm run dev` na pasta `code/front/agrolink` → ngrok ativo → testar login pelo link público.

**Roteiro sugerido (5–8 min):** login → dashboard → mapa → lista/detalhe de ocorrência → registrar ocorrência → mensagens (enviar mensagem no chat) → equipe → relatórios → *(opcional)* mobile.

Passo a passo técnico: [`code/README.md`](./code/README.md#demonstração-pública-apresentação).

### 📱 Aplicativo Mobile

- GIF de demonstração (exemplo de fluxo de usuário):  
Passo a passo técnico: [`code/README.md`](./code/README.md#demonstração-pública-apresentação).

| Demonstração 1 | Demonstração 2 | Demonstração 3 | Demonstração 4 |
|----------------|----------------|----------------|----------------|
|![alt text](./docs/imagens/demo1.gif) | ![alt text](./docs/imagens/demo2.gif) | ![alt text](./docs/imagens/demo3.gif) | ![alt text](./docs/imagens/demo4.gif) |
| Criar ocorrências | Visualizar ocorrência detalhada | Filtrar ocorrências | Abrir mapa de ocorrências |

Capturas das telas principais (repositório `docs/imagens/`):

| Tela | Captura de Tela |
| :---: | :---: |
| **Login** | **Cadastro** |
| ![alt text](./docs/imagens/telalogin.jpg) | ![alt text](./docs/imagens/telacadastro.jpg) |
| **Dashboard** | **Mapa de ocorrências** |
| ![alt text](./docs/imagens/teladashboard.jpg) | ![alt text](./docs/imagens/telamapa.jpg) |
| **Lista de ocorrências** | **Detalhe / incidente** |
| ![alt text](./docs/imagens/telalistaocorrencias.jpg) |![alt text](./docs/imagens/telaocorrencia.jpg) |
| **Nova ocorrência** | **Chat** |
| ![alt text](./docs/imagens/telaregistrarocorrencia.jpg) | ![alt text](./docs/imagens/telaconversa.jpg) |
| **Notificações** | **Chats da equipe** |
| ![alt text](./docs/imagens/telanotificacoes.jpg) | ![alt text](./docs/imagens/telachat.jpg) |

### 🌐 Aplicação Web

Rotas principais da SPA (a maioria exige login). Capturas em `docs/imagens/`.

| Tela | Rota | Captura |
| :---: | :---: | :---: |
| **Início (landing)** | `/` |  ![alt text](./docs/imagens/image-11.png) |
| **Login** | `/login` |  ![alt text](./docs/imagens/image-9.png) |
| **Cadastro** | `/cadastro` |  ![alt text](./docs/imagens/image-10.png) |
| **Dashboard** | `/dashboard` | ![alt text](./docs/imagens/image.png) |
| **Minha fazenda** | `/fazenda` |  ![alt text](./docs/imagens/image-12.png) |
| **Ocorrências** | `/ocorrencias` |  ![alt text](./docs/imagens/image-1.png) |
| **Detalhe da ocorrência** | `/ocorrencias/:id` |  ![alt text](./docs/imagens/image-8.png) |
| **Mapa** | `/mapa` |  ![alt text](./docs/imagens/image-2.png) |
| **Registrar ocorrência** | `/registrar` | ![alt text](./docs/imagens/image-3.png) |
| **Mensagens** | `/mensagens` |  ![alt text](./docs/imagens/image-4.png) |
| **Equipe** | `/equipe` |  ![alt text](./docs/imagens/image-5.png) |
| **Relatórios** | `/relatorios` |  ![alt text](./docs/imagens/image-6.png) |
| **Notificações** | `/notificacoes` |  ![alt text](./docs/imagens/image-7.png) |

### 💻 Exemplo de Saída no Terminal (para Back-end, API, CLI)

Caso o projeto seja focado em serviços de Back-end (API, microserviço, CLI), utilize esta seção para demonstrar a interação com o sistema e a resposta esperada.

#### 1. Demonstração da API (Exemplo com cURL)

Mostra uma chamada simples para um endpoint da API (ex: GET de health).

```bash
curl -s http://localhost:8080/api/health
```

**Saída Esperada:**
```json
{
  "status": "UP",
  "aplicacao": "agrolink"
}
```

---

#### 2. RabbitMQ no chat (mensageria)

Com RabbitMQ em `localhost:5672` e o backend no perfil `dev`, ao enviar uma mensagem no chat o consumer registra o evento:

```text
RabbitMQ recebeu mensagem do chat. salaId=..., autor=..., texto=...
```

Painel de gestão (opcional): http://localhost:15672 — usuário/senha `guest` / `guest`.

---

## 🧪 Testes

### Back-end (JUnit)

```bash
cd code/back
.\gradlew.bat test
```

Relatório HTML: `code/back/build/reports/tests/test/index.html`. Cenários e rastreabilidade ATAM: [`docs/7.avaliacao.md`](./docs/7.avaliacao.md).

### Front-end e E2E

Testes automatizados da SPA e E2E (Cypress/Playwright) **ainda não configurados** no `package.json` do front.

---

## 🔗 Documentações utilizadas

Liste aqui links para documentação técnica, referências de bibliotecas complexas ou guias de estilo que foram cruciais para o projeto.

* 📖 **Framework/Biblioteca (Front-end):** [Documentação Oficial do **React**](https://react.dev/reference/react)
* 📖 **Build Tool (Front-end):** [Guia de Configuração do **Vite**](https://vitejs.dev/config/)
* 📖 **Framework (Back-end):** [Documentação Oficial do **Spring Boot**](https://docs.spring.io/spring-boot/documentation.html)
* 📖 **Containerização:** [Documentação de Referência do **Docker**](https://docs.docker.com/)
* 📖 **Guia de Estilo:** [**Conventional Commits** (Padrão de Mensagens)](https://www.conventionalcommits.org/en/v1.0.0/)
* 📖 **Monorepo:** [`code/README.md`](./code/README.md) · [back](./code/back/README.md) · [front](./code/front/README.md) · [mobile](./code/mobile/README.md)
* 📖 **Documentação acadêmica (PUC):** [`docs/`](./docs/) — apresentação, produto, [`requisitos`](./docs/3.requisitos.md), [`modelagem`](./docs/4.modelagem.md), [`wireframes`](./docs/5.wireframe.md), solução, [`avaliação`](./docs/7.avaliacao.md)

---

## 👥 Autores

| 👤 Nome | 🖼️ Foto | :octocat: GitHub | 💼 LinkedIn | 📤 Gmail |
|---------|----------|-----------------|-------------|-----------|
| Arthur Henrique Araújo Santos  | ![alt text](./docs/imagens/image-13.png) | <div align="center"><a href="https://github.com/arthurhasantos"><img src="https://joaopauloaramuni.github.io/image/github6.png" width="50px" height="50px"></a></div> | <div align="center"><a href="https://www.linkedin.com/in/arthurhas/"><img src="https://joaopauloaramuni.github.io/image/linkedin2.png" width="50px" height="50px"></a></div> | <div align="center"><a href="mailto:arthurhsantos2018@gmail.com"><img src="https://joaopauloaramuni.github.io/image/gmail3.png" width="50px" height="50px"></a></div> |
| Leonardo Augusto Pereira do Carmo  | ![alt text](./docs/imagens/image-14.png) | <div align="center"><a href="https://github.com/Leozin11"><img src="https://joaopauloaramuni.github.io/image/github6.png" width="50px" height="50px"></a></div> | <div align="center"><a href="https://www.linkedin.com/in/leonardo-augusto-pereira-do-carmo-b36210239/"><img src="https://joaopauloaramuni.github.io/image/linkedin2.png" width="50px" height="50px"></a></div> | <div align="center"><a href="mailto:leonardoaugustopcarmo@gmail.com"><img src="https://joaopauloaramuni.github.io/image/gmail3.png" width="50px" height="50px"></a></div> |
| Lucas Jácome Magalhães de Jesus  |  ![alt text](./docs/imagens/image-15.png) | <div align="center"><a href="https://github.com/lucasjacome"><img src="https://joaopauloaramuni.github.io/image/github6.png" width="50px" height="50px"></a></div> | <div align="center"><a href="https://www.linkedin.com/in/lucasjacomem/"><img src="https://joaopauloaramuni.github.io/image/linkedin2.png" width="50px" height="50px"></a></div> | <div align="center"><a href="mailto:lucas.jacome66@outlook.com"><img src="https://joaopauloaramuni.github.io/image/gmail3.png" width="50px" height="50px"></a></div> |
| Miguel Lima Barcellos  |  ![alt text](./docs/imagens/image-16.png)| <div align="center"><a href="https://github.com/MiguelLimab"><img src="https://joaopauloaramuni.github.io/image/github6.png" width="50px" height="50px"></a></div> | <div align="center"><a href="https://www.linkedin.com/in/miguelbarcellos/"><img src="https://joaopauloaramuni.github.io/image/linkedin2.png" width="50px" height="50px"></a></div> | <div align="center"><a href="mailto:miguel.limabarcellos@gmail.com"><img src="https://joaopauloaramuni.github.io/image/gmail3.png" width="50px" height="50px"></a></div> |
| Pedro Barros Lemos  | ![alt text](./docs/imagens/image-18.png) | <div align="center"><a href="https://github.com/BLpedro"><img src="https://joaopauloaramuni.github.io/image/github6.png" width="50px" height="50px"></a></div> | <div align="center"><a href="https://www.linkedin.com/in/blpedro/"><img src="https://joaopauloaramuni.github.io/image/linkedin2.png" width="50px" height="50px"></a></div> | <div align="center"><a href="mailto:pedrobarroslemos813@gmail.com"><img src="https://joaopauloaramuni.github.io/image/gmail3.png" width="50px" height="50px"></a></div> |
| Victor Ferreira de Almeida  |  ![alt text](./docs/imagens/image-17.png) | <div align="center"><a href="https://github.com/victorferreiralmeida"><img src="https://joaopauloaramuni.github.io/image/github6.png" width="50px" height="50px"></a></div> | <div align="center"><a href="https://www.linkedin.com/in/victorferreiradealmeida/"><img src="https://joaopauloaramuni.github.io/image/linkedin2.png" width="50px" height="50px"></a></div> | <div align="center"><a href="mailto:victorferreiralmeida@gmail.com"><img src="https://joaopauloaramuni.github.io/image/gmail3.png" width="50px" height="50px"></a></div> |

**Orientadores:** Cleiton Silva Tavares; Cristiano de Macêdo Neto; João Paulo Carneiro Aramuni.

---

## 🤝 Contribuição
Guia para contribuições ao projeto.

1.  Faça um `fork` do projeto.
2.  Crie uma branch para sua feature (`git checkout -b feature/minha-feature`).
3. Commit suas mudanças (`git commit -m 'feat: Adiciona nova funcionalidade X'`). **(Utilize [Conventional Commits](https://www.conventionalcommits.org/en/v1.0.0/))**
4.  Faça o `push` para a branch (`git push origin feature/minha-feature`).
5.  Abra um **Pull Request (PR)**.

> [!IMPORTANT]
> 📝 **Regras:** Por favor, verifique o arquivo [`CONTRIBUTING.md`](./CONTRIBUTING.md) para detalhes sobre nosso guia de estilo de código e o processo de submissão de PRs.

---

## 🙏 Agradecimentos
Em ambiente acadêmico, citar fontes e inspirações é crucial (integridade acadêmica). Em ambiente profissional, mostra humildade e conexão com a comunidade.

Gostaria de agradecer aos seguintes canais e pessoas que foram fundamentais para o desenvolvimento deste projeto:

* [**Engenharia de Software PUC Minas**](https://www.instagram.com/engsoftwarepucminas/) - Pelo apoio institucional, estrutura acadêmica e fomento à inovação e boas práticas de engenharia.
* [**Prof. Dr. João Paulo Aramuni**](https://github.com/joaopauloaramuni) - Pelos valiosos ensinamentos sobre **Arquitetura de Software** e **Padrões de Projeto**.
* [**Fernanda Kipper**](https://www.instagram.com/kipper.dev/) - Pelos valiosos ensinamentos em **Desenvolvimento Web**, **DevOps** e melhores práticas em **Front-end**.
* [**Rodrigo Branas**](https://branas.io/) - Pela didática excepcional em **Clean Architecture** e **Clean Code**.
* [**Código Fonte TV**](https://codigofonte.tv/) - Pelo vasto conteúdo e cobertura de notícias, tutoriais e apoio à comunidade de **Desenvolvimento Web**.

---

## 📄 Licença

Este projeto é distribuído sob a **[Licença MIT](https://github.com/joaopauloaramuni/laboratorio-de-desenvolvimento-de-software/blob/main/LICENSE)**.

---
