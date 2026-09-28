import type { SupabaseClient, User } from '@supabase/supabase-js';

export function validateCredentials(email: string, password: string, creating = false) {
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) throw new Error('Informe um e-mail válido.');
  if (!password || (creating && password.length < 8)) throw new Error(creating ? 'Use uma senha com pelo menos 8 caracteres.' : 'Informe sua senha.');
}

// Converte o próprio usuário anônimo. Nunca cria outro UUID para suas roupas.
export async function linkEmail(client: SupabaseClient, email: string, userId: string): Promise<User> {
  const { data, error } = await client.auth.updateUser({ email: email.trim().toLowerCase() });
  if (error) throw error;
  if (data.user.id !== userId) throw new Error('A conta retornada não corresponde ao guarda roupa atual.');
  return data.user;
}

export async function finishPassword(client: SupabaseClient, email: string, password: string, userId: string, code?: string) {
  validateCredentials(email, password, true);
  if (code?.trim()) {
    const verified = await client.auth.verifyOtp({ email: email.trim().toLowerCase(), token: code.trim(), type: 'email_change' });
    if (verified.error) throw verified.error;
    if (verified.data.user?.id !== userId) throw new Error('A confirmação não corresponde à conta atual.');
  }
  const current = await client.auth.getUser();
  if (current.error) throw current.error;
  if (current.data.user.id !== userId) throw new Error('A conta retornada não corresponde ao guarda roupa atual.');
  if (!current.data.user.email_confirmed_at || current.data.user.email?.toLowerCase() !== email.trim().toLowerCase()) {
    throw new Error('Confirme seu e-mail antes de concluir. Use o código recebido ou o link enviado pelo Supabase.');
  }
  const saved = await client.auth.updateUser({ password });
  if (saved.error) throw saved.error;
  if (saved.data.user.id !== userId) throw new Error('A conta retornada não corresponde ao guarda roupa atual.');
  return saved.data.user;
}

export function accountError(error: unknown) {
  const value = error as { code?: string; message?: string; status?: number };
  if (value.code === 'invalid_credentials') return 'E-mail ou senha incorretos.';
  if (value.code === 'email_not_confirmed') return 'Confirme o e-mail da sua conta antes de entrar.';
  if (value.code === 'email_exists' || value.code === 'user_already_exists') return 'Esse e-mail já tem uma conta. Use Entrar para acessar o guarda roupa dela; o acesso anônimo atual fica separado.';
  if (value.code === 'manual_linking_disabled') return 'Ative Allow manual linking em Authentication → Sign In / Providers no Supabase.';
  if (value.code === 'email_provider_disabled') return 'Ative o provedor Email no painel do Supabase.';
  if (value.code === 'email_address_not_authorized' || /only.*send.*email|not authorized/i.test(value.message ?? '')) return 'O envio de e-mail do Supabase está limitado. Teste com o e-mail da sua conta no painel ou configure SMTP para outros destinatários.';
  if (value.code === 'weak_password') return 'A senha não atende às regras do Supabase. Use uma senha mais forte.';
  if (value.code === 'otp_expired') return 'O código expirou ou está incorreto. Confira o e-mail ou reenvie a confirmação.';
  if (value.status === 429 || /rate limit/i.test(value.message ?? '')) return 'Muitas tentativas. Aguarde alguns minutos antes de tentar novamente.';
  if (/fetch|network|abort|timeout/i.test(value.message ?? '')) return 'Conecte-se à internet para acessar ou criar sua conta.';
  if (error instanceof Error && /^(Informe|Use |Confirme|A conta|A confirmação|Sua sessão|Seu e-mail|Este guarda roupa|Configure|Aguarde)/.test(error.message)) return error.message;
  return 'Não foi possível concluir. Confira os dados e a configuração de e-mail do Supabase.';
}
