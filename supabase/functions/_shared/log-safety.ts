const SENSITIVE_KEY_RE =
  /(?:authorization|apikey|api_key|key|password|secret|token|access_token|refresh_token|service_role|service_role_key)/i;

const JWT_RE = /\beyJ[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\.[A-Za-z0-9_-]{8,}\b/g;
const BEARER_RE = /(Bearer\s+)[A-Za-z0-9._-]{8,}/gi;
const QUERY_SECRET_RE =
  /([?&](?:auth|apikey|api_key|token|access_token|refresh_token|key|secret)=)[^&#\s"']+/gi;
const SUPABASE_REF_RE = /(https?:\/\/)([a-z0-9]{16,})(\.supabase\.(?:co|in))/gi;

function truncate(value: string, max = 240): string {
  return value.length <= max ? value : `${value.slice(0, max)}...(+${value.length - max} chars)`;
}

export function maskLogText(value: unknown, max = 240): string {
  return truncate(String(value ?? 'unknown'), max)
    .replace(JWT_RE, '[masked:jwt]')
    .replace(BEARER_RE, '$1[masked]')
    .replace(QUERY_SECRET_RE, '$1[masked]')
    .replace(SUPABASE_REF_RE, '$1[masked-ref]$3');
}

export function safeErrorFields(error: unknown): Record<string, unknown> {
  if (error instanceof Error) {
    const maybe = error as Error & { code?: unknown; status?: unknown };
    return {
      name: error.name,
      message: maskLogText(error.message),
      code: maybe.code ?? undefined,
      status: maybe.status ?? undefined,
    };
  }
  if (error && typeof error === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, raw] of Object.entries(error as Record<string, unknown>)) {
      if (SENSITIVE_KEY_RE.test(key)) {
        out[key] = '[redacted]';
      } else if (typeof raw === 'string') {
        out[key] = maskLogText(raw);
      } else if (typeof raw === 'number' || typeof raw === 'boolean' || raw === null) {
        out[key] = raw;
      } else {
        out[key] = `[${Array.isArray(raw) ? 'array' : typeof raw}]`;
      }
    }
    return out;
  }
  return { message: maskLogText(error) };
}

export function safeCount(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}
