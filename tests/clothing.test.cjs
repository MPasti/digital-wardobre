const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const { DatabaseSync } = require('node:sqlite');
const ts = require('typescript');

// Executa a lógica real do app com um banco SQLite, sem simular consultas SQL.
require.extensions['.ts'] = (module, filename) => {
  const code = ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  module._compile(code, filename);
};
const { migrateDatabase, listClothing, insertClothing } = require('../src/data/clothing-repository.ts');
const { saveClothing, validateDraft } = require('../src/services/save-clothing.ts');

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
const draft = { name: '  Camiseta de algodão  ', category: 'tops', color: '  Azul  ', notes: "Detalhe d'água; não passar a estampa." };
const id = '8e1cbd54-de97-4e7c-b1bc-196642ab9386';
function deps(db) {
  return {
    createId: () => id,
    persistPhoto: async () => { throw new Error('Não deveria copiar uma foto.'); },
    removePhoto: async () => { throw new Error('Não deveria apagar uma foto.'); },
    insert: (item) => insertClothing(db, item),
  };
}

test('cadastro sem foto persiste após fechar/reabrir; migração não apaga registros', async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wardrobe-test-'));
  const filename = path.join(dir, 'wardrobe.db');
  let handle = openDb(filename);
  try {
    await migrateDatabase(handle.db);
    await saveClothing(draft, deps(handle.db));
    handle.raw.close();
    handle = openDb(filename);
    await migrateDatabase(handle.db);
    const items = await listClothing(handle.db);
    assert.equal(items.length, 1);
    assert.equal(items[0].name, 'Camiseta de algodão');
    assert.equal(items[0].color, 'Azul');
    assert.equal(items[0].notes, draft.notes);
    assert.equal(items[0].localPhotoPath, undefined);
    assert.equal(items[0].syncStatus, 'pending');
  } finally {
    handle.raw.close();
    assert.equal(path.dirname(dir), path.resolve(os.tmpdir()));
    assert.ok(path.basename(dir).startsWith('wardrobe-test-'));
    fs.rmSync(dir, { recursive: true });
  }
});

test('entrada com SQL e aspas é armazenada literalmente; ID duplicado não duplica registro', async () => {
  const { db, raw } = openDb();
  try {
    await migrateDatabase(db);
    const value = "Saia'); DROP TABLE clothing_items; --";
    await saveClothing({ ...draft, name: value }, deps(db));
    await assert.rejects(saveClothing(draft, deps(db)), /UNIQUE/);
    const items = await listClothing(db);
    assert.equal(items.length, 1);
    assert.equal(items[0].name, value);
  } finally { raw.close(); }
});

test('validação rejeita nome/cor vazios e categoria inválida antes de copiar a foto', async () => {
  const invalid = { ...draft, name: '  ', color: ' ', category: 'all', photoUri: 'temporary.jpg' };
  assert.deepEqual(Object.keys(validateDraft(invalid)).sort(), ['category', 'color', 'name']);
  let copied = false;
  await assert.rejects(saveClothing(invalid, {
    createId: () => id, persistPhoto: async () => { copied = true; return 'photo.jpg'; },
    removePhoto: async () => {}, insert: async () => {},
  }));
  assert.equal(copied, false);
  assert.ok(validateDraft({ ...draft, name: 'a'.repeat(101) }).name);
  assert.ok(validateDraft({ ...draft, notes: 'a'.repeat(1001) }).notes);
});

test('falha na cópia impede gravar uma peça com referência quebrada', async () => {
  let inserted = false;
  await assert.rejects(saveClothing({ ...draft, photoUri: 'temporary.jpg' }, {
    createId: () => id, persistPhoto: async () => { throw new Error('Sem espaço'); },
    removePhoto: async () => {}, insert: async () => { inserted = true; },
  }), /Sem espaço/);
  assert.equal(inserted, false);
});

test('falha no SQLite remove somente a cópia da foto e permite tentar novamente', async () => {
  const removed = [];
  const dependencies = {
    createId: () => id, persistPhoto: async () => `${id}.jpg`,
    removePhoto: async (photoPath) => { removed.push(photoPath); },
    insert: async () => { throw new Error('Banco indisponível'); },
  };
  await assert.rejects(saveClothing({ ...draft, photoUri: 'original.jpg' }, dependencies), /Banco indisponível/);
  assert.deepEqual(removed, [`${id}.jpg`]);
  const { db, raw } = openDb();
  try {
    await migrateDatabase(db);
    await saveClothing({ ...draft, photoUri: 'original.jpg' }, { ...dependencies, insert: (item) => insertClothing(db, item) });
    assert.equal((await listClothing(db))[0].localPhotoPath, `${id}.jpg`);
    assert.equal(removed.length, 1);
  } finally { raw.close(); }
});

test('banco também rejeita categorias inválidas e versões futuras não são rebaixadas', async () => {
  const { db, raw } = openDb();
  try {
    await migrateDatabase(db);
    await assert.rejects(insertClothing(db, {
      id, name: 'Peça', category: 'invalid', color: 'Preto', createdAt: '', updatedAt: '', syncStatus: 'pending',
    }), /CHECK/);
    await db.execAsync('PRAGMA user_version = 3');
    await assert.rejects(migrateDatabase(db), /mais recente/);
    assert.equal((await db.getFirstAsync('PRAGMA user_version')).user_version, 3);
  } finally { raw.close(); }
});
