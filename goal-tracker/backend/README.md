# Goal Tracker — Backend

API REST do Goal Tracker: metas recorrentes (diárias, semanais e mensais) com
**histórico preservado**, autenticação, autorização por usuário e estatísticas.

Este backend implementa as regras definidas em
[`../AI_NOTES.md`](../AI_NOTES.md) e descritos no
[`../README_goal-tracker.md`](../README_goal-tracker.md).

---

## 📌 A regra que organiza o projeto

> O estado "concluída" pertence a uma **ocorrência** (meta + período), nunca à meta.

A recorrência **não** é implementada resetando, apagando ou sobrescrevendo o
estado anterior. Cada período tem sua própria linha em `goal_occurrences`:

```text
Goal: Estudar programação (DIÁRIA)
 └── GoalOccurrences
      ├── 2026-10-01 → COMPLETED
      ├── 2026-10-02 → COMPLETED
      ├── 2026-10-03 → MISSED
      └── 2026-10-04 → PENDING
```

Quando o dia vira, uma **nova** linha nasce como `PENDING`. As anteriores
permanecem intactas.

Isso é garantido em três níveis:

| Nível | Mecanismo |
|---|---|
| Banco | `UNIQUE (goal_id, period_start)` |
| Service | `completeCurrentOccurrence` só toca o período atual |
| Modelo | `completedAt` só existe quando `status = COMPLETED` |

---

## 🏗️ Arquitetura

```text
backend/src/
├── server.ts              # bootstrap: env → banco → sync → listen
├── app.ts                 # montagem do Express (separada para testes)
├── config/
│   ├── env.ts             # validação de ambiente (fail fast)
│   └── database.ts        # conexão Sequelize
├── models/index.ts        # User, Goal, GoalOccurrence
├── services/              # REGRAS DE NEGÓCIO
│   ├── auth.service.ts
│   ├── goal.service.ts
│   ├── occurrence.service.ts   # núcleo da recorrência
│   └── stats.service.ts
├── controllers/index.ts   # camada fina: valida, chama, responde
├── routes/index.ts        # rota = validação + auth + controller
├── middlewares/
│   ├── authenticate.ts    # JWT → req.user
│   ├── error-handler.ts   # AppError/ZodError → resposta segura
│   ├── rate-limit.ts
│   └── validate.ts
├── validators/index.ts    # schemas Zod
└── utils/
    ├── civil-date.ts      # data civil (ano/mês/dia) sem fuso
    ├── period.ts          # cálculo de período — função pura
    ├── streak.ts          # streaks e taxas — função pura
    ├── password.ts        # bcrypt
    ├── jwt.ts
    └── errors.ts
```

A regra de separação (AI_NOTES §10): **business logic nos services**, nunca em
controllers ou routes.

### Por que `civil-date.ts` existe

`new Date('2026-10-04')` é interpretado como **UTC** e vira dia 03/10 em
 fusos negativos. Isso corromperia a regra "qual é o dia do usuário".

A solução aqui usa só recursos da plataforma:

1. `Intl.DateTimeFormat` converte um instante em **data civil** no fuso do
   usuário (sem biblioteca externa);
2. toda aritmética de período acontece sobre datas civis, em UTC "falso".

Como nunca há conversão entre fusos, horário de verão não quebra nada.

---

## 🚀 Como executar

### Pré-requisitos

- Node.js 20+
- PostgreSQL 14+

### 1. Instalar dependências

```bash
npm install
```

### 2. Banco de dados

**Opção A — Docker (recomendado):**

```bash
docker compose up -d
```

**Opção B — PostgreSQL local:**

```sql
CREATE ROLE goals WITH LOGIN PASSWORD 'goals';
CREATE DATABASE goal_tracker OWNER goals;
```

### 3. Configurar ambiente

```bash
cp .env.example .env
```

Gere um segredo forte:

```bash
openssl rand -base64 48
```

Cole o resultado em `JWT_SECRET`. **Nunca versionar o `.env`** — ele já está no
`.gitignore`.

### 4. Criar as tabelas e (opcionalmente) popular

```bash
npm run db:sync     # cria/atualiza o schema
npm run db:seed     # usuário + 3 metas + histórico de exemplo
```

### 5. Rodar

```bash
npm run dev     # desenvolvimento (watch)
npm run build   # compila para dist/
npm start       # produção
```

API em `http://localhost:3000` · Health check em `http://localhost:3000/health`

### Scripts

| Comando | Descrição |
|---|---|
| `npm run dev` | Servidor com hot reload |
| `npm run build` | Compila TypeScript para `dist/` |
| `npm start` | Executa o build |
| `npm run typecheck` | `tsc --noEmit` |
| `npm test` | Roda todos os testes |
| `npm run test:watch` | Testes em modo watch |
| `npm run db:sync` | Sincroniza o schema |
| `npm run db:seed` | Dados de exemplo |

---

## 🔐 Variáveis de ambiente

| Variável | Obrigatória | Padrão | Descrição |
|---|---|---|---|
| `NODE_ENV` | não | `development` | `development` \| `test` \| `production` |
| `PORT` | não | `3000` | Porta do servidor |
| `DATABASE_URL` | **sim** | — | String de conexão do PostgreSQL |
| `JWT_SECRET` | **sim** | — | Segredo de assinatura (mín. 32 caracteres) |
| `JWT_EXPIRES_IN` | não | `1d` | Validade do token |
| `BCRYPT_SALT_ROUNDS` | não | `12` | Custo do hash (4–15) |
| `RATE_LIMIT_WINDOW_MS` | não | `900000` | Janela do rate limit (15 min) |
| `RATE_LIMIT_MAX` | não | `300` | Requisições por janela (global) |
| `AUTH_RATE_LIMIT_MAX` | não | `10` | Tentativas de login por janela |
| `CORS_ORIGIN` | não | `*` | Origem permitida (use `*` só em dev) |
| `SQL_LOGGING` | não | `false` | Log SQL: `true` \| `false` \| `sequelize` |

A aplicação **não sobe** com configuração inválida: `config/env.ts` valida tudo
com Zod e falha na inicialização, em vez de estourar no meio de uma requisição.

---

## 🔌 Endpoints

Base: `/api`. Autenticação via `Authorization: Bearer <token>`.

### Auth

| Método | Rota | Descrição |
|---|---|---|
| `POST` | `/auth/register` | Cria conta e retorna token |
| `POST` | `/auth/login` | Autentica e retorna token |
| `GET` | `/auth/me` | Perfil do usuário logado |
| `PATCH` | `/auth/me` | Atualiza nome e/ou fuso horário |

### Metas

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/goals` | Lista metas (`?includeInactive&page&limit`) |
| `POST` | `/goals` | Cria meta |
| `GET` | `/goals/:id` | Detalhe |
| `PATCH` | `/goals/:id` | Edita |
| `DELETE` | `/goals/:id` | **Soft delete** — preserva histórico |
| `GET` | `/goals/:id/occurrences` | Histórico (`?from&to&status`) |
| `POST` | `/goals/:id/occurrences/complete` | Conclui o período atual |
| `GET` | `/goals/:id/stats` | Streaks, taxa e contagens |

### Dashboard

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/dashboard` | Resumo do período corrente |

### Outros

| Método | Rota | Descrição |
|---|---|---|
| `GET` | `/health` | Health check (sem auth) |

---

## 🧪 Testes

```bash
npx vitest run tests/unit   # não precisa de banco
npm test                    # unit + integration; exige TEST_DATABASE_URL
```

| Arquivo | Cobre |
|---|---|
| `tests/unit/period.test.ts` | Períodos, fuso horário, virada de ano, bissexto, virada de semana |
| `tests/unit/streak.test.ts` | Streaks, taxas, "sem dados suficientes" |
| `tests/unit/auth.test.ts` | Hash de senha, JWT, adulteração de token |
| `tests/integration/recurrence.test.ts` | Recorrência, permissões, histórico, dashboard, validação de `:id` (banco real) |

### `TEST_DATABASE_URL` é obrigatória

`tests/integration/recurrence.test.ts` roda `sync({ force: true })` no
`beforeAll` e `destroy({ force: true })` a cada teste. **Não existe fallback
para `DATABASE_URL`** — se existisse, um `npm test` apontado para o banco de
desenvolvimento apagaria o seed sem nenhum aviso.

Sem a variável, o teste falha na inicialização com a instrução de como
resolver. Isso é intencional: falhar alto no boot é melhor do que destruir
dados.

Crie o banco descartável uma vez:

```bash
# Docker: já acontece na primeira subida do volume (docker/initdb/01-create-test-db.sql)
docker compose up -d

# Volume já existia, ou PostgreSQL local:
sudo -u postgres psql -c "CREATE DATABASE goal_tracker_test OWNER goals;"
```

E aponte no `.env`:

```bash
TEST_DATABASE_URL=postgres://goals:goals@localhost:5432/goal_tracker_test
```

> A role `goals` do `docker-compose.yml` **não** tem `CREATEDB`, então o
> `CREATE DATABASE` acima precisa de um superusuário. Para PostgreSQL local,
> `CREATE DATABASE goal_tracker_test OWNER goals;` é equivalente.

### Verificação manual de concorrência

```bash
# 10 pedidos simultâneos de conclusão no mesmo período
for i in $(seq 1 10); do
  curl -s -o /dev/null -w "%{http_code} " -X POST \
    "localhost:3000/api/goals/$GOAL/occurrences/complete" \
    -H "Authorization: Bearer $TOKEN" &
done; wait
```

Resultado esperado: **um** `200`, nove `409`, e exatamente **uma** linha no banco.

---

## 🔒 Segurança

Implementado conforme AI_NOTES §9:

- **Senhas**: bcrypt (12 rounds), nunca em texto puro
- **`passwordHash`**: fora do `defaultScope` e removido no `toJSON`
- **JWT**: `HS256` explícito; erros viram mensagem genérica
- **Equalização de tempo**: e-mail inexistente custa o mesmo que senha errada
- **Rate limiting**: global + apertado em login/registro (com `ipKeyGenerator` para IPv6)
- **Helmet**, **CORS** configurável, **limite de corpo** (100 kb)
- **Validação** com Zod em toda entrada
- **Erros**: erro desconhecido vira 500 sem stack nem SQL
- **Autorização**: filtro por `userId` no WHERE — nunca confiar em ID do cliente
- **Segredos**: só via variável de ambiente

### Testado contra acesso indevido

```bash
# Usuário B tentando a meta do usuário A → 404 (não 403)
curl -s -o /dev/null -w "%{http_code}\n" localhost:3000/api/goals/1 -H "Authorization: Bearer $TOKEN_B"
# 404
```

`404` em vez de `403` é intencional: confirmar "acesso negado" revelaria que o
recurso existe.

---

## 📐 Modelagem

```text
users
 ├── id, email (unique), password_hash, name, timezone, timestamps
 │
 └── goals (user_id FK CASCADE, deleted_at para soft delete)
      └── goal_occurrences (goal_id FK CASCADE)
           ├── period_start (DATE)   ← parte da UNIQUE
           ├── period_end   (DATE)
           ├── status (PENDING | COMPLETED | MISSED)
           └── completed_at (TIMESTAMPTZ, só se COMPLETED)
```

**Restrições que garantem integridade:**

```sql
UNIQUE (goal_id, period_start)              -- uma ocorrência por meta por período
CHECK  completedAt consistente com status
```

### Decisões que valem revisão

1. **Exclusão é soft delete.** A linha fica com `deleted_at` preenchido e as
   ocorrências permanecem. É a regra 8 do AI_NOTES: excluir não apaga
   histórico.

2. **Trocar a frequência é permitido.** O histórico **não** é reescrito: cada
   ocorrência mantém as fronteiras do período com que foi criada. Efeito
   colateral aceito: a série pode misturar granularidades. Preferiu-se isso a
   apagar dados.

3. **Períodos passados em aberto viram `MISSED` na leitura** (lazy), em vez de
   um cron. Mais robusto: não depende do servidor estar no ar na virada do dia.

4. **Histórico ancorado em `createdAt`.** Uma meta criada hoje não "perdeu" os
   30 dias anteriores — sem essa âncora, o dashboard mostraria estatísticas
   falsas (AI_NOTES §6).

5. **`sync()` não roda em produção.** Ele pode alterar tabela sem avisar. O
   caminho correto é migração versionada; `server.ts` recusa
   `NODE_ENV=production`.

---

## 📌 Limitações conhecidas

- `sequelize.sync()` em vez de migrações versionadas (aceitável em dev; ver
  decisão 5)
- Um único access token JWT: não há refresh token nem revogação antecipada
- Ausência de **deleção definitiva** de conta e de metas (soft delete por
  design)
- Rate limit em memória: reinicia a cada restart e não é compartilhado entre
  instâncias. Em produção, usar Redis
- Sem recuperação de senha e sem verificação de e-mail
- `npm audit` reporta `uuid` transitivo do Sequelize (moderate). O advisory
  afeta `uuid` v3/v5/v6 com buffer fornecido, caminho que o Sequelize não usa;
  a correção sugerida (`sequelize@3`) seria uma regressão grave

---

## 📚 Aprendizado

Este backend foi escrito para estudar, não para entregar rápido. Os pontos que
mais valem atenção:

1. **Períodos recorrentes** — `utils/period.ts` é a ideia central do projeto
2. **Datas e fusos** — por que `new Date('YYYY-MM-DD')` é perigoso
3. **Autorização real** — filtrar no banco, nunca confiar no cliente
4. **Restrições como defesa** — a UNIQUE é a garantia final da regra 1
5. **Transações** — quando a operação tem mais de uma escrita
6. **Testes das regras, não do código** — os testes citam a regra do AI_NOTES
   que estão exercitando

> **A IA pode escrever código, mas quem decide sobre o sistema é o desenvolvedor.**