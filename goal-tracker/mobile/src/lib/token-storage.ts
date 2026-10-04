/**
 * Persistência do token JWT.
 *
 * ## Por que existe este arquivo
 *
 * Hoje o token mora em `AsyncStorage`. Isso é uma decisão INTERNA, não uma
 * decisão de produto: `AsyncStorage` é documentado pela Expo como
 * "asynchronous, **unencrypted**" e `inExpoGo: true`.
 *
 * O problema: o token é a credencial que dá acesso a TODOS os dados do
 * usuário. Em aparelho com root/jailbreak, ou com backup do iCloud sem
 * criptografia, ele fica legível.
 *
 * ## Como trocar depois (o ponto deste arquivo)
 *
 * A decisão de QUANDO trocar é sua. Quando decidir, mexa **aqui e em um lugar
 * só**:
 *
 *   1. `npx expo install expo-secure-store`
 *   2. troque a implementação de `createTokenStorage()` abaixo
 *   3. mais nada. Nenhum import fora deste arquivo conhece o backend.
 *
 * Se algum dia o app precisar de *dois* storages (ex.: migrar do legado), este
 * é o lugar do shim — não o `ctx.tsx`.
 *
 * ## Limitações conhecidas
 *
 * - O token é legível em rooted device / backup sem criptografia.
 * - AsyncStorage não sobrevive a limpeza de dados do app (aceito: sem cache,
 *   sem sessão persistida — o usuário loga de novo).
 * - Registrado em `mobile/README.md` como limitação conhecida.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

const TOKEN_KEY = 'goal-tracker.token';

/**
 * Interface mínima de armazenamento. Qualquer backend (AsyncStorage,
 * SecureStore, memória) satisfaz isto — é este o contrato que o resto do app
 * conhece.
 */
export interface TokenStorage {
  get(): Promise<string | null>;
  set(token: string): Promise<void>;
  clear(): Promise<void>;
}

export const createTokenStorage = (): TokenStorage => ({
  get: () => AsyncStorage.getItem(TOKEN_KEY),
  set: (token: string) => AsyncStorage.setItem(TOKEN_KEY, token),
  clear: () => AsyncStorage.removeItem(TOKEN_KEY),
});

/** Instância única. Injetada no `SessionProvider` para poder ser mockada. */
export const tokenStorage: TokenStorage = createTokenStorage();