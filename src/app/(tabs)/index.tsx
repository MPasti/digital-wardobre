import { router } from 'expo-router';
import { useState } from 'react';
import { FlatList, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, AppHeader, EmptyState, Tip } from '../../components/ui';
import { ClothingPhoto } from '../../components/clothing-photo';
import { useWardrobe } from '../../context/wardrobe';
import { theme } from '../../theme';
import { clothingCategories, type ClothingFilter } from '../../types/wardrobe';

export default function WardrobeScreen() {
  const { items, outfits } = useWardrobe();
  const [category, setCategory] = useState<ClothingFilter>('all');
  const filtered = category === 'all' ? items : items.filter((item) => item.category === category);
  const selectedLabel = clothingCategories.find((item) => item.id === category)?.label;
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <FlatList data={filtered} numColumns={2} keyExtractor={(item) => item.id}
      contentContainerStyle={styles.page} columnWrapperStyle={styles.row} showsVerticalScrollIndicator={false}
      ListHeaderComponent={<View style={styles.headerContent}>
        <AppHeader onHelp={() => router.push('/guia')} />
        <View style={styles.intro}>
          <Text style={styles.eyebrow}>MENOS BAGUNÇA. MAIS POSSIBILIDADES.</Text>
          <Text style={styles.title} accessibilityRole="header">Seu estilo,{'\n'}ao seu alcance.</Text>
          <Text style={styles.subtitle}>Um novo olhar para as roupas que já fazem parte de você.</Text>
        </View>
        <View style={styles.overview}>
          <View style={styles.metric}><Text style={styles.number}>{items.length}</Text><Text style={styles.metricLabel}>peças no guarda roupa</Text></View>
          <View style={styles.divider} />
          <View style={styles.metric}><Text style={styles.number}>{outfits.length}</Text><Text style={styles.metricLabel}>looks criados</Text></View>
        </View>
        <ActionButton label="Cadastrar peça" icon="plus" onPress={() => router.push('/nova-roupa')} />
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle} accessibilityRole="header">Suas peças</Text><Text style={styles.count}>{filtered.length} {filtered.length === 1 ? 'item' : 'itens'}</Text></View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filters}>
          {clothingCategories.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Filtrar: ${item.label}`} accessibilityState={{ selected: category === item.id }} onPress={() => setCategory(item.id)} style={({ pressed }) => [styles.chip, category === item.id && styles.activeChip, pressed && styles.pressed]}>
            <Text style={[styles.chipText, category === item.id && styles.activeChipText]}>{item.label}</Text>
          </Pressable>)}
        </ScrollView>
      </View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Ver peça: ${item.name}`} onPress={() => router.push({ pathname: '/roupa/[id]', params: { id: item.id } })} style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
        <ClothingPhoto uri={item.localPhotoUri} name={item.name} />
        <View style={styles.cardCopy}><Text style={styles.cardTitle} numberOfLines={2}>{item.name}</Text><Text style={styles.cardColor} numberOfLines={1}>{item.color}</Text></View>
      </Pressable>}
      ListEmptyComponent={<EmptyState icon="hanger" title={category === 'all' ? 'Espaço para suas\npeças favoritas.' : 'Nenhuma peça\nnessa categoria.'} description={category === 'all' ? 'Cadastre sua primeira peça e comece a redescobrir o que você já tem.' : `Nenhuma peça em “${selectedLabel}”. Experimente outro filtro.`}>
        {category !== 'all' ? <ActionButton label="Ver todas as categorias" secondary onPress={() => setCategory('all')} /> : null}
      </EmptyState>}
      ListFooterComponent={<View style={styles.footer}><Tip text="Suas peças estão salvas neste aparelho. Uma peça pode ser o começo de muitos looks." /></View>}
    />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background }, page: { padding: 24, paddingBottom: 36, width: '100%', maxWidth: 680, alignSelf: 'center' }, headerContent: { gap: 24, paddingBottom: 20 },
  intro: { gap: 12, paddingTop: 8 }, eyebrow: { color: theme.colors.primary, fontSize: 10, letterSpacing: 1.7, fontWeight: '700', lineHeight: 16 },
  title: { fontFamily: theme.fonts.editorial, color: theme.colors.ink, fontSize: 40, lineHeight: 46, letterSpacing: -1.3 }, subtitle: { color: theme.colors.muted, fontSize: 15, lineHeight: 23, maxWidth: 370 },
  overview: { backgroundColor: theme.colors.sage, borderRadius: 20, padding: 22, flexDirection: 'row', gap: 20, alignItems: 'center' }, metric: { flex: 1, gap: 5 }, number: { color: theme.colors.primary, fontSize: 30, fontWeight: '500' }, metricLabel: { color: theme.colors.primary, fontSize: 12, lineHeight: 18 }, divider: { width: 1, alignSelf: 'stretch', backgroundColor: '#CBD5C6' },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, sectionTitle: { color: theme.colors.ink, fontWeight: '700', fontSize: 20 }, count: { color: theme.colors.muted, fontSize: 13 },
  filters: { gap: 8, paddingRight: 8 }, chip: { minHeight: 44, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 24, borderWidth: 1, borderColor: theme.colors.border, justifyContent: 'center' }, activeChip: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary }, chipText: { color: theme.colors.muted, fontSize: 13, fontWeight: '500' }, activeChipText: { color: theme.colors.white }, pressed: { opacity: 0.7 },
  row: { gap: 14 }, card: { width: '47.8%', flexGrow: 0, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, padding: 8, marginBottom: 16 }, cardCopy: { padding: 6, gap: 5 }, cardTitle: { color: theme.colors.ink, fontSize: 15, fontWeight: '600', lineHeight: 21 }, cardColor: { color: theme.colors.muted, fontSize: 12 }, footer: { marginTop: 24 },
});
