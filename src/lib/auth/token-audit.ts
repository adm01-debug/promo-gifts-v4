/**
 * Token Audit — JWT Leak Detection
 *
 * Detects Bearer tokens in error messages before they get logged
 * or sent to monitoring services.
 *
 * IMPORTANT: Never log JWT tokens. They are equivalent to passwords.
 */

const JWT_PATTERN = /Bearer\s+[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/gi;
const SHORT_JWT_PATTERN = /eyJ[A-Za-z0-9_-]{20,}/g;

/**
 * stripTokens — removes JWT tokens from a string.
 * Use before logging error messages.
 */
export function stripTokens(input: string): string {
  return input
    .replace(JWT_PATTERN, 'Bearer [REDACTED]')
    .replace(SHORT_JWT_PATTERN, '[JWT_REDACTED]');
}

/**
 * auditErrorMessage — check if a message contains tokens.
 * @returns true if tokens were found (caller should sanitize)
 */
export function auditErrorMessage(message: string): boolean {
  return JWT_PATTERN.test(message) || SHORT_JWT_PATTERN.test(message);
}

/**
 * safeErrorMessage — sanitize error for logging/display.
 */
export function safeErrorMessage(error: unknown): string {
  const msg =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : JSON.stringify(error);

  return stripTokens(msg);
}
