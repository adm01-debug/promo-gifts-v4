import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCorsPreflight, buildPublicCorsHeaders } from "../_shared/cors.ts";
import { getOrCreateRequestId } from "../_shared/request-id.ts";
import { createStructuredLogger } from "../_shared/structured-logger.ts";
import { getCredential } from "../_shared/credentials.ts";

// --- Types ---

type HealthStatus = "healthy" | "degraded" | "unhealthy" | "skipped";

interface CheckResult {
  status: HealthStatus;
  latency_ms?: number;
  error?: string;
}

interface HealthChecker {
  name: string;
  check(): Promise<CheckResult>;
}

// --- Singletons (hoisted out of handler so warm invocations skip client construction) ---

let internalClient: SupabaseClient | null = null;
function getInternalClient(): SupabaseClient {
  if (!internalClient) {
    internalClient = createClient(
      Deno.env.get("SUPABASE_URL") || "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "",
      { auth: { persistSession: false, autoRefreshToken: false } },
    );
  }
  return internalClient;
}

let externalClientPromise: Promise<SupabaseClient | null> | null = null;
function getExternalClient(): Promise<SupabaseClient | null> {
  if (!externalClientPromise) {
    externalClientPromise = (async () => {
      const [url, key] = await Promise.all([
        getCredential("EXTERNAL_PROMOBRIND_URL"),
        getCredential("EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY"),
      ]);
      if (!url || !key) return null;
      return createClient(url, key, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
    })();
  }
  return externalClientPromise;
}

// Per-check timeout: gate is 500ms total; cap each probe to keep the worst case bounded.
const PROBE_TIMEOUT_MS = 1500;

async function withTimeout<T>(p: Promise<T>, ms: number, label: string): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`${label} timeout after ${ms}ms`)), ms),
    ),
  ]);
}

// --- Implementations ---

class DatabaseChecker implements HealthChecker {
  name = "database";

  async check(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const supabase = getInternalClient();
      const { error } = await withTimeout(
        supabase.from("profiles").select("id").limit(1),
        PROBE_TIMEOUT_MS,
        "database",
      );
      return {
        status: error ? "degraded" : "healthy",
        latency_ms: Date.now() - start,
        ...(error && { error: error.message }),
      };
    } catch (e) {
      return {
        status: "unhealthy",
        error: (e as Error).message,
        latency_ms: Date.now() - start,
      };
    }
  }
}

class ExternalDatabaseChecker implements HealthChecker {
  name = "external_db";

  async check(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const client = await getExternalClient();
      if (!client) return { status: "skipped", error: "No credentials" };

      const { error } = await withTimeout(
        client.from("products").select("id").limit(1),
        PROBE_TIMEOUT_MS,
        "external_db",
      );
      return {
        status: error ? "degraded" : "healthy",
        latency_ms: Date.now() - start,
        ...(error && { error: error.message }),
      };
    } catch (e) {
      return {
        status: "unhealthy",
        error: (e as Error).message,
        latency_ms: Date.now() - start,
      };
    }
  }
}

// --- Main Handler ---

const CHECKERS: HealthChecker[] = [new DatabaseChecker(), new ExternalDatabaseChecker()];

// Result cache: probe at most every CACHE_TTL_MS; otherwise serve last snapshot.
// Keeps warm responses well under the 500ms gate while still surfacing real
// outages within 10s. Force a fresh probe with ?fresh=1 (for ops debugging).
const CACHE_TTL_MS = 10_000;
interface Snapshot {
  status: HealthStatus;
  results: Record<string, CheckResult>;
  probedAt: number;
}
let lastSnapshot: Snapshot | null = null;
let inflight: Promise<Snapshot> | null = null;

async function runProbes(): Promise<Snapshot> {
  const results: Record<string, CheckResult> = {};
  await Promise.all(
    CHECKERS.map(async (checker) => {
      results[checker.name] = await checker.check();
    }),
  );
  const statuses = Object.values(results).map((r) => r.status);
  let status: HealthStatus = "healthy";
  if (statuses.some((s) => s === "unhealthy")) status = "unhealthy";
  else if (statuses.some((s) => s === "degraded")) status = "degraded";
  const snap: Snapshot = { status, results, probedAt: Date.now() };
  lastSnapshot = snap;
  return snap;
}

async function getSnapshot(force: boolean): Promise<Snapshot> {
  const fresh = lastSnapshot && Date.now() - lastSnapshot.probedAt < CACHE_TTL_MS;
  if (!force && fresh && lastSnapshot) return lastSnapshot;
  if (!inflight) {
    inflight = runProbes().finally(() => {
      inflight = null;
    });
  }
  return await inflight;
}

Deno.serve(async (req) => {
  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: "health-check", requestId, req });

  const preflight = handleCorsPreflight(req, { public: true });
  if (preflight) return preflight;

  const corsHeaders = {
    ...buildPublicCorsHeaders(),
    "Content-Type": "application/json",
    "X-Health-Version": "1.3.0",
  };

  const start = Date.now();
  const url = new URL(req.url);
  const force = url.searchParams.get("fresh") === "1";
  const snap = await getSnapshot(force);
  const cached = !force && Date.now() - snap.probedAt > 50;

  const responseBody = {
    status: snap.status,
    timestamp: new Date().toISOString(),
    total_latency_ms: Date.now() - start,
    cached,
    cache_age_ms: Date.now() - snap.probedAt,
    checks: snap.results,
    request_id: requestId,
  };

  log.info(snap.status === "healthy" ? "health_ok" : "health_degraded", responseBody);

  return log.respond(
    new Response(JSON.stringify(responseBody), {
      status: snap.status === "unhealthy" ? 503 : 200,
      headers: corsHeaders,
    }),
  );
});
