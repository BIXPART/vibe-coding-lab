# ValiStock — Sistema de Controle de Validade e Estoque

Sistema interno para controle de estoque e validade de produtos, pensado para uso
por uma equipe de estoque de supermercado.

## Arquitetura

```
React Native + Expo (mobile)
        │
        │ HTTPS / REST
        ▼
┌─────────────────────────────┐
│       Render Free           │
│                             │
│ Node.js + Express           │
│ Sequelize                   │
│ SQLite                      │
│                             │
│ database.sqlite             │
└─────────────────────────────┘
```

## Stack

| Parte | Tecnologias |
|---|---|
| Mobile | React Native, Expo, JavaScript, React Navigation, Expo Camera |
| Backend | Node.js, Express, Sequelize ORM, SQLite (JWT + bcrypt) |
| Deploy | Render Free |

## Regra fundamental: produto ≠ lote

A validade **não** é armazenada no produto. Cada produto possui múltiplos lotes,
e cada lote tem código, quantidade, data de fabricação e data de validade.

A classificação de validade (VENCIDO / URGENTE / ATENÇÃO / PRÓXIMO / NORMAL)
é calculada **dinamicamente** pela data atual — nunca gravada no banco.

## Classificação de validade

| Situação | Dias até vencimento |
|---|---|
| 🔴 VENCIDO | data já passou |
| 🔴 URGENTE | 0–3 dias |
| 🟠 ATENÇÃO | 4–7 dias |
| 🟡 PRÓXIMO | 8–30 dias |
| 🟢 NORMAL | mais de 30 dias |

## Backend

```bash
cd backend
npm install
cp .env.example .env      # configure JWT_SECRET e demais variáveis
npm run db:migrate        # cria as tabelas
npm run db:seed           # cria admin inicial + dados de demonstração
npm run dev               # desenvolvimento (nodemon)
npm start                 # produção
npm test                  # testes básicos
```

- `GET /health` → `{ "status": "ok" }`
- Login inicial (seed): `admin@valistock.com` / `admin123` — **trocar em produção**.

### Estrutura

```
backend/
├── config/         # configuração do banco (ponto único de troca)
├── controllers/    # entrada/saída HTTP
├── middlewares/    # autenticação, autorização, erros
├── models/         # Sequelize (models + associations)
├── routes/         # definição das rotas
├── services/       # regras de negócio
├── utils/          # funções utilitárias (classificação de validade, etc)
├── migrations/     # estrutura do banco
├── seeders/        # dados iniciais
├── database/       # database.sqlite (ignorada no Git)
├── tests/          # testes básicos
├── app.js
└── server.js
```

### Roles

| Role | Permissões |
|---|---|
| ADMIN | usuários, produtos, categorias, lotes, movimentações, relatórios |
| MANAGER | produtos, lotes, movimentações, estoque, dashboard, relatórios |
| EMPLOYEE | consulta, scan, lotes, validades, operações permitidas |

## ⚠️ Limitação do armazenamento (Render Free)

Este projeto é um **MVP/demo hospedado no Render Free**, utilizando **SQLite**
com arquivo local (`database/database.sqlite`).

O ambiente gratuito do Render possui **armazenamento efêmero e volátil**:
o arquivo do banco pode ser **apagado ou sobrescrito a cada deploy/restart**.
Portanto, **o SQLite local NÃO é adequado para produção** neste ambiente —
os dados podem não persistir entre reinicializações do serviço.

Para produção real, recomenda-se:

1. Migrar para **PostgreSQL** (a aplicação já está preparada: basta alterar
   `DATABASE_DIALECT=postgres` e `DATABASE_URL` — sem reescrever a aplicação,
   pois toda a persistência passa pelo Sequelize).
2. Ou utilizar um serviço de banco gerenciado com persistência garantida.

Enquanto isso, **durante o desenvolvimento o sistema funciona normalmente
utilizando SQLite**, com persistência real em arquivo (não há uso de memória
RAM nem arrays como banco de dados).

## API REST (resumo)

| Método | Rota | Descrição |
|---|---|---|
| POST | `/api/auth/login` | Login (JWT) |
| GET | `/api/auth/me` | Usuário autenticado |
| GET/POST/PUT/DELETE | `/api/products` | CRUD produtos |
| GET | `/api/products/barcode/:barcode` | Scanner |
| POST | `/api/products/import` | Importação CSV |
| GET/POST | `/api/products/:id/lots` | Lotes do produto |
| GET/PUT/DELETE | `/api/lots/:id` | Detalhe do lote |
| GET/POST/PUT/DELETE | `/api/categories` | CRUD categorias |
| GET | `/api/stock` | Visão geral do estoque |
| GET | `/api/stock/expiring` | Lotes vencendo |
| GET | `/api/stock/expired` | Lotes vencidos |
| POST/GET | `/api/stock/movements` | Movimentações |
| GET | `/api/dashboard` | Indicadores |
| GET | `/health` | Health check |

### Formato de resposta

Sucesso:
```json
{ "success": true, "data": {} }
```

Erro:
```json
{ "success": false, "message": "Produto não encontrado" }
```

## Importação CSV

Formato (com cabeçalho):

```csv
codigo_barras,nome,categoria,marca
7894900011517,Coca-Cola Original 2L,Bebidas,Coca-Cola
7891000100103,Leite Integral 1L,Laticínios,Marca X
```

- Valida campos obrigatórios e informa erros **por linha**
- Identifica códigos duplicados (no arquivo e no banco)
- Não importa lotes (cadastrados conforme a mercadoria chega)

## Mobile (React Native + Expo)

```bash
cd mobile
npm install
cp .env.example .env   # configure EXPO_PUBLIC_API_URL
npx expo start         # escaneie o QR com o app Expo Go
```

- `EXPO_PUBLIC_API_URL`: URL da API. Em emulador use `http://localhost:3000/api`;
  em dispositivo físico, use o IP da máquina (ex.: `http://192.168.0.10:3000/api`);
  em produção, a URL do Render.
- A câmera (scanner) funciona no **Expo Go** — leitura de códigos de barras
  (`ean13`, `ean8`, `upc_a`, `code128`, etc).
- Estrutura: `screens/`, `components/`, `navigation/`, `services/api.js`
  (URL central), `context/` (autenticação), `utils/`.

### Navegação

| Tab | Função |
|---|---|
| 🏠 Início | Dashboard com indicadores e lotes urgentes |
| 🔎 Produtos | Busca por nome/código + filtros de validade |
|  Scanner | Leitura de código de barras (ação principal) |
| 📦 Estoque | Visão geral com quantidades |
| ⚠️ Validades | Conferência rápida (Hoje/3/7/30/Vencidos) |

### Fluxos principais

```
Escanear → produto existe → [Ver produto] [Adicionar lote]
          → produto não existe → [Cadastrar produto] → primeiro lote
```

```
Mercadoria nova → Scanner → Adicionar lote → quantidade + validade
               → salva lote + registra ENTRADA → dashboard atualizada
```

## Testes

```bash
cd backend
npm test    # 27 testes: validade, estoque (transações/negativo), auth
```

Os testes rodam em um banco separado (`database/test.sqlite`) para não
afetar os dados de desenvolvimento.

## Deploy no Render

| | |
|---|---|
| Build Command | `npm install` |
| Start Command | `npm start` |
| Variáveis | `NODE_ENV=production`, `JWT_SECRET=...`, `DATABASE_DIALECT=sqlite`, `DATABASE_PATH=./database/database.sqlite` |
