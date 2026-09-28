import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { ActionButton, Page } from '../components/ui';
import { insertClothing, listClothing } from '../data/clothing-repository';
import { getDatabase } from '../data/database';
import { insertOutfit, listOutfits } from '../data/outfit-repository';
import { buildOutfit, type OutfitDraft } from '../services/outfits';
import { persistPhoto, removePhoto, resolvePhoto } from '../services/photos';
import { saveClothing, type ClothingDraft } from '../services/save-clothing';
import { theme } from '../theme';
import type { ClothingItem, Outfit } from '../types/wardrobe';

type WardrobeContextValue = {
  items: ClothingItem[];
  outfits: Outfit[];
  addClothing: (draft: ClothingDraft) => Promise<string>;
  addOutfit: (draft: OutfitDraft) => Promise<string>;
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
  useEffect(() => {
    let active = true;
    (async () => {
      try {
        const db = await getDatabase();
        const saved = await Promise.all((await listClothing(db)).map(withPhoto));
        const savedOutfits = await listOutfits(db);
        if (active) { setItems(saved); setOutfits(savedOutfits); setStatus('ready'); }
      } catch (error) {
        console.error('Falha ao abrir o guarda roupa local:', error);
        if (active) setStatus('error');
      }
    })();
    return () => { active = false; };
  }, [attempt]);

  const addClothing = useCallback(async (draft: ClothingDraft) => {
    const db = await getDatabase();
    const saved = await saveClothing(draft, {
      createId: randomUUID, persistPhoto, removePhoto,
      insert: (item) => insertClothing(db, item),
    });
    const displayItem = await withPhoto(saved);
    setItems((current) => [displayItem, ...current]);
    return saved.id;
  }, []);

  const addOutfit = useCallback(async (draft: OutfitDraft) => {
    const outfit = buildOutfit(draft, items, randomUUID);
    await insertOutfit(await getDatabase(), outfit);
    setOutfits((current) => [outfit, ...current]);
    return outfit.id;
  }, [items]);

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
  return <WardrobeContext.Provider value={{ items, outfits, addClothing, addOutfit }}>{children}</WardrobeContext.Provider>;
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
