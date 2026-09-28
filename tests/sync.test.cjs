const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);
const { migrateDatabase, insertClothing, listClothing } = require('../src/data/clothing-repository.ts');
const { insertOutfit, listOutfits } = require('../src/data/outfit-repository.ts');
const { getBinding, getSyncValue, mergeOutfit, setSyncValue } = require('../src/data/sync-repository.ts');
const { synchronizeOnce, createSyncRunner } = require('../src/services/sync-engine.ts');
const { createSupabaseRemote } = require('../src/services/supabase-remote.ts');
const uid = '9f2a027b-d631-4d62-99e8-8f0940683776';
const cid = '2e67b24c-770c-47b2-b4d8-ef5eaf56bdd4';
const oid = 'b573e332-3b89-489c-80d9-dc057bd76f41';
const date = '2026-09-28T12:00:00.000Z';
const clothing = { id: cid, name: 'Camisa', category: 'tops', color: 'Azul', createdAt: date, updatedAt: date, syncStatus: 'pending' };
const outfit = { id: oid, name: 'Passeio', clothingIds: [cid], createdAt: date, updatedAt: date, syncStatus: 'pending' };
const binding = { userId: uid, project: 'https://teste.supabase.co' };

async function setup(t) {
  const raw = new DatabaseSync(':memory:');
  t.after(() => raw.close());
  const db = {
    execAsync: async (sql) => raw.exec(sql),
    runAsync: async (sql, ...params) => raw.prepare(sql).run(...params),
    getAllAsync: async (sql, ...params) => raw.prepare(sql).all(...params),
    getFirstAsync: async (sql, ...params) => raw.prepare(sql).get(...params) ?? null,
    withTransactionAsync: async (task) => {
      raw.exec('BEGIN');
      try { await task(); raw.exec('COMMIT'); } catch (error) { raw.exec('ROLLBACK'); throw error; }
    },
  };
  await migrateDatabase(db);
  const cloud = { clothes: new Map(), outfits: new Map(), links: new Map(), photos: new Map() };
  const files = new Map();
  const calls = [];
  const remote = {
    identify: async () => binding,
    saveClothing: async (item, user, photo) => {
      calls.push('clothing');
      const row = { id: item.id, user_id: user, name: item.name, category: item.category, color: item.color, notes: item.notes ?? '', remote_photo_path: photo ?? null, created_at: item.createdAt, updated_at: item.updatedAt };
      cloud.clothes.set(row.id, row); return row;
    },
    saveOutfit: async (item, user) => {
      calls.push('outfit');
      const row = { id: item.id, user_id: user, name: item.name, occasion: '', created_at: item.createdAt, updated_at: item.updatedAt };
      cloud.outfits.set(row.id, row); return row;
    },
    saveLinks: async (item, user) => {
      calls.push('links');
      for (const [position, id] of item.clothingIds.entries()) {
        assert.ok(cloud.clothes.has(id));
        cloud.links.set(`${item.id}/${id}`, { outfit_id: item.id, clothing_item_id: id, user_id: user, position, created_at: date, updated_at: date });
      }
    },
    download: async () => ({ clothes: [...cloud.clothes.values()], outfits: [...cloud.outfits.values()], links: [...cloud.links.values()] }),
    uploadPhoto: async (path, bytes) => { calls.push('photo'); cloud.photos.set(path, bytes); },
    downloadPhoto: async (path) => cloud.photos.get(path),
  };
  const deps = { runLocal: async (task) => task(db), remote, photos: {
    read: async (path) => { if (!files.has(path)) throw new Error('A foto não existe.'); return files.get(path); },
    exists: async (path) => files.has(path),
    save: async (bytes, id) => { const path = `${id}.jpg`; files.set(path, bytes); return path; },
  } };
  return { db, raw, cloud, files, calls, remote, deps };
}

test('offline preserva cadastro pendente; tentativa seguinte envia o mesmo UUID sem duplicar', async (t) => {
  const s = await setup(t);
  await insertClothing(s.db, clothing);
  const identify = s.remote.identify;
  s.remote.identify = async () => { throw new Error('Network failed'); };
  await assert.rejects(synchronizeOnce(s.deps), /Network/);
  assert.equal((await listClothing(s.db))[0].syncStatus, 'pending');
  assert.equal(await getBinding(s.db), null);
  s.remote.identify = identify;
  assert.deepEqual((await synchronizeOnce(s.deps)).issues, []);
  await synchronizeOnce(s.deps);
  assert.equal(s.cloud.clothes.size, 1);
  assert.equal(s.cloud.clothes.get(cid).id, cid);
  assert.equal((await listClothing(s.db))[0].syncStatus, 'synced');
  assert.ok(await getSyncValue(s.db, 'last_success'));
});

test('resposta perdida após gravar na nuvem permite repetir o upsert sem perder dados', async (t) => {
  const s = await setup(t);
  await insertClothing(s.db, clothing);
  const save = s.remote.saveClothing;
  s.remote.saveClothing = async (...args) => { await save(...args); throw new Error('Network failed'); };
  assert.ok((await synchronizeOnce(s.deps)).issues.length);
  assert.equal((await listClothing(s.db))[0].syncStatus, 'pending');
  assert.equal(await getSyncValue(s.db, 'last_success'), null);
  s.remote.saveClothing = save;
  await synchronizeOnce(s.deps);
  assert.equal(s.cloud.clothes.size, 1);
  assert.equal((await listClothing(s.db))[0].syncStatus, 'synced');
});

test('foto falha: peça e look ficam pendentes; retentativa envia foto, roupa, look e relações nessa ordem', async (t) => {
  const s = await setup(t);
  const photo = `${cid}.jpg`;
  s.files.set(photo, new Uint8Array([1, 2, 3]).buffer);
  await insertClothing(s.db, { ...clothing, localPhotoPath: photo });
  await insertOutfit(s.db, outfit);
  const upload = s.remote.uploadPhoto;
  s.remote.uploadPhoto = async () => { throw new Error('Bucket not found'); };
  await synchronizeOnce(s.deps);
  assert.equal((await listClothing(s.db))[0].syncStatus, 'pending');
  assert.equal((await listOutfits(s.db))[0].syncStatus, 'pending');
  assert.equal(s.cloud.outfits.size, 0);
  assert.ok(s.files.has(photo));
  s.remote.uploadPhoto = upload;
  await synchronizeOnce(s.deps);
  assert.deepEqual(s.calls, ['photo', 'clothing', 'outfit', 'links']);
  assert.equal((await listOutfits(s.db))[0].syncStatus, 'synced');
  assert.equal(s.cloud.clothes.get(cid).remote_photo_path, `${uid}/${cid}.jpg`);
});

test('falha nas relações não confirma o look; nova tentativa completa a composição', async (t) => {
  const s = await setup(t);
  await insertClothing(s.db, clothing);
  await insertOutfit(s.db, outfit);
  const save = s.remote.saveLinks;
  s.remote.saveLinks = async () => { throw new Error('Network failed'); };
  await synchronizeOnce(s.deps);
  assert.equal((await listOutfits(s.db))[0].syncStatus, 'pending');
  assert.deepEqual((await listOutfits(s.db))[0].clothingIds, [cid]);
  s.remote.saveLinks = save;
  await synchronizeOnce(s.deps);
  assert.equal(s.cloud.outfits.size, 1);
  assert.equal(s.cloud.links.size, 1);
  assert.equal((await listOutfits(s.db))[0].syncStatus, 'synced');
});

test('download restaura roupa, foto e composição no SQLite com os mesmos UUIDs', async (t) => {
  const s = await setup(t);
  await s.remote.saveClothing(clothing, uid, `${uid}/${cid}.jpg`);
  await s.remote.saveOutfit(outfit, uid);
  await s.remote.saveLinks(outfit, uid);
  s.cloud.photos.set(`${uid}/${cid}.jpg`, new Uint8Array([1, 2, 3]).buffer);
  assert.equal((await synchronizeOnce(s.deps)).downloaded, 2);
  assert.equal((await listClothing(s.db))[0].localPhotoPath, `${cid}.jpg`);
  assert.ok(s.files.has(`${cid}.jpg`));
  assert.deepEqual((await listOutfits(s.db))[0].clothingIds, [cid]);
  assert.equal((await synchronizeOnce(s.deps)).downloaded, 0);
});

test('vínculo impede enviar roupas de uma instalação para outra identidade', async (t) => {
  const s = await setup(t);
  await synchronizeOnce(s.deps);
  await insertClothing(s.db, clothing);
  s.remote.identify = async () => ({ ...binding, userId: 'outro-usuario' });
  await assert.rejects(synchronizeOnce(s.deps), /outra sessão/);
  assert.equal(s.cloud.clothes.size, 0);
  assert.equal((await listClothing(s.db))[0].syncStatus, 'pending');
});

test('adaptador não cria novo anônimo quando uma sessão vinculada foi perdida', async () => {
  let signups = 0;
  const remote = createSupabaseRemote({ auth: {
    getSession: async () => ({ data: { session: null }, error: null }),
    signInAnonymously: async () => { signups++; },
  } }, binding.project);
  await assert.rejects(remote.identify(binding), /Sua sessão anônima/);
  assert.equal(signups, 0);
});

test('migração da versão 2 preserva roupas e looks; relação remota inválida desfaz toda a mesclagem', async (t) => {
  const s = await setup(t);
  await insertClothing(s.db, clothing);
  await insertOutfit(s.db, outfit);
  await s.db.execAsync('DROP TABLE sync_metadata; PRAGMA user_version=2;');
  await migrateDatabase(s.db);
  await synchronizeOnce(s.deps);
  const row = { ...s.cloud.outfits.get(oid), name: 'Nome novo' };
  const invalid = [{ ...s.cloud.links.values().next().value, clothing_item_id: 'inexistente' }];
  await assert.rejects(mergeOutfit(s.db, row, invalid), /FOREIGN KEY/);
  assert.equal((await listOutfits(s.db))[0].name, outfit.name);
  assert.deepEqual((await listOutfits(s.db))[0].clothingIds, [cid]);
  await setSyncValue(s.db, 'test', 'ok');
  assert.equal(await getSyncValue(s.db, 'test'), 'ok');
});

test('duas solicitações simultâneas compartilham a execução e incluem cadastro feito durante o envio', async (t) => {
  const s = await setup(t);
  let release;
  let entered;
  const reached = new Promise((resolve) => { entered = resolve; });
  const gate = new Promise((resolve) => { release = resolve; });
  let count = 0;
  const download = s.remote.download;
  s.remote.download = async (...args) => { if (++count === 1) { entered(); await gate; } return download(...args); };
  const run = createSyncRunner(s.deps);
  const first = run();
  await reached;
  await insertClothing(s.db, clothing);
  const second = run();
  assert.equal(first, second);
  release();
  await first;
  assert.equal(s.cloud.clothes.size, 1);
  assert.equal((await listClothing(s.db))[0].syncStatus, 'synced');
});
