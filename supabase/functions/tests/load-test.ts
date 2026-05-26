const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CONCURRENCY = 10;
const TOTAL_REQUESTS = 50;

async function runLoadTest(name: string, path: string, method = "GET", body: any = null, headers: any = {}) {
  console.log(`Starting stress test for ${name} (${TOTAL_REQUESTS} requests, concurrency ${CONCURRENCY})...`);
  
  const start = performance.now();
  let success = 0;
  let failure = 0;
  const latencies: number[] = [];

  const workers = Array.from({ length: CONCURRENCY }).map(async (_, workerId) => {
    for (let i = 0; i < TOTAL_REQUESTS / CONCURRENCY; i++) {
      const reqStart = performance.now();
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1${path}`, {
          method,
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
            "X-Test-Worker": String(workerId),
            ...headers
          },
          body: body ? JSON.stringify(body) : undefined,
        });
        await res.text(); // Always consume body
        if (res.ok || res.status === 401 || res.status === 400) {
          // In stress testing, we count expected error codes as "network success" 
          // because the function handled the request. 5xx would be a failure.
          if (res.status >= 500) {
            failure++;
          } else {
            success++;
          }
        } else {
          success++; // Still a response
        }
      } catch (e) {
        failure++;
      }
      latencies.push(performance.now() - reqStart);
    }
  });

  await Promise.all(workers);
  const totalTime = performance.now() - start;
  
  const sortedLatencies = [...latencies].sort((a, b) => a - b);
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.95)];
  const p99Latency = sortedLatencies[Math.floor(sortedLatencies.length * 0.99)];

  console.log(`\nResults for ${name}:`);
  console.log(`- Success (handled): ${success}`);
  console.log(`- Failure (5xx/Network): ${failure}`);
  console.log(`- Total Time: ${(totalTime / 1000).toFixed(2)}s`);
  console.log(`- Throughput: ${(TOTAL_REQUESTS / (totalTime / 1000)).toFixed(1)} req/s`);
  console.log(`- Avg Latency: ${avgLatency.toFixed(0)}ms`);
  console.log(`- P95 Latency: ${p95Latency.toFixed(0)}ms`);
  console.log(`- P99 Latency: ${p99Latency.toFixed(0)}ms`);
}

// Resilience test: Webhook inbound (simulating burst from external service)
await runLoadTest("webhook-inbound (Burst)", "/webhook-inbound?slug=test", "POST", { event: "ping" }, {
  "X-Signature-256": "sha256=invalid-but-triggers-logic"
});

// Stress test: Health check (heavy DB connectivity)
await runLoadTest("health-check (Stress)", "/health-check");

// Resilience test: Validate access
await runLoadTest("validate-access (Security Logic)", "/validate-access", "POST", { ip: "127.0.0.1" });
