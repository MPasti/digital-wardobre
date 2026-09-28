import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { migrateDatabase } from './clothing-repository';

let connection: Promise<SQLiteDatabase> | undefined;

export function getDatabase() {
  if (!connection) {
    connection = (async () => {
      const db = await openDatabaseAsync('wardrobe.db');
      try {
        await migrateDatabase(db);
        return db;
      } catch (error) {
        await db.closeAsync().catch(() => undefined);
        throw error;
      }
    })().catch((error) => {
      connection = undefined;
      throw error;
    });
  }
  return connection;
}
