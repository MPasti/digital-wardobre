import { runLocalTask } from '../data/database';
import { requireSupabase, supabaseConfiguration } from '../lib/supabase';
import { hasPhoto, readPhotoBytes, savePhotoBytes } from './photos';
import { createSyncRunner } from './sync-engine';
import { createSupabaseRemote } from './supabase-remote';
import { getSyncValue } from '../data/sync-repository';
import type { SyncResult } from './sync-types';

let runner: ReturnType<typeof createSyncRunner> | undefined;
let active: Promise<SyncResult> | undefined;
let paused = false;
export async function syncWardrobe() {
  if (paused) throw new Error('Aguarde a troca de conta.');
  if (await runLocalTask((db) => getSyncValue(db, 'signin_required')) === '1') throw new Error('Entre na sua conta ou escolha continuar sem cadastro.');
  if (paused) throw new Error('Aguarde a troca de conta.');
  if (!runner) {
    const client = requireSupabase();
    if (supabaseConfiguration.status !== 'ready') throw new Error('Configure a conexão com o Supabase.');
    runner = createSyncRunner({
      runLocal: runLocalTask,
      remote: createSupabaseRemote(client, supabaseConfiguration.url),
      photos: { read: readPhotoBytes, exists: hasPhoto, save: savePhotoBytes },
    });
  }
  const operation = runner();
  active = operation;
  try { return await operation; }
  finally { if (active === operation) active = undefined; }
}

export async function withSyncPaused<T>(task: () => Promise<T>): Promise<T> {
  paused = true;
  try {
    await active?.catch(() => undefined);
    return await task();
  } finally { runner = undefined; paused = false; }
}
