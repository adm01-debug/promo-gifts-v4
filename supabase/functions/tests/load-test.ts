// supabase/functions/tests/load-test.ts
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CONCURRENCY = 50;
const TOTAL_REQUESTS = 500; 


async function runLoadTest(name: string, path: string, method = "GET", body: any = null, headers: any = {}) {
  console.log(`\n🚀 Stress test: ${name} (${TOTAL_REQUESTS} req, c=${CONCURRENCY})`);
  
  const start = performance.now();
  let success = 0;
  let failure = 0;
  let status401 = 0;
  const latencies: number[] = [];
  let firstResponseBody = "";

  const workers = Array.from({ length: CONCURRENCY }).map(async (_, workerId) => {
    for (let i = 0; i < TOTAL_REQUESTS / CONCURRENCY; i++) {
      const reqStart = performance.now();
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "X-Internal-Call": "true",
            ...headers
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        
        const text = await res.text();
        if (i === 0 && workerId === 0) firstResponseBody = text;
        
        latencies.push(performance.now() - reqStart);

        if (res.status === 200 || res.status === 201 || res.status === 204) {
          success++;
        } else if (res.status === 401) {
          status401++;
        } else {
          failure++;
        }
      } catch (e) {
        failure++;
      }
    }
  });

  await Promise.all(workers);
  const totalTime = performance.now() - start;
  
  const avg = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  console.log(`✅ ${name}: ${success} OK, ${status401} 401, ${failure} Fail. Avg: ${avg.toFixed(0)}ms`);
  if (status401 > 0) console.log(`   Sample Error Body: ${firstResponseBody}`);
}

await runLoadTest("health-check", "/health-check");
await runLoadTest("validate-access", "/validate-access", "POST", { ip: "127.0.0.1" });
await runLoadTest("materials-api", "/materials-api", "POST", { action: "groups" });
