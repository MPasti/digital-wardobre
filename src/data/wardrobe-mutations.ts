import type { ClothingItem, Outfit } from '../types/wardrobe';
import { validateOutfit } from '../services/outfits';
import { listClothing, type LocalDatabase } from './clothing-repository';
import { listOutfits } from './outfit-repository';

export type Deletion = { entity: 'clothing' | 'outfit' | 'photo'; id: string; queued_at: string };

export function nextUpdatedAt(previous: string) {
  return new Date(Math.max(Date.now(), Date.parse(previous) + 1)).toISOString();
}

async function queueDeletion(db: LocalDatabase, entity: Deletion['entity'], id: string) {
  await db.runAsync(`INSERT INTO sync_deletions (entity,id,queued_at,done) VALUES (?,?,?,0)
    ON CONFLICT(entity,id) DO UPDATE SET queued_at=excluded.queued_at, done=0`, entity, id, new Date().toISOString());
}

export async function listDeletions(db: LocalDatabase) {
  return db.getAllAsync<Deletion>("SELECT entity,id,queued_at FROM sync_deletions WHERE done=0 ORDER BY CASE entity WHEN 'outfit' THEN 0 WHEN 'clothing' THEN 1 ELSE 2 END");
}

export async function wasDeleted(db: LocalDatabase, entity: 'clothing' | 'outfit', id: string) {
  return !!await db.getFirstAsync('SELECT 1 FROM sync_deletions WHERE entity=? AND id=?', entity, id);
}

export async function confirmDeletion(db: LocalDatabase, deletion: Deletion) {
  // Guarda só o UUID excluído para impedir que uma resposta antiga restaure o registro.
  await db.runAsync('UPDATE sync_deletions SET done=1 WHERE entity=? AND id=? AND queued_at=?', deletion.entity, deletion.id, deletion.queued_at);
}

async function writeOutfit(db: LocalDatabase, outfit: Outfit) {
  await db.runAsync("UPDATE outfits SET name=?, occasion=?, updated_at=?, sync_status='pending' WHERE id=?",
    outfit.name, outfit.occasion ?? '', outfit.updatedAt, outfit.id);
  await db.runAsync('DELETE FROM outfit_items WHERE outfit_id=?', outfit.id);
  for (const [position, id] of outfit.clothingIds.entries()) {
    await db.runAsync('INSERT INTO outfit_items (outfit_id,clothing_item_id,position,created_at,updated_at) VALUES (?,?,?,?,?)',
      outfit.id, id, position, outfit.createdAt, outfit.updatedAt);
  }
}

export async function updateOutfit(db: LocalDatabase, outfit: Outfit) {
  await db.withTransactionAsync(async () => {
    if (!await db.getFirstAsync('SELECT id FROM outfits WHERE id=?', outfit.id)) throw new Error('Este look não está mais disponível.');
    const errors = validateOutfit({ ...outfit, occasion: outfit.occasion ?? '' }, await listClothing(db));
    if (Object.keys(errors).length) throw new Error(Object.values(errors)[0]);
    await writeOutfit(db, outfit);
  });
}

export async function updateClothing(db: LocalDatabase, item: ClothingItem) {
  await db.withTransactionAsync(async () => {
    const clothes = await listClothing(db);
    const previous = clothes.find((entry) => entry.id === item.id);
    if (!previous) throw new Error('Esta peça não está mais disponível.');
    if (previous.category !== item.category) {
      const changed = clothes.map((entry) => entry.id === item.id ? item : entry);
      for (const look of (await listOutfits(db)).filter((entry) => entry.clothingIds.includes(item.id))) {
        if (validateOutfit({ ...look, occasion: look.occasion ?? '' }, changed).pieces) {
          throw new Error(`Essa categoria conflita com as peças do look “${look.name}”. Ajuste esse look antes de trocar a categoria.`);
        }
      }
    }
    await db.runAsync(`UPDATE clothing_items SET name=?,category=?,color=?,notes=?,local_photo_path=?,remote_photo_path=?,updated_at=?,sync_status='pending' WHERE id=?`,
      item.name, item.category, item.color, item.notes ?? '', item.localPhotoPath ?? null, item.remotePhotoPath ?? null, item.updatedAt, item.id);
    if (item.localPhotoPath || item.remotePhotoPath) {
      await db.runAsync("DELETE FROM sync_deletions WHERE entity='photo' AND id=?", item.id);
    } else if (previous.localPhotoPath || previous.remotePhotoPath) {
      await queueDeletion(db, 'photo', item.id);
    }
  });
}

export async function deleteOutfit(db: LocalDatabase, id: string) {
  await db.withTransactionAsync(async () => {
    await queueDeletion(db, 'outfit', id);
    await db.runAsync('DELETE FROM outfits WHERE id=?', id);
  });
}

export async function deleteClothing(db: LocalDatabase, id: string) {
  await db.withTransactionAsync(async () => {
    for (const outfit of (await listOutfits(db)).filter((entry) => entry.clothingIds.includes(id))) {
      const clothingIds = outfit.clothingIds.filter((entry) => entry !== id);
      if (clothingIds.length) {
        await writeOutfit(db, { ...outfit, clothingIds, updatedAt: nextUpdatedAt(outfit.updatedAt) });
      } else {
        await queueDeletion(db, 'outfit', outfit.id);
        await db.runAsync('DELETE FROM outfits WHERE id=?', outfit.id);
      }
    }
    await queueDeletion(db, 'clothing', id);
    await db.runAsync('DELETE FROM clothing_items WHERE id=?', id);
    await db.runAsync("DELETE FROM sync_deletions WHERE entity='photo' AND id=?", id);
  });
}
