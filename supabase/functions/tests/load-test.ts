import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CONCURRENCY = 50;
const TOTAL_REQUESTS = 500;

async function runLoadTest(name: string, path: string, method = "GET", body: any = null) {
  console.log(`Starting load test for ${name} (${TOTAL_REQUESTS} requests, concurrency ${CONCURRENCY})...`);
  
  const start = performance.now();
  let success = 0;
  let failure = 0;
  const latencies: number[] = [];

  const workers = Array.from({ length: CONCURRENCY }).map(async () => {
    for (let i = 0; i < TOTAL_REQUESTS / CONCURRENCY; i++) {
      const reqStart = performance.now();
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        await res.text();
        if (res.ok) {
          success++;
        } else {
          failure++;
        }
      } catch (e) {
        failure++;
      }
      latencies.push(performance.now() - reqStart);
    }
  });

  await Promise.all(workers);
  const totalTime = performance.now() - start;
  
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95Latency = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

  console.log(`\nResults for ${name}:`);
  console.log(`- Success: ${success}`);
  console.log(`- Failure: ${failure}`);
  console.log(`- Total Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`- Throughput: ${(success / (totalTime / 1000)).toFixed(1)} req/s`);
  console.log(`- Avg Latency: ${avgLatency.toFixed(0)}ms`);
  console.log(`- P95 Latency: ${p95Latency.toFixed(0)}ms`);
}

// Main execution
await runLoadTest("health-check", "/health-check");
await runLoadTest("validate-access", "/validate-access", "POST", { ip: "127.0.0.1" });
