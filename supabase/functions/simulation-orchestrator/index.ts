import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const startTime = performance.now();

  try {
    const { count = 100, targetFunctions = ["external-db-bridge", "webhook-inbound", "product-webhook"] } = await req.json();
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const report = {
      totalScenarios: 0,
      successes: 0,
      failures: 0,
      details: [] as any[],
      startTime: new Date().toISOString(),
      endTime: "",
      consistencyChecks: { passed: 0, failed: 0 },
    };

    // 1. Setup Simulation Data
    const { data: simEndpoint } = await supabase
      .from("inbound_webhook_endpoints")
      .select("id, slug")
      .eq("slug", "simulation-test")
      .maybeSingle();
      
    let endpointId = simEndpoint?.id;
    if (!simEndpoint) {
      const { data: newEndpoint, error } = await supabase.from("inbound_webhook_endpoints").insert({
        slug: "simulation-test",
        name: "Simulation Test Endpoint",
        active: true,
        source_system: "simulation",
        hmac_secret_ref: "SUPABASE_SERVICE_ROLE_KEY",
        created_by: "7b565451-7eb6-4063-a74b-8ce4dca8703d",
        allowed_events: ["test"]
      }).select("id").single();
      if (error) throw new Error(`Setup failed: ${error.message}`);
      endpointId = newEndpoint.id;
    }

    const runScenario = async (fnName: string, payload: any, expectedStatuses: number[], extraHeaders = {}) => {
      const url = `${supabaseUrl}/functions/v1/${fnName}`;
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
        
        if (success) {
          report.successes++;
        } else {
          report.failures++;
          if (report.details.length < 50) {
             report.details.push({ fnName, status, error: await res.text().catch(() => "N/A") });
          }
        }
        report.totalScenarios++;
        return { status, success };
      } catch (err) {
        report.failures++;
        report.totalScenarios++;
        return { success: false, error: String(err) };
      }
    };

    const TABLES = ["products", "categories", "suppliers", "brands", "quotes"];
    const OPERATORS = ["gte", "lte", "gt", "lt", "neq", "like", "ilike"];

    const batchSize = 25;
    for (let i = 0; i < count; i += batchSize) {
      const promises = [];
      const currentBatch = Math.min(batchSize, count - i);
      
      for (let j = 0; j < currentBatch; j++) {
        // Bridge scenarios
        if (targetFunctions.includes("external-db-bridge")) {
          const table = TABLES[Math.floor(Math.random() * TABLES.length)];
          const op = OPERATORS[Math.floor(Math.random() * OPERATORS.length)];
          promises.push(runScenario("external-db-bridge", {
            operation: "select", table, filters: { [`id_${op}`]: "123" }, limit: 5
          }, [200, 404, 400, 401]));
        }

        // Webhook scenarios with consistency check
        if (targetFunctions.includes("webhook-inbound")) {
          const testEventId = `sim-event-${crypto.randomUUID()}`;
          promises.push((async () => {
            const result = await runScenario("webhook-inbound?slug=simulation-test", { 
              event: "test", id: testEventId 
            }, [200, 401]);
            
            if (result.success && result.status === 200) {
              // Quick consistency check: was it recorded?
              const { data } = await supabase.from("inbound_webhook_events")
                .select("id")
                .eq("endpoint_id", endpointId)
                .contains("payload", { id: testEventId })
                .maybeSingle();
              if (data) report.consistencyChecks.passed++;
              else report.consistencyChecks.failed++;
            }
          })());
        }

        // Product Webhook scenarios
        if (targetFunctions.includes("product-webhook")) {
          promises.push(runScenario("product-webhook", {
            action: "update",
            product: { id: "test", price: Math.random() * 100 }
          }, [200, 400, 401, 422]));
        }
      }
      
      await Promise.all(promises);
      
      // Stop if timeout is approaching (45s)
      if (performance.now() - startTime > 45000) break;
    }

    report.endTime = new Date().toISOString();

    return new Response(JSON.stringify(report), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 400,
    });
  }
});
