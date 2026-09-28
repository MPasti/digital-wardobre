import type { Outfit } from '../types/wardrobe';
import type { LocalDatabase } from './clothing-repository';

export async function insertOutfit(db: LocalDatabase, outfit: Outfit) {
  await db.withTransactionAsync(async () => {
    await db.runAsync(`INSERT INTO outfits (id, name, occasion, created_at, updated_at, sync_status)
      VALUES (?, ?, ?, ?, ?, ?)`, outfit.id, outfit.name, outfit.occasion ?? '',
    outfit.createdAt, outfit.updatedAt, outfit.syncStatus);
    for (const [position, clothingId] of outfit.clothingIds.entries()) {
      await db.runAsync(`INSERT INTO outfit_items
        (outfit_id, clothing_item_id, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`,
      outfit.id, clothingId, position, outfit.createdAt, outfit.updatedAt);
    }
  });
}

export async function listOutfits(db: LocalDatabase): Promise<Outfit[]> {
  const rows = await db.getAllAsync<{
    id: string; name: string; occasion: string; created_at: string;
    updated_at: string; sync_status: 'pending' | 'synced';
  }>('SELECT * FROM outfits ORDER BY created_at DESC, id DESC');
  const links = await db.getAllAsync<{ outfit_id: string; clothing_item_id: string }>(
    'SELECT outfit_id, clothing_item_id FROM outfit_items ORDER BY outfit_id, position',
  );
  const clothingIds = new Map<string, string[]>();
  for (const link of links) {
    const ids = clothingIds.get(link.outfit_id) ?? [];
    ids.push(link.clothing_item_id);
    clothingIds.set(link.outfit_id, ids);
  }
  return rows.map((row) => ({
    id: row.id, name: row.name, occasion: row.occasion,
    createdAt: row.created_at, updatedAt: row.updated_at, syncStatus: row.sync_status,
    clothingIds: clothingIds.get(row.id) ?? [],
  }));
}
