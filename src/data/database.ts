import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import { migrateDatabase } from './clothing-repository';

let connection: Promise<SQLiteDatabase> | undefined;
let localQueue: Promise<unknown> = Promise.resolve();

// Serializa operacoes locais para uma gravacao de tela nao entrar na transacao de download. Requisicoes de rede ficam fora desta fila.
export function runLocalTask<T>(task: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  const operation = localQueue.then(async () => task(await getDatabase()));
  localQueue = operation.catch(() => undefined);
  return operation;
}

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
