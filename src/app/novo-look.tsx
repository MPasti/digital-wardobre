import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { OutfitComposition } from '../components/outfit-composition';
import { OutfitPiecePicker } from '../components/outfit-piece-picker';
import { ActionButton, EmptyState, Page, Tip } from '../components/ui';
import { useWardrobe } from '../context/wardrobe';
import { toggleOutfitItem, validateOutfit, type OutfitErrors } from '../services/outfits';
import { theme } from '../theme';
import type { ClothingCategory, ClothingItem, Outfit } from '../types/wardrobe';

export default function NewOutfitScreen() {
  const { editId } = useLocalSearchParams<{ editId?: string }>();
  const { outfits } = useWardrobe();
  const existing = outfits.find((outfit) => outfit.id === editId);
  if (editId && !existing) return <Page withHeader><EmptyState icon="view-grid-outline" title="Look não encontrado" description="Esse look não está mais disponível."><ActionButton label="Ver meus looks" onPress={() => router.replace('/looks')} /></EmptyState></Page>;
  return <OutfitForm key={editId ?? 'new'} existing={existing} />;
}

function OutfitForm({ existing }: { existing?: Outfit }) {
  const { items, addOutfit, editOutfit } = useWardrobe();
  const [name, setName] = useState(existing?.name ?? '');
  const [occasion, setOccasion] = useState(existing?.occasion ?? '');
  const [selectedIds, setSelectedIds] = useState<string[]>(existing?.clothingIds ?? []);
  const [onePieceMode, setOnePieceMode] = useState(() => items.some((item) => item.category === 'one-piece' && existing?.clothingIds.includes(item.id)));
  const [picker, setPicker] = useState<ClothingCategory>();
  const [errors, setErrors] = useState<OutfitErrors>({});
  const [message, setMessage] = useState('');
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const mounted = useRef(true);
  const scroll = useRef<ScrollView>(null);
  const selected = selectedIds.map((id) => items.find((item) => item.id === id)).filter((item): item is ClothingItem => !!item);

  useEffect(() => {
    mounted.current = true;
    const listener = BackHandler.addEventListener('hardwareBackPress', () => savingRef.current);
    return () => { mounted.current = false; listener.remove(); };
  }, []);

  function clearError(field: keyof OutfitErrors) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage('');
  }

  function changeMode(next: boolean) {
    if (savingRef.current) return;
    setOnePieceMode(next);
    setSelectedIds((ids) => ids.filter((id) => {
      const category = items.find((item) => item.id === id)?.category;
      return next ? category !== 'tops' && category !== 'bottoms' : category !== 'one-piece';
    }));
    clearError('pieces');
  }

  function toggle(item: ClothingItem) {
    setSelectedIds((ids) => toggleOutfitItem(ids, item, items));
    clearError('pieces');
    if (item.category !== 'accessories') setPicker(undefined);
  }

  async function save() {
    if (savingRef.current) return;
    const draft = { name, occasion, clothingIds: selectedIds };
    const validation = validateOutfit(draft, items);
    setErrors(validation);
    if (Object.keys(validation).length) {
      setMessage('Confira o nome e as peças antes de salvar.');
      scroll.current?.scrollTo({ y: 0, animated: true });
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setMessage('');
    try {
      const id = existing ? await editOutfit(existing.id, draft) : await addOutfit(draft);
      if (existing && router.canGoBack()) router.back();
      else router.replace({ pathname: '/look/[id]', params: { id, saved: '1' } });
    } catch (error) {
      console.error('Falha ao salvar o look local:', error);
      if (mounted.current) {
        setMessage('Não foi possível salvar o look. Sua seleção foi mantida. Tente novamente.');
        scroll.current?.scrollTo({ y: 0, animated: true });
      }
    } finally {
      savingRef.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
    <Stack.Screen options={{ title: existing ? 'Editar look' : 'Montar look', gestureEnabled: !saving, headerBackVisible: false, headerLeft: () => <Pressable accessibilityRole="button" accessibilityLabel="Voltar aos looks" disabled={saving} style={styles.back} onPress={() => router.canGoBack() ? router.back() : router.navigate('/looks')}><MaterialCommunityIcons name="arrow-left" size={24} color={theme.colors.primary} /></Pressable> }} />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <ScrollView ref={scroll} contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <View style={styles.intro}>
          <Text style={styles.title} accessibilityRole="header">{existing ? 'Atualize seu look.' : 'Criar um novo look.'}</Text>
          <Text style={styles.description}>{existing ? 'Troque as peças, o nome ou a ocasião e salve suas mudanças.' : 'Toque nos espaços para escolher as peças. Veja tudo junto antes de salvar.'}</Text>
        </View>
        {!items.length ? <EmptyState icon="hanger" title="Vamos começar pelas roupas?" description="Cadastre suas peças para montar combinações com elas."><ActionButton label="Cadastrar minha primeira peça" icon="plus" onPress={() => router.push('/nova-roupa')} /></EmptyState> : <>
          {message ? <Text accessibilityRole="alert" style={styles.errorBox}>{message}</Text> : null}
          <View style={styles.group}>
            <Text style={styles.label}>Nome do look *</Text>
            <TextInput accessibilityLabel="Nome do look" placeholder="Ex.: Café de domingo" placeholderTextColor={theme.colors.muted} value={name} onChangeText={(value) => { setName(value); clearError('name'); }} editable={!saving} maxLength={100} style={[styles.input, !!errors.name && styles.invalid]} />
            {errors.name ? <Text style={styles.error}>{errors.name}</Text> : null}
          </View>
          <View style={styles.group}>
            <View style={styles.sectionHeader}><Text style={styles.label}>Sua combinação</Text><Text style={styles.count}>{selected.length} {selected.length === 1 ? 'peça' : 'peças'}</Text></View>
            <View style={styles.modes}>
              {[{ value: false, label: 'Partes separadas' }, { value: true, label: 'Peça única' }].map((mode) => <Pressable key={mode.label} accessibilityRole="button" accessibilityLabel={mode.label} accessibilityState={{ selected: mode.value === onePieceMode, disabled: saving }} disabled={saving} onPress={() => changeMode(mode.value)} style={[styles.mode, mode.value === onePieceMode && styles.modeActive]}><Text style={[styles.modeLabel, mode.value === onePieceMode && styles.modeLabelActive]}>{mode.label}</Text></Pressable>)}
            </View>
            <Text style={styles.modeHint}>{onePieceMode ? 'Vestidos e macacões ocupam a parte de cima e a de baixo.' : 'Parte de cima, parte de baixo e calçados, nessa ordem.'} Trocar o modo substitui as peças do corpo.</Text>
            <OutfitComposition items={selected} onePieceMode={onePieceMode} onSelectSlot={(category) => { if (!savingRef.current) setPicker(category); }} disabled={saving} />
            {errors.pieces ? <Text style={styles.error}>{errors.pieces}</Text> : null}
          </View>
          <View style={styles.group}>
            <Text style={styles.label}>Ocasião <Text style={styles.optional}>(opcional)</Text></Text>
            <TextInput accessibilityLabel="Ocasião do look" placeholder="Ex.: Trabalho, passeio, jantar…" placeholderTextColor={theme.colors.muted} value={occasion} onChangeText={(value) => { setOccasion(value); clearError('occasion'); }} editable={!saving} maxLength={200} style={styles.input} />
            {errors.occasion ? <Text style={styles.error}>{errors.occasion}</Text> : null}
          </View>
          <ActionButton label={saving ? 'Salvando seu look…' : existing ? 'Salvar alterações' : 'Salvar look'} icon="check" onPress={() => void save()} disabled={saving} loading={saving} />
        </>}
      </ScrollView>
    </KeyboardAvoidingView>
    {picker ? <OutfitPiecePicker key={picker} category={picker} items={items} selectedIds={selectedIds} onToggle={toggle} onClose={() => setPicker(undefined)} onCreate={() => { setPicker(undefined); router.push('/nova-roupa'); }} /> : null}
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background }, flex: { flex: 1 }, back: { minWidth: 44, minHeight: 44, justifyContent: 'center' },
  content: { padding: 24, paddingBottom: 36, gap: 24, width: '100%', maxWidth: 680, alignSelf: 'center' }, intro: { gap: 10 },
  eyebrow: { fontSize: 10, lineHeight: 16, letterSpacing: 1.4, fontWeight: '700', color: theme.colors.primary }, title: { fontFamily: theme.fonts.editorial, fontSize: 34, lineHeight: 41, color: theme.colors.ink }, description: { fontSize: 14, lineHeight: 22, color: theme.colors.muted },
  group: { gap: 10 }, label: { color: theme.colors.ink, fontSize: 15, fontWeight: '700' }, optional: { color: theme.colors.muted, fontSize: 13, fontWeight: '400' }, input: { borderColor: theme.colors.border, borderWidth: 1, borderRadius: 14, minHeight: 52, backgroundColor: theme.colors.surface, padding: 15, color: theme.colors.ink, fontSize: 16 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 }, count: { fontSize: 12, color: theme.colors.muted }, modes: { flexDirection: 'row', padding: 4, backgroundColor: theme.colors.sage, borderRadius: 16, gap: 4 }, mode: { flex: 1, minHeight: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12, padding: 8 }, modeActive: { backgroundColor: theme.colors.primary }, modeLabel: { fontSize: 13, color: theme.colors.primary }, modeLabelActive: { color: theme.colors.white }, modeHint: { fontSize: 12, lineHeight: 18, color: theme.colors.muted },
  invalid: { borderColor: '#A4493B' }, error: { color: '#963D32', fontSize: 13, lineHeight: 20 }, errorBox: { backgroundColor: '#F8E9E4', borderRadius: 16, padding: 16, color: '#963D32', fontSize: 14, lineHeight: 21 },
});
