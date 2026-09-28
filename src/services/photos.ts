import { Directory, File, Paths } from 'expo-file-system';
import { preparePhoto } from './prepare-photo';

function photoFile(path: string) {
  if (!/^[a-f0-9-]{36}\.jpg$/i.test(path)) throw new Error('Caminho de foto inválido.');
  return new File(Paths.document, 'clothing-photos', path);
}

export async function persistPhoto(uri: string, id: string) {
  const image = await preparePhoto(uri);
  const path = `${id}.jpg`;
  const destination = photoFile(path);
  try {
    new Directory(Paths.document, 'clothing-photos').create({ idempotent: true, intermediates: true });
    await new File(image.uri).copy(destination);
    if (!destination.exists || destination.size === 0) throw new Error('A foto não foi copiada.');
    return path;
  } catch (error) {
    try { if (destination.exists) destination.delete(); } catch { /* A falha principal será exibida. */ }
    throw error;
  } finally {
    const temporary = new File(image.uri);
    try { if (temporary.exists) temporary.delete(); } catch { /* O sistema pode limpar o cache depois. */ }
  }
}

export async function removePhoto(path: string) {
  const file = photoFile(path);
  if (file.exists) await file.delete();
}

export async function resolvePhoto(path: string) {
  const file = photoFile(path);
  return file.exists ? file.uri : undefined;
}

export async function hasPhoto(path: string) {
  const file = photoFile(path);
  return file.exists && file.size > 0;
}

export async function readPhotoBytes(path: string): Promise<ArrayBuffer> {
  const file = photoFile(path);
  if (!file.exists || !file.size) throw new Error('A foto local não foi encontrada. Os dados da peça foram preservados.');
  return file.arrayBuffer();
}

export async function savePhotoBytes(bytes: ArrayBuffer, id: string) {
  const path = `${id}.jpg`;
  const file = photoFile(path);
  new Directory(Paths.document, 'clothing-photos').create({ idempotent: true, intermediates: true });
  try {
    file.write(new Uint8Array(bytes));
    if (!file.exists || file.size !== bytes.byteLength) throw new Error('A foto não foi salva por completo.');
    return path;
  } catch (error) {
    try { if (file.exists) file.delete(); } catch {}
    throw error;
  }
}
