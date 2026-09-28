import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, AppState, Platform, StyleSheet, Text, View } from 'react-native';
import { ActionButton, Page } from '../components/ui';
import { insertClothing, listClothing } from '../data/clothing-repository';
import { runLocalTask } from '../data/database';
import { insertOutfit, listOutfits } from '../data/outfit-repository';
import { getBinding, getSyncValue } from '../data/sync-repository';
import { buildOutfit, type OutfitDraft } from '../services/outfits';
import { persistPhoto, removePhoto, resolvePhoto } from '../services/photos';
import { saveClothing, type ClothingDraft } from '../services/save-clothing';
import { syncWardrobe } from '../services/sync';
import { syncErrorMessage } from '../services/sync-engine';
import { theme } from '../theme';
import type { ClothingItem, Outfit } from '../types/wardrobe';

type WardrobeContextValue = {
  items: ClothingItem[];
  outfits: Outfit[];
  addClothing: (draft: ClothingDraft) => Promise<string>;
  addOutfit: (draft: OutfitDraft) => Promise<string>;
  sync: { running: boolean; issues: string[]; lastSuccess: string | null; userId: string | null };
  syncNow: () => Promise<void>;
};
const WardrobeContext = createContext<WardrobeContextValue | null>(null);

async function withPhoto(item: ClothingItem): Promise<ClothingItem> {
  return {
    ...item,
    localPhotoUri: item.localPhotoPath
      ? await resolvePhoto(item.localPhotoPath).catch(() => undefined)
      : undefined,
  };
}

export function WardrobeProvider({ children }: PropsWithChildren) {
  const [items, setItems] = useState<ClothingItem[]>([]);
  const [outfits, setOutfits] = useState<Outfit[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading');
  const [attempt, setAttempt] = useState(0);
  const [sync, setSync] = useState<WardrobeContextValue['sync']>({ running: false, issues: [], lastSuccess: null, userId: null });
  const syncRequest = useRef(0);
  const reload = useCallback(() => runLocalTask(async (db) => {
    const saved = await Promise.all((await listClothing(db)).map(withPhoto));
    const savedOutfits = await listOutfits(db);
    const binding = await getBinding(db);
    const lastSuccess = await getSyncValue(db, 'last_success');
    setItems(saved);
    setOutfits(savedOutfits);
    setSync((current) => ({ ...current, lastSuccess, userId: binding?.userId ?? null }));
  }), []);

  const syncNow = useCallback(async () => {
    const request = ++syncRequest.current;
    setSync((current) => ({ ...current, running: true, issues: [] }));
    let issues: string[] = [];
    try { issues = (await syncWardrobe()).issues; }
    catch (error) { issues = [syncErrorMessage(error)]; }
    try { await reload(); }
    catch { issues.push('Não foi possível atualizar a tela com os dados locais. Tente novamente.'); }
    if (request === syncRequest.current) setSync((current) => ({ ...current, running: false, issues }));
  }, [reload]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await reload();
        if (active) { setStatus('ready'); void syncNow(); }
      } catch (error) {
        console.error('Falha ao abrir o guarda roupa local:', error);
        if (active) setStatus('error');
      }
    })();
    return () => { active = false; };
  }, [attempt, reload, syncNow]);

  useEffect(() => {
    if (status !== 'ready') return;
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') void syncNow();
    });
    const online = () => { void syncNow(); };
    if (Platform.OS === 'web' && typeof window !== 'undefined') window.addEventListener('online', online);
    return () => {
      subscription.remove();
      if (Platform.OS === 'web' && typeof window !== 'undefined') window.removeEventListener('online', online);
    };
  }, [status, syncNow]);

  useEffect(() => {
    if (status !== 'ready' || sync.running) return;
    // Configuração e sessão perdida exigem ação do usuário, não novas tentativas de login.
    if (sync.issues.length && !sync.issues.some((issue) => /internet|conexão|muitas tentativas/i.test(issue))) return;
    if (!sync.issues.length && !items.some((item) => item.syncStatus === 'pending') && !outfits.some((item) => item.syncStatus === 'pending')) return;
    const timer = setTimeout(() => {
      if (AppState.currentState === 'active') void syncNow();
    }, 60000);
    return () => clearTimeout(timer);
  }, [status, sync.running, sync.issues, items, outfits, syncNow]);

  const addClothing = useCallback(async (draft: ClothingDraft) => {
    const saved = await saveClothing(draft, {
      createId: randomUUID, persistPhoto, removePhoto,
      insert: (item) => runLocalTask((db) => insertClothing(db, item)),
    });
    await reload();
    void syncNow();
    return saved.id;
  }, [reload, syncNow]);

  const addOutfit = useCallback(async (draft: OutfitDraft) => {
    const outfit = buildOutfit(draft, items, randomUUID);
    await runLocalTask((db) => insertOutfit(db, outfit));
    await reload();
    void syncNow();
    return outfit.id;
  }, [items, reload, syncNow]);

  if (status !== 'ready') {
    return <Page><View style={styles.state}>
      {status === 'loading' ? <ActivityIndicator size="large" color={theme.colors.primary} /> : null}
      <Text style={styles.title}>{status === 'loading' ? 'Abrindo seu guarda roupa…' : 'Não foi possível abrir suas peças.'}</Text>
      {status === 'error' ? <>
        <Text style={styles.description}>Seus dados não foram apagados. Tente abrir novamente.</Text>
        <ActionButton label="Tentar novamente" icon="refresh" onPress={() => { setStatus('loading'); setAttempt((value) => value + 1); }} />
      </> : null}
    </View></Page>;
  }
  return <WardrobeContext.Provider value={{ items, outfits, addClothing, addOutfit, sync, syncNow }}>{children}</WardrobeContext.Provider>;
}

export function useWardrobe() {
  const context = useContext(WardrobeContext);
  if (!context) throw new Error('useWardrobe precisa do WardrobeProvider.');
  return context;
}

const styles = StyleSheet.create({
  state: { gap: 20, paddingTop: 100 },
  title: { fontSize: 22, color: theme.colors.ink, textAlign: 'center' },
  description: { color: theme.colors.muted, fontSize: 15, lineHeight: 23, textAlign: 'center' },
});
