/**
 * Mascaramento defensivo client-side para evitar que pedaços sensíveis
 * (URL do Supabase, anon key, service role key, tokens em geral) apareçam
 * em qualquer painel da UI — incluindo previews de respostas que possam
 * conter listas de produtos.
 *
 * Princípios de consistência:
 *  - Largura fixa: TODO valor mascarado é renderizado como `••••XXXX`
 *    (4 bullets + 4 caracteres do sufixo real), garantindo alinhamento
 *    visual e impedindo inferências de tamanho.
 *  - Caracteres uniformes: usamos sempre o bullet U+2022 ("•") como filler.
 *    Nunca asteriscos misturados, nunca padding variável.
 *  - Cobertura ampla: mascara JWTs (eyJ…), URLs supabase.co, query params
 *    sensíveis (apikey, token, auth, key, access_token) e campos JSON
 *    sensíveis (authorization, apikey, token, password, secret, etc.).
 *  - Idempotente: aplicar duas vezes não introduz ruído extra.
 */

const BULLET = '\u2022';
const FILL = BULLET.repeat(4);

/** Sufixo padronizado para qualquer segredo — sempre 4 chars + 4 bullets. */
export function maskSecretValue(raw: string | null | undefined): string {
  if (!raw) return `${FILL}????`;
  const trimmed = String(raw).trim();
  if (trimmed.length === 0) return `${FILL}????`;
  const suffix = trimmed.length >= 4 ? trimmed.slice(-4) : trimmed.padStart(4, BULLET);
  return `${FILL}${suffix}`;
}

/**
 * Padrões reconhecidos como sensíveis. Cada match é substituído por
 * `maskSecretValue(matchedSecret)` — preservando os 4 últimos caracteres
 * do segredo original para auditoria, mas escondendo o restante.
 */
const PATTERNS: Array<{ re: RegExp; group: number }> = [
  // JWT (anon key, service role key, access tokens) — três segmentos base64url separados por ponto.
  { re: /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g, group: 0 },
  // Supabase project ref dentro de URLs (ex: https://abcdefgh.supabase.co)
  { re: /https?:\/\/([a-z0-9]{16,})\.supabase\.(co|in)/gi, group: 1 },
  // Tokens em path style /rest/v1/<token>/
  { re: /(\/rest\/\d+\/)([A-Za-z0-9_-]{8,})(\/)/g, group: 2 },
];

/** Query params sensíveis: ?apikey=… ou &token=… etc. */
const QUERY_PARAM_RE =
  /([?&](?:auth|apikey|api_key|token|access_token|refresh_token|key|secret)=)([^&#\s"']+)/gi;

/** Campos JSON sensíveis: "authorization":"…" */
const JSON_FIELD_RE =
  /("(?:authorization|apikey|api_key|token|access_token|refresh_token|password|secret|service_role|service_role_key|anon_key)"\s*:\s*")([^"]+)(")/gi;

/** Header Authorization: Bearer <token> */
const BEARER_RE = /(Bearer\s+)([A-Za-z0-9._-]{8,})/g;

/**
 * Aplica todas as regras de mascaramento. Sempre devolve uma string
 * (ou `null` se a entrada for `null`/`undefined`). Nunca lança.
 */
export function maskSensitiveText(text: string | null | undefined): string | null {
  if (text === null) return null;
  let out = String(text);

  // 1. JWTs e refs em URL (substitui o segmento inteiro)
  for (const { re, group } of PATTERNS) {
    out = out.replace(re, (match, ...groups) => {
      const captured = group === 0 ? match : (groups[group - 1] as string);
      const masked = maskSecretValue(captured);
      return group === 0 ? masked : match.replace(captured, masked);
    });
  }

  // 2. Query params sensíveis
  out = out.replace(QUERY_PARAM_RE, (_m, prefix: string, value: string) => {
    return `${prefix}${maskSecretValue(value)}`;
  });

  // 3. Campos JSON sensíveis
  out = out.replace(JSON_FIELD_RE, (_m, prefix: string, value: string, suffix: string) => {
    return `${prefix}${maskSecretValue(value)}${suffix}`;
  });

  // 4. Bearer tokens em headers
  out = out.replace(BEARER_RE, (_m, prefix: string, value: string) => {
    return `${prefix}${maskSecretValue(value)}`;
  });

  return out;
}

/**
 * Verifica rapidamente se uma string contém qualquer padrão sensível.
 * Útil para asserts em testes e para destacar "este preview ainda contém
 * dados sensíveis — algo escapou da rede de mascaramento".
 */
export function containsSensitive(text: string | null | undefined): boolean {
  if (!text) return false;
  if (/eyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}/.test(text)) return true;
  if (/https?:\/\/[a-z0-9]{16,}\.supabase\.(co|in)/i.test(text)) return true;
  if (
    /[?&](?:auth|apikey|api_key|token|access_token|refresh_token|key|secret)=[^&#\s"']+/i.test(text)
  )
    return true;
  if (
    /"(?:authorization|apikey|api_key|token|access_token|refresh_token|password|secret|service_role|service_role_key|anon_key)"\s*:\s*"[^"•]+"/i.test(
      text,
    )
  )
    return true;
  if (/Bearer\s+[A-Za-z0-9._-]{8,}/.test(text) && !/Bearer\s+\u2022{4}/.test(text)) return true;
  return false;
}
