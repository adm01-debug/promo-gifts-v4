import { createClient, SupabaseClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { handleCorsPreflight } from "../_shared/cors.ts";
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

// --- Implementations ---

class DatabaseChecker implements HealthChecker {
  name = "database";
  
  async check(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL") || "",
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || ""
      );
      const { error } = await supabase.from("profiles").select("id").limit(1);
      
      return {
        status: error ? "degraded" : "healthy",
        latency_ms: Date.now() - start,
        ...(error && { error: error.message }),
      };
    } catch (e) {
      return { 
        status: "unhealthy", 
        error: (e as Error).message,
        latency_ms: Date.now() - start 
      };
    }
  }
}

class ExternalDatabaseChecker implements HealthChecker {
  name = "external_db";

  async check(): Promise<CheckResult> {
    const start = Date.now();
    try {
      const url = await getCredential('EXTERNAL_PROMOBRIND_URL');
      const key = await getCredential('EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY');
      
      if (!url || !key) {
        return { status: "skipped", error: "No credentials" };
      }

      const client = createClient(url, key);
      // Alterado de 'produto' para 'products' para refletir o schema real
      const { error } = await client.from("products").select("id").limit(1);
      
      return {
        status: error ? "degraded" : "healthy",
        latency_ms: Date.now() - start,
        ...(error && { error: error.message }),
      };
    } catch (e) {
      return { 
        status: "unhealthy", 
        error: (e as Error).message,
        latency_ms: Date.now() - start 
      };
    }
  }
}

// --- Main Handler ---

Deno.serve(async (req) => {
  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: "health-check", requestId, req });

  // Handle CORS
  const preflight = handleCorsPreflight(req, { public: true });
  if (preflight) return preflight;

  const start = Date.now();
  const checkers: HealthChecker[] = [
    new DatabaseChecker(),
    new ExternalDatabaseChecker(),
  ];

  const results: Record<string, CheckResult> = {};
  
  // Run all checks in parallel
  await Promise.all(
    checkers.map(async (checker) => {
      results[checker.name] = await checker.check();
    })
  );

  // Compute aggregate status
  const statuses = Object.values(results).map((r) => r.status);
  let overall: HealthStatus = "healthy";
  
  if (statuses.some((s) => s === "unhealthy")) {
    overall = "unhealthy";
  } else if (statuses.some((s) => s === "degraded")) {
    overall = "degraded";
  }

  const responseBody = {
    status: overall,
    timestamp: new Date().toISOString(),
    total_latency_ms: Date.now() - start,
    checks: results,
    request_id: requestId,
  };

  log.info(overall === "healthy" ? "health_ok" : "health_degraded", responseBody);

  return log.respond(
    new Response(JSON.stringify(responseBody), {
      status: overall === "unhealthy" ? 503 : 200,
      headers: { "Content-Type": "application/json" },
    })
  );
});
