// Prévia web: fotos ficam como arquivos Blob no IndexedDB, fora das tabelas SQLite.
// No iPhone e no Android, photos.ts usa a pasta persistente do Expo FileSystem.
import { preparePhoto } from './prepare-photo';

function openPhotos(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open('wardrobe-photos', 1);
    request.onupgradeneeded = () => request.result.createObjectStore('photos');
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function photoTransaction<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openPhotos();
  try {
    return await new Promise<T>((resolve, reject) => {
      const tx = db.transaction('photos', mode);
      const request = operation(tx.objectStore('photos'));
      tx.oncomplete = () => resolve(request.result);
      tx.onabort = () => reject(tx.error ?? new Error('Falha ao armazenar a foto.'));
      tx.onerror = () => reject(tx.error);
    });
  } finally {
    db.close();
  }
}

export async function persistPhoto(uri: string, id: string) {
  const image = await preparePhoto(uri);
  const blob = await (await fetch(image.uri)).blob();
  if (!blob.size) throw new Error('A imagem está vazia.');
  const path = `${id}.jpg`;
  await photoTransaction('readwrite', (store) => store.put(blob, path));
  return path;
}

export async function removePhoto(path: string) {
  await photoTransaction('readwrite', (store) => store.delete(path));
}

export async function resolvePhoto(path: string): Promise<string | undefined> {
  const blob = await photoTransaction<Blob | undefined>('readonly', (store) => store.get(path));
  if (!blob) return undefined;
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
