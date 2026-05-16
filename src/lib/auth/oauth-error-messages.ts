/**
 * Mapeia códigos / descrições de erro OAuth (Google / Supabase) para mensagens
 * descritivas em PT-BR exibidas em `/login?error=…`.
 *
 * Fontes dos códigos:
 * - OAuth 2.0 RFC 6749 §4.1.2.1 (access_denied, invalid_request, ...)
 * - Supabase Auth (server_error, otp_expired, provider_email_needs_verification, ...)
 * - Google (redirect_uri_mismatch, admin_policy_enforced, org_internal, ...)
 */

export interface OAuthErrorCopy {
  /** Título curto, ~40 chars. */
  title: string;
  /** Descrição amigável + próximo passo. */
  description: string;
  /** Sugestão de ação prática (1 frase). */
  hint?: string;
  /** Se true, o problema é de configuração do provider — não adianta o usuário tentar de novo. */
  isConfig?: boolean;
}

const RAW_MAP: Record<string, OAuthErrorCopy> = {
  access_denied: {
    title: "Login cancelado",
    description: "Você cancelou a autorização na tela do Google ou negou as permissões solicitadas.",
    hint: "Tente novamente e clique em “Continuar” na tela do Google.",
  },
  user_cancelled: {
    title: "Login cancelado",
    description: "Você fechou a janela do Google antes de concluir.",
    hint: "Tente novamente sem fechar a aba.",
  },
  server_error: {
    title: "O Google está instável",
    description: "O provedor de identidade retornou um erro temporário.",
    hint: "Aguarde alguns segundos e tente de novo. Se persistir, use e-mail e senha.",
  },
  temporarily_unavailable: {
    title: "Serviço de login indisponível",
    description: "O Google está temporariamente fora do ar.",
    hint: "Tente novamente em alguns minutos.",
  },
  invalid_request: {
    title: "Pedido de login inválido",
    description: "Algum parâmetro obrigatório do fluxo OAuth está faltando ou malformado.",
    hint: "Tente novamente. Se continuar, entre com e-mail e senha.",
    isConfig: true,
  },
  invalid_client: {
    title: "Cliente OAuth não reconhecido",
    description: "As credenciais do app no Google não estão corretas.",
    isConfig: true,
  },
  invalid_grant: {
    title: "Autorização expirada",
    description: "O código de autorização expirou ou já foi usado.",
    hint: "Faça o login novamente.",
  },
  unauthorized_client: {
    title: "App não autorizado",
    description: "Este aplicativo não tem permissão para usar o login do Google.",
    isConfig: true,
  },
  unsupported_response_type: {
    title: "Configuração OAuth inválida",
    description: "O tipo de resposta solicitado não é suportado.",
    isConfig: true,
  },
  invalid_scope: {
    title: "Permissões inválidas",
    description: "Os escopos solicitados ao Google não são válidos.",
    isConfig: true,
  },
  redirect_uri_mismatch: {
    title: "URL de retorno não autorizada",
    description: "A URL para onde o Google deveria voltar não está cadastrada no console do provedor.",
    hint: "Avise o administrador — é uma configuração no Google Cloud / Supabase.",
    isConfig: true,
  },
  admin_policy_enforced: {
    title: "Bloqueado pela política da sua organização",
    description: "O administrador da sua conta Google bloqueou o login neste app.",
    hint: "Fale com o admin do seu Google Workspace.",
  },
  org_internal: {
    title: "Conta fora da organização permitida",
    description: "Apenas contas Google de uma organização específica podem entrar.",
    hint: "Use sua conta corporativa ou peça acesso ao admin.",
  },
  provider_email_needs_verification: {
    title: "E-mail do Google não verificado",
    description: "Sua conta Google ainda não confirmou o endereço de e-mail.",
    hint: "Verifique o e-mail no Google e tente de novo.",
  },
  email_address_invalid: {
    title: "E-mail inválido",
    description: "O e-mail retornado pelo Google não pôde ser usado.",
  },
  signup_disabled: {
    title: "Cadastro fechado",
    description: "Esta plataforma é restrita — novos usuários precisam ser provisionados manualmente.",
    hint: "Fale com o administrador para liberar seu acesso.",
  },
  user_not_allowed: {
    title: "Acesso não autorizado",
    description: "Sua conta não tem permissão para entrar nesta plataforma.",
    hint: "Fale com o administrador.",
  },
  validation_failed: {
    title: "Sessão inválida",
    description: "Não conseguimos validar a sessão retornada pelo Google.",
    hint: "Tente novamente.",
  },
  no_session: {
    title: "Sessão não criada",
    description: "O Google retornou ao app, mas nenhuma sessão foi criada.",
    hint: "Tente novamente ou use e-mail e senha.",
  },
  state_mismatch: {
    title: "Sessão de login expirou",
    description: "O parâmetro de segurança (state) não bateu — possivelmente o login demorou demais.",
    hint: "Tente novamente sem deixar a aba aberta por muito tempo.",
  },
  bad_oauth_state: {
    title: "Sessão de login expirou",
    description: "O estado de segurança do OAuth não é válido.",
    hint: "Tente novamente.",
  },
};

/** Normaliza o input — códigos OAuth costumam vir em snake_case minúsculo. */
function normalizeKey(raw: string): string {
  return raw.trim().toLowerCase().replace(/[\s-]+/g, "_");
}

/**
 * Resolve uma mensagem amigável a partir do `?error=…` da URL.
 *
 * O valor pode ser:
 * - um código OAuth conhecido (ex: `access_denied`)
 * - uma `error_description` em texto livre (ex: `"Token expired"`)
 * - uma mensagem em PT-BR já formatada
 *
 * Se nenhuma correspondência for encontrada, devolvemos um copy genérico
 * preservando o texto original como `description` (útil para debug).
 */
export function resolveOAuthError(raw: string | null | undefined): OAuthErrorCopy {
  if (!raw) {
    return {
      title: "Falha no login com Google",
      description: "Não foi possível autenticar. Tente novamente.",
    };
  }

  const normalized = normalizeKey(raw);

  // 1) match direto por código
  if (RAW_MAP[normalized]) return RAW_MAP[normalized];

  // 2) match por substring (descriptions vindas do provider)
  for (const [key, copy] of Object.entries(RAW_MAP)) {
    if (normalized.includes(key)) return copy;
  }

  // 3) heurísticas de texto livre
  if (/expired|expirad/.test(normalized)) {
    return {
      title: "Sessão de login expirou",
      description: "O link de autenticação expirou antes de ser concluído.",
      hint: "Tente novamente.",
    };
  }
  if (/network|fetch|timeout|timed.?out/.test(normalized)) {
    return {
      title: "Sem conexão com o Google",
      description: "Não conseguimos falar com o servidor do Google.",
      hint: "Verifique sua internet e tente de novo.",
    };
  }
  if (/popup|blocked/.test(normalized)) {
    return {
      title: "Pop-up bloqueado",
      description: "Seu navegador bloqueou a janela de login do Google.",
      hint: "Permita pop-ups deste site e tente novamente.",
    };
  }

  // 4) fallback: preserva texto original
  return {
    title: "Falha no login com Google",
    description: raw,
    hint: "Tente novamente ou use e-mail e senha.",
  };
}
