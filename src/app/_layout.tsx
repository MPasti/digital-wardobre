import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { WardrobeProvider, useWardrobe } from '../context/wardrobe';
import { observeSupabaseAppState } from '../lib/supabase';
import { theme } from '../theme';

export const unstable_settings = { initialRouteName: '(tabs)' };

export default function RootLayout() {
  useEffect(() => observeSupabaseAppState(), []);
  return <SafeAreaProvider>
    <StatusBar style="dark" />
    <WardrobeProvider>
      <AppRoutes />
    </WardrobeProvider>
  </SafeAreaProvider>;
}

function AppRoutes() {
  const { account } = useWardrobe();
  return (
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.background }, headerStyle: { backgroundColor: theme.colors.background }, headerTintColor: theme.colors.primary, headerShadowVisible: false, headerBackTitle: 'Voltar' }}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="guia" options={{ presentation: 'modal' }} />
        <Stack.Protected guard={!account.signedOut}>
        <Stack.Screen name="nova-roupa" options={{ headerShown: true, title: 'Nova peça' }} />
        <Stack.Screen name="roupa/[id]" options={{ headerShown: true, title: 'Sua peça' }} />
        <Stack.Screen name="novo-look" options={{ headerShown: true, title: 'Montar look' }} />
        <Stack.Screen name="look/[id]" options={{ headerShown: true, title: 'Seu look' }} />
        </Stack.Protected>
      </Stack>
  );
}
