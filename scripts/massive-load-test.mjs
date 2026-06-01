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

const TOTAL_REQUESTS = Number(process.env.LOAD_TOTAL_REQUESTS) || 1_000;
const REQUEST_TIMEOUT_MS = 15_000;

// SLA thresholds
const SLA_P95_MAX_MS = 2_000;
const SLA_ERROR_RATE_MAX = 0.02;

// Ramp-up stages: [concurrency, requestCount]
const RAMP_STAGES = [
  [5,   50],
  [10,  100],
  [25,  200],
  [50,  300],
  [100, 350],
];

const ENDPOINTS = [
  {
    url: `${SUPABASE_URL}/functions/v1/health-check`,
    method: 'GET',
    body: null,
    weight: 3,
  },
  {
    url: `${SUPABASE_URL}/functions/v1/cnpj-lookup`,
    method: 'POST',
    body: { cnpj: '00.000.000/0001-91' },
    weight: 1,
  },
  {
    url: `${SUPABASE_URL}/functions/v1/webhook-inbound`,
    method: 'POST',
    body: {
      event: 'order.created',
      occurred_at: new Date().toISOString(),
      data: { order_id: 'load-test-ord', amount: 1.0 },
    },
    weight: 2,
  },
  {
    url: `${SUPABASE_URL}/functions/v1/rate-limit-check`,
    method: 'POST',
    body: { key: 'load-test:probe', limit: 100000, window_seconds: 60 },
    weight: 2,
  },
  {
    url: `${SUPABASE_URL}/functions/v1/external-db-bridge`,
    method: 'POST',
    body: { operation: 'select', table: 'products', limit: 1 },
    weight: 1,
  },
  {
    url: `${SUPABASE_URL}/functions/v1/quote-sync`,
    method: 'POST',
    body: { quote_id: '00000000-0000-0000-0000-000000000001', action: 'recalculate' },
    weight: 1,
  },
];

const weightedEndpoints = ENDPOINTS.flatMap((e) => Array(e.weight).fill(e));

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    Math.ceil((p / 100) * sorted.length) - 1,
    sorted.length - 1,
  );
  return sorted[idx];
}

async function makeRequest(endpoint) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  const reqStart = Date.now();
  try {
    const opts = {
      method: endpoint.method,
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      signal: ctrl.signal,
    };
    if (endpoint.body) opts.body = JSON.stringify(endpoint.body);
    const res = await fetch(endpoint.url, opts);
    clearTimeout(timer);
    return { latency: Date.now() - reqStart, ok: res.status < 500 };
  } catch {
    clearTimeout(timer);
    return { latency: Date.now() - reqStart, ok: false };
  }
}

async function runStage(concurrency, count, label) {
  const latencies = [];
  let ok = 0;
  let failed = 0;
  const queue = Array.from({ length: count }, () =>
    weightedEndpoints[Math.floor(Math.random() * weightedEndpoints.length)],
  );
  let qi = 0;
  await Promise.all(
    Array.from({ length: concurrency }, async () => {
      while (true) {
        const idx = qi++;
        if (idx >= queue.length) break;
        const r = await makeRequest(queue[idx]);
        latencies.push(r.latency);
        r.ok ? ok++ : failed++;
      }
    }),
  );
  process.stdout.write(` [${label}:${ok}ok/${failed}fail]`);
  return { latencies, ok, failed };
}

async function runLoadTest() {
  console.log(`🚀 Massive Load Test — ${TOTAL_REQUESTS} req, ramp-up 5→100 concorrentes`);
  console.log(`   Endpoints: ${ENDPOINTS.map((e) => e.url.split('/').pop()).join(', ')}`);

  const start = Date.now();
  const allLatencies = [];
  let totalOk = 0;
  let totalFailed = 0;

  process.stdout.write('Progresso:');

  for (const [concurrency, count] of RAMP_STAGES) {
    const { latencies, ok, failed } = await runStage(concurrency, count, `c${concurrency}`);
    allLatencies.push(...latencies);
    totalOk += ok;
    totalFailed += failed;
  }

  console.log('');

  const totalTime = Date.now() - start;
  const total = totalOk + totalFailed;
  const sorted = [...allLatencies].sort((a, b) => a - b);
  const errorRate = totalFailed / total;
  const throughput = total / (totalTime / 1000);

  console.log('\n\n--- RELATÓRIO DE CARGA ---');
  console.log(`Tempo Total:        ${totalTime}ms`);
  console.log(`Requests:           ${totalOk} OK / ${totalFailed} FAILED`);
  console.log(`Taxa de erro:       ${(errorRate * 100).toFixed(2)}%`);
  console.log(`Throughput:         ${throughput.toFixed(2)} req/s`);
  console.log(`Latência Média:     ${(allLatencies.reduce((a, b) => a + b, 0) / allLatencies.length).toFixed(2)}ms`);
  console.log(`P50:                ${percentile(sorted, 50)}ms`);
  console.log(`P90:                ${percentile(sorted, 90)}ms`);
  console.log(`P95:                ${percentile(sorted, 95)}ms`);
  console.log(`P99:                ${percentile(sorted, 99)}ms`);
  console.log('---------------------------\n');

  const violations = [];
  const p95 = percentile(sorted, 95);

  if (p95 > SLA_P95_MAX_MS) {
    violations.push(`P95 ${p95}ms > SLA ${SLA_P95_MAX_MS}ms`);
  }
  if (errorRate > SLA_ERROR_RATE_MAX) {
    violations.push(
      `Taxa de erro ${(errorRate * 100).toFixed(2)}% > SLA ${(SLA_ERROR_RATE_MAX * 100).toFixed(0)}%`,
    );
  }

  if (violations.length > 0) {
    console.error('❌ SLA VIOLATIONS:');
    violations.forEach((v) => console.error(`   • ${v}`));
    process.exit(1);
  }

  console.log('✅ Todos os SLAs satisfeitos.');
}

runLoadTest().catch((err) => {
  console.error('Load test falhou:', err);
  process.exit(1);
});
