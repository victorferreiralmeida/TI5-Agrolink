# Back-end — AGROLINK

API REST em **Spring Boot 4.0.5** e **Java 21**, com persistência **JPA/Hibernate**. Expõe autenticação, ocorrências, fazenda, equipe, chat, notificações e health check.

Documentação do monorepo: [`../README.md`](../README.md) · Front: [`../front/README.md`](../front/README.md) · Mobile: [`../mobile/README.md`](../mobile/README.md) · Projeto: [`../../README.md`](../../README.md)

---

## Pré-requisitos

| Ferramenta | Versão |
|------------|--------|
| **JDK** | 21 (definido em `build.gradle`) |
| **Gradle** | Wrapper incluído (`gradlew` / `gradlew.bat`) |

Opcional: **MySQL 8+** se usar o perfil `mysql`.

---

## Executar

### Desenvolvimento (perfil `dev` — H2 em arquivo)

```bash
cd code/back
# Windows
set SPRING_PROFILES_ACTIVE=dev
.\gradlew.bat bootRun

# Linux/macOS
export SPRING_PROFILES_ACTIVE=dev
./gradlew bootRun
```

API em **http://localhost:8080** · Health: `GET /api/health`

> **Atenção:** `bootRun` **sem** `SPRING_PROFILES_ACTIVE=dev` usa as credenciais **MySQL** de `application.properties`. Os scripts `npm run dev` do front/mobile definem `dev` automaticamente via `scripts/start-backend.mjs`.

### Build e testes

```bash
.\gradlew.bat clean build    # Windows
.\gradlew.bat test           # JUnit — relatório em build/reports/tests/test/
```

---

## Perfis Spring

| Perfil | Banco | Arquivo | Uso |
|--------|--------|---------|-----|
| **`dev`** | H2 em arquivo (`data/`) | `application-dev.properties` | Desenvolvimento local (recomendado) |
| **`mysql`** | MySQL | `application-mysql.properties` | Homologação/produção com MySQL |

Ativar perfil:

```bash
set SPRING_PROFILES_ACTIVE=dev    # Windows
export SPRING_PROFILES_ACTIVE=mysql # Linux/macOS
```

### Variáveis de ambiente (resumo)

| Variável | Descrição | Exemplo |
|----------|-----------|---------|
| `SERVER_PORT` | Porta HTTP | `8080` |
| `SPRING_PROFILES_ACTIVE` | Perfil ativo | `dev` ou `mysql` |
| `MYSQL_HOST` | Host MySQL (perfil `mysql`) | `localhost` |
| `MYSQL_PORT` | Porta MySQL | `3306` |
| `MYSQL_DATABASE` | Schema | `agrolink` |
| `MYSQL_USER` / `MYSQL_PASSWORD` | Credenciais | `root` / `sua_senha` |
| `agrolink.demo-seed` | Cria usuários `@agrolink.demo` | `true` / `false` |

---

## Banco H2 (perfil `dev`)

| Item | Valor |
|------|--------|
| Console | http://localhost:8080/h2-console |
| JDBC URL | `jdbc:h2:file:./data/agrolink;AUTO_SERVER=TRUE` |
| Usuário | `sa` |
| Senha | *(vazio)* |
| Arquivos | `code/back/data/` (runtime, no `.gitignore`) |

O Hibernate usa `ddl-auto=update` (schema criado/atualizado na subida).

---

## Seed de equipe demo

Com `agrolink.demo-seed=true` (padrão em `dev`), o backend cria até **8 usuários** `@agrolink.demo` que ainda não existem:

| Papel | E-mail | Senha |
|--------|--------|--------|
| Produtor | `produtor@agrolink.demo` | `AgrolinkDemo1!` |
| Gerente | `gerente1@agrolink.demo`, `gerente2@agrolink.demo` | mesma senha |
| Funcionário de campo | `campo1@agrolink.demo` … `campo5@agrolink.demo` | mesma senha |

- Constante no código: `DemoTeamSeed.DEMO_PASSWORD`
- Contas reais **não** são alteradas
- **Zerar demos:** apague linhas `@agrolink.demo` no H2 ou remova `data/` com o app parado
- Perfil **`mysql`:** seed desligado por padrão (`agrolink.demo-seed=false`)

---

## RabbitMQ (chat — demonstração)

Perfil `dev` espera broker em `localhost:5672`. Subir com Docker:

```bash
docker run -d --name agrolink-rabbit -p 5672:5672 -p 15672:15672 rabbitmq:3-management
```

| Item | Valor |
|------|--------|
| Exchange | `agrolink.chat.exchange` |
| Fila | `agrolink.chat.messages` |
| Routing key | `chat.mensagem.criada` |
| Painel | http://localhost:15672 (`guest` / `guest`) |

Ao enviar mensagem no chat, `ChatMensagemConsumer` registra no log do Spring Boot. Se o RabbitMQ estiver indisponível, a mensagem **ainda é salva** no banco (publicação falha com aviso no log).

---

## Autenticação (MVP acadêmico)

| Aspecto | Comportamento |
|---------|----------------|
| Login | `POST /api/auth/login` → token `agrolink-{userId}` |
| Cadastro | `POST /api/auth/register` |
| Senhas | **BCrypt** |
| Validação do token | Endpoints críticos (ocorrências, chat, equipe, fazenda…) exigem `Authorization: Bearer agrolink-{id}`; trate como **protótipo**, não produção |

Papéis (`PapelUsuario`): `PRODUTOR`, `GERENTE`, `FUNCIONARIO_CAMPO`.

---

## API REST — visão geral

Base: **`http://localhost:8080`**

### Auth — `/api/auth`

| Método | Caminho | Descrição |
|--------|---------|-----------|
| `POST` | `/login` | Autenticação |
| `POST` | `/register` | Cadastro |

### Health — `/api`

| Método | Caminho | Descrição |
|--------|---------|-----------|
| `GET` | `/health` | Status da aplicação |

### Ocorrências — `/api/ocorrencias` *(Bearer)*

| Método | Caminho | Descrição |
|--------|---------|-----------|
| `GET` | `/` | Lista visível ao usuário |
| `GET` | `/{id}` | Detalhe |
| `POST` | `/` | Criar |
| `PUT` | `/{id}` | Atualizar |
| `DELETE` | `/{id}` | Remover |
| `POST` | `/{id}/resolver` | Marcar resolvida |
| `POST` | `/{id}/comentarios` | Comentário (JSON ou multipart) |
| `POST` | `/{id}/imagens` | Upload de imagens |
| `POST` | `/{id}/responsavel/mim` | Assumir responsabilidade |
| `PUT` | `/{id}/responsavel` | Atribuir responsável |

### Fazenda — `/api/fazenda` *(Bearer)*

| Método | Caminho | Descrição |
|--------|---------|-----------|
| `GET` | `/me` | Dados da fazenda do gerente |
| `PUT` | `/me` | Atualizar perímetro/nome |
| `GET` | `/setores-registro` | Setores para registro de ocorrência |
| `GET` | `/registro-ocorrencia-mapa` | Dados do mapa no registro |
| `POST` | `/me/setores` | Criar setor |
| `PUT` | `/me/setores/{id}` | Atualizar setor |
| `DELETE` | `/me/setores/{id}` | Remover setor |

### Equipe — `/api/equipe` *(Bearer)*

| Método | Caminho | Descrição |
|--------|---------|-----------|
| `GET` | `/` | Resumo da equipe |
| `GET` | `/membros` | Lista de membros |
| `GET` | `/membros/{id}` | Detalhe do membro |
| `PUT` | `/membros/{id}` | Atualizar membro |
| `DELETE` | `/membros/{id}` | Remover membro |
| `GET` | `/convites` | Convites enviados |
| `POST` | `/convites` | Convidar |
| `GET` | `/convites/me` | Convites recebidos |
| `POST` | `/convites/{id}/aceitar` | Aceitar |
| `POST` | `/convites/{id}/recusar` | Recusar |
| `POST` | `/convites/{id}/reenviar` | Reenviar |
| `DELETE` | `/convites/{id}` | Cancelar convite |

### Chat — `/api/chat` *(Bearer)*

Na subida, é criada a sala **“Canal geral da equipe”** se não existir nenhuma. Salas antigas sem membros recebem todos os usuários ativos (migração única).

| Método | Caminho | Descrição |
|--------|---------|-----------|
| `GET` | `/salas` | Salas do usuário (+ preview da última mensagem) |
| `POST` | `/salas` | Criar canal (`nome`, `membroIds`) — produtor/gerente |
| `PATCH` | `/salas/{salaId}` | Atualizar sala |
| `GET` | `/salas/{salaId}/membros` | Membros do canal |
| `GET` | `/salas/{salaId}/mensagens` | Histórico (até 500) |
| `POST` | `/salas/{salaId}/mensagens` | Enviar texto e/ou `midiaUrl` |
| `POST` | `/salas/{salaId}/mensagens/com-arquivo` | Multipart (imagem/PDF até 10 MB) |
| `POST` | `/salas/{salaId}/imagem` | Upload de imagem |

**Tempo real:** WebSocket **não** implementado; clientes usam polling.

### Notificações — `/api/notificacoes` *(Bearer)*

| Método | Caminho | Descrição |
|--------|---------|-----------|
| `GET` | `/` | Lista de notificações do usuário |

### Perfil — `/api/usuario` *(Bearer)*

| Método | Caminho | Descrição |
|--------|---------|-----------|
| `GET` | `/me` | Perfil atual |
| `PUT` | `/me` | Atualizar perfil |
| `POST` | `/me/foto` | Upload de foto |

### Arquivos estáticos

Uploads servidos em **`/uploads/**`** (pasta `uploads/` em runtime, ao lado de `data/`).

---

## Estrutura do código

```
back/
├── build.gradle
├── src/main/java/agrolink/agrolink/
│   ├── api/           # Controllers REST + ApiExceptionHandler
│   ├── auth/          # Parser do token Bearer
│   ├── config/        # Seed demo, bootstrap do chat, beans
│   ├── domain/        # Entidades JPA
│   ├── dto/           # Request/Response
│   ├── repository/    # Spring Data
│   └── service/       # Regras de negócio
├── src/main/resources/
│   ├── application.properties
│   ├── application-dev.properties
│   └── application-mysql.properties
├── src/test/java/     # JUnit (Auth, Ocorrência, Fazenda…)
├── data/              # H2 (dev, runtime)
└── uploads/           # Mídias (runtime)
```

### Entidades principais

`Usuario`, `Fazenda`, `FazendaSetor`, `Ocorrencia`, `SalaChat`, `SalaChatMembro`, `MensagemChat`, `ConviteEquipe`, `Notificacao`.

---

## Testes

```bash
cd code/back
.\gradlew.bat test
```

| Classe | Foco |
|--------|------|
| `AuthServiceTest` | Regras de login/cadastro |
| `AuthControllerIntegrationTest` | HTTP auth |
| `OcorrenciaServiceTest` | Ocorrências |
| `FazendaTest` | Fazenda/setores |

Perfil de teste: H2 em memória (`src/test/resources/application-test.properties`).

Relatório HTML: `build/reports/tests/test/index.html`

---

## Referências

- [Spring Boot](https://docs.spring.io/spring-boot/documentation.html)
- [Spring Data JPA](https://docs.spring.io/spring-data/jpa/docs/current/reference/html/)
- Avaliação ATAM (autenticação): [`../../docs/7.avaliacao.md`](../../docs/7.avaliacao.md)
