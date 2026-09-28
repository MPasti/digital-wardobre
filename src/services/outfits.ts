import type { ClothingCategory, ClothingItem, Outfit } from '../types/wardrobe';

export const outfitSlots: Record<ClothingCategory, { label: string; hint: string }> = {
  tops: { label: 'Parte de cima', hint: 'Camisa, camiseta ou casaco' },
  bottoms: { label: 'Parte de baixo', hint: 'Calça, saia ou bermuda' },
  'one-piece': { label: 'Peça única', hint: 'Vestido ou macacão' },
  shoes: { label: 'Calçados', hint: 'O par que completa o look' },
  accessories: { label: 'Acessórios', hint: 'Bolsas, cintos e outros detalhes' },
};

const categoryOrder: Record<ClothingCategory, number> = {
  tops: 0, 'one-piece': 0, bottoms: 1, shoes: 2, accessories: 3,
};

export function orderOutfitItems(items: ClothingItem[]) {
  return [...items].sort((a, b) => categoryOrder[a.category] - categoryOrder[b.category]);
}

export function toggleOutfitItem(ids: string[], selected: ClothingItem, wardrobe: ClothingItem[]) {
  if (ids.includes(selected.id)) return ids.filter((id) => id !== selected.id);
  const retained = ids.filter((id) => {
    const item = wardrobe.find((entry) => entry.id === id);
    if (!item) return false;
    if (selected.category === 'accessories') return true;
    if (item.category === selected.category) return false;
    if (selected.category === 'one-piece') return item.category !== 'tops' && item.category !== 'bottoms';
    if (selected.category === 'tops' || selected.category === 'bottoms') return item.category !== 'one-piece';
    return true;
  });
  return [...retained, selected.id];
}

export type OutfitDraft = { name: string; occasion: string; clothingIds: string[] };
export type OutfitErrors = Partial<Record<'name' | 'occasion' | 'pieces', string>>;

export function validateOutfit(draft: OutfitDraft, wardrobe: ClothingItem[]): OutfitErrors {
  const errors: OutfitErrors = {};
  if (!draft.name.trim()) errors.name = 'Dê um nome para o look.';
  else if (draft.name.trim().length > 100) errors.name = 'Use até 100 caracteres.';
  if (draft.occasion.trim().length > 200) errors.occasion = 'Use até 200 caracteres.';
  if (draft.clothingIds.length === 0) errors.pieces = 'Escolha pelo menos uma peça para o look.';
  const unique = new Set(draft.clothingIds);
  const selected = wardrobe.filter((item) => unique.has(item.id));
  if (unique.size !== draft.clothingIds.length || selected.length !== unique.size) {
    errors.pieces = 'Confira a seleção: alguma peça não está mais disponível ou foi repetida.';
  }
  for (const category of ['tops', 'bottoms', 'one-piece', 'shoes'] as const) {
    if (selected.filter((item) => item.category === category).length > 1) {
      errors.pieces = 'Escolha uma peça por posição. Acessórios podem ser combinados.';
    }
  }
  if (selected.some((item) => item.category === 'one-piece') && selected.some((item) => item.category === 'tops' || item.category === 'bottoms')) {
    errors.pieces = 'Use uma peça única ou combine parte de cima e parte de baixo.';
  }
  return errors;
}

export function buildOutfit(draft: OutfitDraft, wardrobe: ClothingItem[], createId: () => string): Outfit {
  const errors = validateOutfit(draft, wardrobe);
  if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
  const selected = draft.clothingIds.map((id) => wardrobe.find((item) => item.id === id)!);
  const now = new Date().toISOString();
  return {
    id: createId(), name: draft.name.trim(), occasion: draft.occasion.trim(),
    clothingIds: orderOutfitItems(selected).map((item) => item.id),
    createdAt: now, updatedAt: now, syncStatus: 'pending',
  };
}
