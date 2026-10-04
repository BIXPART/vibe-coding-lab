# AI Development Notes — Daily Goals

## 1. Context

Este projeto faz parte do meu **Vibe Coding Lab**, um repositório onde desenvolvo aplicações utilizando IA como ferramenta de desenvolvimento, sem abrir mão de decisões técnicas, regras de negócio, segurança e entendimento do código.

Sou estudante de **Desenvolvimento de Sistemas no SENAI** e ainda não possuo experiência profissional como desenvolvedor. Já desenvolvo projetos manualmente e utilizo IA como forma de acelerar meu processo de desenvolvimento.

Neste projeto, a IA deve atuar como **assistente de desenvolvimento**, e não como autoridade sobre as decisões do sistema.

---

## 2. Objetivo do projeto

Criar um aplicativo mobile de **metas recorrentes**, permitindo que o usuário crie metas diárias, semanais ou mensais e acompanhe seu histórico de cumprimento.

A ideia principal é que uma meta recorrente tenha uma nova oportunidade de conclusão a cada período, mas **o histórico dos períodos anteriores nunca seja perdido**.

Exemplo:

Uma meta diária chamada `Estudar programação`:

- 01/10 — concluída
- 02/10 — concluída
- 03/10 — não concluída
- 04/10 — pendente

No aplicativo, no início de um novo dia, a meta deve aparecer novamente como **não concluída/pendente**. Isso NÃO significa apagar ou sobrescrever os registros anteriores no banco.

---

## 3. Stack

A stack inicial planejada é:

### Mobile
- React Native
- Expo
- TypeScript

### Backend
- Node.js
- Express
- TypeScript

### Banco de dados
- PostgreSQL
- Sequelize

A arquitetura deve manter o aplicativo mobile separado da API.

### Stack efetivamente adotada

Registrada depois da implementação, para não divergir do que está no código.

**Mobile** — Expo SDK 57 · React Native 0.86 · React 19.2 · Expo Router
(navegação por arquivos em `src/app/`) · TypeScript 6 ·
`@react-native-async-storage/async-storage` (token) · `expo-symbols` (ícones).

**Backend** — Node.js 22+ · Express 5 · TypeScript · Sequelize 6 · PostgreSQL ·
Zod (validação) · `jsonwebtoken` + `bcrypt` (auth) · `express-rate-limit` ·
Vitest.

**Duas escolhas que valem registrar:**

1. **Expo Router, não `app-tabs.tsx`.** Navegação inteira por arquivos:
   `_layout.tsx` define os navegadores e `Stack.Protected` protege as rotas. No
   SDK 57, `Stack.Protected` aceita apenas `guard` — `redirectTo` é SDK 58+.
2. **Sem `date-fns` no backend.** Períodos e datas civis são resolvidos em
   `src/utils/civil-date.ts` com `Intl` e aritmética em "UTC falso". A função é
   pura, testável e imune a horário de verão. É o tipo de código em que uma
   biblioteca quase certa é pior do que o código explícito.

---

## 4. Funcionalidades

### Metas

O usuário deve conseguir:

- Criar uma meta
- Editar uma meta
- Excluir uma meta
- Visualizar suas metas
- Marcar uma meta como concluída no período atual
- Consultar o histórico de uma meta

Cada meta deve possuir, no mínimo:

- Nome
- Descrição opcional
- Frequência
- Data de criação
- Estado ativo/inativo

Frequências:

- Diária
- Semanal
- Mensal

---

## 5. Regra fundamental de recorrência

**NÃO implementar a recorrência simplesmente apagando ou alterando o estado anterior.**

O estado "concluída" pertence a uma determinada ocorrência/período.

Exemplo:

```text
Meta: Estudar programação
Frequência: diária

01/10 → concluída
02/10 → concluída
03/10 → não concluída
04/10 → pendente
```

No dia 04/10, a aplicação deve permitir que o usuário marque a ocorrência atual como concluída.

Depois disso:

```text
04/10 → concluída
```

No dia seguinte, uma nova ocorrência estará disponível:

```text
05/10 → pendente
```

As informações dos dias anteriores continuam preservadas.

---

## 6. Histórico

O histórico deve permitir descobrir:

- Quais períodos foram concluídos
- Quais períodos não foram concluídos
- Quais períodos ainda estão pendentes
- Taxa de conclusão
- Sequências de conclusões (streaks)
- Evolução ao longo do tempo

Não criar estatísticas falsas quando ainda não houver dados suficientes.

---

## 7. Dashboard

O aplicativo deve possuir uma dashboard mostrando o estado atual das metas e estatísticas.

Exemplos de informações:

- Metas do período atual
- Quantidade concluída
- Quantidade pendente
- Percentual de conclusão
- Histórico de conclusões
- Streak atual
- Melhor streak
- Evolução semanal/mensal

A interface deve ser simples e adequada para uso em celular.

---

## 8. Regras de negócio

A IA deve respeitar estas regras:

1. Uma mesma ocorrência não pode ser concluída duas vezes.
2. Uma ocorrência pertence a uma meta específica e a um período específico.
3. Concluir a ocorrência atual não pode alterar o histórico de períodos anteriores.
4. Uma meta diária possui uma ocorrência por dia.
5. Uma meta semanal possui uma ocorrência por semana.
6. Uma meta mensal possui uma ocorrência por mês.
7. O cálculo do período deve respeitar o fuso horário do usuário.
8. Uma meta excluída não deve apagar automaticamente seu histórico.
9. Operações que envolvam múltiplas alterações no banco devem utilizar transações quando necessário.
10. O backend deve validar as regras de negócio; a validação não deve existir somente no aplicativo mobile.
11. O usuário só pode acessar e alterar suas próprias metas e respectivos históricos.
12. Não confiar em IDs ou dados enviados pelo cliente para autorizar acesso.

---

## 9. Segurança

A aplicação deve considerar:

- Autenticação
- Autorização
- Hash seguro de senhas, caso haja autenticação por senha
- Validação dos dados recebidos pela API
- Sanitização quando aplicável
- Tratamento adequado de erros
- Rate limiting em endpoints sensíveis
- Não expor informações sensíveis nos erros
- Não armazenar segredos no código-fonte
- Variáveis de ambiente para credenciais
- Controle de acesso por usuário

Nunca colocar:

- Senhas
- Tokens
- API keys
- Connection strings
- Secrets

diretamente no código ou no Git.

---

## 10. Arquitetura

A IA deve evitar colocar toda a lógica dentro de controllers ou componentes React Native.

Preferir uma separação semelhante a:

```text
Mobile
├── screens
├── components
├── services
├── hooks
├── types
└── utils

API
├── controllers
├── services
├── models
├── routes
├── middlewares
├── validators
└── utils
```

As regras de negócio importantes devem ficar em uma camada apropriada do backend.

---

## 11. Banco de dados

A modelagem deve preservar o histórico.

Uma possibilidade inicial é separar:

```text
users
goals
goal_occurrences
```

Relacionamento conceitual:

```text
User
 └── Goals
      └── GoalOccurrences
```

Uma ocorrência pode conter informações como:

- ID
- ID da meta
- período/data de referência
- status
- data de conclusão
- timestamps

A modelagem final deve ser analisada antes da implementação.

Criar restrições no banco quando elas ajudarem a garantir integridade, por exemplo, evitando duas ocorrências da mesma meta para o mesmo período.

---

## 12. Uso da IA

A IA pode ser utilizada para:

- Planejamento
- Geração de código
- Estrutura inicial do projeto
- Criação de componentes
- Criação de endpoints
- Sugestão de testes
- Debugging
- Refatoração
- Documentação
- Revisão de código
- Identificação de possíveis problemas de segurança

Porém, a IA deve:

- Explicar decisões importantes quando solicitado
- Não assumir que uma implementação está correta apenas porque compila
- Não remover regras de negócio para simplificar a implementação
- Não introduzir dependências desnecessárias
- Não inventar requisitos
- Perguntar quando uma decisão importante estiver realmente ambígua

---

## 13. O que eu quero aprender com este projeto

Este projeto deve servir também como aprendizado.

Quero entender:

- Como estruturar um aplicativo React Native completo
- Como conectar React Native a uma API REST
- Como modelar dados recorrentes
- Como preservar histórico
- Como trabalhar com datas e fusos horários
- Como criar regras de negócio no backend
- Como autenticação e autorização funcionam
- Como testar uma aplicação assistida por IA
- Como revisar código gerado por IA
- Como utilizar IA sem deixar de compreender o código produzido

---

## 14. Testes

Criar testes para as regras de negócio mais importantes.

Principalmente:

- Criação de metas
- Edição
- Exclusão
- Geração/identificação do período atual
- Conclusão de ocorrência
- Impedir conclusão duplicada
- Separação entre períodos
- Cálculo de estatísticas
- Permissões entre usuários

Não considerar o projeto pronto apenas porque a interface funciona.

---

## 15. Documentação

O projeto deve possuir um `README.md` próprio contendo:

- Objetivo
- Funcionalidades
- Tecnologias
- Arquitetura
- Como executar
- Variáveis de ambiente
- Banco de dados
- Endpoints
- Screenshots, quando disponíveis
- Regras de negócio principais

---

## 16. Princípio principal

> **A IA pode escrever código, mas eu sou responsável pelas decisões do sistema.**

O objetivo deste projeto não é provar que uma IA consegue gerar um aplicativo.

O objetivo é demonstrar como um desenvolvedor em formação pode utilizar IA para acelerar o desenvolvimento enquanto continua responsável por:

- arquitetura;
- regras de negócio;
- segurança;
- banco de dados;
- testes;
- revisão;
- manutenção;
- entendimento do código.

