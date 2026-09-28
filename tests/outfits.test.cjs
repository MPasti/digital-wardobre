const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');

require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  module._compile(code, filename);
};
const { migrateDatabase, insertClothing, listClothing } = require('../src/data/clothing-repository.ts');
const { insertOutfit, listOutfits } = require('../src/data/outfit-repository.ts');
const { buildOutfit, toggleOutfitItem, validateOutfit } = require('../src/services/outfits.ts');

function openDb(filename = ':memory:') {
  const raw = new DatabaseSync(filename);
  const db = {
    execAsync: async (sql) => { raw.exec(sql); },
    runAsync: async (sql, ...params) => raw.prepare(sql).run(...params),
    getAllAsync: async (sql, ...params) => raw.prepare(sql).all(...params),
    getFirstAsync: async (sql, ...params) => raw.prepare(sql).get(...params) ?? null,
    withTransactionAsync: async (task) => {
      raw.exec('BEGIN');
      try { await task(); raw.exec('COMMIT'); }
      catch (error) { raw.exec('ROLLBACK'); throw error; }
    },
  };
  return { db, raw };
}
function piece(id, category) {
  return { id, category, name: id, color: 'Azul', localPhotoPath: `${id}.jpg`, createdAt: '2026-09-27T12:00:00Z', updatedAt: '2026-09-27T12:00:00Z', syncStatus: 'pending' };
}
const wardrobe = [piece('camisa', 'tops'), piece('casaco', 'tops'), piece('calca', 'bottoms'), piece('sapato', 'shoes'), piece('vestido', 'one-piece'), piece('bolsa', 'accessories'), piece('cinto', 'accessories')];

test('salva e reabre um look com camisa acima da calça, depois sapato e acessórios', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wardrobe-outfits-test-'));
  const filename = path.join(dir, 'wardrobe.db');
  let handle = openDb(filename);
  try {
    await migrateDatabase(handle.db);
    for (const item of wardrobe) await insertClothing(handle.db, item);
    const outfit = buildOutfit({ name: '  Passeio de domingo  ', occasion: '  Café  ', clothingIds: ['sapato', 'bolsa', 'calca', 'camisa'] }, wardrobe, () => 'look-1');
    await insertOutfit(handle.db, outfit);
    handle.raw.close();
    handle = openDb(filename);
    await migrateDatabase(handle.db);
    const [saved] = await listOutfits(handle.db);
    assert.equal(saved.name, 'Passeio de domingo');
    assert.equal(saved.occasion, 'Café');
    assert.deepEqual(saved.clothingIds, ['camisa', 'calca', 'sapato', 'bolsa']);
    assert.equal(saved.syncStatus, 'pending');
    assert.equal((await listClothing(handle.db)).length, wardrobe.length);
  } finally {
    handle.raw.close();
    assert.equal(path.dirname(dir), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('wardrobe-outfits-test-'));
    fs.rmSync(dir, { recursive: true });
  }
});

test('migração da versão 1 mantém roupas e caminhos de fotos existentes', async () => {
  const { db, raw } = openDb();
  try {
    await migrateDatabase(db);
    await insertClothing(db, wardrobe[0]);
    // Reconstrói o estado da versão anterior, que tinha apenas clothing_items.
    await db.execAsync('DROP TABLE outfit_items; DROP TABLE outfits; PRAGMA user_version = 1;');
    await migrateDatabase(db);
    await migrateDatabase(db);
    const [saved] = await listClothing(db);
    assert.equal(saved.id, 'camisa');
    assert.equal(saved.localPhotoPath, 'camisa.jpg');
    assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 4);
    assert.deepEqual(await listOutfits(db), []);
  } finally { raw.close(); }
});

test('falha em uma relação desfaz o look e todas as relações já inseridas', async () => {
  const { db, raw } = openDb();
  try {
    await migrateDatabase(db);
    await insertClothing(db, wardrobe[0]);
    const outfit = buildOutfit({ name: 'Teste', occasion: '', clothingIds: ['camisa'] }, wardrobe, () => 'look-failed');
    outfit.clothingIds.push('nao-existe');
    await assert.rejects(insertOutfit(db, outfit), /FOREIGN KEY/);
    assert.deepEqual(await listOutfits(db), []);
    assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS total FROM outfit_items')).total, 0);
    assert.equal((await listClothing(db)).length, 1);
  } finally { raw.close(); }
});

test('uma roupa participa de vários looks sem duplicar o cadastro e fotos', async () => {
  const { db, raw } = openDb();
  try {
    await migrateDatabase(db);
    await insertClothing(db, wardrobe[0]);
    for (const id of ['primeiro', 'segundo']) {
      await insertOutfit(db, buildOutfit({ name: id, occasion: '', clothingIds: ['camisa'] }, wardrobe, () => id));
    }
    assert.equal((await listOutfits(db)).length, 2);
    assert.equal((await listClothing(db)).length, 1);
    assert.equal((await db.getFirstAsync('SELECT COUNT(*) AS total FROM outfit_items')).total, 2);
  } finally { raw.close(); }
});

test('seleção troca a camisa, permite vários acessórios e remove ao tocar novamente', () => {
  let ids = ['camisa', 'calca', 'sapato'];
  ids = toggleOutfitItem(ids, wardrobe[1], wardrobe);
  assert.deepEqual(ids, ['calca', 'sapato', 'casaco']);
  ids = toggleOutfitItem(ids, wardrobe[5], wardrobe);
  ids = toggleOutfitItem(ids, wardrobe[6], wardrobe);
  assert.ok(ids.includes('bolsa') && ids.includes('cinto'));
  ids = toggleOutfitItem(ids, wardrobe[5], wardrobe);
  assert.ok(!ids.includes('bolsa') && ids.includes('cinto'));
});

test('peça única substitui torso e pernas, preserva calçados/acessórios e pode voltar a partes separadas', () => {
  const ids = toggleOutfitItem(['camisa', 'calca', 'sapato', 'bolsa'], wardrobe[4], wardrobe);
  assert.deepEqual(ids, ['sapato', 'bolsa', 'vestido']);
  const outfit = buildOutfit({ name: 'Vestido', occasion: '', clothingIds: ids }, wardrobe, () => 'vestido-look');
  assert.deepEqual(outfit.clothingIds, ['vestido', 'sapato', 'bolsa']);
  assert.deepEqual(toggleOutfitItem(ids, wardrobe[0], wardrobe), ['sapato', 'bolsa', 'camisa']);
});

test('validação rejeita look vazio, peças ausentes/repetidas e composições incompatíveis', () => {
  assert.deepEqual(Object.keys(validateOutfit({ name: ' ', occasion: '', clothingIds: [] }, wardrobe)).sort(), ['name', 'pieces']);
  for (const clothingIds of [['inexistente'], ['camisa', 'camisa'], ['camisa', 'casaco'], ['vestido', 'calca']]) {
    assert.ok(validateOutfit({ name: 'Look', occasion: '', clothingIds }, wardrobe).pieces);
  }
  assert.ok(validateOutfit({ name: 'Look', occasion: 'a'.repeat(201), clothingIds: ['camisa'] }, wardrobe).occasion);
  assert.throws(() => buildOutfit({ name: '', occasion: '', clothingIds: ['camisa'] }, wardrobe, () => 'invalid'));
});

test('nome com aspas é literal; tentativa repetida não duplica o look', async () => {
  const { db, raw } = openDb();
  try {
    await migrateDatabase(db);
    await insertClothing(db, wardrobe[0]);
    const outfit = buildOutfit({ name: "Look d'inverno; DROP TABLE outfits;", occasion: '', clothingIds: ['camisa'] }, wardrobe, () => 'same-id');
    await insertOutfit(db, outfit);
    await assert.rejects(insertOutfit(db, outfit), /UNIQUE/);
    assert.equal((await listOutfits(db)).length, 1);
    assert.equal((await listOutfits(db))[0].name, outfit.name);
  } finally { raw.close(); }
});
