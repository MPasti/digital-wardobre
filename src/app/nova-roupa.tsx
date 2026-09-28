import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import * as ImagePicker from 'expo-image-picker';
import { router, Stack } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { BackHandler, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, Tip } from '../components/ui';
import { ClothingPhoto } from '../components/clothing-photo';
import { useWardrobe } from '../context/wardrobe';
import { validateDraft, type DraftErrors } from '../services/save-clothing';
import { theme } from '../theme';
import { clothingCategories, clothingColors } from '../types/wardrobe';

export default function NewClothingScreen() {
  const { addClothing } = useWardrobe();
  const [name, setName] = useState('');
  const [category, setCategory] = useState('');
  const [color, setColor] = useState('');
  const [notes, setNotes] = useState('');
  const [photoUri, setPhotoUri] = useState<string>();
  const [errors, setErrors] = useState<DraftErrors>({});
  const [message, setMessage] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [saving, setSaving] = useState(false);
  const [picking, setPicking] = useState(false);
  const lock = useRef(false);
  const mounted = useRef(true);
  const scroll = useRef<ScrollView>(null);
  const busy = saving || picking;

  useEffect(() => {
    mounted.current = true;
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => lock.current);
    if (Platform.OS === 'android') {
      ImagePicker.getPendingResultAsync().then((result) => {
        if (mounted.current && result && 'assets' in result && !result.canceled && result.assets?.[0]) {
          setPhotoUri(result.assets[0].uri);
        }
      }).catch(() => undefined);
    }
    return () => { mounted.current = false; subscription.remove(); };
  }, []);

  function showMessage(text: string) {
    setMessage(text);
    scroll.current?.scrollTo({ y: 0, animated: true });
  }

  function clearError(field: keyof DraftErrors) {
    setErrors((current) => ({ ...current, [field]: undefined }));
    setMessage('');
  }

  async function pickPhoto(source: 'camera' | 'library') {
    if (lock.current) return;
    lock.current = true;
    setPicking(true);
    setMessage('');
    setShowSettings(false);
    try {
      if (source === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          setShowSettings(!permission.canAskAgain);
          showMessage('Permita o acesso à câmera para fotografar a peça. Você também pode escolher uma foto da galeria.');
          return;
        }
      }
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'], allowsEditing: false, quality: 1,
        exif: false, allowsMultipleSelection: false,
      };
      const result = source === 'camera'
        ? await ImagePicker.launchCameraAsync(options)
        : await ImagePicker.launchImageLibraryAsync(options);
      if (mounted.current && !result.canceled && result.assets[0]) setPhotoUri(result.assets[0].uri);
    } catch (error) {
      console.error('Falha ao selecionar foto:', error);
      if (mounted.current) showMessage('Não foi possível abrir essa foto. Tente outra imagem ou continue sem foto.');
    } finally {
      lock.current = false;
      if (mounted.current) setPicking(false);
    }
  }

  async function save() {
    if (lock.current) return;
    const draft = { name, category, color, notes, photoUri };
    const validation = validateDraft(draft);
    setErrors(validation);
    setShowSettings(false);
    if (Object.keys(validation).length) {
      showMessage('Confira os campos indicados antes de salvar.');
      return;
    }
    lock.current = true;
    setSaving(true);
    setMessage('');
    try {
      const id = await addClothing(draft);
      router.replace({ pathname: '/roupa/[id]', params: { id, saved: '1' } });
    } catch (error) {
      console.error('Falha ao salvar roupa:', error);
      if (mounted.current) showMessage('Não foi possível salvar a peça. Seus campos foram mantidos. Confira o espaço livre no aparelho e tente novamente.');
    } finally {
      lock.current = false;
      if (mounted.current) setSaving(false);
    }
  }

  return <SafeAreaView style={styles.safe} edges={['left', 'right', 'bottom']}>
    <Stack.Screen options={{ title: 'Nova peça', headerShown: true, gestureEnabled: !busy, headerBackVisible: !busy }} />
    <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined} keyboardVerticalOffset={100}>
      <ScrollView ref={scroll} keyboardShouldPersistTaps="handled" contentContainerStyle={styles.content}>
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>MAIS UMA PEÇA, NOVAS POSSIBILIDADES</Text>
          <Text style={styles.title} accessibilityRole="header">Vamos guardar?</Text>
          <Text style={styles.description}>Comece pelo que torna essa peça sua. Os campos marcados com * são obrigatórios.</Text>
        </View>
        {message ? <View style={styles.errorBox} accessibilityRole="alert">
          <Text style={styles.errorText}>{message}</Text>
          {showSettings ? <ActionButton label="Abrir ajustes" secondary icon="cog-outline" onPress={() => { Linking.openSettings().catch(() => showMessage('Abra os ajustes do aparelho e permita o acesso à câmera.')); }} /> : null}
        </View> : null}
        <View style={styles.group}>
          <Text style={styles.label}>Foto <Text style={styles.optional}>(opcional)</Text></Text>
          {photoUri ? <ClothingPhoto uri={photoUri} name={name || 'nova peça'} style={styles.photo} />
            : <View style={styles.photoEmpty}>
              <MaterialCommunityIcons name="camera-plus-outline" size={36} color={theme.colors.primary} />
              <Text style={styles.photoTitle}>Sua peça em destaque</Text>
              <Text style={styles.photoHint}>Use uma boa luz e um fundo simples.</Text>
            </View>}
          <View style={styles.photoButtons}>
            {Platform.OS !== 'web' ? <View style={styles.flex}><ActionButton label="Tirar foto" icon="camera-outline" onPress={() => void pickPhoto('camera')} disabled={busy} secondary /></View> : null}
            <View style={styles.flex}><ActionButton label="Galeria" icon="image-outline" onPress={() => void pickPhoto('library')} disabled={busy} secondary /></View>
          </View>
          {photoUri ? <Pressable accessibilityRole="button" disabled={busy} onPress={() => setPhotoUri(undefined)} style={styles.remove}>
            <Text style={styles.removeText}>Remover foto</Text>
          </Pressable> : null}
          {picking ? <Text style={styles.description}>Abrindo suas fotos…</Text> : null}
        </View>
        <View style={styles.group}>
          <Text style={styles.label}>Nome da peça *</Text>
          <TextInput accessibilityLabel="Nome da peça" placeholder="Ex.: Camiseta de algodão" placeholderTextColor={theme.colors.muted} value={name} onChangeText={(value) => { setName(value); clearError('name'); }} maxLength={100} editable={!busy} style={[styles.input, !!errors.name && styles.invalid]} returnKeyType="next" />
          {errors.name ? <Text style={styles.errorText}>{errors.name}</Text> : null}
        </View>
        <View style={styles.group}>
          <Text style={styles.label}>Categoria *</Text>
          <View style={styles.options}>
            {clothingCategories.filter((item) => item.id !== 'all').map((item) => <Pressable key={item.id}
              accessibilityRole="radio" accessibilityLabel={item.label} accessibilityState={{ checked: category === item.id, disabled: busy }} disabled={busy}
              onPress={() => { setCategory(item.id); clearError('category'); }} style={[styles.option, category === item.id && styles.optionActive]}>
              <Text style={[styles.optionText, category === item.id && styles.optionTextActive]}>{item.label}</Text>
            </Pressable>)}
          </View>
          {errors.category ? <Text style={styles.errorText}>{errors.category}</Text> : null}
        </View>
        <View style={styles.group}>
          <Text style={styles.label}>Cor principal *</Text>
          <View style={styles.options}>
            {clothingColors.map((item) => <Pressable key={item.label}
              accessibilityRole="radio" accessibilityLabel={item.label} accessibilityState={{ checked: color === item.label, disabled: busy }} disabled={busy}
              onPress={() => { setColor(item.label); clearError('color'); }} style={[styles.swatchButton, color === item.label && styles.swatchActive]}>
              <View style={[styles.swatch, { backgroundColor: item.hex }]} />
              <Text style={styles.swatchLabel}>{item.label}</Text>
            </Pressable>)}
          </View>
          <TextInput accessibilityLabel="Cor principal" placeholder="Ou escreva outra cor / estampada" placeholderTextColor={theme.colors.muted} value={color} onChangeText={(value) => { setColor(value); clearError('color'); }} maxLength={50} editable={!busy} style={[styles.input, !!errors.color && styles.invalid]} />
          {errors.color ? <Text style={styles.errorText}>{errors.color}</Text> : null}
        </View>
        <View style={styles.group}>
          <Text style={styles.label}>Observações <Text style={styles.optional}>(opcional)</Text></Text>
          <TextInput accessibilityLabel="Observações" placeholder="Tecido, tamanho, cuidados ou uma lembrança…" placeholderTextColor={theme.colors.muted} value={notes} onChangeText={(value) => { setNotes(value); clearError('notes'); }} maxLength={1000} multiline textAlignVertical="top" editable={!busy} style={[styles.input, styles.notes]} />
          <Text style={styles.counter}>{notes.length}/1.000</Text>
          {errors.notes ? <Text style={styles.errorText}>{errors.notes}</Text> : null}
        </View>
        <Tip text="Sua peça fica salva neste aparelho e pode ser consultada mesmo sem internet." />
        <ActionButton label={saving ? 'Salvando sua peça…' : 'Salvar peça'} icon="check" onPress={() => void save()} disabled={busy} loading={saving} />
      </ScrollView>
    </KeyboardAvoidingView>
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background }, flex: { flex: 1 },
  content: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 24, paddingBottom: 36, gap: 26 },
  intro: { gap: 10 }, eyebrow: { color: theme.colors.primary, fontSize: 10, letterSpacing: 1.4, fontWeight: '700', lineHeight: 16 },
  title: { fontFamily: theme.fonts.editorial, color: theme.colors.ink, fontSize: 36, lineHeight: 43 },
  description: { color: theme.colors.muted, fontSize: 14, lineHeight: 22 },
  group: { gap: 10 }, label: { color: theme.colors.ink, fontSize: 15, fontWeight: '700' },
  optional: { color: theme.colors.muted, fontWeight: '400', fontSize: 13 },
  photo: { aspectRatio: 4 / 3 },
  photoEmpty: { minHeight: 184, borderWidth: 1, borderStyle: 'dashed', borderColor: '#B4C2AC', backgroundColor: theme.colors.sage, borderRadius: 22, alignItems: 'center', justifyContent: 'center', padding: 20, gap: 10 },
  photoTitle: { color: theme.colors.ink, fontSize: 17, fontWeight: '600' }, photoHint: { color: theme.colors.muted, fontSize: 13, textAlign: 'center' },
  photoButtons: { flexDirection: 'row', gap: 10 }, remove: { minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  removeText: { color: '#9B433A', fontSize: 14 },
  input: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 14, paddingHorizontal: 16, paddingVertical: 14, fontSize: 16, color: theme.colors.ink, minHeight: 52 },
  notes: { minHeight: 110 }, counter: { color: theme.colors.muted, fontSize: 12, textAlign: 'right' },
  options: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  option: { borderRadius: 24, borderWidth: 1, borderColor: theme.colors.border, minHeight: 44, paddingHorizontal: 16, paddingVertical: 12 },
  optionActive: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }, optionText: { fontSize: 13, color: theme.colors.ink }, optionTextActive: { color: theme.colors.white },
  swatchButton: { alignItems: 'center', gap: 5, padding: 8, minWidth: 64, borderWidth: 1, borderColor: 'transparent', borderRadius: 13 },
  swatchActive: { borderColor: theme.colors.primary, backgroundColor: theme.colors.sage },
  swatch: { width: 28, height: 28, borderRadius: 14, borderWidth: 1, borderColor: '#00000020' }, swatchLabel: { fontSize: 11, color: theme.colors.ink },
  invalid: { borderColor: '#A4493B' }, errorText: { color: '#963D32', fontSize: 13, lineHeight: 20 },
  errorBox: { backgroundColor: '#F8E9E4', borderRadius: 16, padding: 16, gap: 12 },
});
