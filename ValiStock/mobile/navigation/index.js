/**
 * Navegação do aplicativo.
 *
 * Estrutura:
 * - Sem token → Login
 * - Com token → Tabs:
 *   🏠 Início | 🔎 Produtos | 📷 Scanner (destaque) | 📦 Estoque | ⚠️ Validades
 *
 * Stack secundária: detalhe do produto, novo produto, novo lote, importar CSV.
 */
import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { NavigationContainer } from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { colors } from '../utils/theme';
import { LoadingState } from '../components/States';

import LoginScreen from '../screens/LoginScreen';
import HomeScreen from '../screens/HomeScreen';
import ProductsScreen from '../screens/ProductsScreen';
import ProductDetailScreen from '../screens/ProductDetailScreen';
import ScannerScreen from '../screens/ScannerScreen';
import StockScreen from '../screens/StockScreen';
import ExpiryScreen from '../screens/ExpiryScreen';
import NewProductScreen from '../screens/NewProductScreen';
import NewLotScreen from '../screens/NewLotScreen';
import ImportScreen from '../screens/ImportScreen';
import RegisterMovementScreen from '../screens/RegisterMovementScreen';

const Tab = createBottomTabNavigator();
const Stack = createNativeStackNavigator();

const screenOptions = {
  headerStyle: { backgroundColor: colors.surface },
  headerTintColor: colors.text,
  headerTitleStyle: { fontWeight: '600' },
  headerShadowVisible: false,
};

const TabIcon = ({ emoji, focused }) => (
  <View style={tabStyles.container}>
    <Text style={[tabStyles.emoji, focused && tabStyles.emojiFocused]}>{emoji}</Text>
    {focused && <View style={tabStyles.indicator} />}
  </View>
);

const tabStyles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
  emoji: { fontSize: 20, opacity: 0.6 },
  emojiFocused: { opacity: 1 },
  indicator: {
    width: 18,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.primary,
    marginTop: 2,
  },
});

const MainTabs = () => (
  <Tab.Navigator
    screenOptions={{
      ...screenOptions,
      tabBarActiveTintColor: colors.primary,
      tabBarInactiveTintColor: colors.textMuted,
      tabBarStyle: { height: 62, paddingBottom: 8, paddingTop: 6 },
      tabBarLabelStyle: { fontSize: 11, fontWeight: '600' },
    }}
  >
    <Tab.Screen
      name="Home"
      component={HomeScreen}
      options={{
        title: 'Início',
        tabBarIcon: ({ focused }) => <TabIcon emoji="🏠" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="Products"
      component={ProductsScreen}
      options={{
        title: 'Produtos',
        tabBarIcon: ({ focused }) => <TabIcon emoji="🔎" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="Scanner"
      component={ScannerScreen}
      options={{
        title: 'Scanner',
        tabBarIcon: ({ focused }) => <TabIcon emoji="📷" focused={focused} />,
        tabBarLabelStyle: { fontSize: 12, fontWeight: '800', color: colors.primary },
      }}
    />
    <Tab.Screen
      name="Stock"
      component={StockScreen}
      options={{
        title: 'Estoque',
        tabBarIcon: ({ focused }) => <TabIcon emoji="📦" focused={focused} />,
      }}
    />
    <Tab.Screen
      name="Expiry"
      component={ExpiryScreen}
      options={{
        title: 'Validades',
        tabBarIcon: ({ focused }) => <TabIcon emoji="⚠️" focused={focused} />,
      }}
    />
  </Tab.Navigator>
);

const AppStack = () => (
  <Stack.Navigator screenOptions={screenOptions}>
    <Stack.Screen
      name="Main"
      component={MainTabs}
      options={{ headerShown: false }}
    />
    <Stack.Screen
      name="ProductDetail"
      component={ProductDetailScreen}
      options={{ title: 'Produto' }}
    />
    <Stack.Screen
      name="NewProduct"
      component={NewProductScreen}
      options={{ title: 'Novo produto' }}
    />
    <Stack.Screen
      name="NewLot"
      component={NewLotScreen}
      options={{ title: 'Adicionar lote' }}
    />
    <Stack.Screen
      name="Import"
      component={ImportScreen}
      options={{ title: 'Importar CSV' }}
    />
    <Stack.Screen
      name="RegisterMovement"
      component={RegisterMovementScreen}
      options={{ title: 'Movimentar estoque' }}
    />
  </Stack.Navigator>
);

const Navigation = () => {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingState message="Verificando sessão..." />;
  }

  return (
    <NavigationContainer>
      {user ? <AppStack /> : <LoginScreen />}
    </NavigationContainer>
  );
};

export default Navigation;
