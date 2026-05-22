import * as dotenv from 'dotenv';
dotenv.config();

// Fail-fast on missing env: silently falling back to a hardcoded URL once
// caused this script to point at an obsolete Supabase project for months.
// Define no .env (raiz do repo) ou exporte antes de rodar.
const SUPABASE_URL = process.env.SUPABASE_URL;
if (!SUPABASE_URL) {
  console.error("❌ SUPABASE_URL não definida.");
  console.error("   Defina no .env (raiz do repo) ou exporte antes de rodar:");
  console.error("   export SUPABASE_URL=https://doufsxqlfjyuvxuezpln.supabase.co");
  process.exit(2);
}

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;
if (!SERVICE_ROLE_KEY) {
  console.error("❌ SUPABASE_SERVICE_ROLE_KEY (ou SUPABASE_ANON_KEY) não definida.");
  console.error("   Defina no .env (raiz do repo) ou exporte antes de rodar.");
  process.exit(2);
}

const CONCURRENCY = 5;
const TOTAL_REQUESTS = 25;

async function runLoadTest() {
  console.log(`🚀 Iniciando Teste de Carga (CONCURRENCY=${CONCURRENCY}, TOTAL=${TOTAL_REQUESTS})...`);
  console.log(`🎯 Alvo: ${SUPABASE_URL}`);

  const startTime = Date.now();
  let completed = 0;
  let failed = 0;
  const latencies = [];

  const endpoints = [
    `${SUPABASE_URL}/functions/v1/external-db-bridge`,
    `${SUPABASE_URL}/functions/v1/cnpj-lookup`
  ];

  async function makeRequest() {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const reqStart = Date.now();
    try {
      const body = endpoint.includes('bridge')
        ? { operation: "select", table: "products", limit: 1 }
        : { cnpj: "00.000.000/0001-91" };

      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify(body)
      });

      const latency = Date.now() - reqStart;
      latencies.push(latency);

      if (res.ok) {
        completed++;
      } else {
        failed++;
        // console.error(`Error ${res.status}: ${await res.text()}`);
      }
    } catch (err) {
      failed++;
      // console.error(err);
    }
  }

  for (let i = 0; i < TOTAL_REQUESTS; i += CONCURRENCY) {
    const batch = Array(Math.min(CONCURRENCY, TOTAL_REQUESTS - i)).fill(null).map(() => makeRequest());
    await Promise.all(batch);
    process.stdout.write(".");
  }

  const totalTime = Date.now() - startTime;
  const avgLatency = latencies.reduce((a, b) => a + b, 0) / latencies.length;
  const p95 = latencies.sort((a, b) => a - b)[Math.floor(latencies.length * 0.95)];

  console.log(`\n\n--- RELATÓRIO DE CARGA ---`);
  console.log(`Tempo Total: ${totalTime}ms`);
  console.log(`Requests: ${completed} OK / ${failed} FAILED`);
  console.log(`Latência Média: ${avgLatency.toFixed(2)}ms`);
  console.log(`P95 Latência: ${p95}ms`);
  console.log(`Throughput: ${((completed + failed) / (totalTime / 1000)).toFixed(2)} req/s`);
  console.log(`---------------------------\n`);

  if (failed > TOTAL_REQUESTS * 0.1) {
    console.error("❌ Taxa de falha muito alta!");
    process.exit(1);
  }
}

runLoadTest().catch(console.error);
