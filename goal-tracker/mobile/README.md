# Goal Tracker — Mobile

App mobile (Expo / React Native) do Goal Tracker. Fala com a API do
[`../backend`](../backend) por HTTPS/HTTP.

O backend é a **autoridade** sobre regra de negócio. Este app formata e exibe;
não calcula período, não decide status, não inventa estatística. Ver
[`../AI_NOTES.md`](../AI_NOTES.md) §10.

---

## Índice

- [Rodando](#rodando)
- [Endereço da API](#endereço-da-api)
- [Estrutura](#estrutura)
- [Rotas](#rotas)
- [Decisões que valem explicar](#decisões-que-valem-explicar)
- [Limitações conhecidas](#limitações-conhecidas)
- [Scripts](#scripts)

---

## Rodando

Pré-requisito: o backend no ar (`cd ../backend && npm run dev`).

```bash
npm install
cp .env.example .env.local     # opcional; veja a seção seguinte
npx expo start
```

Para logar, semeie o backend uma vez:

```bash
cd ../backend && npm run db:seed
# demo@goaltracker.dev / demo1234
```

### Primeiro build de desenvolvimento

`AsyncStorage` é módulo nativo. Ele é `inExpoGo: true` (não exige build próprio),
então o Expo Go serve. Se em algum momento entrar outro módulo nativo, o
Expo Go deixa de bastar:

```bash
npx expo run:ios      # ou run:android
```

`ios/` e `android/` são gerados (Continuous Native Generation). **Nunca edite
esses diretórios à mão** — configure em `app.json` e config plugins.

---

## Endereço da API

Esta é a causa nº 1 de "não funciona no meu celular". O app resolve em três
níveis, em `src/lib/env.ts`:

1. **`EXPO_PUBLIC_API_URL`** definido em `.env.local` — vence sempre. É a forma
   explícita, e a única que sobrevive a build de produção.
2. **Host derivado do Metro**: `Constants.expoConfig.hostUri` devolve algo como
   `192.168.1.5:8081`; trocamos pela porta da API. Funciona em iOS Simulator e
   em aparelho físico na mesma rede, sem configurar nada.
3. **`localhost:3000`** como último recurso.

| Onde | Valor |
|---|---|
| iOS Simulator | derivado do Metro, ou `http://localhost:3000` |
| Android emulador | **`http://10.0.2.2:3000`** — `localhost` é o próprio aparelho |
| Aparelho físico | `http://SEU_IP_LOCAL:3000` |
| Produção | `https://api.seudominio.com` |

O endereço realmente em uso aparece na tela **Perfil → Diagnóstico**. Confira lá
antes de caçar bug em outro lugar.

### Cuidado com `EXPO_PUBLIC_`

Variáveis com esse prefixo são **inlinadas no bundle em texto puro**. Nunca
coloque um segredo aqui — a API não tem credencial de cliente, só endereço.

E precisa ser notação de **ponto**: `process.env.EXPO_PUBLIC_API_URL`.
`process.env['EXPO_PUBLIC_API_URL']` não é inlinada pelo Metro e chegaria
`undefined` em execução.

`.env.local` já está no `.gitignore`. `.env.example` está versionado.

---

## Estrutura

```
src/
  app/                    rotas (Expo Router) — cada arquivo é uma tela
    _layout.tsx           raiz: tema + SessionProvider + guarda de rotas
    sign-in.tsx           ÚNICA rota pública
    (app)/
      _layout.tsx         Tabs: Hoje | Metas | Perfil
      index.tsx           Hoje (dashboard)
      profile.tsx         Perfil + diagnóstico + sair
      goals/
        _layout.tsx       Stack da aba Metas
        index.tsx         lista paginada
        new.tsx           criar
        [id]/index.tsx    detalhe, concluir, estatísticas, histórico
        [id]/edit.tsx     editar

  components/             UI compartilhada (não chamam a API)
  hooks/                  use-async (leitura), use-action (escrita), use-theme…
  lib/                    env, token-storage, format (datas civis)
  services/               api, auth, goals, dashboard
  types/api.ts            tipos do contrato com a API
  ctx.tsx                 SessionProvider
```

O alias `@/` aponta para `src/` (configurado em `tsconfig.json`).

### Fronteira entre camadas

`app/` e `components/` nunca chamam `fetch`. Só `services/` faz I/O, e só
`hooks/` orquestram estado. É o que mantém a regra 10 verificável: se um cálculo
de período aparece num componente, algo mudou de camada.

---

## Rotas

| Rota | Protegida | Tela |
|---|---|---|
| `/sign-in` | só deslogado | Entrar / criar conta |
| `/` | sim | Hoje |
| `/goals` | sim | Lista de metas |
| `/goals/new` | sim | Nova meta |
| `/goals/[id]` | sim | Detalhe + concluir |
| `/goals/[id]/edit` | sim | Editar |
| `/profile` | sim | Perfil |

A proteção usa `Stack.Protected` no layout raiz:

```tsx
<Stack.Protected guard={signedIn}><Stack.Screen name="(app)" /></Stack.Protected>
<Stack.Protected guard={!signedIn}><Stack.Screen name="sign-in" /></Stack.Protected>
```

Existe **uma** rota pública de propósito. Com duas, o redirect padrão ("primeira
tela disponível") fica ambíguo.

> `redirectTo` em `Stack.Protected` é **SDK 58+**. Não usar neste SDK.
> Da mesma forma, `Tabs` vem de `expo-router` (a doc de protected routes mostra
> `expo-router/js-tabs`, que não existe em 57.0.24).

---

## Decisões que valem explicar

### O app não calcula período

`periodStart`, `periodEnd`, `window.from/to`, streaks e `completionRate` vêm
prontos do servidor. O app exibe.

Motivo concreto: **o fuso do usuário define o que é "hoje"**, e essa informação
só existe no servidor. Se o app recalculasse, os dois discordariam na virada do
dia — e o usuário veria "concluído" numa tela e "pendente" na outra.

Por isso `src/lib/format.ts` **nunca** faz `new Date('2026-10-04')`: isso é
interpretado como meia-noite UTC, que no Brasil é 21:00 do dia anterior. As
funções leem as partes da string e montam a data explicitamente.

### Fuso detectado no boot

`Intl.DateTimeFormat().resolvedOptions().timeZone` no boot, sincronizado em
`PATCH /auth/me` **só quando difere** do valor salvo. Se o usuário viajou ou trocou
de celular, o fuso salvo ficou errado e toda a lógica de período usaria o dia
errado. Um PATCH a cada abertura gastaria requisição e arriscaria `429`.

### Concluir é idempotente na prática

`completeCurrentOccurrence` trata `409 OCCURRENCE_ALREADY_COMPLETED` como
**sucesso**. Tocar duas vezes não pode gerar erro nem duas linhas. Para montar o
resultado, o service lê o período de `GET /goals/:id/stats` — de novo, sem
recalcular nada no cliente.

### `useAsync` não zera estado no efeito

Buscar dados é sincronizar com sistema externo, mas a regra
`react-hooks/set-state-in-effect` está certa: `setState` síncrono no corpo do
efeito gera render em cascata. O efeito aqui **só dispara a promessa**; os
commits acontecem em `.then`/`.catch`. O estado inicial já é `loading: true`, e
trocar de dependência mantém os dados antigos visíveis (equivale a `reload`) —
trocar de meta não deve piscar um spinner no lugar do conteúdo.

O mesmo motivo fez o formulário de edição virar um componente separado com
`useState` inicializado a partir das props: preencher campos por efeito deixa
uma janela em que estão vazios, e salvar nela sobrescreveria a meta com nada.

### `web.output: "single"`

O template vinha com `"static"`, que é para SEO. A própria documentação avisa
que nesse modo "não é uma single-page application" e que rotas dinâmicas
(`[id]`) não funcionam sem `generateStaticParams`. Um app em que toda tela
depende de sessão do cliente é o oposto de um site estático. `single` é o
default do Expo, e é o certo aqui.

---

## Limitações conhecidas

Registradas de propósito (AI_NOTES §15). Nenhuma é oculta.

### 1. O token JWT fica em `AsyncStorage`, sem criptografia

`AsyncStorage` é documentado pela Expo como *"asynchronous, unencrypted"*. O
token é a credencial que dá acesso a **todos** os dados do usuário; em aparelho
com root/jailbreak ou com backup do iCloud sem criptografia, ele fica legível.

Decisão conscious do usuário, com mitigação acordada: o acesso ao storage está
abstrato atrás da interface `TokenStorage` em `src/lib/token-storage.ts`. Trocar
por `expo-secure-store` depois é reescrever **um arquivo**:

```bash
npx expo install expo-secure-store
```

e então substituir a implementação de `createTokenStorage()`. Nenhum import fora
daquele arquivo conhece o backend de armazenamento.

### 2. Logout não revoga o token

O backend não tem revogação de token; o JWT é válido até expirar. "Sair" limpa
o token do aparelho e nada mais. A tela de Perfil diz isso ao usuário em vez de
deixar parecer que a sessão foi invalidada no servidor.

### 3. `AUTH_RATE_LIMIT_MAX=10` atrapalha o desenvolvimento

Tentar logar algumas vezes com senha errada **vai** gerar `429`. Isso é
proteção funcionando, não defeito do app — a mensagem na tela de login diz
exatamente isso. Durante o desenvolvimento, aumente `AUTH_RATE_LIMIT_MAX` no
`backend/.env` ou espere a janela de 15 min.

### 4. Truncamento de lista no servidor

`GET /goals` trunca silenciosamente em 100 registros. Por isso a lista usa botão
"Carregar mais" com `limit` crescente até 100, e não rolagem infinita: simular
scroll infinito sobre uma base truncada daria a impressão de bug. É uma
limitação do backend (não uma decisão do app) e precisa ser corrigida lá.

### 5. CORS só importa na web

App nativo (iOS/Android) não envia header `Origin`, então CORS é irrelevante. Só
`expo start --web` depende de `CORS_ORIGIN` no backend.

### 6. Sem testes automatizados

O projeto tem suíte de testes no backend; o mobile ainda não tem. A verificação
feita até aqui foi `tsc --noEmit`, `expo lint`, build de produção e conferência
do contrato da API contra as formas reais devolvidas — mas **não** cobre
renderização e interação. Rodar `npx expo start` e navegar é parte do trabalho.

### 7. `npx expo install` falha com npm 12

A CLI do Expo passa `--allow-scripts`, que o npm ≥ 12 rejeita em instalação de
projeto. Não é bug deste projeto. Contorno: insira a versão manually e rode
`npm install` — a versão correta está em
`node_modules/expo/bundledNativeModules.json`, e `npx expo install --check`
valida. Foi assim que `@react-native-async-storage/async-storage@2.2.0` entrou.

---

## Scripts

| Comando | O quê |
|---|---|
| `npx expo start` | dev server |
| `npx expo start --ios` / `--android` / `--web` | abre direto na plataforma |
| `npm run lint` | ESLint (`eslint-config-expo`) |
| `npm run typecheck` | `tsc --noEmit` |
| `npx expo-doctor` | diagnóstico de dependências e config |

Rode `lint` **e** `typecheck` antes de dar qualquer tarefa por concluída.