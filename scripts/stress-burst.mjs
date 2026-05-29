#!/usr/bin/env node
/**
 * scripts/stress-burst.mjs
 *
 * Teste de stress burst: 200 requisições concorrentes por 5 segundos.
 * Mede degradação, tempo de recuperação e percentil de latência sob pico.
 *
 * Sem credenciais: modo dry-run (skip silencioso).
 *
 * SLA:
 *   - Taxa de erro durante burst < 10%
 *   - Recovery time < 5 000ms após burst
 *   - P99 durante burst < 8 000ms
 */

import { readFileSync, existsSync } from "node:fs";
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
  process.env.SUPABASE_TEST_BYPASS_TOKEN ||
  process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.log(
    "[stress-burst] credenciais ausentes. Pulando teste de stress burst."
  );
  process.exit(0);
}

const BURST_CONCURRENCY = Number(process.env.BURST_CONCURRENCY) || 200;
const BURST_DURATION_SECONDS = Number(process.env.BURST_DURATION_SECONDS) || 5;
const RECOVERY_PROBE_INTERVAL_MS = 500;
const RECOVERY_TIMEOUT_MS = 10_000;
const REQUEST_TIMEOUT_MS = 8_000;

const SLA_ERROR_RATE_MAX = 0.10;
const SLA_RECOVERY_MAX_MS = 5_000;
const SLA_P99_MAX_MS = 8_000;

const ENDPOINTS = [
  { url: `${SUPABASE_URL}/functions/v1/health-check`, method: "GET", body: null },
  {
    url: `${SUPABASE_URL}/functions/v1/rate-limit-check`,
    method: "POST",
    body: { key: "burst-test:probe", limit: 10000, window_seconds: 60 },
  },
  {
    url: `${SUPABASE_URL}/functions/v1/webhook-inbound`,
    method: "POST",
    body: {
      event: "order.created",
      occurred_at: new Date().toISOString(),
      data: { order_id: "burst-test-ord", amount: 1.0 },
    },
  },
];

function percentile(sorted, p) {
  if (sorted.length === 0) return 0;
  const idx = Math.min(
    Math.ceil((p / 100) * sorted.length) - 1,
    sorted.length - 1
  );
  return sorted[idx];
}

async function makeRequest(endpoint) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REQUEST_TIMEOUT_MS);
  const start = Date.now();

  try {
    const opts = {
      method: endpoint.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
      },
      signal: ctrl.signal,
    };
    if (endpoint.body) opts.body = JSON.stringify(endpoint.body);

    const res = await fetch(endpoint.url, opts);
    clearTimeout(timer);
    return { latency: Date.now() - start, ok: res.status < 500 };
  } catch {
    clearTimeout(timer);
    return { latency: Date.now() - start, ok: false, timedOut: true };
  }
}

async function runBurst() {
  console.log(
    `\n🔥 Stress Burst — ${BURST_CONCURRENCY} concorrentes por ${BURST_DURATION_SECONDS}s`
  );

  const allLatencies = [];
  let totalRequests = 0;
  let failed = 0;
  let timedOut = 0;

  const deadline = Date.now() + BURST_DURATION_SECONDS * 1000;

  const workers = Array.from({ length: BURST_CONCURRENCY }, async () => {
    while (Date.now() < deadline) {
      const endpoint = ENDPOINTS[Math.floor(Math.random() * ENDPOINTS.length)];
      const r = await makeRequest(endpoint);
      totalRequests++;
      allLatencies.push(r.latency);
      if (!r.ok) failed++;
      if (r.timedOut) timedOut++;
    }
  });

  await Promise.all(workers);

  const sorted = [...allLatencies].sort((a, b) => a - b);
  const errorRate = failed / totalRequests;
  const throughput = totalRequests / BURST_DURATION_SECONDS;

  console.log("\n--- BURST REPORT ---");
  console.log(`Duração: ${BURST_DURATION_SECONDS}s`);
  console.log(`Total requisições: ${totalRequests}`);
  console.log(`Falhas: ${failed} (${(errorRate * 100).toFixed(1)}%)`);
  console.log(`Timeouts: ${timedOut}`);
  console.log(`Throughput: ${throughput.toFixed(1)} req/s`);
  console.log(`P50: ${percentile(sorted, 50)}ms`);
  console.log(`P90: ${percentile(sorted, 90)}ms`);
  console.log(`P95: ${percentile(sorted, 95)}ms`);
  console.log(`P99: ${percentile(sorted, 99)}ms`);
  console.log(`Max: ${sorted[sorted.length - 1]}ms`);

  // ── Recovery probe ──────────────────────────────────────────────────────
  console.log("\n🔄 Medindo recovery time...");
  const recoveryStart = Date.now();
  let recovered = false;

  while (Date.now() - recoveryStart < RECOVERY_TIMEOUT_MS) {
    const probe = await makeRequest(ENDPOINTS[0]);
    if (probe.ok && probe.latency < 2000) {
      recovered = true;
      break;
    }
    await new Promise((r) => setTimeout(r, RECOVERY_PROBE_INTERVAL_MS));
  }

  const recoveryTime = Date.now() - recoveryStart;
  console.log(
    recovered
      ? `✅ Recuperado em ${recoveryTime}ms`
      : `⚠️  Não recuperou em ${RECOVERY_TIMEOUT_MS}ms`
  );

  // ── SLA violations ──────────────────────────────────────────────────────
  const violations = [];
  const p99 = percentile(sorted, 99);

  if (errorRate > SLA_ERROR_RATE_MAX) {
    violations.push(
      `Taxa de erro ${(errorRate * 100).toFixed(1)}% > SLA ${SLA_ERROR_RATE_MAX * 100}%`
    );
  }
  if (p99 > SLA_P99_MAX_MS) {
    violations.push(`P99 ${p99}ms > SLA ${SLA_P99_MAX_MS}ms`);
  }
  if (!recovered || recoveryTime > SLA_RECOVERY_MAX_MS) {
    violations.push(
      `Recovery time ${recoveryTime}ms > SLA ${SLA_RECOVERY_MAX_MS}ms`
    );
  }

  if (violations.length > 0) {
    console.error("\n❌ SLA VIOLATIONS:");
    violations.forEach((v) => console.error(`   • ${v}`));
    process.exit(1);
  } else {
    console.log("\n✅ Todos os SLAs de burst satisfeitos.");
  }
}

runBurst().catch((err) => {
  console.error("Stress burst falhou:", err);
  process.exit(1);
});
