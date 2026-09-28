import { listClothing } from '../data/clothing-repository';
import { listOutfits } from '../data/outfit-repository';
import { bindDatabase, confirmClothing, confirmOutfit, getBinding, mergeClothing, mergeOutfit, setSyncValue } from '../data/sync-repository';
import type { SyncDependencies, SyncResult } from './sync-types';

export function syncErrorMessage(error: unknown): string {
  const value = error as { message?: string; code?: string; status?: number } | null;
  const message = value?.message ?? '';
  if (value?.code === 'anonymous_provider_disabled' || /anonymous.*(disabled|not allowed)/i.test(message)) {
    return 'Ative o acesso anônimo no Supabase em Authentication → Sign In / Providers → Anonymous.';
  }
  if (/bucket not found/i.test(message)) return 'As fotos aguardam a criação do armazenamento. Execute supabase/02_storage_fotos.sql no SQL Editor do Supabase.';
  if (/row.level security|permission denied|42501/i.test(message) || value?.code === '42501') {
    return 'O Supabase recusou a permissão. Confira as políticas RLS das tabelas e do armazenamento de fotos.';
  }
  if (/relation .* does not exist|schema cache/i.test(message)) return 'Confira se as três tabelas do projeto foram criadas no schema public do Supabase.';
  if (/fetch|network|abort|timeout|timed out|conexão/i.test(message)) return 'Não foi possível acessar a nuvem. Seus dados continuam neste aparelho; tente novamente com internet.';
  if (value?.status === 429 || /rate limit/i.test(message)) return 'O servidor recebeu muitas tentativas. Aguarde alguns minutos antes de sincronizar novamente.';
  // Mensagens de sessão/configuração geradas pelo aplicativo são seguras para exibir.
  if (error instanceof Error && /^(Este guarda roupa|Sua sessão|Configure|Preencha|A configuração|Use |Informe|A foto|Caminho|Resposta|Dados)/.test(message)) return message;
  return 'Não foi possível concluir a sincronização. Seus dados locais foram mantidos. Confira a conexão e a configuração do Supabase.';
}

function assertOwner(row: { user_id: string }, userId: string) {
  if (row.user_id !== userId) throw new Error('Resposta da nuvem pertence a outra conta. A sincronização foi interrompida.');
}

export async function synchronizeOnce(deps: SyncDependencies): Promise<SyncResult> {
  const { runLocal, remote, photos } = deps;
  const binding = await remote.identify(await runLocal(getBinding));
  await runLocal(async (db) => {
    await bindDatabase(db, binding);
    await setSyncValue(db, 'last_attempt', new Date().toISOString());
  });
  const userId = binding.userId;
  const result: SyncResult = { userId, uploaded: 0, downloaded: 0, issues: [] };
  const problem = (error: unknown) => {
    const message = syncErrorMessage(error);
    if (!result.issues.includes(message)) result.issues.push(message);
  };

  deps.onPhase?.('Enviando suas peças…');
  const pending = (await runLocal(listClothing)).filter((item) => item.syncStatus === 'pending');
  for (const item of pending) {
    try {
      let photoPath = item.remotePhotoPath;
      if (item.localPhotoPath) {
        photoPath = `${userId}/${item.id}.jpg`;
        await remote.uploadPhoto(photoPath, await photos.read(item.localPhotoPath));
      }
      const saved = await remote.saveClothing(item, userId, photoPath);
      assertOwner(saved, userId);
      if (saved.id !== item.id) throw new Error('Resposta da nuvem com identificador diferente.');
      await runLocal((db) => confirmClothing(db, item, saved));
      result.uploaded++;
    } catch (error) { problem(error); }
  }

  deps.onPhase?.('Enviando seus looks…');
  const clothes = await runLocal(listClothing);
  const syncedIds = new Set(clothes.filter((item) => item.syncStatus === 'synced').map((item) => item.id));
  for (const outfit of (await runLocal(listOutfits)).filter((item) => item.syncStatus === 'pending')) {
    if (!outfit.clothingIds.every((id) => syncedIds.has(id))) {
      problem(new Error('Dados do look aguardam o envio das peças que o compõem.'));
      continue;
    }
    try {
      const saved = await remote.saveOutfit(outfit, userId);
      assertOwner(saved, userId);
      if (saved.id !== outfit.id) throw new Error('Resposta da nuvem com identificador diferente.');
      await remote.saveLinks(outfit, userId);
      await runLocal((db) => confirmOutfit(db, outfit, saved));
      result.uploaded++;
    } catch (error) { problem(error); }
  }

  deps.onPhase?.('Atualizando este aparelho…');
  try {
    const snapshot = await remote.download(userId);
    for (const row of [...snapshot.clothes, ...snapshot.outfits, ...snapshot.links]) assertOwner(row, userId);
    for (const row of snapshot.clothes) {
      if (row.remote_photo_path && row.remote_photo_path !== `${userId}/${row.id}.jpg`) {
        throw new Error('Resposta da nuvem com caminho de foto inválido.');
      }
      if (await runLocal((db) => mergeClothing(db, row))) result.downloaded++;
    }
    for (const row of snapshot.outfits) {
      const links = snapshot.links.filter((link) => link.outfit_id === row.id).sort((a, b) => a.position - b.position);
      if (await runLocal((db) => mergeOutfit(db, row, links))) result.downloaded++;
    }
  } catch (error) { problem(error); }

  for (const item of await runLocal(listClothing)) {
    if (!item.remotePhotoPath || item.syncStatus === 'pending') continue;
    try {
      if (item.localPhotoPath && await photos.exists(item.localPhotoPath)) continue;
      if (item.remotePhotoPath !== `${userId}/${item.id}.jpg`) throw new Error('Caminho de foto inválido.');
      const path = await photos.save(await remote.downloadPhoto(item.remotePhotoPath), item.id);
      await runLocal((db) => db.runAsync("UPDATE clothing_items SET local_photo_path=? WHERE id=? AND remote_photo_path=? AND sync_status='synced'", path, item.id, item.remotePhotoPath!));
    } catch (error) { problem(error); }
  }
  if (!result.issues.length) await runLocal((db) => setSyncValue(db, 'last_success', new Date().toISOString()));
  return result;
}

// Uma única execução por vez, inclusive quando salvar e retomar o app ocorrem juntos.
// Se houver novos cadastros durante o envio, processa outra rodada após o sucesso.
export function createSyncRunner(deps: SyncDependencies) {
  let running: Promise<SyncResult> | null = null;
  let requestedAgain = false;
  return function synchronize(): Promise<SyncResult> {
    if (running) { requestedAgain = true; return running; }
    running = (async () => {
      let result: SyncResult;
      do {
        requestedAgain = false;
        result = await synchronizeOnce(deps);
      } while (requestedAgain && !result.issues.length);
      return result;
    })().finally(() => { running = null; });
    return running;
  };
}
