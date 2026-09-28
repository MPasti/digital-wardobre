import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ActionButton, AppHeader, EmptyState, Tip } from '../../components/ui';
import { OutfitComposition } from '../../components/outfit-composition';
import { useWardrobe } from '../../context/wardrobe';
import { theme } from '../../theme';
import type { ClothingItem } from '../../types/wardrobe';

export default function LooksScreen() {
  const { items, outfits } = useWardrobe();
  const byId = new Map(items.map((item) => [item.id, item]));
  return <SafeAreaView style={styles.safe} edges={['top', 'left', 'right']}>
    <FlatList data={outfits} keyExtractor={(item) => item.id} contentContainerStyle={styles.page}
      ListHeaderComponent={<View style={styles.header}>
        <AppHeader onHelp={() => router.push('/guia')} />
        <View style={styles.intro}><Text style={styles.eyebrow}>COMBINAÇÕES COM A SUA CARA</Text><Text style={styles.title} accessibilityRole="header">Novas formas{'\n'}de se vestir.</Text><Text style={styles.subtitle}>Suas peças favoritas, juntas. Guarde as combinações que você quer repetir.</Text></View>
        <ActionButton label="Montar look" icon="plus" onPress={() => router.push('/novo-look')} />
        <View style={styles.sectionHeader}><Text style={styles.sectionTitle} accessibilityRole="header">Seus looks</Text><Text style={styles.count}>{outfits.length} {outfits.length === 1 ? 'combinação' : 'combinações'}</Text></View>
      </View>}
      renderItem={({ item }) => <Pressable accessibilityRole="button" accessibilityLabel={`Ver look: ${item.name}`} onPress={() => router.push({ pathname: '/look/[id]', params: { id: item.id } })} style={({ pressed }) => [styles.card, pressed && { opacity: 0.75 }]}>
        <OutfitComposition compact items={item.clothingIds.map((id) => byId.get(id)).filter((piece): piece is ClothingItem => !!piece)} />
        <View style={styles.cardInfo}><View style={styles.cardTitleArea}><Text style={styles.cardTitle}>{item.name}</Text>{item.occasion ? <Text style={styles.occasion} numberOfLines={2}>{item.occasion}</Text> : null}</View><Text style={styles.count}>{item.clothingIds.length} {item.clothingIds.length === 1 ? 'peça' : 'peças'}</Text></View>
      </Pressable>}
      ListEmptyComponent={<EmptyState icon="view-grid-outline" title={'Seu próximo look\ncomeça aqui.'} description={items.length ? 'Escolha suas peças e veja a combinação organizada, de cima a baixo.' : 'Cadastre suas primeiras roupas para começar a combinar.'}>
        {!items.length ? <ActionButton label="Cadastrar peça" icon="hanger" secondary onPress={() => router.push('/nova-roupa')} /> : null}
      </EmptyState>}
      ListFooterComponent={<View style={styles.footer}><Tip text="Uma mesma roupa pode ganhar várias combinações. Experimente mudar os sapatos ou acrescentar um acessório." /></View>} />
  </SafeAreaView>;
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background }, page: { width: '100%', maxWidth: 680, alignSelf: 'center', padding: 24, paddingBottom: 36 }, header: { gap: 24, paddingBottom: 22 }, intro: { gap: 12, paddingTop: 8 }, eyebrow: { color: theme.colors.primary, fontSize: 10, letterSpacing: 1.7, fontWeight: '700', lineHeight: 16 }, title: { fontFamily: theme.fonts.editorial, color: theme.colors.ink, fontSize: 40, lineHeight: 46, letterSpacing: -1.3 }, subtitle: { color: theme.colors.muted, fontSize: 15, lineHeight: 23 },
  sectionHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, sectionTitle: { color: theme.colors.ink, fontSize: 20, fontWeight: '700' }, count: { color: theme.colors.muted, fontSize: 12 }, card: { backgroundColor: theme.colors.surface, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 24, padding: 12, marginBottom: 18 }, cardInfo: { padding: 8, paddingTop: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, cardTitleArea: { flex: 1, gap: 5 }, cardTitle: { color: theme.colors.ink, fontSize: 18, fontWeight: '600' }, occasion: { color: theme.colors.muted, fontSize: 13, lineHeight: 19 }, footer: { paddingTop: 20 },
});
