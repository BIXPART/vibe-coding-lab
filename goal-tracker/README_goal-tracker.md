# 🎯 Goal Tracker

Aplicativo mobile para criação e acompanhamento de **metas recorrentes diárias, semanais e mensais**.

O objetivo é permitir que o usuário organize suas metas, registre quando conseguiu cumpri-las e acompanhe seu desempenho através de histórico e estatísticas.

Este projeto faz parte do [Vibe Coding Lab](../), sendo desenvolvido com auxílio de ferramentas de IA e seguindo uma abordagem de engenharia de software, com atenção especial a **regras de negócio, segurança, arquitetura, persistência de dados e testes**.

---

## ✨ Funcionalidades

### Metas

O usuário poderá:

- Criar metas
- Editar metas
- Excluir metas
- Visualizar suas metas
- Definir a frequência da meta
- Marcar a meta como concluída no período atual
- Consultar o histórico de uma meta

### Frequências

Cada meta poderá ser:

- 📅 Diária
- 📆 Semanal
- 🗓️ Mensal

Uma meta recorrente não perde seu histórico quando começa um novo período.

Por exemplo:

```text
Estudar programação

01/10  ✅ Concluída
02/10  ✅ Concluída
03/10  ❌ Não concluída
04/10  ⏳ Pendente
```

No dia seguinte, a meta volta a aparecer como pendente para o novo período, mas os registros anteriores continuam armazenados.

---

## 📊 Dashboard

O aplicativo terá uma dashboard para acompanhar o desempenho do usuário.

Entre as informações planejadas:

- Metas do período atual
- Metas concluídas
- Metas pendentes
- Percentual de conclusão
- Histórico de desempenho
- Streak atual
- Melhor streak
- Estatísticas semanais
- Estatísticas mensais

---

## 🏗️ Arquitetura

```text
goal-tracker/
├── mobile/                   # app (Expo Router + TypeScript)
│   ├── src/app/              rotas — cada arquivo é uma tela
│   ├── src/services/         único lugar que faz I/O com a API
│   ├── src/hooks/            use-async (leitura) / use-action (escrita)
│   ├── src/lib/              env, token-storage, formatação de data civil
│   └── README.md             # decisões, limitações conhecidas, diagnóstico
│
├── backend/                  # API (Express + TypeScript + Sequelize)
│   ├── src/services/         regra de negócio
│   ├── src/controllers/      camada fina: HTTP ⇄ service
│   ├── src/utils/            civil-date (períodos sem dependência)
│   └── tests/                unit + integration
│
├── AI_NOTES.md               # contrato do projeto (16 seções)
└── README_goal-tracker.md    # este arquivo
```

### Mobile

Interface e interação com o usuário. Expo SDK 57 · React Native 0.86 ·
React 19.2 · **Expo Router** (rotas em `src/app/`, `_layout.tsx` definem
navegadores) · TypeScript.

O app **não** calcula período nem decide status: exibe o que a API resolve. Ver
[`mobile/README.md`](./mobile/README.md) para as decisões e limitações.

### Backend

Autenticação, regras de negócio, persistência e comunicação com o banco.

Node.js · Express 5 · TypeScript · Sequelize 6 · Zod · JWT + bcrypt · Vitest.

### Banco de dados

- PostgreSQL

Banco de desenvolvimento: `goal_tracker`. Banco **descartável** dos testes:
`goal_tracker_test` (obrigatório via `TEST_DATABASE_URL`, sem fallback).

---

## 🗄️ Modelo de dados

A estrutura inicial deverá considerar entidades semelhantes a:

```text
User
 └── Goals
      └── GoalOccurrences
```

A existência de ocorrências permite preservar o histórico de cada período.

Por exemplo:

```text
Goal
 └── "Estudar programação"

GoalOccurrences
 ├── 01/10 → completed
 ├── 02/10 → completed
 ├── 03/10 → missed
 └── 04/10 → pending
```

O início de um novo período **não deve apagar as ocorrências anteriores**.

---

## 🔐 Segurança

O projeto deverá considerar:

- Autenticação
- Autorização
- Validação de dados
- Controle de acesso por usuário
- Proteção de endpoints
- Hash seguro de senhas
- Rate limiting em endpoints sensíveis
- Variáveis de ambiente
- Tratamento adequado de erros
- Não exposição de informações sensíveis

Nenhuma senha, API key, token ou credencial deve ser armazenada diretamente no código-fonte.

---

## 🧠 Regras de negócio

Algumas das principais regras:

1. Uma ocorrência só pode ser concluída uma vez.
2. Uma meta diária possui uma ocorrência por dia.
3. Uma meta semanal possui uma ocorrência por semana.
4. Uma meta mensal possui uma ocorrência por mês.
5. Concluir uma ocorrência não modifica períodos anteriores.
6. O histórico deve permanecer disponível.
7. O usuário só pode acessar suas próprias metas.
8. O backend deve validar as regras de negócio.
9. Datas e períodos devem considerar o fuso horário adequado.
10. Excluir uma meta não deve necessariamente apagar seu histórico.

As regras completas e as orientações para desenvolvimento assistido por IA estão documentadas em [`AI_NOTES.md`](./AI_NOTES.md).

---

## 🤖 Vibe Coding

Este projeto está sendo desenvolvido utilizando IA como ferramenta de desenvolvimento.

A IA pode auxiliar em:

- Planejamento
- Estruturação
- Geração de código
- Debugging
- Refatoração
- Testes
- Documentação
- Revisão

Porém, as decisões relacionadas à arquitetura, segurança, regras de negócio e comportamento da aplicação são revisadas durante o desenvolvimento.

> **A IA escreve código. O desenvolvedor continua responsável pelo sistema.**

---

## 🧪 Testes

As regras de negócio mais importantes deverão possuir testes, incluindo:

- Criação de metas
- Edição
- Exclusão
- Recorrência
- Identificação do período atual
- Conclusão de ocorrências
- Prevenção de conclusões duplicadas
- Cálculo de estatísticas
- Permissões de usuários

---

## 🚧 Status

**Em desenvolvimento.**

### O que já funciona

| Parte | Estado |
|---|---|
| API — auth (registro, login, `GET /auth/me`, perfil + fuso) | ✅ |
| API — metas (CRUD, soft delete) | ✅ |
| API — ocorrências (concluir, histórico) | ✅ |
| API — dashboard e estatísticas (streak, taxa de conclusão) | ✅ |
| API — validação de entrada (Zod em body, query e params) | ✅ |
| API — segurança (bcrypt, JWT, rate limit, CORS, headers, erros padronizados) | ✅ |
| API — testes unitários (período, streak, auth) | ✅ 49 testes |
| API — testes de integração (recorrência, permissões, regressões) | ⚠️ exige `TEST_DATABASE_URL` |
| App — sessão (login/registro/logout, token persistido, guarda de rotas) | ✅ |
| App — telas (Hoje, Metas, criar, detalhe, concluir, editar, perfil) | ✅ |
| App — testes automatizados | ❌ não existem |

### Como rodar

```bash
# 1. Backend
cd backend
npm install
cp .env.example .env          # ajuste DATABASE_URL, JWT_SECRET e TEST_DATABASE_URL
docker compose up -d          # ou use um PostgreSQL local
npm run db:sync               # cria/ajusta o schema (alter: true em dev)
npm run db:seed               # cria demo@goaltracker.dev / demo1234
npm run dev                   # http://localhost:3000

# 2. App (outro terminal)
cd mobile
npm install
cp .env.example .env.local    # opcional: só se a URL derivada não resolver
npx expo start
```

O endereço da API em uso no aparelho aparece em **Perfil → Diagnóstico**.

### O que falta

- Testes de integração rodando de ponta a ponta (falta criar `goal_tracker_test`).
- Testes automatizados no mobile.
- Correção dos bugs conhecidos do backend ainda em aberto (B3, B4, B6–B12),
  catalogados em [`AI_NOTES.md`](./AI_NOTES.md).
- Filtros e ordenação na lista de metas; tela de recuperação de senha.

Este projeto está sendo construído como parte do meu processo de aprendizado e experimentação com desenvolvimento assistido por IA.

---

## 📚 Objetivos de aprendizado

Com este projeto, pretendo aprofundar meus conhecimentos em:

- React Native
- Expo
- TypeScript
- APIs REST
- Node.js
- Express
- PostgreSQL
- Sequelize
- Autenticação e autorização
- Modelagem de dados
- Regras de negócio
- Testes
- Desenvolvimento assistido por IA
