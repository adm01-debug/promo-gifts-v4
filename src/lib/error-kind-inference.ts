import type { ErrorKind } from '@/hooks/intelligence';

/**
 * Infere `error_kind` a partir de `error_message` + `status_code` para registros
 * antigos do `connection_test_history` que foram persistidos antes do backend
 * passar a gravar `error_kind`. Quando o backend já gravou um kind (novos
 * registros), retorna-o como-está. Sucessos retornam `null`.
 *
 * SSOT do fallback no client — não duplicar no edge (lá usamos detecção direta
 * via `err.name === "AbortError"` e HTTP status no momento do erro).
 */
export function inferErrorKind(opts: {
  errorKind?: string | null;
  errorMessage?: string | null;
  statusCode?: number | null;
  success?: boolean | null;
}): ErrorKind | null {
  if (opts.success) return null;
  if (opts.errorKind) return opts.errorKind as ErrorKind;

  const msg = (opts.errorMessage ?? '').toLowerCase();
  const status = opts.statusCode ?? null;

  if (/timeout|timed?\s?out|abort/.test(msg)) return 'timeout';
  if (/dns|enotfound|getaddrinfo|name not resolved/.test(msg)) return 'dns';
  if (/network|fetch failed|econnrefused|econnreset|socket|tls|ssl/.test(msg)) return 'network';
  if (
    status === 401 ||
    status === 403 ||
    /unauthor|forbidden|invalid.*(token|key|secret|credential)|expired.*(token|key)/.test(msg)
  ) {
    return 'auth';
  }
  if (status !== null && status >= 400) return 'http';
  if (/config|missing.*(url|secret|key|env)/.test(msg)) return 'config';
  return 'unknown';
}
