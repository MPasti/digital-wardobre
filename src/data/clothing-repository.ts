import type { ClothingCategory, ClothingItem } from '../types/wardrobe';

export interface LocalDatabase {
  execAsync(sql: string): Promise<void>;
  runAsync(sql: string, ...params: (string | number | null)[]): Promise<unknown>;
  getAllAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T[]>;
  getFirstAsync<T>(sql: string, ...params: (string | number | null)[]): Promise<T | null>;
  withTransactionAsync(task: () => Promise<void>): Promise<void>;
}

export async function migrateDatabase(db: LocalDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;');
  const version = await db.getFirstAsync<{ user_version: number }>('PRAGMA user_version');
  const currentVersion = version?.user_version ?? 0;
  if (currentVersion > 4) {
    throw new Error('O banco foi criado por uma versão mais recente do aplicativo.');
  }
  if (currentVersion === 4) return;
  await db.withTransactionAsync(async () => {
    if (currentVersion === 0) {
    await db.execAsync(`
      CREATE TABLE clothing_items (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
        category TEXT NOT NULL CHECK(category IN ('tops','bottoms','one-piece','shoes','accessories')),
        color TEXT NOT NULL CHECK(length(trim(color)) BETWEEN 1 AND 50),
        notes TEXT NOT NULL DEFAULT '' CHECK(length(notes) <= 1000),
        local_photo_path TEXT,
        remote_photo_path TEXT,
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending','synced'))
      );
      CREATE INDEX clothing_items_category_idx ON clothing_items(category);
    `);
    }
    if (currentVersion < 2) await db.execAsync(`
      CREATE TABLE outfits (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL CHECK(length(trim(name)) BETWEEN 1 AND 100),
        occasion TEXT NOT NULL DEFAULT '' CHECK(length(occasion) <= 200),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        sync_status TEXT NOT NULL DEFAULT 'pending' CHECK(sync_status IN ('pending','synced'))
      );
      CREATE TABLE outfit_items (
        outfit_id TEXT NOT NULL REFERENCES outfits(id) ON DELETE CASCADE,
        clothing_item_id TEXT NOT NULL REFERENCES clothing_items(id) ON DELETE CASCADE,
        position INTEGER NOT NULL CHECK(position >= 0),
        created_at TEXT NOT NULL,
        updated_at TEXT NOT NULL,
        PRIMARY KEY (outfit_id, clothing_item_id),
        UNIQUE (outfit_id, position)
      );
      CREATE INDEX outfit_items_clothing_idx ON outfit_items(clothing_item_id);
    `);
    await db.execAsync(`
      CREATE TABLE IF NOT EXISTS sync_metadata (key TEXT PRIMARY KEY NOT NULL, value TEXT NOT NULL);
      CREATE TABLE IF NOT EXISTS sync_deletions (
        entity TEXT NOT NULL CHECK(entity IN ('clothing','outfit','photo')),
        id TEXT NOT NULL,
        queued_at TEXT NOT NULL,
        done INTEGER NOT NULL DEFAULT 0 CHECK(done IN (0,1)),
        PRIMARY KEY (entity,id)
      );
      PRAGMA user_version = 4;
    `);
  });
}

type ClothingRow = {
  id: string; name: string; category: ClothingCategory; color: string; notes: string;
  local_photo_path: string | null; remote_photo_path: string | null;
  created_at: string; updated_at: string; sync_status: 'pending' | 'synced';
};

export async function listClothing(db: LocalDatabase): Promise<ClothingItem[]> {
  const rows = await db.getAllAsync<ClothingRow>('SELECT * FROM clothing_items ORDER BY created_at DESC, id DESC');
  return rows.map((row) => ({
    id: row.id, name: row.name, category: row.category, color: row.color, notes: row.notes,
    localPhotoPath: row.local_photo_path ?? undefined,
    remotePhotoPath: row.remote_photo_path ?? undefined,
    createdAt: row.created_at, updatedAt: row.updated_at, syncStatus: row.sync_status,
  }));
}

export async function insertClothing(db: LocalDatabase, item: ClothingItem) {
  await db.runAsync(`INSERT INTO clothing_items
    (id, name, category, color, notes, local_photo_path, remote_photo_path, created_at, updated_at, sync_status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  item.id, item.name, item.category, item.color, item.notes ?? '', item.localPhotoPath ?? null,
  item.remotePhotoPath ?? null, item.createdAt, item.updatedAt, item.syncStatus);
}
