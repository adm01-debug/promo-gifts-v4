// supabase/functions/_shared/credentials.ts
// SSOT (Single Source of Truth) for credential resolution across all edge functions.
//
// Resolution order:
//   1) integration_credentials table (DB-first) — values entered via /admin/conexoes
//   2) Deno.env.get(name) fallback — legacy/bootstrap values
//   3) optional name aliases (different historical env names → canonical DB name)
//
// In-memory cache (60s TTL per isolate) avoids hammering the DB on hot paths.

import { createClient, type SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

interface CacheEntry {
  value: string | null;
  source: CredentialSource;
  expires_at: number;
  stored_at: number;
}

export type CredentialSource = "db" | "env" | "none";

export interface CredentialResolution {
  value: string | null;
  source: CredentialSource;
  /** Canonical secret name actually resolved (after alias lookup). */
  resolved_name: string;
}

const CACHE = new Map<string, CacheEntry>();
const TTL_MS = 60_000;

const ALIASES: Record<string, string[]> = {
  EXTERNAL_PROMOBRIND_URL: ["EXTERNAL_SUPABASE_URL"],
  EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY: [
    "EXTERNAL_SUPABASE_SERVICE_ROLE_KEY",
    "EXTERNAL_SUPABASE_SERVICE_KEY",
  ],
  EXTERNAL_PROMOBRIND_ANON_KEY: ["EXTERNAL_SUPABASE_ANON_KEY"],
  EXTERNAL_CRM_URL: ["CRM_SUPABASE_URL"],
  EXTERNAL_CRM_SERVICE_ROLE_KEY: ["CRM_SUPABASE_SERVICE_KEY"],
  EXTERNAL_CRM_ANON_KEY: ["CRM_SUPABASE_ANON_KEY"],
};

// =============================================================================
// Metrics: per-isolate (in-memory). Reset on isolate restart.
// =============================================================================

interface PerNameStats {
  hits: number;
  misses: number;
  expirations: number;
  resolutions: number;
  last_source: CredentialSource | null;
  last_resolved_at: number | null;
  last_duration_ms: number | null;
}

interface CacheMetricsState {
  /** Wall-clock ms when this isolate started collecting metrics. */
  started_at: number;
  hits: number;
  misses: number;
  expirations: number;
  resolutions: number;
  invalidations_single: number;
  invalidations_full: number;
  /** Rolling buffer of resolution durations (ms). Bounded for memory safety. */
  durations_ms: number[];
  per_name: Map<string, PerNameStats>;
}

const MAX_DURATIONS = 500;

const METRICS: CacheMetricsState = {
  started_at: Date.now(),
  hits: 0,
  misses: 0,
  expirations: 0,
  resolutions: 0,
  invalidations_single: 0,
  invalidations_full: 0,
  durations_ms: [],
  per_name: new Map(),
};

function getOrInitName(name: string): PerNameStats {
  let entry = METRICS.per_name.get(name);
  if (!entry) {
    entry = {
      hits: 0,
      misses: 0,
      expirations: 0,
      resolutions: 0,
      last_source: null,
      last_resolved_at: null,
      last_duration_ms: null,
    };
    METRICS.per_name.set(name, entry);
  }
  return entry;
}

function recordDuration(ms: number): void {
  METRICS.durations_ms.push(ms);
  if (METRICS.durations_ms.length > MAX_DURATIONS) {
    METRICS.durations_ms.splice(0, METRICS.durations_ms.length - MAX_DURATIONS);
  }
}

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
}

export interface CacheMetricsSnapshot {
  isolate_started_at: string;
  uptime_ms: number;
  cache: {
    size: number;
    ttl_ms: number;
    entries: Array<{
      name: string;
      source: CredentialSource;
      has_value: boolean;
      stored_at: string;
      expires_at: string;
      ttl_remaining_ms: number;
      expired: boolean;
    }>;
  };
  counters: {
    resolutions: number;
    hits: number;
    misses: number;
    expirations: number;
    invalidations_single: number;
    invalidations_full: number;
    hit_ratio: number;
  };
  duration_ms: {
    samples: number;
    avg: number;
    p50: number;
    p95: number;
    p99: number;
    max: number;
  };
  per_name: Array<{
    name: string;
    hits: number;
    misses: number;
    expirations: number;
    resolutions: number;
    last_source: CredentialSource | null;
    last_resolved_at: string | null;
    last_duration_ms: number | null;
    hit_ratio: number;
  }>;
}

/** Public read-only snapshot of cache health for the current isolate. */
export function getCredentialCacheMetrics(): CacheMetricsSnapshot {
  const now = Date.now();
  const sorted = [...METRICS.durations_ms].sort((a, b) => a - b);
  const sum = sorted.reduce((acc, n) => acc + n, 0);
  const avg = sorted.length ? sum / sorted.length : 0;
  const totalAccess = METRICS.hits + METRICS.misses;
  const hitRatio = totalAccess > 0 ? METRICS.hits / totalAccess : 0;

  return {
    isolate_started_at: new Date(METRICS.started_at).toISOString(),
    uptime_ms: now - METRICS.started_at,
    cache: {
      size: CACHE.size,
      ttl_ms: TTL_MS,
      entries: Array.from(CACHE.entries()).map(([name, e]) => ({
        name,
        source: e.source,
        has_value: e.value !== null,
        stored_at: new Date(e.stored_at).toISOString(),
        expires_at: new Date(e.expires_at).toISOString(),
        ttl_remaining_ms: Math.max(0, e.expires_at - now),
        expired: e.expires_at <= now,
      })),
    },
    counters: {
      resolutions: METRICS.resolutions,
      hits: METRICS.hits,
      misses: METRICS.misses,
      expirations: METRICS.expirations,
      invalidations_single: METRICS.invalidations_single,
      invalidations_full: METRICS.invalidations_full,
      hit_ratio: Number(hitRatio.toFixed(4)),
    },
    duration_ms: {
      samples: sorted.length,
      avg: Number(avg.toFixed(2)),
      p50: percentile(sorted, 50),
      p95: percentile(sorted, 95),
      p99: percentile(sorted, 99),
      max: sorted.length ? sorted[sorted.length - 1] : 0,
    },
    per_name: Array.from(METRICS.per_name.entries()).map(([name, s]) => {
      const access = s.hits + s.misses;
      return {
        name,
        hits: s.hits,
        misses: s.misses,
        expirations: s.expirations,
        resolutions: s.resolutions,
        last_source: s.last_source,
        last_resolved_at: s.last_resolved_at ? new Date(s.last_resolved_at).toISOString() : null,
        last_duration_ms: s.last_duration_ms,
        hit_ratio: access > 0 ? Number((s.hits / access).toFixed(4)) : 0,
      };
    }),
  };
}

// =============================================================================
// Credentials health summary — observability snapshot without exposing values.
// =============================================================================
// Reusable primitive consumed by edge functions that expose ?op=creds_health
// (currently crm-db-bridge; expand to quote-sync/expert-chat
// in follow-up PRs). Returns presence/source/alias/length/suffix4 per name,
// plus an aggregated `health` flag.
//
// Health aggregation rules (URL é considerada o pivô — sem URL nada conecta):
//   - "missing"   : nenhum dos nomes "URL" está presente
//   - "degraded"  : URL presente, mas zero "key" presente
//   - "healthy"   : URL presente E ao menos 1 "key" presente
//
// Para detectar URL, consideramos `name.endsWith("_URL")`. Mantemos simples;
// edge fns com nomenclatura diferente podem passar `urlNames`/`keyNames`
// explicitamente.

export interface CredentialHealthEntry {
  name: string;
  present: boolean;
  source: CredentialSource;
  via_alias: boolean;
  resolved_name: string;
  value_length: number;
  /** Last 4 chars of the secret value, for ops to fingerprint without leaking. */
  suffix4: string | null;
}

export interface CredentialsHealthSummary {
  ok: true;
  ts: number;
  health: "healthy" | "degraded" | "missing";
  credentials: CredentialHealthEntry[];
}

export interface BuildCredentialsHealthOptions {
  /**
   * Name suffixes that identify URL-like credentials. Defaults to ["_URL"].
   * Used for the "missing" classification (no URL → missing).
   */
  urlSuffixes?: string[];
  /** Optional service client to pass through to resolveCredential. */
  serviceClient?: SupabaseClient | null;
}

function summarizeCredential(name: string, res: CredentialResolution): CredentialHealthEntry {
  return {
    name,
    present: res.value !== null,
    source: res.source,
    via_alias: res.resolved_name !== name,
    resolved_name: res.resolved_name,
    value_length: res.value?.length ?? 0,
    suffix4: res.value ? res.value.slice(-4) : null,
  };
}

/**
 * Resolve uma lista de credenciais e devolve um snapshot agregado de saúde,
 * sem expor valores. Usado por endpoints `?op=creds_health` em edge functions
 * que dependem de credenciais externas (CRM, Promobrind, etc).
 */
export async function buildCredentialsHealth(
  names: readonly string[],
  options: BuildCredentialsHealthOptions = {},
): Promise<CredentialsHealthSummary> {
  const urlSuffixes = options.urlSuffixes ?? ["_URL"];
  const resolutions = await Promise.all(
    names.map((name) => resolveCredential(name, options.serviceClient)),
  );
  const credentials = names.map((name, i) => summarizeCredential(name, resolutions[i]));

  const isUrlName = (n: string) => urlSuffixes.some((suf) => n.endsWith(suf));
  const urlEntries = credentials.filter((c) => isUrlName(c.name));
  const keyEntries = credentials.filter((c) => !isUrlName(c.name));

  const anyUrlPresent = urlEntries.some((c) => c.present);
  const anyKeyPresent = keyEntries.some((c) => c.present);

  const health: CredentialsHealthSummary["health"] = !anyUrlPresent
    ? "missing"
    : !anyKeyPresent
      ? "degraded"
      : "healthy";

  return {
    ok: true,
    ts: Date.now(),
    health,
    credentials,
  };
}

/** Reset all in-memory metrics. Cache itself is NOT cleared. */
export function resetCredentialCacheMetrics(): void {
  METRICS.started_at = Date.now();
  METRICS.hits = 0;
  METRICS.misses = 0;
  METRICS.expirations = 0;
  METRICS.resolutions = 0;
  METRICS.invalidations_single = 0;
  METRICS.invalidations_full = 0;
  METRICS.durations_ms = [];
  METRICS.per_name.clear();
}

export function invalidateCredentialCache(name?: string): void {
  if (name) {
    CACHE.delete(name);
    METRICS.invalidations_single += 1;
    for (const [canonical] of Object.entries(ALIASES)) {
      if (canonical === name) CACHE.delete(canonical);
    }
  } else {
    CACHE.clear();
    METRICS.invalidations_full += 1;
  }
}

let internalServiceClient: SupabaseClient | null = null;
function getInternalServiceClient(): SupabaseClient | null {
  if (internalServiceClient) return internalServiceClient;
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !key) return null;
  internalServiceClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return internalServiceClient;
}

interface ResolutionLogPayload {
  event: "credential_resolved";
  name: string;
  resolved_name: string;
  source: CredentialSource;
  has_value: boolean;
  value_length: number;
  cached: boolean;
  duration_ms: number;
  via_alias: boolean;
  error?: string;
  /** True quando o valor foi obtido via bulk fetch (1 query para N nomes). */
  bulk?: boolean;
}

function logResolution(payload: ResolutionLogPayload): void {
  if (Deno.env.get("LOG_CREDENTIAL_RESOLUTION") === "off") return;
  try {
    console.log("[credentials] " + JSON.stringify(payload));
  } catch {
    // Never let logging break credential resolution
  }
}

function recordResolution(opts: {
  name: string;
  source: CredentialSource;
  duration_ms: number;
  cached: boolean;
  expired_before: boolean;
}): void {
  METRICS.resolutions += 1;
  if (opts.cached) METRICS.hits += 1;
  else METRICS.misses += 1;
  if (opts.expired_before) METRICS.expirations += 1;
  recordDuration(opts.duration_ms);

  const stats = getOrInitName(opts.name);
  stats.resolutions += 1;
  if (opts.cached) stats.hits += 1;
  else stats.misses += 1;
  if (opts.expired_before) stats.expirations += 1;
  stats.last_source = opts.source;
  stats.last_resolved_at = Date.now();
  stats.last_duration_ms = opts.duration_ms;
}

/**
 * Resolve a credential by name with full provenance metadata.
 * Always prefers DB; falls back to env (and to legacy env aliases).
 */
export async function resolveCredential(
  name: string,
  serviceClient?: SupabaseClient | null,
): Promise<CredentialResolution> {
  const startedAt = Date.now();
  const cached = CACHE.get(name);
  const expiredBefore = !!cached && cached.expires_at <= startedAt;

  if (cached && cached.expires_at > startedAt) {
    const value = cached.value;
    const duration = Date.now() - startedAt;
    recordResolution({ name, source: cached.source, duration_ms: duration, cached: true, expired_before: false });
    logResolution({
      event: "credential_resolved",
      name,
      resolved_name: name,
      source: cached.source,
      has_value: value !== null,
      value_length: value ? value.length : 0,
      cached: true,
      duration_ms: duration,
      via_alias: false,
    });
    return { value, source: cached.source, resolved_name: name };
  }

  const client = serviceClient ?? getInternalServiceClient();
  let dbError: string | undefined;

  // 1) DB
  if (client) {
    try {
      const { data, error } = await client
        .from("integration_credentials")
        .select("secret_value")
        .eq("secret_name", name)
        .maybeSingle();
      if (!error && data?.secret_value) {
        const value = data.secret_value as string;
        const now = Date.now();
        CACHE.set(name, { value, source: "db", expires_at: now + TTL_MS, stored_at: now });
        const duration = Date.now() - startedAt;
        recordResolution({ name, source: "db", duration_ms: duration, cached: false, expired_before: expiredBefore });
        logResolution({
          event: "credential_resolved",
          name,
          resolved_name: name,
          source: "db",
          has_value: true,
          value_length: value.length,
          cached: false,
          duration_ms: duration,
          via_alias: false,
        });
        return { value, source: "db", resolved_name: name };
      }
      if (error) dbError = error.message;
    } catch (err) {
      dbError = err instanceof Error ? err.message : String(err);
      console.error("[credentials] DB read failed for", name, err);
    }
  }

  // 2) Env at canonical name
  const envCanonical = Deno.env.get(name);
  if (envCanonical) {
    const now = Date.now();
    CACHE.set(name, { value: envCanonical, source: "env", expires_at: now + TTL_MS, stored_at: now });
    const duration = Date.now() - startedAt;
    recordResolution({ name, source: "env", duration_ms: duration, cached: false, expired_before: expiredBefore });
    logResolution({
      event: "credential_resolved",
      name,
      resolved_name: name,
      source: "env",
      has_value: true,
      value_length: envCanonical.length,
      cached: false,
      duration_ms: duration,
      via_alias: false,
      error: dbError,
    });
    return { value: envCanonical, source: "env", resolved_name: name };
  }

  // 3) Env at legacy aliases
  for (const alias of ALIASES[name] ?? []) {
    const v = Deno.env.get(alias);
    if (v) {
      const now = Date.now();
      CACHE.set(name, { value: v, source: "env", expires_at: now + TTL_MS, stored_at: now });
      const duration = Date.now() - startedAt;
      recordResolution({ name, source: "env", duration_ms: duration, cached: false, expired_before: expiredBefore });
      logResolution({
        event: "credential_resolved",
        name,
        resolved_name: alias,
        source: "env",
        has_value: true,
        value_length: v.length,
        cached: false,
        duration_ms: duration,
        via_alias: true,
        error: dbError,
      });
      return { value: v, source: "env", resolved_name: alias };
    }
  }

  const now = Date.now();
  CACHE.set(name, { value: null, source: "none", expires_at: now + TTL_MS, stored_at: now });
  const duration = Date.now() - startedAt;
  recordResolution({ name, source: "none", duration_ms: duration, cached: false, expired_before: expiredBefore });
  logResolution({
    event: "credential_resolved",
    name,
    resolved_name: name,
    source: "none",
    has_value: false,
    value_length: 0,
    cached: false,
    duration_ms: duration,
    via_alias: false,
    error: dbError,
  });
  return { value: null, source: "none", resolved_name: name };
}

/** Convenience: just the value (or null). Backwards-compatible. */
export async function getCredential(
  name: string,
  serviceClient?: SupabaseClient | null,
): Promise<string | null> {
  const { value } = await resolveCredential(name, serviceClient);
  return value;
}

/**
 * Resolve many credentials with **single SQL round-trip** (vs N round-trips
 * em `Promise.all(resolveCredential)`). Estratégia:
 *
 *   1. Separa nomes em "cached" (TTL válido) vs "missing".
 *   2. Para os missing, faz UMA query `WHERE secret_name IN (...)` retornando
 *      todos os valores DB de uma vez. Popula cache em bulk.
 *   3. Para qualquer ainda não resolvido, faz fallback Deno.env.get síncrono.
 *
 * Benchmark esperado: 6 credenciais cold path → 1 query (~30ms) em vez de
 * 6 queries paralelas (~6×80ms cada em isolate frio). Reduz contenção do
 * connection pool do PgBouncer.
 *
 * Bug P1-05 da auditoria 24/05/2026: logs mostravam 8+ requests/segundo a
 * integration_credentials, todas mesma key, indicando que isolates frios
 * estavam disparando N queries individuais em cascata.
 */
export async function resolveCredentials(
  names: string[],
  serviceClient?: SupabaseClient | null,
): Promise<Record<string, CredentialResolution>> {  const startedAt = Date.now();
  const result: Record<string, CredentialResolution> = {};
  const missing: string[] = [];

  // 1) Cache lookup pass
  for (const name of names) {
    const cached = CACHE.get(name);
    if (cached && cached.expires_at > startedAt) {
      const duration = Date.now() - startedAt;
      recordResolution({
        name,
        source: cached.source,
        duration_ms: duration,
        cached: true,
        expired_before: false,
      });
      result[name] = { value: cached.value, source: cached.source, resolved_name: name };
    } else {
      missing.push(name);
    }
  }

  if (missing.length === 0) return result;

  // 2) Bulk DB fetch para os missing
  const client = serviceClient ?? getInternalServiceClient();
  const dbHits = new Set<string>();

  if (client) {
    try {
      const { data, error } = await client
        .from("integration_credentials")
        .select("secret_name, secret_value")
        .in("secret_name", missing);

      if (!error && Array.isArray(data)) {
        for (const row of data) {
          const name = row.secret_name as string;
          const value = row.secret_value as string | null;
          if (!value) continue;
          const now = Date.now();
          CACHE.set(name, { value, source: "db", expires_at: now + TTL_MS, stored_at: now });
          const duration = Date.now() - startedAt;
          recordResolution({
            name,
            source: "db",
            duration_ms: duration,
            cached: false,
            expired_before: false,
          });
          logResolution({
            event: "credential_resolved",
            name,
            resolved_name: name,
            source: "db",
            has_value: true,
            value_length: value.length,
            cached: false,
            duration_ms: duration,
            via_alias: false,
            bulk: true,
          });
          result[name] = { value, source: "db", resolved_name: name };
          dbHits.add(name);
        }
      } else if (error) {
        console.error("[credentials] bulk DB fetch failed:", error.message);
      }
    } catch (err) {
      console.error("[credentials] bulk fetch threw:", err);
    }
  }

  // 3) Fallback env (e aliases) para o que ainda falta
  for (const name of missing) {
    if (dbHits.has(name)) continue;
    // Reaproveita o caminho single-name que já trata env + ALIASES + cache miss
    result[name] = await resolveCredential(name, serviceClient);
  }

  return result;
}

/**
 * Pre-aquece o cache para uma lista de credenciais no boot do isolate.
 *
 * Uso típico (top-level da edge function, antes do serve()):
 *   await warmupCredentials([
 *     "EXTERNAL_PROMOBRIND_URL",
 *     "EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY",
 *   ]);
 *
 * Idempotente; não bloqueia em erro (loga e segue, fallback acontece no
 * primeiro request real). Garante 1 query DB por cold start em vez de N.
 *
 * Bug P1-05 da auditoria 24/05/2026.
 */
export async function warmupCredentials(
  names: readonly string[],
  serviceClient?: SupabaseClient | null,
): Promise<void> {
  if (names.length === 0) return;
  try {
    await resolveCredentials([...names], serviceClient);
  } catch (err) {
    console.warn("[credentials] warmup failed (non-fatal):", err);
  }
}
