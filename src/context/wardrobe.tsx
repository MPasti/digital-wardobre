import { randomUUID } from 'expo-crypto';
import { createContext, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react';
import { ActivityIndicator, AppState, Modal, Platform, StyleSheet, Text, View } from 'react-native';
import { ActionButton, Page } from '../components/ui';
import { insertClothing, listClothing } from '../data/clothing-repository';
import { runLocalTask } from '../data/database';
import { insertOutfit, listOutfits } from '../data/outfit-repository';
import { getBinding, getSyncValue } from '../data/sync-repository';
import { deleteClothing, deleteOutfit, listDeletions, nextUpdatedAt, updateClothing, updateOutfit } from '../data/wardrobe-mutations';
import { buildOutfit, type OutfitDraft } from '../services/outfits';
import { persistPhoto, removePhoto, resolvePhoto } from '../services/photos';
import { saveClothing, type ClothingDraft } from '../services/save-clothing';
import { syncWardrobe, withSyncPaused } from '../services/sync';
import { changeRegistrationEmail, completeRegistration, continueAnonymously, emptyAccount, loginAccount, logoutAccount, readAccountState, reconcileAccountOnStartup, registerAccount, rememberSessionAccount, resendConfirmation, type AccountState } from '../services/account';
import { syncErrorMessage } from '../services/sync-engine';
import { theme } from '../theme';
import type { ClothingItem, Outfit } from '../types/wardrobe';

type WardrobeContextValue = {
  items: ClothingItem[];
  outfits: Outfit[];
  addClothing: (draft: ClothingDraft) => Promise<string>;
  addOutfit: (draft: OutfitDraft) => Promise<string>;
  editClothing: (id: string, draft: ClothingDraft) => Promise<string>;
  editOutfit: (id: string, draft: OutfitDraft) => Promise<string>;
  removeClothing: (id: string) => Promise<void>;
  removeOutfit: (id: string) => Promise<void>;
  sync: { running: boolean; issues: string[]; lastSuccess: string | null; userId: string | null; deletions: number };
  syncNow: () => Promise<void>;
  account: AccountState;
  accountBusy: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string) => Promise<'complete' | 'confirmation'>;
  confirmAccount: (password: string, code?: string) => Promise<void>;
  resendEmail: () => Promise<void>;
  changeEmail: () => Promise<void>;
  signOut: () => Promise<void>;
  useAnonymous: () => Promise<void>;
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
  const [sync, setSync] = useState<WardrobeContextValue['sync']>({ running: false, issues: [], lastSuccess: null, userId: null, deletions: 0 });
  const syncRequest = useRef(0);
  const [account, setAccount] = useState<AccountState>(emptyAccount);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountEpoch, setAccountEpoch] = useState(0);
  const accountChanging = useRef(false);
  const signedOut = useRef(false);
  const mutations = useRef(new Set<Promise<unknown>>());
  const withMutation = useCallback(async <T,>(task: () => Promise<T>): Promise<T> => {
    if (accountChanging.current || signedOut.current) throw new Error('Aguarde o acesso à sua conta para salvar.');
    const operation = task();
    mutations.current.add(operation);
    try { return await operation; }
    finally { mutations.current.delete(operation); }
  }, []);
  const reload = useCallback(() => runLocalTask(async (db) => {
    const saved = await Promise.all((await listClothing(db)).map(withPhoto));
    const savedOutfits = await listOutfits(db);
    const binding = await getBinding(db);
    const lastSuccess = await getSyncValue(db, 'last_success');
    const deletions = (await listDeletions(db)).length;
    const currentAccount = await readAccountState(db);
    signedOut.current = currentAccount.signedOut;
    setAccount(currentAccount);
    setItems(saved);
    setOutfits(savedOutfits);
    setSync((current) => ({ ...current, lastSuccess, userId: binding?.userId ?? null, deletions }));
  }), []);

  const syncNow = useCallback(async () => {
    if (accountChanging.current || signedOut.current) return;
    const request = ++syncRequest.current;
    setSync((current) => ({ ...current, running: true, issues: [] }));
    let issues: string[] = [];
    try {
      issues = (await syncWardrobe()).issues;
      if (!accountChanging.current) await rememberSessionAccount();
    }
    catch (error) { issues = [syncErrorMessage(error)]; }
    if (accountChanging.current) return;
    try { await reload(); }
    catch { issues.push('Não foi possível atualizar a tela com os dados locais. Tente novamente.'); }
    if (request === syncRequest.current) setSync((current) => ({ ...current, running: false, issues }));
  }, [reload]);

  const accountAction = useCallback(async <T,>(task: () => Promise<T>): Promise<T> => {
    if (accountChanging.current) throw new Error('Aguarde a operação anterior.');
    accountChanging.current = true;
    setAccountBusy(true);
    ++syncRequest.current;
    try {
      return await withSyncPaused(async () => {
        await Promise.allSettled([...mutations.current]);
        const before = await runLocalTask(readAccountState);
        try { return await task(); }
        finally {
          const after = await runLocalTask(readAccountState);
          if (before.id !== after.id || before.signedOut !== after.signedOut) setAccountEpoch((value) => value + 1);
          await reload();
        }
      });
    } finally {
      accountChanging.current = false;
      setAccountBusy(false);
      setSync((current) => ({ ...current, running: false, issues: [] }));
      void syncNow();
    }
  }, [reload, syncNow]);

  useEffect(() => {
    let active = true;
    (async () => {
      try {
        await reconcileAccountOnStartup();
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
    if (sync.issues.length && !sync.issues.some((issue) => /internet|conexão|muitas tentativas/i.test(issue))) return;
    if (!sync.issues.length && !sync.deletions && !items.some((item) => item.syncStatus === 'pending') && !outfits.some((item) => item.syncStatus === 'pending')) return;
    const timer = setTimeout(() => {
      if (AppState.currentState === 'active') void syncNow();
    }, 60000);
    return () => clearTimeout(timer);
  }, [status, sync.running, sync.issues, sync.deletions, items, outfits, syncNow]);

  const addClothing = useCallback(async (draft: ClothingDraft) => {
    return withMutation(async () => {
    const saved = await saveClothing(draft, {
      createId: randomUUID, persistPhoto, removePhoto,
      insert: (item) => runLocalTask((db) => insertClothing(db, item)),
    });
    await reload();
    void syncNow();
    return saved.id;
    });
  }, [reload, syncNow, withMutation]);

  const addOutfit = useCallback(async (draft: OutfitDraft) => {
    return withMutation(async () => {
    const outfit = buildOutfit(draft, items, randomUUID);
    await runLocalTask((db) => insertOutfit(db, outfit));
    await reload();
    void syncNow();
    return outfit.id;
    });
  }, [items, reload, syncNow, withMutation]);

  const editClothing = useCallback(async (id: string, draft: ClothingDraft) => {
    return withMutation(async () => {
    const existing = items.find((item) => item.id === id);
    if (!existing) throw new Error('Esta peça não está mais disponível.');
    const saved = await saveClothing(draft, {
      createId: randomUUID, persistPhoto, removePhoto,
      insert: (item) => runLocalTask((db) => updateClothing(db, item)),
    }, existing);
    await reload();
    void syncNow();
    return saved.id;
    });
  }, [items, reload, syncNow, withMutation]);

  const editOutfit = useCallback(async (id: string, draft: OutfitDraft) => {
    return withMutation(async () => {
    const existing = outfits.find((outfit) => outfit.id === id);
    if (!existing) throw new Error('Este look não está mais disponível.');
    const changed = buildOutfit(draft, items, () => id);
    await runLocalTask((db) => updateOutfit(db, { ...changed, createdAt: existing.createdAt, updatedAt: nextUpdatedAt(existing.updatedAt) }));
    await reload();
    void syncNow();
    return id;
    });
  }, [items, outfits, reload, syncNow, withMutation]);

  const removeClothing = useCallback(async (id: string) => {
    return withMutation(async () => {
    const path = items.find((item) => item.id === id)?.localPhotoPath;
    await runLocalTask((db) => deleteClothing(db, id));
    if (path) await removePhoto(path).catch(() => undefined);
    await reload();
    void syncNow();
    });
  }, [items, reload, syncNow, withMutation]);

  const removeOutfit = useCallback(async (id: string) => {
    return withMutation(async () => {
    await runLocalTask((db) => deleteOutfit(db, id));
    await reload();
    void syncNow();
    });
  }, [reload, syncNow, withMutation]);

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
  return <WardrobeContext.Provider key={accountEpoch} value={{
    items, outfits, addClothing, addOutfit, editClothing, editOutfit, removeClothing, removeOutfit, sync, syncNow, account, accountBusy,
    signIn: (email, password) => accountAction(() => loginAccount(email, password)),
    register: (email, password) => accountAction(() => registerAccount(email, password)),
    confirmAccount: (password, code) => accountAction(() => completeRegistration(password, code)),
    resendEmail: () => accountAction(resendConfirmation),
    changeEmail: () => accountAction(changeRegistrationEmail),
    signOut: () => accountAction(logoutAccount),
    useAnonymous: () => accountAction(continueAnonymously),
  }}>
    {children}
    <Modal visible={accountBusy} animationType="fade" onRequestClose={() => {}}>
      <Page><View style={styles.state}><ActivityIndicator size="large" color={theme.colors.primary} /><Text style={styles.title}>Preparando sua conta…</Text></View></Page>
    </Modal>
  </WardrobeContext.Provider>;
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
