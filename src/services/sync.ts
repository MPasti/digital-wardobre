import { runLocalTask } from '../data/database';
import { requireSupabase, supabaseConfiguration } from '../lib/supabase';
import { hasPhoto, readPhotoBytes, savePhotoBytes } from './photos';
import { createSyncRunner } from './sync-engine';
import { createSupabaseRemote } from './supabase-remote';

let runner: ReturnType<typeof createSyncRunner> | undefined;
export function syncWardrobe() {
  if (!runner) {
    const client = requireSupabase();
    if (supabaseConfiguration.status !== 'ready') throw new Error('Configure a conexão com o Supabase.');
    runner = createSyncRunner({
      runLocal: runLocalTask,
      remote: createSupabaseRemote(client, supabaseConfiguration.url),
      photos: { read: readPhotoBytes, exists: hasPhoto, save: savePhotoBytes },
    });
  }
  return runner();
}
