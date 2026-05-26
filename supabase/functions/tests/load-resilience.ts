
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const WEBHOOK_SLUG = "test-automated";
const WEBHOOK_SECRET = Deno.env.get("SIMULATION_BYPASS_KEY") || SERVICE_KEY;
const CONCURRENCY = 50;
const TOTAL_WEBHOOKS = 100; 
const TOTAL_QUERY_REQ = 1000; 


async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(payload));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

async function runWebhookLoad() {
  console.log(`\n🚀 Webhook Load Test: ${TOTAL_WEBHOOKS} events, c=${CONCURRENCY}`);
  const start = performance.now();
  let success = 0;
  let failure = 0;
  const latencies: number[] = [];

  const workers = Array.from({ length: CONCURRENCY }).map(async () => {
    for (let i = 0; i < TOTAL_WEBHOOKS / CONCURRENCY; i++) {
      const payload = JSON.stringify({
        event: "test.event",
        occurred_at: new Date().toISOString(),
        data: { id: crypto.randomUUID(), value: Math.random() }
      });
      const signature = await hmacSign(payload, WEBHOOK_SECRET);
      
      const reqStart = performance.now();
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/webhook-inbound?slug=${WEBHOOK_SLUG}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-signature-256": `sha256=${signature}`,
            "accept-version": "2",
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
            "X-Internal-Call": "true",
            "Authorization": `Bearer ${SERVICE_KEY}`
          },
          body: payload,
        });
        
        latencies.push(performance.now() - reqStart);
        if (res.status === 200 || res.status === 201) {
          success++;
        } else {
          failure++;
          if (success === 0 && failure === 1) {
             const errorBody = await res.text();
             console.log(`First error body: ${res.status} - ${errorBody}`);
          }
        }
      } catch {
        failure++;
      }
    }
  });

  await Promise.all(workers);
  const duration = performance.now() - start;
  const avg = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  console.log(`🏁 Webhook Results: ${success} OK, ${failure} Fail. Avg Latency: ${avg.toFixed(0)}ms. Total Duration: ${duration.toFixed(0)}ms`);
}

async function runQueryLoad(table: string) {
  console.log(`\n🚀 PostgREST Load Test: ${table}, ${TOTAL_QUERY_REQ} req, c=${CONCURRENCY}`);
  const start = performance.now();
  let success = 0;
  let failure = 0;
  const latencies: number[] = [];

  const workers = Array.from({ length: CONCURRENCY }).map(async () => {
    for (let i = 0; i < TOTAL_QUERY_REQ / CONCURRENCY; i++) {
      const reqStart = performance.now();
      try {
        const res = await fetch(`${SUPABASE_URL}/rest/v1/${table}?limit=10`, {
          headers: {
            "apikey": SERVICE_KEY,
            "Authorization": `Bearer ${SERVICE_KEY}`
          }
        });
        
        latencies.push(performance.now() - reqStart);
        if (res.status === 200) {
          success++;
        } else {
          failure++;
        }
      } catch {
        failure++;
      }
    }
  });

  await Promise.all(workers);
  const duration = performance.now() - start;
  const avg = latencies.length ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
  console.log(`🏁 ${table} Results: ${success} OK, ${failure} Fail. Avg Latency: ${avg.toFixed(0)}ms`);
}

console.log("Starting Load & Resilience Tests...");
await runWebhookLoad();
await runQueryLoad("order_items");
await runQueryLoad("admin_audit_log");
await runQueryLoad("user_roles");
console.log("\n✅ Resilience tests completed.");
