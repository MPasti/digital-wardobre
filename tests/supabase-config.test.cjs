const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const ts = require('typescript');
const Module = require('node:module');

require.extensions['.ts'] = (module, filename) => {
  module._compile(ts.transpileModule(fs.readFileSync(filename, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, filename);
};
const { resolveSupabaseConfiguration: resolve } = require('../src/config/supabase-config.ts');
const publicKey = 'sb_publishable_chave_ficticia_para_teste';

test('configuração ausente, dummy ou inválida mantém o cliente desabilitado', () => {
  assert.equal(resolve().status, 'missing');
  assert.equal(resolve('https://SEU-PROJETO.supabase.co', 'sb_publishable_COLE_SUA_CHAVE_AQUI').status, 'placeholder');
  for (const url of ['texto', 'http://projeto.supabase.co', 'postgresql://user:senha@db:5432/postgres', 'https://user:senha@projeto.supabase.co', 'https://projeto.supabase.co/rest/v1', 'https://projeto.supabase.co?apikey=x']) {
    assert.equal(resolve(url, publicKey).status, 'invalid');
  }
  for (const key of ['sb_secret_nao_pode', 'eyJhbGciOiJIUzI1NiJ9.legado.assinatura', 'senha']) {
    const result = resolve('https://projeto.supabase.co', key);
    assert.equal(result.status, 'invalid');
    assert.ok(!result.message.includes(key));
  }
});

test('URL e chave pública válidas são normalizadas sem alterar a chave', () => {
  assert.deepEqual(resolve(' https://projeto.supabase.co/ ', ` ${publicKey} `), {
    status: 'ready', url: 'https://projeto.supabase.co', publishableKey: publicKey,
  });
});

test('importar o cliente com dummy não inicializa SDK, sessão nem listener', () => {
  const previousLoad = Module._load;
  const names = ['EXPO_PUBLIC_SUPABASE_URL', 'EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY'];
  const previous = names.map((name) => process.env[name]);
  const filename = require.resolve('../src/lib/supabase.ts');
  process.env[names[0]] = 'https://SEU-PROJETO.supabase.co';
  process.env[names[1]] = 'sb_publishable_COLE_SUA_CHAVE_AQUI';
  Module._load = function (name, parent, isMain) {
    if (name === 'react-native-url-polyfill/auto') return {};
    if (name === '@supabase/supabase-js') return { createClient() { assert.fail('Não deve criar cliente com dummy.'); } };
    if (name === 'expo-sqlite/kv-store') return {};
    if (name === 'react-native') return { Platform: { OS: 'ios' }, AppState: { addEventListener() { assert.fail('Não deve observar sessão sem configuração.'); } } };
    return previousLoad.call(this, name, parent, isMain);
  };
  try {
    delete require.cache[filename];
    const lib = require(filename);
    assert.equal(lib.supabase, null);
    assert.equal(lib.supabaseConfiguration.status, 'placeholder');
    assert.throws(() => lib.requireSupabase(), /Substitua os exemplos/);
    assert.doesNotThrow(() => lib.observeSupabaseAppState()());
  } finally {
    Module._load = previousLoad;
    delete require.cache[filename];
    names.forEach((name, index) => {
      if (previous[index] === undefined) delete process.env[name];
      else process.env[name] = previous[index];
    });
  }
});
