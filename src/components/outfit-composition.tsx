import MaterialCommunityIcons from '@expo/vector-icons/MaterialCommunityIcons';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { ComponentProps } from 'react';
import { outfitSlots } from '../services/outfits';
import { theme } from '../theme';
import type { ClothingCategory, ClothingItem } from '../types/wardrobe';
import { ClothingPhoto } from './clothing-photo';

const icons: Record<ClothingCategory, ComponentProps<typeof MaterialCommunityIcons>['name']> = {
  tops: 'tshirt-crew-outline', bottoms: 'hanger', 'one-piece': 'hanger', shoes: 'shoe-sneaker', accessories: 'bag-personal-outline',
};

type Props = {
  items: ClothingItem[];
  compact?: boolean;
  onePieceMode?: boolean;
  disabled?: boolean;
  onSelectSlot?: (category: ClothingCategory) => void;
};

export function OutfitComposition({ items, compact = false, onePieceMode = false, disabled = false, onSelectSlot }: Props) {
  const onePiece = items.find((item) => item.category === 'one-piece');
  const accessories = items.filter((item) => item.category === 'accessories');
  const interactive = !!onSelectSlot;

  function slot(category: ClothingCategory, height: number, item?: ClothingItem) {
    const content = <>
      {item ? <>
        <ClothingPhoto uri={item.localPhotoUri} name={item.name} resizeMode="contain" compact={compact || category === 'shoes' || category === 'accessories'} placeholderIcon={icons[category]} style={styles.photo} />
        {!compact ? <Text style={styles.pieceName} numberOfLines={1}>{item.name}</Text> : null}
      </> : <View style={styles.placeholder}>
        <MaterialCommunityIcons name={icons[category]} size={compact ? 21 : 28} color="#82937C" />
        {!compact ? <Text style={styles.slotLabel}>{outfitSlots[category].label}</Text> : null}
        {interactive && !compact ? <Text style={styles.choose}>+ Escolher</Text> : null}
      </View>}
      {item && interactive ? <View style={styles.change}><MaterialCommunityIcons name="pencil-outline" size={13} color={theme.colors.primary} /></View> : null}
    </>;
    const style = [styles.slot, { height }, !item && styles.emptySlot];
    return interactive
      ? <Pressable accessibilityRole="button" accessibilityLabel={`${item ? 'Trocar' : 'Escolher'} ${outfitSlots[category].label}${item ? `: ${item.name}` : ''}`} accessibilityState={{ disabled }} disabled={disabled} onPress={() => onSelectSlot?.(category)} style={({ pressed }) => [...style, pressed && styles.pressed]}>{content}</Pressable>
      : <View accessibilityLabel={outfitSlots[category].label} style={style}>{content}</View>;
  }

  return <View style={[styles.board, compact && styles.compactBoard]}>
    <View style={styles.assembly}>
      <View style={styles.body}>
        {onePieceMode || onePiece
          ? slot('one-piece', compact ? 158 : 308, onePiece)
          : <>
            {slot('tops', compact ? 72 : 140, items.find((item) => item.category === 'tops'))}
            {slot('bottoms', compact ? 78 : 160, items.find((item) => item.category === 'bottoms'))}
          </>}
        {slot('shoes', compact ? 42 : 80, items.find((item) => item.category === 'shoes'))}
      </View>
      {(interactive || accessories.length > 0) ? <View style={[styles.accessories, compact && styles.compactAccessories]}>
        {!compact ? <Text style={styles.accessoryLabel}>DETALHES</Text> : null}
        {(compact ? accessories.slice(0, 3) : accessories).map((item) => <View key={item.id} style={styles.accessory}>
          {slot('accessories', compact ? 52 : 76, item)}
        </View>)}
        {compact && accessories.length > 3 ? <Text style={styles.more}>+{accessories.length - 3}</Text> : null}
        {interactive ? <Pressable disabled={disabled} accessibilityRole="button" accessibilityLabel="Escolher acessórios" onPress={() => onSelectSlot?.('accessories')} style={styles.addAccessory}>
          <MaterialCommunityIcons name="plus" size={22} color={theme.colors.primary} />
          <Text style={styles.accessoryButtonLabel}>Acessórios</Text>
        </Pressable> : null}
      </View> : null}
    </View>
  </View>;
}

const styles = StyleSheet.create({
  board: { backgroundColor: '#ECEDE5', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: theme.colors.border },
  compactBoard: { padding: 12, borderRadius: 18 }, assembly: { flexDirection: 'row', justifyContent: 'center', gap: 12, alignItems: 'flex-start' },
  body: { flex: 1, maxWidth: 240, gap: 8 }, slot: { borderRadius: 15, backgroundColor: '#FFFFFF', padding: 7, overflow: 'hidden', borderWidth: 1, borderColor: '#D8DED2' },
  emptySlot: { backgroundColor: '#F5F5EF', borderStyle: 'dashed', borderColor: '#C5CFC0' },
  photo: { flex: 1, width: '100%', aspectRatio: undefined, borderRadius: 8, backgroundColor: 'transparent' },
  pieceName: { fontSize: 11, lineHeight: 16, color: theme.colors.ink, textAlign: 'center', marginTop: 3 },
  placeholder: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 4 }, slotLabel: { fontSize: 12, color: theme.colors.muted, textAlign: 'center' }, choose: { color: theme.colors.primary, fontSize: 11, fontWeight: '600' },
  change: { position: 'absolute', right: 5, top: 5, padding: 5, backgroundColor: theme.colors.sage, borderRadius: 12 },
  accessories: { width: 82, gap: 9, paddingTop: 6 }, compactAccessories: { width: 60 }, accessory: { width: '100%' },
  accessoryLabel: { fontSize: 9, letterSpacing: 1.1, color: theme.colors.muted, textAlign: 'center', marginBottom: 3 },
  addAccessory: { borderWidth: 1, borderStyle: 'dashed', borderColor: '#ACBBA5', borderRadius: 14, minHeight: 66, alignItems: 'center', justifyContent: 'center', gap: 5, padding: 5 },
  accessoryButtonLabel: { fontSize: 10, color: theme.colors.primary }, more: { textAlign: 'center', color: theme.colors.muted, fontSize: 12 }, pressed: { opacity: 0.7 },
});
