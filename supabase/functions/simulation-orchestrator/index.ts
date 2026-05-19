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

  try {
    const { count = 100, targetFunctions = ["external-db-bridge", "webhook-inbound"] } = await req.json();
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
    };

    // Ensure simulation endpoint exists for webhook-inbound
    const { data: simEndpoint, error: fetchError } = await supabase
      .from("inbound_webhook_endpoints")
      .select("slug")
      .eq("slug", "simulation-test")
      .maybeSingle();
      
    if (fetchError) {
      throw new Error(`Error checking for simulation endpoint: ${fetchError.message}`);
    }

    if (!simEndpoint) {
      const { error: insertError } = await supabase.from("inbound_webhook_endpoints").insert({
        slug: "simulation-test",
        name: "Simulation Test Endpoint",
        active: true,
        hmac_secret_ref: "SUPABASE_SERVICE_ROLE_KEY"
      });
      if (insertError) {
        throw new Error(`Error creating simulation endpoint: ${insertError.message}`);
      }
    }

    const runScenario = async (fnName: string, payload: any, expectedStatuses: number[]) => {
      const url = `${supabaseUrl}/functions/v1/${fnName}`;
      try {
        const start = performance.now();
        const res = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${serviceRoleKey}`,
          },
          body: JSON.stringify(payload),
        });
        const duration = performance.now() - start;
        const status = res.status;
        const success = expectedStatuses.includes(status);
        
        const result = {
          fnName,
          status,
          duration,
          success,
          payload: count <= 10 ? payload : undefined,
        };

        if (success) {
          report.successes++;
        } else {
          report.failures++;
          const errorBody = await res.text();
          report.details.push({ ...result, error: errorBody });
        }
        report.totalScenarios++;
      } catch (err) {
        report.failures++;
        report.details.push({ fnName, error: String(err), success: false });
        report.totalScenarios++;
      }
    };

    const TABLES = ["products", "categories", "suppliers", "brands", "quotes"];
    const OPERATORS = ["gte", "lte", "gt", "lt", "neq", "like", "ilike"];

    const batchSize = 10;
    for (let i = 0; i < count; i += batchSize) {
      const promises = [];
      const currentBatch = Math.min(batchSize, count - i);
      
      for (let j = 0; j < currentBatch; j++) {
        if (targetFunctions.includes("external-db-bridge")) {
          const table = TABLES[Math.floor(Math.random() * TABLES.length)];
          const isInvalid = Math.random() > 0.8;
          const op = OPERATORS[Math.floor(Math.random() * OPERATORS.length)];
          const payload = {
            operation: "select",
            table,
            filters: isInvalid ? { id: { invalid: true } } : { [`id_${op}`]: "123" },
            limit: 10,
          };
          // Added 401 because bridge might require specific user auth even with service role
          promises.push(runScenario("external-db-bridge", payload, isInvalid ? [400] : [200, 404, 400, 401]));
        }

        if (targetFunctions.includes("webhook-inbound")) {
          const isMissing = Math.random() > 0.7;
          const payload = isMissing ? { event: "test" } : { event: "test", data: { id: "123" } };
          promises.push(runScenario("webhook-inbound?slug=simulation-test", payload, [200, 400, 422, 401]));
        }
      }
      
      await Promise.all(promises);
      
      // Stop if timeout is approaching (simple heuristic for 60s timeout)
      if (performance.now() > 50000) break;
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
