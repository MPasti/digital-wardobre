import { clothingCategories, type ClothingCategory, type ClothingItem } from '../types/wardrobe';
import { nextUpdatedAt } from '../data/wardrobe-mutations';

export type ClothingDraft = {
  name: string;
  category: string;
  color: string;
  notes: string;
  photoUri?: string;
  photoChanged?: boolean;
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

export async function saveClothing(draft: ClothingDraft, deps: SaveDependencies, existing?: ClothingItem): Promise<ClothingItem> {
  if (Object.keys(validateDraft(draft)).length) throw new Error('Confira os campos do cadastro.');
  const id = existing?.id ?? deps.createId();
  const now = existing ? nextUpdatedAt(existing.updatedAt) : new Date().toISOString();
  const replacePhoto = !existing || !!draft.photoChanged;
  // Na edição, a nova foto ganha um arquivo separado; uma falha não destrói a antiga.
  const photoPath = replacePhoto
    ? draft.photoUri ? await deps.persistPhoto(draft.photoUri, existing ? deps.createId() : id) : undefined
    : existing?.localPhotoPath;
  const item: ClothingItem = {
    id, name: draft.name.trim(), category: draft.category as ClothingCategory,
    color: draft.color.trim(), notes: draft.notes.trim(), localPhotoPath: photoPath,
    remotePhotoPath: replacePhoto ? undefined : existing?.remotePhotoPath,
    createdAt: existing?.createdAt ?? now, updatedAt: now, syncStatus: 'pending',
  };
  try {
    await deps.insert(item);
  } catch (error) {
    if (replacePhoto && photoPath) await deps.removePhoto(photoPath).catch(() => undefined);
    throw error;
  }
  if (replacePhoto && existing?.localPhotoPath && existing.localPhotoPath !== photoPath) {
    await deps.removePhoto(existing.localPhotoPath).catch(() => undefined);
  }
  return item;
}
