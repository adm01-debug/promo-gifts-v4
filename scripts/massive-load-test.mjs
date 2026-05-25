import { existsSync, readFileSync } from 'node:fs';

function loadDotEnvIfPresent() {
  if (!existsSync('.env')) return;
  for (const line of readFileSync('.env', 'utf8').split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed
      .slice(eq + 1)
      .trim()
      .replace(/^['"]|['"]$/g, '');
    process.env[key] ??= value;
  }
}

loadDotEnvIfPresent();

// SEC-005: SERVICE_ROLE_KEY vem APENAS de env (mesma estratégia do
// scripts/contract-testing.mjs após SEC-001). Antes estava hardcoded
// (UUID de simulação, mas gitleaks reclamava + risco de virar credencial real).
// Set: export SUPABASE_TEST_BYPASS_TOKEN=<token-de-simulacao>
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').replace(
  /\/+$/,
  '',
);
const SERVICE_ROLE_KEY =
  process.env.SUPABASE_TEST_BYPASS_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL) {
  console.log('[massive-load-test] credenciais ausentes. Pulando teste de carga real.');
  process.exit(0);
}

if (!SERVICE_ROLE_KEY) {
  console.log('[massive-load-test] token ausente. Pulando teste de carga real.');
  process.exit(0);
}

const CONCURRENCY = 5;
const TOTAL_REQUESTS = 25;

async function runLoadTest() {
  console.log(
    `🚀 Iniciando Teste de Carga (CONCURRENCY=${CONCURRENCY}, TOTAL=${TOTAL_REQUESTS})...`,
  );

  const startTime = Date.now();
  let completed = 0;
  let failed = 0;
  const latencies = [];

  const endpoints = [
    `${SUPABASE_URL}/functions/v1/external-db-bridge`,
    `${SUPABASE_URL}/functions/v1/cnpj-lookup`,
  ];

  async function makeRequest() {
    const endpoint = endpoints[Math.floor(Math.random() * endpoints.length)];
    const reqStart = Date.now();
    try {
      const body = endpoint.includes('bridge')
        ? { operation: 'select', table: 'products', limit: 1 }
        : { cnpj: '00.000.000/0001-91' };

      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
        },
        body: JSON.stringify(body),
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
    const batch = Array(Math.min(CONCURRENCY, TOTAL_REQUESTS - i))
      .fill(null)
      .map(() => makeRequest());
    await Promise.all(batch);
    process.stdout.write('.');
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
    console.error('❌ Taxa de falha muito alta!');
    process.exit(1);
  }
}

runLoadTest().catch(console.error);
