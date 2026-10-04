/**
 * Navegação do grupo de metas.
 *
 * `Stack` e não `Tabs`: dentro da aba "Metas" a navegação é hierárquica
 * (lista → detalhe → edição), e tab dentro de tab vira um segundo nível de
 * abas que ninguém pediu.
 */
import { Stack } from 'expo-router';

import { useTheme } from '@/hooks/use-theme';

export default function GoalsLayout() {
  const theme = useTheme();

  return (
    <Stack
      screenOptions={{
        headerTintColor: theme.text,
        headerStyle: { backgroundColor: theme.background },
        contentStyle: { backgroundColor: theme.background },
      }}>
      <Stack.Screen name="index" options={{ title: 'Metas' }} />
      <Stack.Screen name="new" options={{ title: 'Nova meta', presentation: 'modal' }} />
      <Stack.Screen name="[id]/index" options={{ title: 'Meta' }} />
      <Stack.Screen name="[id]/edit" options={{ title: 'Editar meta', presentation: 'modal' }} />
    </Stack>
  );
}