#!/usr/bin/env node
/**
 * scripts/gen-edge-live-tests.mjs
 *
 * Scaffold de um arquivo de teste de integração LIVE por edge function deployada:
 *   tests/edge-functions/live/<fn>.test.ts
 *
 * Cada arquivo é um shim fino que delega para o registro central de descritores
 * (tests/edge-functions/live/descriptors.ts). Enriquecimento por função vive lá.
 *
 * Política: NÃO sobrescreve arquivos existentes (idempotente). Roda automaticamente
 * para cobrir funções novas; o gate `check:edge-live-coverage` falha se faltar algum.
 *
 * Uso: node scripts/gen-edge-live-tests.mjs [--force]
 */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const ROOT = process.cwd();
const FUNCTIONS_DIR = path.join(ROOT, "supabase/functions");
const LIVE_DIR = path.join(ROOT, "tests/edge-functions/live");
const FORCE = process.argv.includes("--force");

const EXCLUDE = new Set(["_shared", "tests"]);

function listFunctions() {
  return fs
    .readdirSync(FUNCTIONS_DIR, { withFileTypes: true })
    .filter((d) => d.isDirectory() && !EXCLUDE.has(d.name))
    .filter((d) => fs.existsSync(path.join(FUNCTIONS_DIR, d.name, "index.ts")))
    .map((d) => d.name)
    .sort();
}

function shim(fn) {
  return `/**
 * Integração LIVE — ${fn}
 * Gerado por scripts/gen-edge-live-tests.mjs. Enriqueça o descritor em
 * tests/edge-functions/live/descriptors.ts (não edite este shim).
 */
import { runLiveSuite } from "./_live-suite";
import { descriptorFor } from "./descriptors";

runLiveSuite(descriptorFor("${fn}"));
`;
}

fs.mkdirSync(LIVE_DIR, { recursive: true });
const fns = listFunctions();
let created = 0;
let skipped = 0;
for (const fn of fns) {
  const file = path.join(LIVE_DIR, `${fn}.test.ts`);
  if (fs.existsSync(file) && !FORCE) {
    skipped++;
    continue;
  }
  fs.writeFileSync(file, shim(fn), "utf8");
  created++;
}

console.log(`Edge live test shims — funções: ${fns.length}, criados: ${created}, mantidos: ${skipped}`);
