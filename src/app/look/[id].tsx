import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { OutfitComposition } from '../../components/outfit-composition';
import { RecordActions } from '../../components/record-actions';
import { ActionButton, EmptyState, Page } from '../../components/ui';
import { useWardrobe } from '../../context/wardrobe';
import { orderOutfitItems, outfitSlots } from '../../services/outfits';
import { theme } from '../../theme';
import type { ClothingItem } from '../../types/wardrobe';

export default function OutfitDetailsScreen() {
  const { id, saved } = useLocalSearchParams<{ id: string; saved?: string }>();
  const { outfits, items, removeOutfit } = useWardrobe();
  const outfit = outfits.find((entry) => entry.id === id);
  if (!outfit) return <Page withHeader><Stack.Screen options={{ title: 'Look não encontrado' }} /><EmptyState icon="view-grid-outline" title="Não encontramos esse look." description="Ele não está neste guarda roupa local."><ActionButton label="Ver meus looks" onPress={() => router.navigate('/looks')} /></EmptyState></Page>;
  const pieces = orderOutfitItems(outfit.clothingIds.map((clothingId) => items.find((item) => item.id === clothingId)).filter((item): item is ClothingItem => !!item));
  return <Page withHeader>
    <Stack.Screen options={{ title: 'Seu look' }} />
    {saved === '1' ? <Text accessibilityRole="alert" style={styles.success}>Look salvo no aparelho!</Text> : null}
    <View style={styles.intro}><Text style={styles.eyebrow}>COMBINAÇÃO FAVORITA, SEMPRE À MÃO</Text><Text accessibilityRole="header" style={styles.title}>{outfit.name}</Text>{outfit.occasion ? <Text style={styles.occasion}>{outfit.occasion}</Text> : null}</View>
    <OutfitComposition items={pieces} />
    <View style={styles.pieces}><Text style={styles.sectionTitle} accessibilityRole="header">Peças deste look</Text>
      {pieces.map((item) => <Pressable key={item.id} accessibilityRole="button" accessibilityLabel={`Abrir peça: ${item.name}`} onPress={() => router.push({ pathname: '/roupa/[id]', params: { id: item.id } })} style={styles.pieceRow}><View style={styles.pieceCopy}><Text style={styles.pieceName}>{item.name}</Text><Text style={styles.pieceCategory}>{outfitSlots[item.category].label} · {item.color}</Text></View><Text style={styles.arrow}>›</Text></Pressable>)}
    </View>
    <Text style={styles.savedDate}>Criado em {new Date(outfit.createdAt).toLocaleDateString('pt-BR')}. Disponível neste aparelho.</Text>
    <RecordActions kind="look" onEdit={() => router.push({ pathname: '/novo-look', params: { editId: outfit.id } })} onDelete={async () => { await removeOutfit(outfit.id); router.replace('/looks'); }} hint="A exclusão é direta. As roupas continuam no seu guarda roupa." />
    <ActionButton label="Ver meus looks" icon="view-grid-outline" onPress={() => router.navigate('/looks')} />
    <ActionButton label="Montar outro look" icon="plus" secondary onPress={() => router.replace('/novo-look')} />
  </Page>;
}

const styles = StyleSheet.create({
  intro: { gap: 9 }, eyebrow: { color: theme.colors.primary, fontSize: 10, lineHeight: 16, letterSpacing: 1.2, fontWeight: '700' }, title: { color: theme.colors.ink, fontFamily: theme.fonts.editorial, fontSize: 34, lineHeight: 41 }, occasion: { color: theme.colors.muted, fontSize: 15, lineHeight: 23 }, success: { backgroundColor: theme.colors.sage, color: theme.colors.primary, textAlign: 'center', padding: 16, borderRadius: 16, fontWeight: '600' },
  pieces: { gap: 4 }, sectionTitle: { color: theme.colors.ink, fontSize: 18, fontWeight: '700', marginBottom: 10 }, pieceRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 14, borderBottomColor: theme.colors.border, borderBottomWidth: 1, gap: 12 }, pieceCopy: { flex: 1, gap: 5 }, pieceName: { color: theme.colors.ink, fontSize: 15, fontWeight: '600' }, pieceCategory: { color: theme.colors.muted, fontSize: 12 }, arrow: { color: theme.colors.primary, fontSize: 26 }, savedDate: { color: theme.colors.muted, fontSize: 13, lineHeight: 21 },
});
