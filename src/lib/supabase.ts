import 'react-native-url-polyfill/auto';
import { createClient } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';
import { AppState, Platform } from 'react-native';
import { resolveSupabaseConfiguration } from '../config/supabase-config';

// O Expo substitui estas referencias literais pelas variaveis EXPO_PUBLIC_.
export const supabaseConfiguration = resolveSupabaseConfiguration(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);

// Sem configuracao real, nao cria cliente nem tenta acessar o servidor.
export const supabase = supabaseConfiguration.status === 'ready'
  ? createClient(supabaseConfiguration.url, supabaseConfiguration.publishableKey, {
    global: { fetch: fetchWithTimeout },
    auth: {
      ...(Platform.OS !== 'web' ? { storage: Storage } : {}),
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: false,
    },
  })
  : null;

// Uma conexão sem resposta não deixa o botão preso indefinidamente.
async function fetchWithTimeout(input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
  const controller = new AbortController();
  const abort = () => controller.abort();
  const signal = init?.signal;
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort);
  const timeout = setTimeout(abort, 20000);
  try { return await fetch(input, { ...init, signal: controller.signal }); }
  finally { clearTimeout(timeout); signal?.removeEventListener('abort', abort); }
}

export function requireSupabase() {
  if (!supabase) {
    throw new Error(supabaseConfiguration.status === 'ready'
      ? 'A conexão com o Supabase não está disponível.'
      : supabaseConfiguration.message);
  }
  return supabase;
}

// Valida um login antes de substituir a sessão que já está no aparelho.
export function createLoginClient() {
  requireSupabase();
  if (supabaseConfiguration.status !== 'ready') throw new Error('Configure a conexão com o Supabase.');
  return createClient(supabaseConfiguration.url, supabaseConfiguration.publishableKey, {
    global: { fetch: fetchWithTimeout },
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'wardrobe-login-check' },
  });
}

// Chamado uma vez no layout; a limpeza evita listeners duplicados no remount.
export function observeSupabaseAppState() {
  const client = supabase;
  if (!client || Platform.OS === 'web') return () => {};
  function refresh(state: string) {
    const operation = state === 'active'
      ? client!.auth.startAutoRefresh()
      : client!.auth.stopAutoRefresh();
    void operation.catch(() => console.warn('Não foi possível ajustar a renovação da sessão.'));
  }
  refresh(AppState.currentState);
  const subscription = AppState.addEventListener('change', refresh);
  return () => {
    subscription.remove();
    void client.auth.stopAutoRefresh().catch(() => {});
  };
}
