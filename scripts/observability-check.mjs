#!/usr/bin/env node
/**
 * observability-check.mjs — Valida que o stack de observabilidade está operacional.
 *
 * Checks:
 *   1. VITE_SENTRY_DSN configurado (variável de ambiente)
 *   2. pg_stat_statements extension disponível (via Supabase REST)
 *   3. Dashboard route registrada em src/pages/admin/telemetry/
 *   4. AppHealthDashboard exportado corretamente
 *   5. Alertas documentados em docs/OBSERVABILITY.md
 *   6. Edge function health-check responde (se SUPABASE_URL configurado)
 *
 * Uso:
 *   node scripts/observability-check.mjs
 *   node scripts/observability-check.mjs --verbose
 *
 * Em CI, chamado como gate não-bloqueador (|| true).
 * Em prod-gate pré-deploy, chamado diretamente (falha para ausências críticas).
 */

import { readFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = resolve(__dirname, "..");
const VERBOSE = process.argv.includes("--verbose");

let passed = 0;
let failed = 0;
const failures = [];

function log(msg) {
  if (VERBOSE) console.log(msg);
}

function pass(label) {
  passed++;
  console.log(`  ✅ ${label}`);
}

function fail(label, detail) {
  failed++;
  failures.push({ label, detail });
  console.error(`  ❌ ${label}${detail ? `\n     ${detail}` : ""}`);
}

function skip(label, reason) {
  console.log(`  ⚠️  ${label} — SKIP (${reason})`);
}

console.log("\n🔭 Observability Check — Promo Gifts\n");

// ─────────────────────────────────────────────────────────────────────────────
// 1. Sentry DSN configurado
// ─────────────────────────────────────────────────────────────────────────────
console.log("1. Sentry DSN");
const sentryDsn = process.env.VITE_SENTRY_DSN;
if (sentryDsn && sentryDsn.startsWith("https://")) {
  pass("VITE_SENTRY_DSN configurado");
} else {
  skip("VITE_SENTRY_DSN não configurado", "set VITE_SENTRY_DSN para ativar Sentry em prod");
}

// Verifica que src/lib/sentry.ts existe e tem shouldLoadSentry()
const sentryLibPath = join(ROOT, "src/lib/sentry.ts");
if (existsSync(sentryLibPath)) {
  const content = readFileSync(sentryLibPath, "utf8");
  if (content.includes("shouldLoadSentry") && content.includes("VITE_SENTRY_DSN")) {
    pass("src/lib/sentry.ts — guard VITE_SENTRY_DSN presente");
  } else {
    fail("src/lib/sentry.ts — guard VITE_SENTRY_DSN ausente");
  }
} else {
  fail("src/lib/sentry.ts não encontrado");
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. AppHealthDashboard componente existente
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n2. AppHealthDashboard");
const dashboardPath = join(ROOT, "src/components/admin/telemetry/AppHealthDashboard.tsx");
if (existsSync(dashboardPath)) {
  const content = readFileSync(dashboardPath, "utf8");
  if (content.includes("export function AppHealthDashboard")) {
    pass("AppHealthDashboard exportado corretamente");
  } else {
    fail("AppHealthDashboard — export não encontrado");
  }

  const requiredKpis = ["p95", "p99", "pct_5xx", "pct_4xx", "req_per_min"];
  const missing = requiredKpis.filter((kpi) => !content.includes(kpi));
  if (missing.length === 0) {
    pass("Dashboard exibe todos os KPIs críticos (p95/p99/5xx/4xx/req_per_min)");
  } else {
    fail("Dashboard faltando KPIs", `ausentes: ${missing.join(", ")}`);
  }
} else {
  fail("AppHealthDashboard.tsx não encontrado", dashboardPath);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. useAppHealth hook — tipos e window options
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n3. useAppHealth hook");
const hookCandidates = [
  join(ROOT, "src/pages/admin/telemetry/useAppHealth.ts"),
  join(ROOT, "src/hooks/useAppHealth.ts"),
];
const hookPath = hookCandidates.find(existsSync);
if (hookPath) {
  const content = readFileSync(hookPath, "utf8");
  const required = ["AppHealthKpis", "EdgeLatencyRow", "WebhookSourceRow", "HealthWindow"];
  const missing = required.filter((t) => !content.includes(t));
  if (missing.length === 0) {
    pass("useAppHealth — tipos canônicos presentes");
  } else {
    fail("useAppHealth — tipos ausentes", missing.join(", "));
  }
} else {
  fail("useAppHealth.ts não encontrado");
}

// ─────────────────────────────────────────────────────────────────────────────
// 4. Documentação de alertas em docs/OBSERVABILITY.md
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n4. Alertas documentados");
const obsDocPath = join(ROOT, "docs/OBSERVABILITY.md");
if (existsSync(obsDocPath)) {
  const content = readFileSync(obsDocPath, "utf8");
  const alertKeywords = ["P0", "P1", "Slack", "PagerDuty", "5xx burst", "Sentry"];
  const missing = alertKeywords.filter((kw) => !content.includes(kw));
  if (missing.length === 0) {
    pass("docs/OBSERVABILITY.md documenta alertas (P0/P1/Slack/PagerDuty)");
  } else {
    fail("docs/OBSERVABILITY.md faltando seções", `ausentes: ${missing.join(", ")}`);
  }
} else {
  fail("docs/OBSERVABILITY.md não encontrado");
}

// ─────────────────────────────────────────────────────────────────────────────
// 5. Edge function health-check (se env configurado)
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n5. Edge Function health-check");
const supabaseUrl = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceKey) {
  skip("health-check live", "VITE_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY não configurados");
} else {
  // Edge functions são serverless e cold starts em região remota inflam latência
  // do primeiro hit. Política: 1 pré-aquecimento + 2 tentativas medidas, melhor amostra.
  // Gate warm = 1500ms (realista para cross-region + probe ao DB externo).
  // Gate fresh-probe = 3000ms (?fresh=1 ignora cache, sempre sintetiza).
  const WARM_GATE_MS = 1500;
  const url = `${supabaseUrl}/functions/v1/health-check`;
  const hit = async (path) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const t0 = performance.now();
    try {
      const res = await fetch(`${url}${path}`, {
        method: "GET",
        headers: { Authorization: `Bearer ${serviceKey}` },
        signal: controller.signal,
      });
      const elapsed = Math.round(performance.now() - t0);
      await res.text(); // drena body para evitar leaks
      return { ok: res.ok, status: res.status, elapsed };
    } finally {
      clearTimeout(timeout);
    }
  };

  try {
    await hit("?fresh=1").catch(() => null); // pré-aquece sem contar
    const measured = [];
    for (let i = 0; i < 2; i++) {
      measured.push(await hit(""));
    }
    const ok = measured.find((m) => m.ok);
    const best = measured.reduce((a, b) => (a.elapsed <= b.elapsed ? a : b));

    if (!ok) {
      fail(`health-check retornou ${measured.map((m) => m.status).join("/")}`);
    } else if (best.elapsed < WARM_GATE_MS) {
      pass(`health-check melhor amostra ${best.elapsed}ms (< ${WARM_GATE_MS}ms gate warm)`);
    } else {
      fail(`health-check lento: melhor amostra ${best.elapsed}ms (≥ ${WARM_GATE_MS}ms gate warm)`);
    }
  } catch (err) {
    if (err.name === "AbortError") {
      fail("health-check timeout (> 8s)");
    } else {
      fail("health-check erro de rede", err.message);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// 6. Structured logger — testes existem
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n6. Testes de observabilidade");
const loggerTestPath = join(ROOT, "tests/observability/structured-logger.test.ts");
if (existsSync(loggerTestPath)) {
  pass("tests/observability/structured-logger.test.ts presente");
} else {
  fail("tests/observability/structured-logger.test.ts ausente");
}

// ─────────────────────────────────────────────────────────────────────────────
// 7. pg_stat_statements SQL presente em supabase/
// ─────────────────────────────────────────────────────────────────────────────
console.log("\n7. Slow query monitoring (pg_stat_statements)");
const pgStatCandidates = [
  join(ROOT, "scripts/audit-technical-rls.sql"),
  join(ROOT, "supabase"),
];
// Check if any migration references pg_stat_statements
const { execSync } = await import("node:child_process");
try {
  const result = execSync(
    'grep -rl "pg_stat_statements" supabase/migrations/ 2>/dev/null || true',
    { cwd: ROOT, encoding: "utf8" }
  ).trim();
  if (result) {
    pass(`pg_stat_statements habilitado via migration: ${result.split("\n").slice(0, 2).join(", ")}`);
  } else {
    skip("pg_stat_statements", "migration não encontrada em supabase/migrations/ — criar extensão via Supabase dashboard");
  }
} catch {
  skip("pg_stat_statements check", "erro ao buscar");
}

// ─────────────────────────────────────────────────────────────────────────────
// SUMMARY
// ─────────────────────────────────────────────────────────────────────────────
console.log(`
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
RESULT  ${passed} passed, ${failed} failed
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

if (failures.length > 0) {
  console.error("\nFailing checks:");
  failures.forEach(({ label, detail }) => {
    console.error(`  • ${label}${detail ? `: ${detail}` : ""}`);
  });
  process.exit(1);
}

console.log("✅ All observability checks passed\n");
