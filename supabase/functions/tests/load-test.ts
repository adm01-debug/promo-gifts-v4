import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCorsHeaders } from "../_shared/cors.ts";

/**
 * Load test to simulate thousands of webhook events and concurrent requests.
 * Tracks intermittent errors and bottlenecks.
 */

Deno.serve(async (req: Request) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { concurrency = 10, totalRequests = 100, targetEndpoint = "/health-check" } = await req.json().catch(() => ({}));
    const baseUrl = Deno.env.get("SUPABASE_URL")!.replace(".supabase.co", ".supabase.co/functions/v1");
    const targetUrl = `${baseUrl}${targetEndpoint}`;

    console.log(`Starting load test: ${totalRequests} requests to ${targetEndpoint} with concurrency ${concurrency}`);

    let successCount = 0;
    let errorCount = 0;
    const latencies: number[] = [];
    const errors: any[] = [];

    const runBatch = async (batchSize: number) => {
      const promises = Array.from({ length: batchSize }).map(async () => {
        const start = Date.now();
        try {
          const res = await fetch(targetUrl, {
            method: "GET",
            headers: {
              "Authorization": `Bearer ${Deno.env.get("SUPABASE_ANON_KEY")}`,
              "X-Request-Id": crypto.randomUUID(),
            }
          });
          
          const end = Date.now();
          latencies.push(end - start);

          if (res.ok) {
            successCount++;
          } else {
            errorCount++;
            errors.push({ status: res.status, text: await res.text() });
          }
        } catch (e) {
          errorCount++;
          errors.push({ error: (e as Error).message });
        }
      });
      await Promise.all(promises);
    };

    for (let i = 0; i < totalRequests; i += concurrency) {
      const batchSize = Math.min(concurrency, totalRequests - i);
      await runBatch(batchSize);
    }

    const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
    const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

    const results = {
      totalRequests,
      successCount,
      errorCount,
      successRate: `${(successCount / totalRequests * 100).toFixed(2)}%`,
      avgLatencyMs: avgLatency.toFixed(2),
      p95LatencyMs: p95Latency,
      topErrors: errors.slice(0, 5),
    };

    console.log("Load test complete:", results);

    return new Response(JSON.stringify(results), {
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });

  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" }
    });
  }
});
