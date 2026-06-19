import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";
import { parseContract } from "../_shared/contracts/index.ts";
import {
  SimulationOrchestratorSchemas,
} from "../_shared/contracts/schemas/simulation-orchestrator.ts";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import { getCredential } from "../_shared/credentials.ts";
import { createStructuredLogger } from '../_shared/structured-logger.ts';
import { getOrCreateRequestId } from '../_shared/request-id.ts';

const corsHeaders = buildPublicCorsHeaders();

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return encodeHex(new Uint8Array(sig));
}

function generateFuzzedPayload(type: string) {
  const fuzzedStrings = [
    "' OR '1'='1", 
    "<script>alert(1)</script>", 
    "A".repeat(10000), 
    null, 
    12345, 
    {}, 
    "undefined", 
    "\0", 
    "NaN", 
    "-1"
  ];
  const item = fuzzedStrings[Math.floor(Math.random() * fuzzedStrings.length)];
  
  if (type === "product") {
    return { sku: item, name: item, price: typeof item === 'number' ? item : -1 };
  }
  if (type === "webhook") {
    return { event: item, id: crypto.randomUUID(), data: { fuzzed: item } };
  }
  return { [String(item)]: item };
}

Deno.serve(async (req) => {
  const __reqId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: 'simulation-orchestrator', requestId: __reqId, req });
  log.info('request_start');
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const startTime = performance.now();

  try {
    const contractResult = await parseContract(req, SimulationOrchestratorSchemas, {
      corsHeaders,
    });
    if (!contractResult.ok) return contractResult.response;
    const { data: parsedBody, responseHeaders } = contractResult;
    const count = parsedBody.count ?? 100;
    const targetFunctions = parsedBody.targetFunctions ?? ["external-db-bridge", "webhook-inbound", "product-webhook"];
    const mode = parsedBody.mode ?? "resilience";

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const n8nSecret = await getCredential("N8N_PRODUCT_WEBHOOK_SECRET") ?? "sim-secret";
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const { data: run } = await supabase
      .from("simulation_runs")
      .insert({ mode, status: "running" })
      .select()
      .single();

    const report = {
      id: run?.id,
      totalScenarios: 0,
      successes: 0,
      failures: 0,
      details: [] as any[],
      startTime: new Date().toISOString(),
      endTime: "",
      consistencyChecks: { passed: 0, failed: 0 },
      latencies: [] as number[],
      pendingLogs: [] as any[],
    };

    const { data: simEndpoint } = await supabase
      .from("inbound_webhook_endpoints")
      .select("id")
      .eq("slug", "simulation-test")
      .maybeSingle();
      
    const endpointId = simEndpoint?.id;

    const runScenario = async (fnName: string, payload: any, expectedStatuses: number[], extraHeaders = {}) => {
      const url = `${supabaseUrl}/functions/v1/${fnName}`;
      const callStart = performance.now();
      try {
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
            ...extraHeaders
          },
          body: JSON.stringify(payload),
        });
        const status = res.status;
        const success = expectedStatuses.includes(status);
        const latency = performance.now() - callStart;
        report.latencies.push(latency);
        
        if (run?.id) {
          report.pendingLogs.push({
            run_id: run.id,
            fn_name: fnName,
            status_code: status,
            payload: payload,
            latency_ms: latency,
            error_message: !success ? await res.clone().text().catch(() => "N/A") : null
          });
        }

        if (success) {
          report.successes++;
        } else {
          report.failures++;
          if (report.details.length < 50) {
             const errorBody = await res.text().catch(() => "N/A");
             report.details.push({ fnName, status, error: errorBody, payload: JSON.stringify(payload).substring(0, 150) });
          }
        }
        report.totalScenarios++;
        return { status, success, payload };
      } catch (err) {
        report.failures++;
        report.totalScenarios++;
        if (run?.id) {
          report.pendingLogs.push({
            run_id: run.id,
            fn_name: fnName,
            error_message: String(err),
            payload: payload
          });
        }
        return { success: false, error: String(err) };
      }
    };

    const batchSize = mode === "load" ? 50 : 20;
    const finalCount = mode === "load" ? Math.max(count, 500) : count;

    for (let i = 0; i < finalCount; i += batchSize) {
      const promises = [];
      const currentBatch = Math.min(batchSize, finalCount - i);
      
      for (let j = 0; j < currentBatch; j++) {
        if (targetFunctions.includes("external-db-bridge")) {
          const payload = mode === "fuzzing" ? generateFuzzedPayload("bridge") : { operation: "select", table: "products", limit: 1 };
          promises.push(runScenario("external-db-bridge", payload, [200, 400, 401, 404, 422]));
        }

        if (targetFunctions.includes("webhook-inbound")) {
          promises.push((async () => {
            const payload = mode === "fuzzing" ? generateFuzzedPayload("webhook") : { event: "simulation", id: `sim-${crypto.randomUUID()}` };
            const signature = "sha256=" + await hmacSign(JSON.stringify(payload), serviceRoleKey);
            
            const result = await runScenario("webhook-inbound?slug=simulation-test", payload, [200, 400, 401, 422], {
              "x-signature-256": signature
            });
            
            if (result.success && result.status === 200 && endpointId && mode !== "fuzzing") {
              await new Promise(r => setTimeout(r, 50));
              const { data } = await supabase.from("inbound_webhook_events")
                .select("id")
                .eq("endpoint_id", endpointId)
                .contains("payload", { id: payload.id })
                .maybeSingle();
              if (data) report.consistencyChecks.passed++;
              else report.consistencyChecks.failed++;
            }
            
            if (mode === "fuzzing") {
              const maliciousPayloads = [{ id: "not-a-uuid" }, { id: null }];
              for (const p of maliciousPayloads) {
                await runScenario("webhook-inbound", p, [400, 422]);
              }
            }
          })());
        }

        if (targetFunctions.includes("product-webhook")) {
          const payload = mode === "fuzzing" ? 
            { action: "upsert", product: generateFuzzedPayload("product") } : 
            { action: "upsert", product: { sku: `SIM-${crypto.randomUUID().substring(0,8)}`, name: "Simulation", price: 99.99 } };
            
          promises.push(runScenario("product-webhook", payload, [200, 400, 422, 500], {
            "x-webhook-secret": n8nSecret
          }));
        }
      }
      
      await Promise.all(promises);
      if (report.pendingLogs.length > 0) {
        await supabase.from("simulation_logs").insert(report.pendingLogs);
        report.pendingLogs = [];
      }
      if (performance.now() - startTime > 55000) break;
    }

    report.endTime = new Date().toISOString();
    
    if (run?.id) {
      const sortedLatencies = [...report.latencies].sort((a, b) => a - b);
      const p50 = sortedLatencies[Math.floor(sortedLatencies.length * 0.5)] || 0;
      const avg = report.latencies.reduce((a, b) => a + b, 0) / (report.latencies.length || 1);

      await supabase.from("simulation_runs").update({
        status: "completed",
        total_scenarios: report.totalScenarios,
        successes: report.successes,
        failures: report.failures,
        avg_latency_ms: avg,
        p50_latency_ms: p50,
        metadata: { consistency: report.consistencyChecks }
      }).eq("id", run.id);
    }
    
    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, ...responseHeaders, "Content-Type": "application/json", "X-Request-Id": __reqId },
      status: 200,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    return new Response(JSON.stringify({ error: errorMessage }), {
      headers: { ...corsHeaders, "Content-Type": "application/json", "X-Request-Id": __reqId },
      status: 400,
    });
  }
});