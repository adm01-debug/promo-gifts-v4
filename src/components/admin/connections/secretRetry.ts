import type { SecretMutationResult, SecretError } from '@/hooks/admin';

/**
 * Detects retryable network errors: timeouts, fetch failures, 5xx responses.
 * Auth/validation errors are NOT retried (fail fast).
 */
export function isRetryableSecretError(err: SecretError | undefined): boolean {
  if (!err) return false;
  const msg = (err.message || '').toLowerCase();
  const code = (err.code || '').toLowerCase();

  // Never retry: client/auth/validation
  if (
    code === 'forbidden' ||
    code === 'not_whitelisted' ||
    code === 'invalid_value' ||
    code === 'unauthorized'
  ) {
    return false;
  }

  // Retry: network / timeout / 5xx
  return (
    msg.includes('network') ||
    msg.includes('failed to fetch') ||
    msg.includes('timeout') ||
    msg.includes('timed out') ||
    (!msg.includes('aborted') &&
      (msg.includes(' 500') ||
        msg.includes(' 502') ||
        msg.includes(' 503') ||
        msg.includes(' 504') ||
        msg.includes('internal server error') ||
        msg.includes('bad gateway') ||
        msg.includes('service unavailable') ||
        msg.includes('gateway timeout'))) ||
    code === 'db_error'
  );
}

export interface RetryOptions {
  maxAttempts?: number;
  baseDelayMs?: number;
  signal?: AbortSignal;
  onAttempt?: (attempt: number, nextDelayMs: number | null) => void;
}

export class CancelledError extends Error {
  constructor() {
    super('cancelled');
    this.name = 'CancelledError';
  }
}

/**
 * Runs `fn` with exponential backoff retries on retryable network/5xx errors.
 * Cancellable via AbortSignal — rejects with CancelledError immediately.
 */
export async function withRetryBackoff(
  fn: () => Promise<SecretMutationResult>,
  options: RetryOptions = {},
): Promise<SecretMutationResult> {
  const { maxAttempts = 3, baseDelayMs = 600, signal, onAttempt } = options;

  let lastResult: SecretMutationResult | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    if (signal?.aborted) throw new CancelledError();

    onAttempt?.(attempt, null);
    const result = await fn();
    lastResult = result;

    if (result.ok) return result;
    if (!isRetryableSecretError(result.error)) return result;
    if (attempt === maxAttempts) return result;

    // Exponential backoff with small jitter: 600ms, 1200ms, 2400ms…
    const delay = baseDelayMs * 2 ** (attempt - 1) + Math.floor(Math.random() * 150);
    onAttempt?.(attempt, delay);

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      }, delay);
      const onAbort = () => {
        clearTimeout(timer);
        reject(new CancelledError());
      };
      if (signal) {
        if (signal.aborted) {
          clearTimeout(timer);
          reject(new CancelledError());
          return;
        }
        signal.addEventListener('abort', onAbort, { once: true });
      }
    });
  }

  return lastResult ?? { ok: false, error: { code: 'unexpected', message: 'Sem resultado' } };
}
