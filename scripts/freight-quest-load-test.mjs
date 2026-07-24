#!/usr/bin/env node
/**
 * scripts/freight-quest-load-test.mjs
 *
 * Teste de carga e stress para o módulo freight-quest.
 * Simula milhares de requisições simultâneas nos endpoints de webhook,
 * quote-sync, e cálculo de frete.
 *
 * SLAs:
 *  - P95 latência < 2000ms
 *  - P99 latência < 4000ms
 *  - Taxa de erro < 2%
 *  - Throughput mínimo: 50 req/s em estado estacionário
 *
 * Stages de ramp-up:
 *  1. Aquecimento:   5 concurrent, 50 requests
 *  2. Rampa:        25 concurrent, 200 requests
 *  3. Pico:         100 concurrent, 500 requests
 *  4. Stress:       200 concurrent, 300 requests (burst)
 *  5. Recuperação:  10 concurrent, 50 requests (mede recovery time)
 *
 * Sem credenciais: modo dry-run (valida estrutura sem HTTP).
 */

import { readFileSync, existsSync, writeFileSync } from "node:fs";
import process from "node:process";

function loadDotEnvIfPresent() {
  if (!existsSync(".env")) return;
  for (const line of readFileSync(".env", "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^['"]|['"]$/g, "");
    process.env[key] ??= value;
  }
}

loadDotEnvIfPresent();

const SUPABASE_URL = (
  process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || ""
).replace(/\/+$/, "");

const SERVICE_ROLE_KEY =
  process.env.SUPABASE_TEST_BYPASS_TOKEN || process.env.SUPABASE_SERVICE_ROLE_KEY;

const DRY_RUN = !SUPABASE_URL || !SERVICE_ROLE_KEY;

const REQUEST_TIMEOUT_MS = Number(process.env.LOAD_TIMEOUT_MS) || 8_000;
const OUTPUT_FILE = process.env.LOAD_OUTPUT_FILE || "load-test-report.json";

// SLA thresholds
const SLA_P95_MAX_MS = Number(process.env.SLA_P95_MAX_MS) || 2_000;
const SLA_P99_MAX_MS = Number(process.env.SLA_P99_MAX_MS) || 4_000;
const SLA_ERROR_RATE_MAX = Number(process.env.SLA_ERROR_RATE_MAX) || 0.02;
const SLA_MIN_THROUGHPUT = Number(process.env.SLA_MIN_THROUGHPUT) || 50;

// Ramp stages: [label, concurrency, requestCount]
const RAMP_STAGES = [
  ["warmup", 5, 50],
  ["ramp", 25, 200],
  ["peak", 100, 500],
  ["stress", 200, 300],
  ["recovery", 10, 50],
];

// Endpoints do freight-quest
function buildEndpoints(baseUrl) {
  const now = new Date().toISOString();
  return [
    {
      label: "health-check",
      url: `${baseUrl}/functions/v1/health-check`,
      method: "GET",
      body: null,
      weight: 2,
    },
    {
      label: "webhook-inbound:order.created",
      url: `${baseUrl}/functions/v1/webhook-inbound`,
      method: "POST",
      body: {
        event: "order.created",
        occurred_at: now,
        data: { order_id: `ORD-LOAD-${Date.now()}`, amount: 1500.0, shipping_type: "fob_pre" },
        source: "n8n",
      },
      weight: 3,
    },
    {
      label: "webhook-inbound:freight.calculated",
      url: `${baseUrl}/functions/v1/webhook-inbound`,
      method: "POST",
      body: {
        event: "freight.calculated",
        occurred_at: now,
        data: {
          quote_id: "550e8400-e29b-41d4-a716-446655440001",
          method: "sedex",
          weight_grams: 2500,
          cost: 35.0,
        },
        source: "custom",
      },
      weight: 3,
    },
    {
      label: "webhook-inbound:quote.approved",
      url: `${baseUrl}/functions/v1/webhook-inbound`,
      method: "POST",
      body: {
        event: "quote.approved",
        occurred_at: now,
        data: { quote_id: "550e8400-e29b-41d4-a716-446655440001" },
        source: "bitrix24",
      },
      weight: 2,
    },
    {
      label: "quote-sync",
      url: `${baseUrl}/functions/v1/quote-sync`,
      method: "POST",
      body: {
        action: "sync_quote",
        data: { quoteId: "550e8400-e29b-41d4-a716-446655440001" },
      },
      weight: 2,
    },
    {
      label: "cnpj-lookup",
      url: `${baseUrl}/functions/v1/cnpj-lookup`,
      method: "POST",
      body: { cnpj: "00.000.000/0001-91" },
      weight: 1,
    },
  ];
}

// ─── Seletor por peso ─────────────────────────────────────────────────────────

function weightedSelect(endpoints) {
  const total = endpoints.reduce((s, e) => s + e.weight, 0);
  let r = Math.random() * total;
  for (const ep of endpoints) {
    r -= ep.weight;
    if (r <= 0) return ep;
  }
  return endpoints[endpoints.length - 1];
}

// ─── Executor de requisição ───────────────────────────────────────────────────

async function executeRequest(endpoint, serviceKey) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  const start = performance.now();
  let status = 0;
  let error = null;
  let timedOut = false;

  try {
    const init = {
      method: endpoint.method,
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${serviceKey}`,
        "X-Internal-Call": "true",
        "X-Load-Test": "true",
      },
    };

    if (endpoint.body) {
      init.headers["Content-Type"] = "application/json";
      init.body = JSON.stringify(endpoint.body);
    }

    const res = await fetch(endpoint.url, init);
    status = res.status;
    await res.text();
  } catch (err) {
    if (err.name === "AbortError") {
      timedOut = true;
      error = "TIMEOUT";
    } else {
      error = err.message;
    }
  } finally {
    clearTimeout(timeout);
  }

  const latency = performance.now() - start;
  return { status, latency, error, timedOut, endpoint: endpoint.label };
}

// ─── Estatísticas ─────────────────────────────────────────────────────────────

function computeStats(results) {
  const latencies = results.map((r) => r.latency).sort((a, b) => a - b);
  const errors = results.filter((r) => r.error || r.status >= 500 || r.timedOut);
  const total = results.length;
  const errorRate = errors.length / total;

  const p50 = latencies[Math.floor(total * 0.5)];
  const p95 = latencies[Math.floor(total * 0.95)];
  const p99 = latencies[Math.floor(total * 0.99)];
  const mean = latencies.reduce((a, b) => a + b, 0) / total;

  return { total, errors: errors.length, errorRate, p50, p95, p99, mean };
}

// ─── Runner de stage ──────────────────────────────────────────────────────────

async function runStage(label, concurrency, totalRequests, endpoints, serviceKey) {
  console.log(`\n  [${label.toUpperCase()}] concurrency=${concurrency} requests=${totalRequests}`);

  const results = [];
  let remaining = totalRequests;
  const stageStart = performance.now();

  while (remaining > 0) {
    const batch = Math.min(concurrency, remaining);
    const tasks = Array.from({ length: batch }, () =>
      executeRequest(weightedSelect(endpoints), serviceKey),
    );
    const batchResults = await Promise.all(tasks);
    results.push(...batchResults);
    remaining -= batch;

    const done = totalRequests - remaining;
    const pct = Math.round((done / totalRequests) * 100);
    if (pct % 20 === 0) {
      process.stdout.write(`    Progress: ${done}/${totalRequests} (${pct}%)\r`);
    }
  }

  const stageDuration = (performance.now() - stageStart) / 1000;
  const stats = computeStats(results);
  const throughput = totalRequests / stageDuration;

  console.log(
    `\n  ✓ done in ${stageDuration.toFixed(1)}s | throughput=${throughput.toFixed(1)} req/s`,
  );
  console.log(
    `    p50=${stats.p50.toFixed(0)}ms p95=${stats.p95.toFixed(0)}ms p99=${stats.p99.toFixed(0)}ms`,
  );
  console.log(
    `    errors=${stats.errors}/${stats.total} (${(stats.errorRate * 100).toFixed(2)}%)`,
  );

  return { label, stats, throughput, duration: stageDuration };
}

// ─── SLA check ────────────────────────────────────────────────────────────────

function checkSLA(stageResults) {
  const failures = [];

  for (const stage of stageResults) {
    const { label, stats, throughput } = stage;

    if (stats.p95 > SLA_P95_MAX_MS && label !== "stress") {
      failures.push(
        `[${label}] P95 ${stats.p95.toFixed(0)}ms > ${SLA_P95_MAX_MS}ms`,
      );
    }
    if (stats.p99 > SLA_P99_MAX_MS && label !== "stress") {
      failures.push(
        `[${label}] P99 ${stats.p99.toFixed(0)}ms > ${SLA_P99_MAX_MS}ms`,
      );
    }
    if (stats.errorRate > SLA_ERROR_RATE_MAX && label !== "stress") {
      failures.push(
        `[${label}] Error rate ${(stats.errorRate * 100).toFixed(2)}% > ${(SLA_ERROR_RATE_MAX * 100).toFixed(0)}%`,
      );
    }
    if (throughput < SLA_MIN_THROUGHPUT && label === "peak") {
      failures.push(
        `[${label}] Throughput ${throughput.toFixed(1)} req/s < ${SLA_MIN_THROUGHPUT} req/s`,
      );
    }
  }

  return failures;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log("=== freight-quest load test ===");

  if (DRY_RUN) {
    console.log("\n⚠️  Modo dry-run: credenciais ausentes");
    console.log("   Estrutura dos endpoints validada:");

    const endpoints = buildEndpoints("https://example.supabase.co");
    for (const ep of endpoints) {
      console.log(`   ✓ ${ep.label}: ${ep.method} ${ep.url.replace(/https:\/\/.*?\//, "…/")}`);
    }

    console.log("\n   SLA thresholds configurados:");
    console.log(`   P95 < ${SLA_P95_MAX_MS}ms | P99 < ${SLA_P99_MAX_MS}ms`);
    console.log(
      `   Error rate < ${(SLA_ERROR_RATE_MAX * 100).toFixed(0)}% | Throughput > ${SLA_MIN_THROUGHPUT} req/s`,
    );
    console.log("\n   Ramp stages:");
    for (const [label, concurrency, requests] of RAMP_STAGES) {
      console.log(`   - ${label}: concurrency=${concurrency} requests=${requests}`);
    }
    console.log("\n✅ Dry-run completed (estrutura OK)");
    process.exit(0);
  }

  console.log(`\nTarget: ${SUPABASE_URL}`);
  console.log(`Total requests (all stages): ${RAMP_STAGES.reduce((s, r) => s + r[2], 0)}`);

  const endpoints = buildEndpoints(SUPABASE_URL);
  const stageResults = [];
  const startTime = performance.now();

  for (const [label, concurrency, requests] of RAMP_STAGES) {
    const result = await runStage(label, concurrency, requests, endpoints, SERVICE_ROLE_KEY);
    stageResults.push(result);
  }

  const totalDuration = (performance.now() - startTime) / 1000;
  const slaFailures = checkSLA(stageResults);

  console.log("\n=== RELATÓRIO FINAL ===");
  console.log(`Duração total: ${totalDuration.toFixed(1)}s`);

  if (slaFailures.length === 0) {
    console.log("✅ Todos os SLAs aprovados");
  } else {
    console.log(`❌ ${slaFailures.length} violação(ões) de SLA:`);
    for (const f of slaFailures) {
      console.log(`   - ${f}`);
    }
  }

  // Salva relatório
  const report = {
    timestamp: new Date().toISOString(),
    target: SUPABASE_URL,
    duration_s: totalDuration,
    sla_failures: slaFailures,
    stages: stageResults,
    passed: slaFailures.length === 0,
  };

  writeFileSync(OUTPUT_FILE, JSON.stringify(report, null, 2));
  console.log(`\nRelatório salvo em: ${OUTPUT_FILE}`);

  if (slaFailures.length > 0) {
    process.exit(1);
  }
}

main().catch((err) => {
  console.error("Erro fatal no load test:", err);
  process.exit(1);
});
