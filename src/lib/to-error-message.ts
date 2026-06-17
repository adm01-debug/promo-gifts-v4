/**
 * Extracts a human-readable string from an unknown caught value.
 * Use in catch blocks for developer/logger-facing messages.
 * For user-facing messages that need security sanitization, use sanitizeError().
 */
export function toErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
