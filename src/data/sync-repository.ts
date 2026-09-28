import type { ClothingItem, Outfit } from '../types/wardrobe';
import type { RemoteClothing, RemoteOutfit, RemoteOutfitItem, SyncBinding } from '../services/sync-types';
import type { LocalDatabase } from './clothing-repository';
import { wasDeleted } from './wardrobe-mutations';

export async function getSyncValue(db: LocalDatabase, key: string) {
  return (await db.getFirstAsync<{ value: string }>('SELECT value FROM sync_metadata WHERE key = ?', key))?.value ?? null;
}
export async function setSyncValue(db: LocalDatabase, key: string, value: string) {
  await db.runAsync('INSERT INTO sync_metadata (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value = excluded.value', key, value);
}
export async function getBinding(db: LocalDatabase): Promise<SyncBinding | null> {
  const value = await getSyncValue(db, 'binding');
  return value ? JSON.parse(value) : null;
}
export async function bindDatabase(db: LocalDatabase, binding: SyncBinding) {
  const current = await getBinding(db);
  if (current && (current.userId !== binding.userId || current.project !== binding.project)) {
    throw new Error('Este guarda roupa pertence a outra sessão. Os dados locais foram preservados e não serão enviados para outra conta.');
  }
  if (!current) await setSyncValue(db, 'binding', JSON.stringify(binding));
}
export async function confirmClothing(db: LocalDatabase, sent: ClothingItem, received: RemoteClothing) {
  await db.runAsync(`UPDATE clothing_items SET sync_status='synced', updated_at=?, remote_photo_path=?
    WHERE id=? AND updated_at=? AND sync_status='pending'`, received.updated_at, received.remote_photo_path, sent.id, sent.updatedAt);
}
export async function confirmOutfit(db: LocalDatabase, sent: Outfit, received: RemoteOutfit) {
  await db.runAsync(`UPDATE outfits SET sync_status='synced', updated_at=?
    WHERE id=? AND updated_at=? AND sync_status='pending'`, received.updated_at, sent.id, sent.updatedAt);
}
export async function mergeClothing(db: LocalDatabase, row: RemoteClothing) {
  if (await wasDeleted(db, 'clothing', row.id)) return false;
  const local = await db.getFirstAsync<{ sync_status: string; updated_at: string; remote_photo_path: string | null }>('SELECT sync_status, updated_at, remote_photo_path FROM clothing_items WHERE id=?', row.id);
  if (local && (local.sync_status === 'pending' || Date.parse(local.updated_at) > Date.parse(row.updated_at))) return false;
  await db.runAsync(`INSERT INTO clothing_items
    (id,name,category,color,notes,remote_photo_path,created_at,updated_at,sync_status)
    VALUES (?,?,?,?,?,?,?,?,'synced') ON CONFLICT(id) DO UPDATE SET
    name=excluded.name, category=excluded.category, color=excluded.color, notes=excluded.notes,
    local_photo_path=CASE WHEN clothing_items.remote_photo_path IS excluded.remote_photo_path THEN clothing_items.local_photo_path ELSE NULL END,
    remote_photo_path=excluded.remote_photo_path, updated_at=excluded.updated_at,
    created_at=excluded.created_at, sync_status='synced'`,
  row.id, row.name, row.category, row.color, row.notes, row.remote_photo_path, row.created_at, row.updated_at);
  return !local;
}
export async function mergeOutfit(db: LocalDatabase, row: RemoteOutfit, links: RemoteOutfitItem[]) {
  if (await wasDeleted(db, 'outfit', row.id)) return false;
  for (const link of links) if (await wasDeleted(db, 'clothing', link.clothing_item_id)) return false;
  const local = await db.getFirstAsync<{ sync_status: string; updated_at: string }>('SELECT sync_status,updated_at FROM outfits WHERE id=?', row.id);
  if (local && (local.sync_status === 'pending' || Date.parse(local.updated_at) > Date.parse(row.updated_at))) return false;
  if (!links.length) return false; // Nao exibe um look remoto cujo envio ainda esta incompleto.
  await db.withTransactionAsync(async () => {
    await db.runAsync(`INSERT INTO outfits (id,name,occasion,created_at,updated_at,sync_status)
      VALUES (?,?,?,?,?,'synced') ON CONFLICT(id) DO UPDATE SET name=excluded.name,
      occasion=excluded.occasion, created_at=excluded.created_at, updated_at=excluded.updated_at, sync_status='synced'`,
    row.id, row.name, row.occasion, row.created_at, row.updated_at);
    await db.runAsync('DELETE FROM outfit_items WHERE outfit_id=?', row.id);
    for (const link of links) {
      await db.runAsync('INSERT INTO outfit_items (outfit_id,clothing_item_id,position,created_at,updated_at) VALUES (?,?,?,?,?)',
        row.id, link.clothing_item_id, link.position, link.created_at, link.updated_at);
    }
  });
  return !local;
}
