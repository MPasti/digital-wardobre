import type { Session, User } from '@supabase/supabase-js';
import Storage from 'expo-sqlite/kv-store';
import { activateAccountDatabase, activateSignedOutDatabase, getActiveDatabaseName, rememberCurrentDatabase, restoreDatabase, runLocalTask } from '../data/database';
import { getBinding, getSyncValue, setSyncValue } from '../data/sync-repository';
import { createLoginClient, requireSupabase, supabase, supabaseConfiguration } from '../lib/supabase';
import { finishPassword, linkEmail, validateCredentials } from './account-link';
import { createSupabaseRemote } from './supabase-remote';
import type { LocalDatabase } from '../data/clothing-repository';

export type AccountState = { id: string | null; email: string | null; anonymous: boolean; signedOut: boolean; pendingEmail: string | null };
export const emptyAccount: AccountState = { id: null, email: null, anonymous: true, signedOut: false, pendingEmail: null };

function project() {
  requireSupabase();
  if (supabaseConfiguration.status !== 'ready') throw new Error('Configure a conexão com o Supabase.');
  return supabaseConfiguration.url;
}
function guestKey() { return `wardrobe.guest-session:${project()}`; }
function tokens(session: Session) { return { access_token: session.access_token, refresh_token: session.refresh_token }; }

async function saveProfile(user: User) {
  const binding = { userId: user.id, project: project() };
  await rememberCurrentDatabase(binding);
  await runLocalTask(async (db) => {
    await setSyncValue(db, 'account_profile', JSON.stringify({ id: user.id, email: user.email ?? null, anonymous: !!user.is_anonymous }));
    await db.runAsync("DELETE FROM sync_metadata WHERE key='signin_required'");
  });
}

export async function readAccountState(db: LocalDatabase): Promise<AccountState> {
    const profile = await getSyncValue(db, 'account_profile');
    const binding = await getBinding(db);
    return { ...emptyAccount, id: binding?.userId ?? null, ...(profile ? JSON.parse(profile) : {}),
      signedOut: await getSyncValue(db, 'signin_required') === '1', pendingEmail: await getSyncValue(db, 'account_link_email') };
}

export async function rememberSessionAccount() {
  if (!supabase) return;
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return;
  const binding = await runLocalTask(getBinding);
  if (binding && (binding.userId !== data.session.user.id || binding.project !== project())) {
    throw new Error('Este guarda roupa pertence a outra conta. Entre novamente para abrir os dados corretos.');
  }
  await saveProfile(data.session.user);
}

// Recupera também a escolha de arquivo após uma interrupção durante a troca de conta.
export async function reconcileAccountOnStartup() {
  if (!supabase) return;
  const { data, error } = await supabase.auth.getSession();
  if (error || !data.session) return;
  const binding = await runLocalTask(getBinding);
  if ((binding && (binding.userId !== data.session.user.id || binding.project !== project())) || (!binding && !data.session.user.is_anonymous) || await runLocalTask((db) => getSyncValue(db, 'signin_required')) === '1') {
    await activateAccountDatabase({ userId: data.session.user.id, project: project() });
  }
  await saveProfile(data.session.user);
}

async function acceptSession(session: Session) {
  const client = requireSupabase();
  const previousFile = await getActiveDatabaseName();
  const previous = (await client.auth.getSession()).data.session;
  if (previous?.user.is_anonymous && previous.user.id !== session.user.id) {
    // Guarda a sessão anônima, nunca a senha, para voltar a ela sem misturar contas.
    await Storage.setItemAsync(guestKey(), JSON.stringify(tokens(previous)));
    await rememberCurrentDatabase({ userId: previous.user.id, project: project() });
  }
  await activateAccountDatabase({ userId: session.user.id, project: project() });
  let installed;
  try {
    installed = await client.auth.setSession(tokens(session));
    if (installed.error) throw installed.error;
  } catch (error) { await restoreDatabase(previousFile); throw error; }
  await saveProfile(installed.data.user!);
}

export async function loginAccount(email: string, password: string) {
  validateCredentials(email, password);
  const temporary = createLoginClient();
  const { data, error } = await temporary.auth.signInWithPassword({ email: email.trim().toLowerCase(), password });
  if (error) throw error;
  if (!data.session) throw new Error('Sua sessão não pôde ser criada.');
  // Cadastros feitos offline antes da primeira sessão continuam recuperáveis como visitante.
  const local = await runLocalTask(readAccountState);
  if (!local.id && !local.signedOut) await continueAnonymously();
  await acceptSession(data.session);
}

export async function continueAnonymously() {
  const client = requireSupabase();
  const current = (await client.auth.getSession()).data.session;
  if (current) { await saveProfile(current.user); return; }
  const cached = await Storage.getItemAsync(guestKey());
  if (cached) {
    const temporary = createLoginClient();
    const result = await temporary.auth.setSession(JSON.parse(cached));
    if (result.error) throw new Error('Sua sessão anônima anterior não pôde ser recuperada. Os dados locais foram preservados. Tente novamente com internet.');
    if (result.data.user?.is_anonymous && result.data.session) { await acceptSession(result.data.session); return; }
    await Storage.removeItemAsync(guestKey());
  }
  const binding = await runLocalTask(getBinding);
  const identified = await createSupabaseRemote(client, project()).identify(binding);
  await rememberCurrentDatabase(identified);
  const session = (await client.auth.getSession()).data.session;
  if (session) await saveProfile(session.user);
}

export async function registerAccount(email: string, password: string) {
  validateCredentials(email, password, true);
  await continueAnonymously();
  const client = requireSupabase();
  const session = (await client.auth.getSession()).data.session;
  if (!session) throw new Error('Sua sessão não está disponível.');
  const pending = await runLocalTask((db) => getSyncValue(db, 'account_link_email'));
  if (!session.user.is_anonymous && !pending) throw new Error('A conta atual já tem um e-mail vinculado.');
  const normalized = email.trim().toLowerCase();
  await runLocalTask((db) => setSyncValue(db, 'account_link_email', normalized));
  let user: User;
  try { user = await linkEmail(client, normalized, session.user.id); }
  catch (error) {
    await runLocalTask(async (db) => {
      if (pending) await setSyncValue(db, 'account_link_email', pending);
      else await db.runAsync("DELETE FROM sync_metadata WHERE key='account_link_email'");
    });
    throw error;
  }
  await saveProfile(user);
  if (user.email_confirmed_at && user.email?.toLowerCase() === normalized) {
    await completeRegistration(password);
    return 'complete' as const;
  }
  return 'confirmation' as const;
}

export async function completeRegistration(password: string, code?: string) {
  const email = await runLocalTask((db) => getSyncValue(db, 'account_link_email'));
  const binding = await runLocalTask(getBinding);
  if (!email || !binding) throw new Error('Informe o e-mail para iniciar o cadastro.');
  const user = await finishPassword(requireSupabase(), email, password, binding.userId, code);
  await saveProfile(user);
  await runLocalTask((db) => db.runAsync("DELETE FROM sync_metadata WHERE key='account_link_email'"));
  await Storage.removeItemAsync(guestKey());
}

export async function resendConfirmation() {
  const email = await runLocalTask((db) => getSyncValue(db, 'account_link_email'));
  if (!email) throw new Error('Informe o e-mail para iniciar o cadastro.');
  const { error } = await requireSupabase().auth.resend({ type: 'email_change', email });
  if (error) throw error;
}

export async function logoutAccount() {
  const previousFile = await getActiveDatabaseName();
  await activateSignedOutDatabase();
  try {
    const { error } = await requireSupabase().auth.signOut({ scope: 'local' });
    if (error) throw error;
  } catch (error) { await restoreDatabase(previousFile); throw error; }
}

export async function changeRegistrationEmail() {
  const { data, error } = await requireSupabase().auth.getUser();
  if (error) throw error;
  if (!data.user.is_anonymous) throw new Error('Seu e-mail já foi confirmado. Defina a senha para concluir o cadastro.');
  await runLocalTask((db) => db.runAsync("DELETE FROM sync_metadata WHERE key='account_link_email'"));
}
