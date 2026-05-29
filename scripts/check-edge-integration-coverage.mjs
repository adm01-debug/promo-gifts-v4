#!/usr/bin/env node
/**
 * scripts/check-edge-integration-coverage.mjs
 *
 * Verifica que cada Edge Function pública tem ao menos um arquivo de
 * "client contract test" em tests/edge-functions/integration/ que
 * referencia seu nome (via fetch mock).
 *
 * Atenção: esses testes verificam contratos de resposta (status, headers,
 * shape), não executam o código real da função. Para cobertura de código real,
 * use `supabase functions serve` + testes contra localhost.
 *
 * Falha CI se a porcentagem de funções com contrato cair abaixo do threshold
 * (padrão 60%, ajustável via EDGE_COVERAGE_THRESHOLD).
 */

import { readdirSync, readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import process from "node:process";

const THRESHOLD = Number(process.env.EDGE_COVERAGE_THRESHOLD) || 60;
const FUNCTIONS_DIR = "supabase/functions";
const TESTS_DIR = "tests/edge-functions/integration";

function listEdgeFunctions() {
  if (!existsSync(FUNCTIONS_DIR)) return [];
  return readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !d.name.startsWith("_"))
    .map((d) => d.name);
}

function loadTestFiles() {
  if (!existsSync(TESTS_DIR)) return [];
  return readdirSync(TESTS_DIR, { withFileTypes: true })
    .filter((f) => f.isFile() && f.name.endsWith(".test.ts"))
    .map((f) => readFileSync(join(TESTS_DIR, f.name), "utf8"));
}

function isFunctionCovered(fnName, testContents) {
  return testContents.some(
    (content) =>
      content.includes(`/${fnName}`) ||
      content.includes(`"${fnName}"`) ||
      content.includes(`'${fnName}'`)
  );
}

function main() {
  const functions = listEdgeFunctions();
  const testContents = loadTestFiles();

  if (functions.length === 0) {
    console.log("⚠️  Nenhuma Edge Function encontrada em", FUNCTIONS_DIR);
    process.exit(0);
  }

  const covered = [];
  const uncovered = [];

  for (const fn of functions) {
    if (isFunctionCovered(fn, testContents)) {
      covered.push(fn);
    } else {
      uncovered.push(fn);
    }
  }

  const pct = Math.round((covered.length / functions.length) * 100);

  console.log(`\n📊 Edge Function Integration Coverage`);
  console.log(`   Total de funções:   ${functions.length}`);
  console.log(`   Cobertas:           ${covered.length} (${pct}%)`);
  console.log(`   Sem testes:         ${uncovered.length}`);
  console.log(`   Threshold:          ${THRESHOLD}%`);

  if (uncovered.length > 0) {
    console.log("\n⚠️  Funções sem cobertura de integração:");
    uncovered.forEach((fn) => console.log(`   - ${fn}`));
  }

  if (pct < THRESHOLD) {
    console.error(
      `\n❌ Cobertura ${pct}% < threshold ${THRESHOLD}%. Adicione testes de integração.`
    );
    process.exit(1);
  }

  console.log(`\n✅ Cobertura ${pct}% ≥ threshold ${THRESHOLD}%.`);
}

main();
