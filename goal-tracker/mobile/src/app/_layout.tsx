/**
 * Layout raiz.
 *
 * ## Rota anônima
 *
 * Existe **uma** tela fora de `(app)`: `sign-in.tsx`. Uma tela só é o que faz
 * `Stack.Protected` funcionar sem ambiguidade — com duas rotas públicas
 * deslogado, o "redirect para a primeira tela disponível" fica ambíguo.
 *
 * ## Splash
 *
 * O `SplashScreen` fica visível enquanto `status === 'restoring'`. Sem isso,
 * abrir o app com sessão salva mostra a tela de login por um frame antes de
 * revalidar o token — o "flash de logout" que todo mundo já viu em app com
 * Router.
 *
 * Nota de versão: no SDK 57 o `SplashScreen` é importado de `expo-router`
 * (re-export de `expo-splash-screen`).
 */
import { DarkTheme, DefaultTheme, Stack, SplashScreen, ThemeProvider } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { useColorScheme } from 'react-native';

import { SessionProvider, useSession } from '@/ctx';
import { Colors } from '@/constants/theme';

SplashScreen.preventAutoHideAsync().catch(() => {
  // Já escondido (hot reload). Ignorar: não é erro.
});

export default function RootLayout() {
  const colorScheme = useColorScheme();

  return (
    <ThemeProvider value={colorScheme === 'dark' ? DarkTheme : DefaultTheme}>
      <SessionProvider>
        <StatusBar style="auto" />
        <Navigation />
      </SessionProvider>
    </ThemeProvider>
  );
}

function Navigation() {
  const { status } = useSession();
  const colorScheme = useColorScheme();
  const signedIn = status === 'signedIn';

  // Esconde o splash só quando sabemos onde o usuário vai. `restoring` mantém
  // a splash na tela.
  useEffect(() => {
    if (status !== 'restoring') {
      SplashScreen.hideAsync().catch(() => {
        // Idempotente: chamar duas vezes não é erro.
      });
    }
  }, [status]);

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        // `useColorScheme()` devolve `'light' | 'dark' | null` desde o RN
        // 0.88 (`'unspecified'` foi removido de `ColorSchemeName`). O `null`
        // cai no light pelo mesmo normalizador de `hooks/use-theme.ts`.
        contentStyle: { backgroundColor: Colors[colorScheme === 'dark' ? 'dark' : 'light'].background },
      }}>
      <Stack.Protected guard={signedIn}>
        <Stack.Screen name="(app)" />
      </Stack.Protected>

      {/* Rotas do grupo não anônimo. `guard={!signedIn}` = só quando deslogado. */}
      <Stack.Protected guard={!signedIn}>
        <Stack.Screen name="sign-in" />
      </Stack.Protected>
    </Stack>
  );
}