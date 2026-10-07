Sistema de Controle de Validade e Estoque

Crie um sistema completo de controle de estoque e validade de produtos para uso interno em um supermercado.

O sistema nasceu de um problema real: atualmente a conferência de validade dos produtos é feita manualmente, mesmo existindo um sistema interno de estoque. O objetivo é criar uma aplicação simples, rápida e prática para consultar produtos, controlar lotes e identificar automaticamente produtos próximos do vencimento.

Stack obrigatória

Mobile

- React Native
- Expo
- JavaScript
- NÃO utilizar TypeScript
- React Navigation
- Expo Camera para leitura de códigos de barras
- "fetch" ou Axios para comunicação com a API REST

O aplicativo deve ser pensado para uso em celular durante atividades de estoque.

Backend

- Node.js
- Express
- JavaScript
- Sequelize ORM
- SQLite
- API REST
- ".env" para configurações

Hospedagem

O backend será hospedado no Render Free.

Não criar um PostgreSQL separado.

O banco SQLite deve ficar dentro do próprio projeto/backend.

Arquitetura:

React Native + Expo
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

Importante sobre o banco

O SQLite deve ser implementado através do Sequelize.

Não espalhar queries SQL diretamente pelo código.

Utilizar:

- Models
- Associations
- Migrations
- Services
- Repositories, se necessário

A aplicação deve ser estruturada de forma que futuramente seja possível trocar SQLite por PostgreSQL alterando principalmente a configuração do Sequelize, sem precisar reescrever toda a aplicação.

Não utilizar Supabase, Firebase, Neon ou outro BaaS.

---

Limitação do Render Free

Este projeto inicialmente será um MVP/demo hospedado no Render Free.

O sistema deve deixar claro na documentação que o armazenamento SQLite local pode não ser adequado para produção devido às características de armazenamento do ambiente gratuito.

Porém, durante o desenvolvimento, o sistema deve funcionar normalmente utilizando SQLite.

Não criar uma solução falsa de persistência.

Não utilizar memória RAM como banco de dados.

Não utilizar arrays JavaScript para armazenar os dados principais.

Todos os dados da aplicação devem ser persistidos no SQLite.

---

Objetivo principal

O aplicativo deve permitir:

1. Cadastrar produtos.
2. Cadastrar múltiplos lotes para cada produto.
3. Registrar quantidade por lote.
4. Registrar data de validade por lote.
5. Consultar produtos.
6. Pesquisar produtos pelo nome ou código de barras.
7. Escanear código de barras pela câmera.
8. Identificar automaticamente produtos próximos do vencimento.
9. Mostrar produtos vencidos.
10. Mostrar quantidade total em estoque.
11. Mostrar uma dashboard com indicadores.
12. Registrar movimentações de estoque.
13. Manter histórico das movimentações.
14. Permitir importação inicial de produtos por CSV.
15. Ter autenticação de usuários.
16. Possuir diferentes níveis de acesso.

---

Regra fundamental: produto ≠ lote

Não armazenar validade diretamente no produto.

Um produto pode possuir vários lotes, e cada lote pode possuir:

- código
- quantidade
- data de fabricação
- data de validade

Exemplo:

Coca-Cola Original 2L
│
├── Lote A49281
│   ├── 12 unidades
│   └── validade: 10/10/2026
│
├── Lote B51273
│   ├── 35 unidades
│   └── validade: 25/11/2026
│
└── Lote C82731
    ├── 20 unidades
    └── validade: 03/01/2027

A quantidade total do produto deve ser calculada com base nos lotes e nas movimentações.

---

Banco de dados

Criar migrations Sequelize.

users

Campos:

- id
- name
- email
- password_hash
- role
- created_at
- updated_at

Roles:

ADMIN
MANAGER
EMPLOYEE

categories

Campos:

- id
- name
- created_at
- updated_at

products

Campos:

- id
- barcode
- name
- brand
- category_id
- active
- created_at
- updated_at

O código de barras deve possuir índice/unique quando apropriado.

lots

Campos:

- id
- product_id
- lot_code
- quantity
- manufactured_at
- expires_at
- created_at
- updated_at

Um produto pode possuir vários lotes.

stock_movements

Campos:

- id
- product_id
- lot_id
- type
- quantity
- reason
- user_id
- created_at

Tipos:

ENTRY
SALE
LOSS
ADJUSTMENT
EXPIRATION

Os relacionamentos devem ser:

Category 1:N Product

Product 1:N Lot

Product 1:N StockMovement

Lot 1:N StockMovement

User 1:N StockMovement

---

Controle de estoque

Não permitir simplesmente alterar a quantidade sem considerar o histórico.

Sempre que houver uma operação de estoque, registrar uma movimentação quando aplicável.

Exemplo:

Entrada +100
Venda -20
Perda -5
Ajuste +2

O sistema deve impedir estoque negativo quando a operação não permitir isso.

As operações de estoque devem utilizar transações do Sequelize quando houver múltiplas alterações que precisam ser atômicas.

---

Dashboard

A tela inicial deve mostrar:

- produtos cadastrados
- quantidade total de unidades
- lotes vencidos
- lotes vencendo em até 3 dias
- lotes vencendo em até 7 dias
- lotes vencendo em até 30 dias

Mostrar também os produtos/lotes mais urgentes.

Exemplo:

⚠️ PRÓXIMOS DO VENCIMENTO

Leite Integral 1L
14 unidades
vence em 2 dias

Iogurte Natural
8 unidades
vence em 4 dias

Presunto 500g
6 unidades
vence em 6 dias

Ordenar pela validade mais próxima.

---

Classificação de validade

Calcular dinamicamente com base na data atual.

Data já passou
→ 🔴 VENCIDO

0–3 dias
→ 🔴 URGENTE

4–7 dias
→ 🟠 ATENÇÃO

8–30 dias
→ 🟡 PRÓXIMO

Mais de 30 dias
→ 🟢 NORMAL

Não armazenar esse status como valor fixo no banco.

Criar uma função/service centralizado para calcular esse status.

---

Cadastro de produtos

Permitir cadastrar manualmente:

- código de barras
- nome
- marca
- categoria

O código de barras pode ser preenchido através do scanner.

Fluxo:

Abrir Scanner
      ↓
Escanear código
      ↓
Consultar API
      ↓
Produto existe?
   ↙          ↘
 SIM          NÃO
 ↓             ↓
Produto       Cadastro
existente     de produto

---

Cadastro de lote

O lote deve ser criado dentro de um produto.

Campos:

- código do lote
- quantidade
- data de fabricação
- data de validade

Exemplo:

Produto:
Coca-Cola Original 2L

Lote:
A49281

Quantidade:
24

Fabricação:
10/07/2026

Validade:
10/10/2026

Ao cadastrar o lote, registrar a entrada correspondente no histórico de movimentações.

---

Scanner

Criar uma tela dedicada para leitura de código de barras.

Ao escanear:

Produto existente

Mostrar:

Produto encontrado

Coca-Cola Original 2L

[Ver produto]
[Adicionar lote]

Produto inexistente

Mostrar:

Produto não cadastrado

Código:
7894900011517

[ Cadastrar produto ]

O código lido deve ser automaticamente preenchido no cadastro.

Após cadastrar um produto novo, permitir seguir diretamente para o cadastro do primeiro lote.

---

Consulta de produtos

Criar tela com:

- busca por nome
- busca por código de barras
- filtros

Filtros:

Todos
Vencidos
Urgentes
Até 7 dias
Até 30 dias
Normais

Mostrar:

- nome
- marca
- quantidade total
- quantidade de lotes
- validade mais próxima
- status

---

Detalhes do produto

Exemplo:

Coca-Cola Original 2L

Código:
7894900011517

Estoque:
47 unidades

LOTES

Lote A49281
12 unidades
10/10/2026
🔴 Vence em 3 dias

Lote B51273
35 unidades
25/11/2026
🟢 Normal

[+ Adicionar lote]

---

Tela de estoque

Criar uma tela para consulta geral.

Permitir:

- pesquisar
- filtrar
- visualizar quantidade
- visualizar situação de validade
- abrir produto

---

Tela de validades

Criar uma tela específica para a rotina de conferência.

Filtros:

Hoje
3 dias
7 dias
30 dias
Vencidos

Essa tela deve priorizar praticidade e velocidade.

---

Importação inicial de produtos

Como o banco começa vazio, permitir importar produtos através de CSV.

Formato:

codigo_barras,nome,categoria,marca
7894900011517,Coca-Cola Original 2L,Bebidas,Coca-Cola
7891000100103,Leite Integral 1L,Laticínios,Marca X

A importação deve:

- validar o arquivo
- validar campos obrigatórios
- identificar códigos duplicados
- evitar produtos duplicados
- informar erros por linha
- informar quantidade importada
- utilizar transação quando apropriado

Não importar lotes inicialmente.

Os lotes serão cadastrados posteriormente conforme os produtos chegam ao estoque.

---

Autenticação

Implementar:

- login
- logout
- JWT
- hash de senha
- middleware de autenticação

Nunca retornar "password_hash" para o mobile.

Permissões:

ADMIN

Pode:

- gerenciar usuários
- gerenciar produtos
- gerenciar categorias
- visualizar estoque
- cadastrar lotes
- registrar movimentações
- visualizar relatórios

MANAGER

Pode:

- gerenciar produtos
- cadastrar lotes
- registrar movimentações
- visualizar estoque
- visualizar dashboard
- visualizar relatórios

EMPLOYEE

Pode:

- consultar produtos
- escanear produtos
- visualizar lotes
- consultar validade
- registrar operações permitidas

Criar middleware para autorização baseada em role.

---

API REST

Criar endpoints:

POST   /api/auth/login
GET    /api/auth/me

GET    /api/products
GET    /api/products/:id
GET    /api/products/barcode/:barcode
POST   /api/products
PUT    /api/products/:id
DELETE /api/products/:id

GET    /api/categories
POST   /api/categories
PUT    /api/categories/:id
DELETE /api/categories/:id

GET    /api/products/:id/lots
POST   /api/products/:id/lots
GET    /api/lots/:id
PUT    /api/lots/:id
DELETE /api/lots/:id

GET    /api/stock
GET    /api/stock/expiring
GET    /api/stock/expired

POST   /api/stock/movements
GET    /api/stock/movements

GET    /api/dashboard

POST   /api/products/import

Utilizar HTTP status codes corretamente.

---

Resposta da API

Padronizar respostas.

Sucesso:

{
  "success": true,
  "data": {}
}

Erro:

{
  "success": false,
  "message": "Produto não encontrado"
}

Não expor informações internas ou stack traces em produção.

---

Estrutura do backend

Utilizar:

backend/
├── config/
│   └── database.js
│
├── controllers/
│
├── middlewares/
│
├── models/
│
├── routes/
│
├── services/
│
├── utils/
│
├── migrations/
│
├── seeders/
│
├── database/
│   └── database.sqlite
│
├── app.js
├── server.js
├── package.json
└── .env

Responsabilidades:

routes
→ definição das rotas

controllers
→ entrada/saída HTTP

services
→ regras de negócio

models
→ Sequelize

middlewares
→ autenticação, autorização e erros

config
→ configuração do banco

migrations
→ estrutura/evolução do banco

Não colocar toda a lógica dentro do "server.js".

---

SQLite

Configurar Sequelize para SQLite.

Exemplo conceitual:

const sequelize = new Sequelize({
  dialect: 'sqlite',
  storage: process.env.DATABASE_PATH || './database/database.sqlite'
});

Não utilizar credenciais hardcoded.

Criar ".gitignore" contendo:

node_modules/
.env
database/*.sqlite

O arquivo do banco não deve ser enviado para o Git.

---

Preparação para PostgreSQL futuro

Mesmo utilizando SQLite inicialmente, estruturar o código para permitir futura migração para PostgreSQL.

A configuração do banco deve ficar isolada.

Exemplo:

DATABASE_DIALECT=sqlite
DATABASE_PATH=./database/database.sqlite

No futuro:

DATABASE_DIALECT=postgres
DATABASE_URL=...

Não espalhar configurações específicas do SQLite pela aplicação.

Evitar recursos SQL específicos do SQLite quando existir uma alternativa compatível com PostgreSQL.

---

Render

O backend deve estar preparado para:

npm install
npm start

O servidor deve utilizar:

process.env.PORT

Criar script:

{
  "scripts": {
    "start": "node server.js"
  }
}

Configurar no Render:

Build Command:
npm install

Start Command:
npm start

Variáveis:

NODE_ENV=production
JWT_SECRET=...
DATABASE_DIALECT=sqlite
DATABASE_PATH=./database/database.sqlite

Adicionar endpoint:

GET /health

que retorne algo como:

{
  "status": "ok"
}

---

Mobile

Estrutura:

mobile/
├── assets/
├── components/
├── screens/
├── navigation/
├── services/
│   └── api.js
├── hooks/
├── utils/
├── context/
├── App.js
└── package.json

Não utilizar TypeScript.

Criar um arquivo central para a URL da API.

Exemplo:

const API_URL = 'https://SEU-BACKEND.onrender.com/api';

Preferencialmente utilizar variável de ambiente/configuração adequada para Expo.

Não espalhar URLs pela aplicação.

---

Navegação

Utilizar:

🏠 Início
🔎 Produtos
📷 Scanner
📦 Estoque
⚠️ Validades

O Scanner deve receber destaque por ser uma ação frequente.

---

UX/UI

A interface deve ser:

- mobile-first
- limpa
- profissional
- rápida
- fácil de usar com uma mão
- com botões grandes
- boa hierarquia visual
- sem excesso de animações
- sem excesso de elementos decorativos

O objetivo é produtividade.

O fluxo mais importante deve ser:

Abrir app
    ↓
Scanner
    ↓
Escanear produto
    ↓
Visualizar validade

Deve exigir o mínimo possível de passos.

Criar estados para:

- loading
- erro
- vazio
- sucesso
- produto não encontrado
- conexão indisponível

---

Tratamento de conexão

Como o backend estará hospedado no Render Free, considerar que o serviço pode demorar para responder após ficar inativo.

O aplicativo deve:

- mostrar loading apropriado
- não parecer travado
- tratar timeout
- mostrar mensagem de erro amigável
- permitir tentar novamente

Não esconder erros da API.

---

MVP

Implementar primeiro:

1. Configuração do projeto
2. SQLite + Sequelize
3. Migrations
4. Models
5. API Express
6. Autenticação
7. CRUD de categorias
8. CRUD de produtos
9. CRUD de lotes
10. Movimentações
11. Cálculo de validade
12. Dashboard
13. Tela de produtos
14. Tela de lotes
15. Scanner
16. Tela de validades
17. Importação CSV
18. Integração mobile + API
19. Testes básicos
20. Deploy no Render

Depois implementar funcionalidades adicionais.

---

Regras importantes para a IA

- NÃO utilizar TypeScript.
- NÃO utilizar PostgreSQL neste primeiro momento.
- NÃO utilizar Supabase.
- NÃO utilizar Firebase.
- NÃO utilizar Neon.
- NÃO criar um banco separado no Render.
- Utilizar SQLite dentro do backend.
- Utilizar Sequelize.
- Utilizar migrations.
- Não armazenar dados principais em arrays JavaScript.
- Não utilizar dados mockados como substituição do backend real.
- Não colocar toda a aplicação em "server.js".
- Não colocar regras de negócio diretamente nas rotas.
- Não armazenar senhas em texto puro.
- Não retornar "password_hash".
- Não duplicar produtos por código de barras.
- Não colocar validade diretamente em "products".
- Não permitir estoque negativo indevidamente.
- Registrar movimentações de estoque.
- Manter o código preparado para futura migração para PostgreSQL.
- Priorizar simplicidade e funcionamento antes de adicionar funcionalidades.

---

Resultado esperado

O resultado final deve ser um sistema funcional de controle de validade e estoque que poderia ser utilizado por uma equipe de estoque de supermercado.

O sistema deve permitir que um funcionário:

Abra o aplicativo
      ↓
Escaneie um produto
      ↓
Encontre o produto
      ↓
Veja seus lotes
      ↓
Veja as validades
      ↓
Identifique rapidamente se existe algo próximo do vencimento

E, quando uma mercadoria nova chegar:

Escanear produto
      ↓
Produto existe?
      ↓
Adicionar lote
      ↓
Informar quantidade
      ↓
Informar validade
      ↓
Registrar entrada
      ↓
Dashboard atualizada

O projeto deve priorizar uma experiência realista de uso em estoque, código organizado e uma arquitetura que possa crescer futuramente.

Comece implementando o backend e o banco SQLite primeiro. Depois implemente o mobile consumindo a API real. Não avance para funcionalidades posteriores enquanto a etapa atual não estiver funcional.