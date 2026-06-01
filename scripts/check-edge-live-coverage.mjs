#!/usr/bin/env node
/**
 * scripts/check-edge-live-coverage.mjs
 *
 * Gate de CI: toda edge function deployada (supabase/functions/<fn>/index.ts)
 * precisa ter um teste de integração LIVE em tests/edge-functions/live/<fn>.test.ts.
 *
 * Falha (exit 1) listando as funções sem cobertura. Espelha a política do
 * scripts/check-edge-authorization.mjs (manifest ↔ função).
 *
 * Uso: node scripts/check-edge-live-coverage.mjs
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const FUNCTIONS_DIR = path.join(ROOT, "supabase/functions");
const LIVE_DIR = path.join(ROOT, "tests/edge-functions/live");
const EXCLUDE = new Set(["_shared", "tests"]);

const fns = fs
  .readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
  .filter((d) => d.isDirectory() && !EXCLUDE.has(d.name))
  .filter((d) => fs.existsSync(path.join(FUNCTIONS_DIR, d.name, "index.ts")))
  .map((d) => d.name)
  .sort();

const missing = fns.filter((fn) => !fs.existsSync(path.join(LIVE_DIR, `${fn}.test.ts`)));

if (missing.length > 0) {
  console.error(`❌ ${missing.length} edge function(s) sem teste LIVE em tests/edge-functions/live/:`);
  for (const m of missing) console.error(`   - ${m} (esperado: tests/edge-functions/live/${m}.test.ts)`);
  console.error(`\n   Rode: node scripts/gen-edge-live-tests.mjs`);
  process.exit(1);
}

console.log(`✅ Cobertura LIVE completa: ${fns.length}/${fns.length} edge functions têm teste em tests/edge-functions/live/.`);
