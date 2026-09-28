import type { SupabaseClient } from '@supabase/supabase-js';
import type { RemoteClothing, RemoteOutfit, RemoteOutfitItem, RemoteWardrobe } from './sync-types';

const BUCKET = 'wardrobe-photos';
const PAGE_SIZE = 200;

export function createSupabaseRemote(client: SupabaseClient, project: string): RemoteWardrobe {
  async function rows<T>(table: string, userId: string, order: string[]): Promise<T[]> {
    const result: T[] = [];
    for (let start = 0; ; start += PAGE_SIZE) {
      let query = client.from(table).select('*').eq('user_id', userId);
      for (const column of order) query = query.order(column);
      const { data, error } = await query.range(start, start + PAGE_SIZE - 1);
      if (error) throw error;
      result.push(...(data as T[]));
      if (data.length < PAGE_SIZE) return result;
    }
  }
  return {
    async identify(binding) {
      if (binding && binding.project !== project) throw new Error('Este guarda roupa já está vinculado a outro projeto Supabase. Restaure a configuração anterior para sincronizar.');
      const { data, error } = await client.auth.getSession();
      if (error) throw error;
      let session = data.session;
      if (!session) {
        if (binding) throw new Error('Sua sessão anônima não está mais disponível. Os dados locais foram preservados. Não é possível recuperar essa identidade sem uma conta vinculada.');
        const signed = await client.auth.signInAnonymously();
        if (signed.error) throw signed.error;
        session = signed.data.session;
      }
      if (!session) throw new Error('Sua sessão não pôde ser criada. Tente novamente com internet.');
      if (binding && binding.userId !== session.user.id) throw new Error('Este guarda roupa pertence a outra sessão. Os dados locais não serão enviados para outra conta.');
      return { userId: session.user.id, project };
    },
    async saveClothing(item, userId, photoPath) {
      const { data, error } = await client.from('clothing_items').upsert({
        id: item.id, user_id: userId, name: item.name, category: item.category, color: item.color,
        notes: item.notes ?? '', remote_photo_path: photoPath ?? null, created_at: item.createdAt, updated_at: item.updatedAt,
      }, { onConflict: 'id' }).select('*').single();
      if (error) throw error;
      return data as RemoteClothing;
    },
    async saveOutfit(outfit, userId) {
      const { data, error } = await client.from('outfits').upsert({
        id: outfit.id, user_id: userId, name: outfit.name, occasion: outfit.occasion ?? '',
        created_at: outfit.createdAt, updated_at: outfit.updatedAt,
      }, { onConflict: 'id' }).select('*').single();
      if (error) throw error;
      return data as RemoteOutfit;
    },
    async saveLinks(outfit, userId) {
      if (!outfit.clothingIds.length) throw new Error('Dados do look não contêm peças.');
      const removed = await client.from('outfit_items').delete().eq('outfit_id', outfit.id).eq('user_id', userId);
      if (removed.error) throw removed.error;
      const { data, error } = await client.from('outfit_items').upsert(outfit.clothingIds.map((id, position) => ({
        outfit_id: outfit.id, clothing_item_id: id, user_id: userId, position,
        created_at: outfit.createdAt, updated_at: outfit.updatedAt,
      })), { onConflict: 'outfit_id,clothing_item_id' }).select('clothing_item_id');
      if (error) throw error;
      if (data.length !== outfit.clothingIds.length) throw new Error('Resposta da nuvem incompleta para as peças do look.');
    },
    async download(userId) {
      // Pais antes das relações; todas as consultas também passam pelas políticas RLS.
      const clothes = await rows<RemoteClothing>('clothing_items', userId, ['id']);
      const outfits = await rows<RemoteOutfit>('outfits', userId, ['id']);
      const links = await rows<RemoteOutfitItem>('outfit_items', userId, ['outfit_id', 'position']);
      return { clothes, outfits, links };
    },
    async uploadPhoto(path, bytes) {
      if (!bytes.byteLength || bytes.byteLength > 5 * 1024 * 1024) throw new Error('A foto deve ter até 5 MB para ser enviada.');
      const { error } = await client.storage.from(BUCKET).upload(path, bytes, { contentType: 'image/jpeg', upsert: true });
      if (error) throw error;
    },
    async downloadPhoto(path) {
      const { data, error } = await client.storage.from(BUCKET).download(path);
      if (error) throw error;
      // Expo SDK 57 usa expo/fetch também como fetch global no celular.
      const bytes = await data.arrayBuffer();
      if (!bytes.byteLength || bytes.byteLength > 5 * 1024 * 1024) throw new Error('A foto recebida está vazia ou excede 5 MB.');
      return bytes;
    },
    async deleteRecord(entity, id, userId) {
      const table = entity === 'clothing' ? 'clothing_items' : 'outfits';
      const { error } = await client.from(table).delete().eq('id', id).eq('user_id', userId);
      if (error) throw error;
      const remaining = await client.from(table).select('id').eq('id', id).eq('user_id', userId).maybeSingle();
      if (remaining.error) throw remaining.error;
      if (remaining.data) throw new Error('Dados não excluídos na nuvem. Confira a política DELETE da tabela.');
    },
    async deletePhoto(path) {
      const [folder, name] = path.split('/');
      const storage = client.storage.from(BUCKET);
      async function exists() {
        const { data, error } = await storage.list(folder, { search: name, limit: 100 });
        if (error) throw error;
        return data.some((file) => file.name === name);
      }
      if (!await exists()) return;
      const { error } = await storage.remove([path]);
      if (error) throw error;
      if (await exists()) throw new Error('A foto aguarda permissão para ser excluída na nuvem. Execute supabase/03_excluir_fotos.sql no Supabase.');
    },
  };
}
