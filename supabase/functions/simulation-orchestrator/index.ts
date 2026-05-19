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
          payload: count <= 10 ? payload : undefined, // Only log payload for small runs
        };

        if (success) {
          report.successes++;
        } else {
          report.failures++;
          report.details.push({ ...result, error: await res.text() });
        }
        report.totalScenarios++;
      } catch (err) {
        report.failures++;
        report.details.push({ fnName, error: String(err), success: false });
        report.totalScenarios++;
      }
    };

    // Ensure simulation endpoint exists for webhook-inbound
    const { data: simEndpoint } = await supabase
      .from("inbound_webhook_endpoints")
      .select("slug")
      .eq("slug", "simulation-test")
      .maybeSingle();
      
    if (!simEndpoint) {
      await supabase.from("inbound_webhook_endpoints").insert({
        slug: "simulation-test",
        name: "Simulation Test Endpoint",
        active: true,
        hmac_secret_ref: "SUPABASE_SERVICE_ROLE_KEY" // Just a dummy for simulation
      });
    }

    // Scenario Generation Logic
    const TABLES = ["products", "categories", "suppliers", "brands", "quotes"];
    const OPERATORS = ["gte", "lte", "gt", "lt", "neq", "like", "ilike"];

    const promises = [];
    for (let i = 0; i < count; i++) {
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
        // Status 401 is expected if no auth, but here we pass service role, so it should be 200/404/400
        promises.push(runScenario("external-db-bridge", payload, isInvalid ? [400] : [200, 404, 400]));
      }

      if (targetFunctions.includes("webhook-inbound")) {
        const isMissing = Math.random() > 0.7;
        const payload = isMissing ? { event: "test" } : { event: "test", data: { id: "123" } };
        // We use the slug we just ensured exists
        promises.push(runScenario("webhook-inbound?slug=simulation-test", payload, [200, 400, 422, 401]));
      }
      
      // Batch processing to avoid overwhelming the system
      if (promises.length >= 20) {
        await Promise.all(promises);
        promises.length = 0;
      }
    }

    if (promises.length > 0) {
      await Promise.all(promises);
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
