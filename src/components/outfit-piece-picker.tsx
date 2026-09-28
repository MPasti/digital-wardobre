import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { useState } from 'react';
import { FlatList, Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { outfitSlots } from '../services/outfits';
import { theme } from '../theme';
import type { ClothingCategory, ClothingItem } from '../types/wardrobe';
import { ClothingPhoto } from './clothing-photo';
import { ActionButton, EmptyState } from './ui';

export function OutfitPiecePicker({ category, items, selectedIds, onToggle, onClose, onCreate }: {
  category: ClothingCategory; items: ClothingItem[]; selectedIds: string[];
  onToggle: (item: ClothingItem) => void; onClose: () => void; onCreate: () => void;
}) {
  const [query, setQuery] = useState('');
  const available = items.filter((item) => item.category === category);
  const filtered = available.filter((item) => `${item.name} ${item.color}`.toLocaleLowerCase('pt-BR').includes(query.trim().toLocaleLowerCase('pt-BR')));
  const selected = available.filter((item) => selectedIds.includes(item.id));
  return <Modal visible animationType="slide" onRequestClose={onClose} presentationStyle="fullScreen">
    <SafeAreaView style={styles.safe}>
      <View style={styles.content}>
        <View style={styles.header}>
          <View style={styles.titleArea}><Text style={styles.title} accessibilityRole="header">{outfitSlots[category].label}</Text><Text style={styles.hint}>{outfitSlots[category].hint}</Text></View>
          <Pressable accessibilityRole="button" accessibilityLabel="Fechar seleção" onPress={onClose} style={styles.close}><MaterialCommunityIcons name="close" size={24} color={theme.colors.ink} /></Pressable>
        </View>
        <Text style={styles.help}>{category === 'accessories' ? 'Escolha quantos quiser. Toque novamente para retirar.' : 'Escolha uma peça para essa posição. Toque na selecionada para retirar.'}</Text>
        {available.length > 0 ? <TextInput accessibilityLabel="Buscar peça para o look" placeholder="Buscar por nome ou cor" placeholderTextColor={theme.colors.muted} value={query} onChangeText={setQuery} style={styles.search} /> : null}
        <FlatList data={filtered} keyExtractor={(item) => item.id} numColumns={2} keyboardShouldPersistTaps="handled" columnWrapperStyle={styles.row} contentContainerStyle={styles.list}
          extraData={selectedIds}
          renderItem={({ item }) => {
            const checked = selectedIds.includes(item.id);
            return <Pressable accessibilityRole="button" accessibilityLabel={`${checked ? 'Retirar' : 'Selecionar'} ${item.name}`} accessibilityState={{ selected: checked }} onPress={() => onToggle(item)} style={[styles.card, checked && styles.selected]}>
              <ClothingPhoto uri={item.localPhotoUri} name={item.name} resizeMode="contain" />
              <Text style={styles.name} numberOfLines={2}>{item.name}</Text>
              <Text style={styles.color}>{item.color}</Text>
              {checked ? <View style={styles.check}><MaterialCommunityIcons name="check" size={18} color={theme.colors.white} /></View> : null}
            </Pressable>;
          }}
          ListEmptyComponent={<EmptyState icon="hanger" title={available.length ? 'Nenhuma peça encontrada.' : 'Essa parte está vazia.'} description={available.length ? 'Tente buscar por outro nome ou cor.' : `Cadastre uma roupa em “${outfitSlots[category].label}” para usá-la aqui.`}>
            {available.length ? <ActionButton label="Limpar busca" secondary onPress={() => setQuery('')} /> : <ActionButton label="Cadastrar peça" icon="plus" onPress={onCreate} />}
          </EmptyState>} />
        <ActionButton label={category === 'accessories' ? `Concluir seleção (${selected.length})` : 'Voltar à montagem'} icon="check" onPress={onClose} />
      </View>
    </SafeAreaView>
  </Modal>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background }, content: { flex: 1, width: '100%', maxWidth: 680, alignSelf: 'center', padding: 24, gap: 16 },
  header: { flexDirection: 'row', gap: 12, alignItems: 'center' }, titleArea: { flex: 1, gap: 5 }, title: { fontSize: 27, fontFamily: theme.fonts.editorial, color: theme.colors.ink }, hint: { fontSize: 13, color: theme.colors.muted }, close: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  help: { fontSize: 13, color: theme.colors.muted, lineHeight: 20 }, search: { backgroundColor: theme.colors.surface, borderColor: theme.colors.border, borderWidth: 1, borderRadius: 14, minHeight: 48, padding: 13, fontSize: 16, color: theme.colors.ink },
  list: { paddingBottom: 16 }, row: { gap: 12 }, card: { width: '48%', borderWidth: 2, borderColor: theme.colors.border, borderRadius: 20, padding: 8, gap: 5, marginBottom: 12, backgroundColor: theme.colors.surface }, selected: { borderColor: theme.colors.primary, backgroundColor: theme.colors.sage },
  name: { color: theme.colors.ink, fontSize: 14, fontWeight: '600', lineHeight: 20, paddingHorizontal: 3 }, color: { color: theme.colors.muted, fontSize: 12, paddingHorizontal: 3, paddingBottom: 3 }, check: { position: 'absolute', top: 12, right: 12, backgroundColor: theme.colors.primary, padding: 5, borderRadius: 16 },
});
