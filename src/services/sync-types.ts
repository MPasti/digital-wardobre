import type { LocalDatabase } from '../data/clothing-repository';
import type { ClothingCategory, ClothingItem, Outfit } from '../types/wardrobe';

export type SyncBinding = { userId: string; project: string };
export type RemoteClothing = {
  id: string; user_id: string; name: string; category: ClothingCategory; color: string;
  notes: string; remote_photo_path: string | null; created_at: string; updated_at: string;
};
export type RemoteOutfit = { id: string; user_id: string; name: string; occasion: string; created_at: string; updated_at: string };
export type RemoteOutfitItem = { outfit_id: string; clothing_item_id: string; user_id: string; position: number; created_at: string; updated_at: string };
export type RemoteSnapshot = { clothes: RemoteClothing[]; outfits: RemoteOutfit[]; links: RemoteOutfitItem[] };
export type SyncResult = { userId: string; uploaded: number; downloaded: number; issues: string[] };
export interface RemoteWardrobe {
  identify: (binding: SyncBinding | null) => Promise<SyncBinding>;
  saveClothing: (item: ClothingItem, userId: string, photoPath?: string) => Promise<RemoteClothing>;
  saveOutfit: (outfit: Outfit, userId: string) => Promise<RemoteOutfit>;
  saveLinks: (outfit: Outfit, userId: string) => Promise<void>;
  download: (userId: string) => Promise<RemoteSnapshot>;
  uploadPhoto: (path: string, bytes: ArrayBuffer) => Promise<void>;
  downloadPhoto: (path: string) => Promise<ArrayBuffer>;
}
export type SyncDependencies = {
  runLocal: <T>(task: (db: LocalDatabase) => Promise<T>) => Promise<T>;
  remote: RemoteWardrobe;
  photos: {
    read: (path: string) => Promise<ArrayBuffer>;
    exists: (path: string) => Promise<boolean>;
    save: (bytes: ArrayBuffer, id: string) => Promise<string>;
  };
  onPhase?: (message: string) => void;
};
