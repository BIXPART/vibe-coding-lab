/**
 * Configuração da API.
 *
 * ## O problema que este arquivo resolve
 *
 * No emulador do Android, `localhost` é o próprio aparelho — não o seu
 * computador. O mesmo código que funciona no iOS Simulator dá `Network request
 * failed` no Android. Esse é o primeiro bug que quase todo mundo leva nesse
 * projeto.
 *
 * ## A estratégia
 *
 * 1. Se `EXPO_PUBLIC_API_URL` existir, ela vence. É a forma explícita de
 *    resolver, e a única que sobrevive a build de produção.
 * 2. Senão, derivamos o host do Metro. `Constants.expoConfig.hostUri` traz
 *    `192.168.1.5:8081` — o IP da máquina que roda o Expo CLI na sua rede
 *    local. Trocamos a porta pela da API e funcionamos em emulador e device
 *    físico sem configuração.
 * 3. Sem host também (web, por exemplo): `localhost`.
 *
 * ## Avisos
 *
 * - Variável `EXPO_PUBLIC_` é **inlinada no bundle em texto puro**. Nunca
 *   coloque um segredo aqui — a API não tem segredo de cliente, só URL. Ver
 *   https://docs.expo.dev/guides/environment-variables/
 * - Precisa ser notação de PONTO. `process.env['EXPO_PUBLIC_X']` não é
 *   inlinada pelo Metro e chegaria `undefined`.
 */
import Constants from 'expo-constants';
import type { PlatformOSType } from 'react-native';

const DEFAULT_PORT = 3000;

/** Extrai `192.168.1.5` de `192.168.1.5:8081`. */
function hostFromMetro(): string | undefined {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return undefined;

  const host = hostUri.split(':')[0];
  return host && host !== 'localhost' && host !== '127.0.0.1' ? host : undefined;
}

function resolveBaseUrl(): string {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/+$/, '');

  const host = hostFromMetro();
  return `http://${host ?? 'localhost'}:${DEFAULT_PORT}`;
}

export const API_BASE_URL = resolveBaseUrl();

/**
 * Endereço útil para diagnóstico: aparece na tela de perfil para você conferir
 * qual API o app está de fato chamando. É exatamente o tipo de bug que
 * "funciona na minha máquina" esconde.
 */
export function describeApiTarget(platform: PlatformOSType = 'web'): string {
  if (platform === 'android' && !process.env.EXPO_PUBLIC_API_URL && !hostFromMetro()) {
    return `${API_BASE_URL} — definido por padrão; no emulador Android provavelmente \
aponta para o próprio aparelho. Defina EXPO_PUBLIC_API_URL=http://10.0.2.2:3000.`;
  }
  return API_BASE_URL;
}
