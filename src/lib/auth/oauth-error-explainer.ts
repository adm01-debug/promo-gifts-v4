/**
 * Traduz erros do fluxo OAuth (vindos do provider, do Supabase ou do exchange)
 * em mensagens detalhadas e acionáveis para o usuário final.
 *
 * Fontes possíveis de erro:
 *  - Query string do callback: `?error=...&error_description=...`
 *  - Hash do callback (implicit grant): `#error=...&error_description=...`
 *  - Mensagem de `exchangeCodeForSession` (Supabase)
 *  - Timeout interno (sem sessão após N segundos)
 *
 * O objetivo é dizer ao usuário **o que aconteceu** e **o que fazer** —
 * destacando os dois cenários mais comuns em apps Lovable Cloud:
 *  1. Redirect URI não autorizada no console do provider.
 *  2. Provider não configurado/desabilitado no backend.
 */

export interface OAuthErrorExplanation {
  /** Código normalizado (snake_case) — útil para telemetria/QA. */
  code: string;
  /** Título curto (~6 palavras). */
  title: string;
  /** Descrição humana do que aconteceu. */
  description: string;
  /** Próximo passo recomendado (ação do usuário ou admin). */
  hint: string;
  /** Categoria — controla cor/ícone na UI. */
  severity: 'config' | 'transient' | 'unknown' | 'user';
}

interface RawErrorInput {
  /** Código cru do provider (ex.: `access_denied`, `redirect_uri_mismatch`). */
  error?: string | null;
  /** Descrição crua (`error_description`) ou mensagem do exchange. */
  description?: string | null;
}

/**
 * Mapeia (error, description) → explicação detalhada.
 * Faz match por código exato primeiro; se não bater, varre a descrição
 * por palavras-chave (case-insensitive).
 */
export function explainOAuthError(input: RawErrorInput): OAuthErrorExplanation {
  const code = (input.error ?? '').trim().toLowerCase();
  const desc = (input.description ?? '').trim();
  const descLower = desc.toLowerCase();

  // --- 0. Overrides por descrição (mais específicos que o code genérico) ---
  // Provedores às vezes retornam `server_error` ou `invalid_request` com a
  // causa real apenas no `error_description` — checamos antes do switch.
  if (descLower.includes('redirect') && descLower.includes('uri')) {
    return REDIRECT_URI_MISMATCH(desc);
  }
  if (descLower.includes('provider is not enabled') || descLower.includes('unsupported provider')) {
    return PROVIDER_NOT_ENABLED(desc);
  }

  // --- 1. Matches por código exato -----------------------------------------
  switch (code) {
    case 'redirect_uri_mismatch':
      return REDIRECT_URI_MISMATCH(desc);
    case 'unauthorized_client':
      return UNAUTHORIZED_CLIENT(desc);
    case 'invalid_client':
      return INVALID_CLIENT(desc);
    case 'provider_not_enabled':
    case 'provider_disabled':
    case 'unsupported_provider':
      return PROVIDER_NOT_ENABLED(desc);
    case 'access_denied':
      return ACCESS_DENIED(desc);
    case 'invalid_request':
      return INVALID_REQUEST(desc);
    case 'server_error':
    case 'temporarily_unavailable':
      return TRANSIENT(code, desc);
    case 'invalid_grant':
    case 'bad_code_verifier':
      return INVALID_GRANT(desc);
    case 'email_not_confirmed':
      return EMAIL_NOT_CONFIRMED(desc);
    case 'user_banned':
      return USER_BANNED(desc);
    case 'otp_expired':
    case 'flow_state_expired':
      return EXPIRED_FLOW(desc);
  }

  // --- 2. Matches por palavras-chave na descrição --------------------------
  if (descLower.includes('redirect') && descLower.includes('uri')) {
    return REDIRECT_URI_MISMATCH(desc);
  }
  if (descLower.includes('provider is not enabled') || descLower.includes('unsupported provider')) {
    return PROVIDER_NOT_ENABLED(desc);
  }
  if (descLower.includes('client') && descLower.includes('not found')) {
    return INVALID_CLIENT(desc);
  }
  if (descLower.includes('sessão não estabelecida') || descLower.includes('timeout')) {
    return TIMEOUT(desc);
  }
  if (descLower.includes('code verifier') || descLower.includes('pkce')) {
    return INVALID_GRANT(desc);
  }
  if (descLower.includes('network') || descLower.includes('failed to fetch')) {
    return NETWORK(desc);
  }

  // --- 3. Fallback genérico -------------------------------------------------
  return {
    code: code || 'unknown',
    title: 'Falha na autenticação',
    description: desc || 'Não foi possível completar o login com o provedor.',
    hint: 'Tente novamente em alguns segundos. Se o problema persistir, entre em contato com o administrador.',
    severity: 'unknown',
  };
}

// =========================================================================
// Mensagens individuais — separadas para fácil ajuste de copy
// =========================================================================

const REDIRECT_URI_MISMATCH = (desc: string): OAuthErrorExplanation => ({
  code: 'redirect_uri_mismatch',
  title: 'Redirect URI não autorizada',
  description:
    desc ||
    'O endereço de retorno usado neste login não está na lista de URIs autorizadas no console do provedor.',
  hint: 'Peça ao administrador para adicionar a URL de callback do Lovable Cloud à lista de "Authorized redirect URIs" do provedor (ex.: Google Cloud Console → APIs & Services → Credentials → OAuth 2.0 Client).',
  severity: 'config',
});

const UNAUTHORIZED_CLIENT = (desc: string): OAuthErrorExplanation => ({
  code: 'unauthorized_client',
  title: 'Cliente OAuth não autorizado',
  description:
    desc ||
    'O Client ID configurado não está autorizado a executar este fluxo de login no provedor.',
  hint: 'Confirme com o administrador se o Client ID/Secret no Lovable Cloud bate com o do console do provedor e se o tipo de aplicação é "Web application".',
  severity: 'config',
});

const INVALID_CLIENT = (desc: string): OAuthErrorExplanation => ({
  code: 'invalid_client',
  title: 'Credenciais do provedor inválidas',
  description:
    desc ||
    'O Client ID ou Client Secret usado para esta autenticação não foi reconhecido pelo provedor.',
  hint: 'Peça ao administrador para revalidar as credenciais OAuth no Lovable Cloud (Cloud → Users → Authentication Settings → Sign In Methods).',
  severity: 'config',
});

const PROVIDER_NOT_ENABLED = (desc: string): OAuthErrorExplanation => ({
  code: 'provider_not_enabled',
  title: 'Provedor de login não configurado',
  description:
    desc ||
    'Este método de login não está habilitado no backend. Nenhuma sessão pode ser criada até que o admin ative o provedor.',
  hint: 'Administrador: ative o provedor em Lovable Cloud → Users → Authentication Settings → Sign In Methods e salve as credenciais antes de tentar novamente.',
  severity: 'config',
});

const ACCESS_DENIED = (desc: string): OAuthErrorExplanation => ({
  code: 'access_denied',
  title: 'Login cancelado',
  description:
    desc || 'Você cancelou o login no provedor ou não concedeu as permissões necessárias.',
  hint: 'Clique novamente em "Continuar com Google" e aceite as permissões solicitadas para entrar.',
  severity: 'user',
});

const INVALID_REQUEST = (desc: string): OAuthErrorExplanation => ({
  code: 'invalid_request',
  title: 'Requisição OAuth inválida',
  description:
    desc ||
    'A requisição enviada ao provedor estava incompleta ou malformada. Isso geralmente é um problema de configuração.',
  hint: 'Atualize a página e tente novamente. Se persistir, peça ao admin para verificar a URL de callback e os escopos configurados.',
  severity: 'config',
});

const TRANSIENT = (code: string, desc: string): OAuthErrorExplanation => ({
  code,
  title: 'Provedor temporariamente indisponível',
  description:
    desc ||
    'O provedor de identidade retornou um erro temporário. Não é necessário mudar nenhuma configuração.',
  hint: 'Aguarde alguns segundos e tente novamente. Se persistir por mais de alguns minutos, verifique a página de status do provedor.',
  severity: 'transient',
});

const INVALID_GRANT = (desc: string): OAuthErrorExplanation => ({
  code: 'invalid_grant',
  title: 'Código de autorização expirado',
  description:
    desc ||
    'O código retornado pelo provedor já foi usado, expirou ou não corresponde ao verificador PKCE desta sessão.',
  hint: 'Volte para a tela de login e tente novamente — não reabra a URL de callback diretamente.',
  severity: 'transient',
});

const EMAIL_NOT_CONFIRMED = (desc: string): OAuthErrorExplanation => ({
  code: 'email_not_confirmed',
  title: 'E-mail não confirmado',
  description: desc || 'Você precisa confirmar seu e-mail antes de poder entrar.',
  hint: 'Confira sua caixa de entrada (e a pasta de spam) e clique no link de confirmação.',
  severity: 'user',
});

const USER_BANNED = (desc: string): OAuthErrorExplanation => ({
  code: 'user_banned',
  title: 'Conta bloqueada',
  description: desc || 'Esta conta está bloqueada e não pode acessar o sistema.',
  hint: 'Entre em contato com o administrador para reativar seu acesso.',
  severity: 'user',
});

const EXPIRED_FLOW = (desc: string): OAuthErrorExplanation => ({
  code: 'flow_state_expired',
  title: 'Sessão de login expirada',
  description: desc || 'A janela de login ficou aberta tempo demais e o estado do fluxo expirou.',
  hint: 'Recarregue a página de login e inicie um novo fluxo.',
  severity: 'transient',
});

const TIMEOUT = (desc: string): OAuthErrorExplanation => ({
  code: 'timeout',
  title: 'Tempo esgotado',
  description:
    desc ||
    'A sessão não foi confirmada a tempo. O provedor respondeu, mas o backend não conseguiu materializar a sessão.',
  hint: 'Verifique sua conexão e tente novamente. Se persistir, peça ao admin para checar os logs do callback e a configuração do provedor.',
  severity: 'transient',
});

const NETWORK = (desc: string): OAuthErrorExplanation => ({
  code: 'network',
  title: 'Erro de conexão',
  description: desc || 'Não foi possível alcançar o servidor de autenticação.',
  hint: 'Verifique sua conexão com a internet e tente novamente.',
  severity: 'transient',
});
