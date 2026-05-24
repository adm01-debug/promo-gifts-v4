import * as dotenv from 'dotenv';
dotenv.config();

// SEC-005: SERVICE_ROLE_KEY vem APENAS de env (mesma estratégia do
// scripts/contract-testing.mjs após SEC-001). Antes estava hardcoded
// (UUID de simulação, mas gitleaks reclamava + risco de virar credencial real).
// Set: export SUPABASE_TEST_BYPASS_TOKEN=<token-de-simulacao>
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(/\/+$/, '');
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_TEST_BYPASS_TOKEN ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.error(
    '[massive-load-test] erro: defina SUPABASE_URL ou VITE_SUPABASE_URL em .env',
  );
  process.exit(1);
}

if (!SERVICE_ROLE_KEY) {
  console.error(
    '[massive-load-test] erro: defina SUPABASE_TEST_BYPASS_TOKEN ou SUPABASE_SERVICE_ROLE_KEY em .env',
  );
  process.exit(1);
}

const CONCURRENCY = 5;
const TOTAL_REQUESTS = 25;

async function runLoadTest() {
  console.log(`🚀 Iniciando Teste de Carga (CONCURRENCY=${CONCURRENCY}, TOTAL=${TOTAL_REQUESTS})...`);
  
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

  const chunks = [];
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
