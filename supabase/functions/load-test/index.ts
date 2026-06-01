import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/cors.ts";
import { createStructuredLogger } from "../_shared/structured-logger.ts";
import { getOrCreateRequestId } from "../_shared/request-id.ts";

/**
 * Load test to simulate thousands of webhook events and concurrent requests.
 * Tracks intermittent errors and bottlenecks.
 */

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  const requestId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: "load-test", requestId, req });

  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const parsed = await req.json().catch(() => ({}));
    // Guard: if body is null/array/primitive, fall back to empty object so
    // destructuring doesn't throw a TypeError.
    const safeBody = (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed))
      ? (parsed as Record<string, unknown>)
      : {};
    const {
      concurrency = 10,
      totalRequests = 100,
      targetEndpoint = "/health-check",
      method = "GET",
      body = null,
      headers = {},
      useIdempotency = false
    } = safeBody as {
      concurrency?: number;
      totalRequests?: number;
      targetEndpoint?: string;
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
      useIdempotency?: boolean;
    };

    const baseUrl = Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", ".supabase.co/functions/v1");
    const targetUrl = targetEndpoint.startsWith("http") ? targetEndpoint : `${baseUrl}${targetEndpoint}`;

    log.info('load-test starting', { totalRequests, method, targetUrl, concurrency, useIdempotency });

    let successCount = 0;
    let errorCount = 0;
    let duplicateCount = 0;
    const latencies: number[] = [];
    const errorsByStatus: Record<string, number> = {};
    const errorDetails: any[] = [];

    const runBatch = async (batchSize: number) => {
      const promises = Array.from({ length: batchSize }).map(async (_, idx) => {
        const start = performance.now();
        const requestId = crypto.randomUUID();
        // Se usar idempotência e for a mesma "chave" (ex: em webhooks), simulamos reenvio
        const idempotencyKey = useIdempotency ? `load-test-${Math.floor(idx / 2)}` : crypto.randomUUID();
        
        try {
          const fetchOptions: RequestInit = {
            method,
            headers: {
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
              "Content-Type": "application/json",
              "X-Request-Id": requestId,
              "X-Internal-Call": "true",
              "X-Idempotency-Key": idempotencyKey,
              ...headers,
            },
          };

          if (method !== "GET" && method !== "HEAD" && body) {
            fetchOptions.body = typeof body === "string" ? body : JSON.stringify(body);
          }

          const res = await fetch(targetUrl, fetchOptions);
          const end = performance.now();
          latencies.push(end - start);

          const responseText = await res.text().catch(() => "");
          const isDuplicate = responseText.includes("Already processed");

          if (res.ok) {
            successCount++;
            if (isDuplicate) duplicateCount++;
          } else {
            errorCount++;
            const status = res.status.toString();
            errorsByStatus[status] = (errorsByStatus[status] || 0) + 1;
            if (errorDetails.length < 10) {
              errorDetails.push({ 
                requestId, 
                status: res.status, 
                text: responseText.slice(0, 100)
              });
            }
          }
        } catch (e) {
          errorCount++;
          const errMsg = (e as Error).message;
          errorsByStatus["EXCEPTION"] = (errorsByStatus["EXCEPTION"] || 0) + 1;
          if (errorDetails.length < 10) {
            errorDetails.push({ requestId, error: errMsg });
          }
        }
      });
      await Promise.all(promises);
    };

    // Sequential batches to respect concurrency
    for (let i = 0; i < totalRequests; i += concurrency) {
      const batchSize = Math.min(concurrency, totalRequests - i);
      await runBatch(batchSize);
    }

    const avgLatency = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const sortedLatencies = [...latencies].sort((a, b) => a - b);
    const p95Latency = sortedLatencies.length > 0 ? sortedLatencies[Math.floor(sortedLatencies.length * 0.95)] : 0;
    const p99Latency = sortedLatencies.length > 0 ? sortedLatencies[Math.floor(sortedLatencies.length * 0.99)] : 0;

    const results = {
      target: { url: targetUrl, method },
      stats: {
        totalRequests,
        successCount,
        errorCount,
        duplicateCount,
        successRate: `${((successCount / totalRequests) * 100).toFixed(2)}%`,
      },
      performanceMs: {
        avg: avgLatency.toFixed(2),
        p95: p95Latency.toFixed(2),
        p99: p99Latency.toFixed(2),
      },
      errorsByStatus,
      sampleErrors: errorDetails,
    };

    console.log(`[load-test] Completed: ${successCount} OK (${duplicateCount} dupes), ${errorCount} ERR. Avg: ${avgLatency.toFixed(2)}ms`);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    console.error(`[load-test] Fatal error:`, error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});