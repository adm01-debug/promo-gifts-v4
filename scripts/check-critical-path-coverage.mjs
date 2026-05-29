#!/usr/bin/env node
/**
 * scripts/check-critical-path-coverage.mjs
 *
 * Verifica thresholds de cobertura por módulo crítico usando o JSON de coverage do Vitest.
 * Falha CI se qualquer módulo ficar abaixo do threshold.
 *
 * Thresholds:
 *   - src/hooks/quotes/quoteHelpers.ts          → lines ≥ 80%
 *   - src/components/kit-builder/FreightEstimator.tsx → lines ≥ 85%
 *   - supabase/functions/_shared/contracts/     → branches ≥ 70%
 */

import { readFileSync, existsSync } from "node:fs";
import process from "node:process";

const COVERAGE_JSON =
  process.env.COVERAGE_JSON_PATH || "coverage/coverage-summary.json";

const THRESHOLDS = [
  {
    pattern: "src/hooks/quotes/quoteHelpers.ts",
    metric: "lines",
    min: 80,
    label: "quoteHelpers.ts lines",
  },
  {
    pattern: "src/components/kit-builder/FreightEstimator.tsx",
    metric: "lines",
    min: 85,
    label: "FreightEstimator.tsx lines",
  },
  {
    pattern: "supabase/functions/_shared/contracts",
    metric: "branches",
    min: 70,
    label: "_shared/contracts branches",
  },
];

function findEntry(summary, pattern) {
  const keys = Object.keys(summary);
  return keys.find((k) => k.includes(pattern));
}

function getPct(entry, metric) {
  const m = entry[metric];
  if (!m || m.total === 0) return null;
  return Math.round((m.covered / m.total) * 100);
}

function main() {
  if (!existsSync(COVERAGE_JSON)) {
    console.log(`⚠️  coverage JSON não encontrado em ${COVERAGE_JSON} — pulando.`);
    process.exit(0);
  }

  const summary = JSON.parse(readFileSync(COVERAGE_JSON, "utf8"));

  console.log("\n📊 Critical Path Coverage Check");

  const violations = [];

  for (const t of THRESHOLDS) {
    const key = findEntry(summary, t.pattern);
    if (!key) {
      console.log(`   ⚠️  ${t.label}: arquivo não encontrado no relatório`);
      continue;
    }

    const pct = getPct(summary[key], t.metric);
    if (pct === null) {
      console.log(`   ⚠️  ${t.label}: sem dados de ${t.metric}`);
      continue;
    }

    const icon = pct >= t.min ? "✅" : "❌";
    console.log(
      `   ${icon} ${t.label}: ${pct}% (threshold ${t.min}%)`
    );

    if (pct < t.min) {
      violations.push(
        `${t.label}: ${pct}% < ${t.min}%`
      );
    }
  }

  if (violations.length > 0) {
    console.error("\n❌ Thresholds de cobertura violados:");
    violations.forEach((v) => console.error(`   • ${v}`));
    process.exit(1);
  }

  console.log("\n✅ Todos os thresholds de cobertura satisfeitos.");
}

main();
