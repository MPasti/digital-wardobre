const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const Module = require('node:module');
const { DatabaseSync } = require('node:sqlite');
const { randomUUID } = require('node:crypto');
const ts = require('typescript');
require.extensions['.ts'] = (module, filename) => module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText, filename);

const { linkEmail, finishPassword, validateCredentials } = require('../src/services/account-link.ts');

test('conversão mantém o UUID e só define senha após confirmar o e-mail', async () => {
  let user = { id: randomUUID(), is_anonymous: true };
  let passwordCalls = 0;
  const client = { auth: {
    updateUser: async (change) => {
      if (change.email) user = { ...user, new_email: change.email };
      if (change.password) { passwordCalls++; user = { ...user, is_anonymous: false }; }
      return { data: { user }, error: null };
    },
    getUser: async () => ({ data: { user }, error: null }),
    verifyOtp: async ({ email, token, type }) => {
      assert.equal(type, 'email_change'); assert.equal(token, '123456');
      user = { ...user, email, email_confirmed_at: '2026-09-28' };
      return { data: { user }, error: null };
    },
  } };
  const id = user.id;
  assert.equal((await linkEmail(client, ' TEST@example.com ', id)).id, id);
  await assert.rejects(finishPassword(client, 'test@example.com', 'test-password', id), /Confirme/);
  assert.equal(passwordCalls, 0);
  const result = await finishPassword(client, 'test@example.com', 'test-password', id, '123456');
  assert.equal(result.id, id); assert.equal(result.is_anonymous, false); assert.equal(passwordCalls, 1);
  await assert.rejects(finishPassword(client, 'test@example.com', 'test-password', randomUUID()), /não corresponde/);
  assert.equal(passwordCalls, 1);
  assert.throws(() => validateCredentials('bad', 'test-password', true), /e-mail/);
  assert.throws(() => validateCredentials('test@example.com', 'short', true), /8 caracteres/);
});

test('entrar, sair e voltar ao visitante isola SQLite e preserva pendências e UUIDs', async (t) => {
  const storage = new Map();
  const rawFiles = [];
  const guestId = randomUUID();
  const memberId = randomUUID();
  const sessions = new Map();
  const session = (id, anonymous) => {
    const value = { access_token: `${id}-access`, refresh_token: `${id}-refresh`, user: { id, is_anonymous: anonymous, email: anonymous ? undefined : 'member@example.com' } };
    sessions.set(value.access_token, value); return value;
  };
  const guest = session(guestId, true);
  const member = session(memberId, false);
  let current = guest;
  let failInstall = false;
  const main = { auth: {
    getSession: async () => ({ data: { session: current }, error: null }),
    setSession: async (tokens) => {
      if (failInstall) throw new Error('Network failed');
      current = sessions.get(tokens.access_token);
      return { data: { session: current, user: current.user }, error: null };
    },
    signOut: async () => { current = null; return { error: null }; },
  } };
  const mocks = {
    'expo-crypto': { randomUUID },
    'expo-sqlite/kv-store': { __esModule: true, default: {
      getItemAsync: async (key) => storage.get(key) ?? null,
      setItemAsync: async (key, value) => { storage.set(key, value); },
      removeItemAsync: async (key) => { storage.delete(key); },
    } },
    'expo-sqlite': { openDatabaseAsync: async () => {
      const raw = new DatabaseSync(':memory:'); rawFiles.push(raw);
      return {
        execAsync: async (sql) => raw.exec(sql),
        runAsync: async (sql, ...args) => raw.prepare(sql).run(...args),
        getAllAsync: async (sql, ...args) => raw.prepare(sql).all(...args),
        getFirstAsync: async (sql, ...args) => raw.prepare(sql).get(...args) ?? null,
        closeAsync: async () => raw.close(),
        withTransactionAsync: async (action) => {
          raw.exec('BEGIN');
          try { await action(); raw.exec('COMMIT'); } catch (error) { raw.exec('ROLLBACK'); throw error; }
        },
      };
    } },
    '../lib/supabase': {
      supabase: main, requireSupabase: () => main,
      supabaseConfiguration: { status: 'ready', url: 'https://example.supabase.co' },
      createLoginClient: () => ({ auth: {
        signInWithPassword: async ({ password }) => password === 'correct-password'
          ? { data: { session: member }, error: null } : { data: {}, error: { code: 'invalid_credentials' } },
        setSession: async (tokens) => { const saved = sessions.get(tokens.access_token); return { data: { session: saved, user: saved.user }, error: null }; },
      } }),
    },
  };
  const original = Module._load;
  Module._load = function (name, ...args) { return name in mocks ? mocks[name] : original.call(this, name, ...args); };
  t.after(() => { Module._load = original; for (const raw of rawFiles) raw.close(); });
  const db = require('../src/data/database.ts');
  const account = require('../src/services/account.ts');
  const { insertClothing, listClothing } = require('../src/data/clothing-repository.ts');
  const { listDeletions } = require('../src/data/wardrobe-mutations.ts');
  await account.reconcileAccountOnStartup();
  const guestFile = await db.getActiveDatabaseName();
  const clothingId = randomUUID();
  await db.runLocalTask(async (connection) => {
    await insertClothing(connection, { id: clothingId, name: 'Camisa do visitante', category: 'tops', color: 'Azul', createdAt: '2026-09-28', updatedAt: '2026-09-28', syncStatus: 'pending' });
    await connection.runAsync("INSERT INTO sync_deletions(entity,id,queued_at,done) VALUES('outfit',?,'2026-09-28',0)", randomUUID());
  });
  await assert.rejects(account.loginAccount('member@example.com', 'wrong-password'));
  assert.equal(await db.getActiveDatabaseName(), guestFile);
  assert.equal(current.user.id, guestId);
  failInstall = true;
  await assert.rejects(account.loginAccount('member@example.com', 'correct-password'), /Network/);
  assert.equal(await db.getActiveDatabaseName(), guestFile);
  failInstall = false;
  await account.loginAccount('member@example.com', 'correct-password');
  const memberFile = await db.getActiveDatabaseName();
  assert.notEqual(memberFile, guestFile);
  assert.equal((await db.runLocalTask(listClothing)).length, 0);
  assert.equal((await db.runLocalTask(listDeletions)).length, 0);
  assert.equal((await db.runLocalTask(account.readAccountState)).id, memberId);
  await account.logoutAccount();
  assert.equal(current, null);
  assert.equal((await db.runLocalTask(account.readAccountState)).signedOut, true);
  assert.equal((await db.runLocalTask(listClothing)).length, 0);
  await account.continueAnonymously();
  assert.equal(await db.getActiveDatabaseName(), guestFile);
  assert.equal(current.user.id, guestId);
  assert.equal((await db.runLocalTask(listClothing))[0].id, clothingId);
  assert.equal((await db.runLocalTask(listClothing))[0].syncStatus, 'pending');
  assert.equal((await db.runLocalTask(listDeletions)).length, 1);
  await account.loginAccount('member@example.com', 'correct-password');
  assert.equal(await db.getActiveDatabaseName(), memberFile);
  assert.equal((await db.runLocalTask(listClothing)).length, 0);
});
