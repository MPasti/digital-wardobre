import { openDatabaseAsync, type SQLiteDatabase } from 'expo-sqlite';
import Storage from 'expo-sqlite/kv-store';
import { randomUUID } from 'expo-crypto';
import { migrateDatabase } from './clothing-repository';
import { bindDatabase, getBinding, setSyncValue } from './sync-repository';
import type { SyncBinding } from '../services/sync-types';

const connections = new Map<string, Promise<SQLiteDatabase>>();
let selectedFile: string | undefined;
let localQueue: Promise<unknown> = Promise.resolve();

function serialize<T>(task: () => Promise<T>): Promise<T> {
  const operation = localQueue.then(task);
  localQueue = operation.catch(() => undefined);
  return operation;
}

// Serializa operacoes locais para uma gravacao de tela nao entrar na transacao de download. Requisicoes de rede ficam fora desta fila.
export function runLocalTask<T>(task: (db: SQLiteDatabase) => Promise<T>): Promise<T> {
  return serialize(async () => task(await getDatabase()));
}

function openFile(filename: string) {
  if (!/^wardrobe(?:-[a-f0-9-]{36})?\.db$/i.test(filename)) throw new Error('Arquivo local de conta inválido.');
  if (!connections.has(filename)) {
    const connection = (async () => {
      const db = await openDatabaseAsync(filename);
      try {
        await migrateDatabase(db);
        return db;
      } catch (error) {
        await db.closeAsync().catch(() => undefined);
        throw error;
      }
    })().catch((error) => {
      connections.delete(filename);
      throw error;
    });
    connections.set(filename, connection);
  }
  return connections.get(filename)!;
}

export async function getActiveDatabaseName() {
  selectedFile ??= await Storage.getItemAsync('wardrobe.active-db') ?? 'wardrobe.db';
  return selectedFile;
}

export async function getDatabase() {
  return openFile(await getActiveDatabaseName());
}

function ownerKey(binding: SyncBinding) {
  return `wardrobe.database:${binding.project}:${binding.userId}`;
}

async function selectFile(filename: string) {
  await openFile(filename);
  await Storage.setItemAsync('wardrobe.active-db', filename);
  selectedFile = filename;
}

// Cada conta tem um SQLite separado. O arquivo original continua intacto.
export function activateAccountDatabase(binding: SyncBinding) {
  return serialize(async () => {
    const currentFile = await getActiveDatabaseName();
    const current = await getBinding(await getDatabase());
    if (current) await Storage.setItemAsync(ownerKey(current), currentFile);
    const same = current?.userId === binding.userId && current.project === binding.project;
    const filename = same ? currentFile : await Storage.getItemAsync(ownerKey(binding)) ?? `wardrobe-${randomUUID()}.db`;
    const db = await openFile(filename);
    await bindDatabase(db, binding);
    await Storage.setItemAsync(ownerKey(binding), filename);
    await selectFile(filename);
  });
}

export function rememberCurrentDatabase(binding: SyncBinding) {
  return runLocalTask(async (db) => {
    await bindDatabase(db, binding);
    await Storage.setItemAsync(ownerKey(binding), await getActiveDatabaseName());
  });
}

export function activateSignedOutDatabase() {
  return serialize(async () => {
    const current = await getBinding(await getDatabase());
    if (current) await Storage.setItemAsync(ownerKey(current), await getActiveDatabaseName());
    const filename = `wardrobe-${randomUUID()}.db`;
    await setSyncValue(await openFile(filename), 'signin_required', '1');
    await selectFile(filename);
  });
}

export function restoreDatabase(filename: string) {
  return serialize(() => selectFile(filename));
}
