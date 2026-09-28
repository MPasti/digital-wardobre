export type SupabaseConfiguration =
  | { status: 'ready'; url: string; publishableKey: string }
  | { status: 'missing' | 'placeholder' | 'invalid'; message: string };

// Recebe valores explicitamente para permitir testes sem acessar a rede.
export function resolveSupabaseConfiguration(urlValue?: string, keyValue?: string): SupabaseConfiguration {
  const url = urlValue?.trim();
  const publishableKey = keyValue?.trim();
  if (!url || !publishableKey) {
    return { status: 'missing', message: 'Preencha a URL e a chave pública do Supabase no arquivo .env.' };
  }
  if (/seu-projeto|cole_sua_chave_aqui/i.test(`${url} ${publishableKey}`)) {
    return { status: 'placeholder', message: 'Substitua os exemplos do .env pelos dados do seu projeto Supabase.' };
  }
  // Este projeto usa as novas chaves públicas. Recusa também JWTs legados,
  // evitando aceitar por engano uma service_role no aplicativo.
  if (!/^sb_publishable_[A-Za-z0-9_-]+$/.test(publishableKey)) {
    return { status: 'invalid', message: 'Use a Publishable key que começa com sb_publishable_.' };
  }
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') {
      return { status: 'invalid', message: 'Use a Project URL HTTPS, sem caminhos adicionais ou dados de conexão do PostgreSQL.' };
    }
    return { status: 'ready', url: parsed.origin, publishableKey };
  } catch {
    return { status: 'invalid', message: 'Confira a Project URL do Supabase no arquivo .env.' };
  }
}
