// Pure helpers extracted from SupabaseConnectionsTab so the
// "Sem credenciais" decision is unit-testable in isolation.
//
// Mirrors exactly the inline expression at SupabaseConnectionsTab.tsx ~L115.

export type ConnectionStatus = 'active' | 'error' | 'unconfigured';

export interface SecretLite {
  has_value: boolean;
}

export interface ResolveStatusInput {
  /** true for connections that are managed automatically (e.g. local Supabase). */
  readOnly: boolean;
  /** Resolved URL secret (or undefined if missing). */
  url?: SecretLite;
  /** Resolved service-role secret (or undefined if missing). */
  service?: SecretLite;
  /** Last connection-test result (null if never tested). */
  last?: { ok: boolean | null } | null;
}

/**
 * Decide which badge a Supabase connection card should show.
 *
 * Rules:
 *   - readOnly cards are always "active" (gerenciado automaticamente)
 *   - URL or service key missing/empty → "unconfigured" ("Sem credenciais")
 *   - Both present + last test failed   → "error"
 *   - Otherwise                         → "active"
 */
export function resolveSupabaseConnectionStatus(input: ResolveStatusInput): ConnectionStatus {
  const { readOnly, url, service, last } = input;
  if (readOnly) return 'active';
  const credsConfigured = !!url?.has_value && !!service?.has_value;
  if (!credsConfigured) return 'unconfigured';
  if (last?.ok === false) return 'error';
  return 'active';
}
