/**
 * Telas autenticadas.
 *
 * Três abas. A decisão por `Tabs` do `expo-router` (e não o `app-tabs.tsx` do
 * template) é do usuário: é a API que o Router suporta nativamente no SDK 57,
 * sem camada extra de abstração.
 *
 * ## Sobre os ícones
 *
 * `expo-symbols` (já era dependência do template) resolve o nome por
 * plataforma. Atenção à API: **fora do iOS o `name` precisa ser um objeto**
 * `{ ios, android, web }`. Com uma string simples, a implementação web/Android
 * faz `props.name[Platform.OS === 'android' ? 'android' : 'web']` sobre uma
 * string — o resultado é `undefined` e o ícone simplesmente não aparece.
 *
 * SF Symbols (iOS) e Material Symbols (Android/web) não compartilham nomes, daí
 * o par explícito por aba.
 */
import { Tabs } from 'expo-router';
import { SymbolView } from 'expo-symbols';
import type { SFSymbol } from 'expo-symbols';
import type { ColorValue } from 'react-native';

import { useSession } from '@/ctx';
import { useTheme } from '@/hooks/use-theme';

/**
 * `expo-symbols` mapeia por plataforma, e os dois catálogos não compartilham
 * nomes: SF Symbols no iOS, Material Symbols no Android/web.
 */
type AndroidSymbol = 'check_circle' | 'target' | 'person';

type TabSymbol = { ios: SFSymbol; android: AndroidSymbol; web: AndroidSymbol };

function TabIcon({ symbol, color }: { symbol: TabSymbol; color: ColorValue }) {
  return (
    <SymbolView
      name={symbol}
      tintColor={color}
      size={26}
      type="hierarchical"
      resizeMode="scaleAspectFit"
      style={{ width: 26, height: 26 }}
    />
  );
}

const SYMBOLS = {
  today: { ios: 'checkmark.circle', android: 'check_circle', web: 'check_circle' },
  goals: { ios: 'target', android: 'target', web: 'target' },
  profile: { ios: 'person.crop.circle', android: 'person', web: 'person' },
} as const satisfies Record<string, TabSymbol>;

export default function AppTabs() {
  const theme = useTheme();
  const { user } = useSession();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: theme.text,
        tabBarInactiveTintColor: theme.textSecondary,
        tabBarStyle: { backgroundColor: theme.background },
        sceneStyle: { backgroundColor: theme.background },
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Hoje',
          tabBarAccessibilityLabel: 'Hoje',
          tabBarIcon: ({ color }) => <TabIcon symbol={SYMBOLS.today} color={color} />,
        }}
      />

      <Tabs.Screen
        name="goals"
        options={{
          title: 'Metas',
          tabBarAccessibilityLabel: 'Metas',
          tabBarIcon: ({ color }) => <TabIcon symbol={SYMBOLS.goals} color={color} />,
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: 'Perfil',
          // O cabeçalho fica dentro da própria tela: mostra nome, e-mail e fuso,
          // o que é informação útil e não decoração.
          headerShown: false,
          tabBarAccessibilityLabel: `Perfil de ${user?.name ?? user?.email ?? 'usuário'}`,
          tabBarIcon: ({ color }) => <TabIcon symbol={SYMBOLS.profile} color={color} />,
        }}
      />
    </Tabs>
  );
}