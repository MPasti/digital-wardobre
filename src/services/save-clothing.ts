import { clothingCategories, type ClothingCategory, type ClothingItem } from '../types/wardrobe';

export type ClothingDraft = {
  name: string;
  category: string;
  color: string;
  notes: string;
  photoUri?: string;
};
export type DraftErrors = Partial<Record<'name' | 'category' | 'color' | 'notes', string>>;

export function validateDraft(draft: ClothingDraft): DraftErrors {
  const errors: DraftErrors = {};
  if (!draft.name.trim()) errors.name = 'Dê um nome para a peça.';
  else if (draft.name.trim().length > 100) errors.name = 'Use até 100 caracteres.';
  if (!clothingCategories.some((item) => item.id !== 'all' && item.id === draft.category)) {
    errors.category = 'Escolha a categoria da peça.';
  }
  if (!draft.color.trim()) errors.color = 'Informe a cor principal.';
  else if (draft.color.trim().length > 50) errors.color = 'Use até 50 caracteres.';
  if (draft.notes.trim().length > 1000) errors.notes = 'Use até 1.000 caracteres.';
  return errors;
}

export type SaveDependencies = {
  createId: () => string;
  persistPhoto: (uri: string, id: string) => Promise<string>;
  removePhoto: (path: string) => Promise<void>;
  insert: (item: ClothingItem) => Promise<void>;
};

export async function saveClothing(draft: ClothingDraft, deps: SaveDependencies): Promise<ClothingItem> {
  if (Object.keys(validateDraft(draft)).length) throw new Error('Confira os campos do cadastro.');
  const id = deps.createId();
  const now = new Date().toISOString();
  const photoPath = draft.photoUri ? await deps.persistPhoto(draft.photoUri, id) : undefined;
  const item: ClothingItem = {
    id, name: draft.name.trim(), category: draft.category as ClothingCategory,
    color: draft.color.trim(), notes: draft.notes.trim(), localPhotoPath: photoPath,
    createdAt: now, updatedAt: now, syncStatus: 'pending',
  };
  try {
    await deps.insert(item);
  } catch (error) {
    if (photoPath) await deps.removePhoto(photoPath).catch(() => undefined);
    throw error;
  }
  return item;
}
