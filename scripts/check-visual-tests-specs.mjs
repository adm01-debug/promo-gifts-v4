#!/usr/bin/env node
/**
 * Gate de pré-execução do workflow `visual-tests.yml`.
 *
 * Lê o passo "Run Playwright Visual Tests" do YAML, extrai os caminhos de
 * spec passados ao `npx playwright test ...` e falha com mensagem clara se
 * algum arquivo referenciado não existir no disco — evita o erro silencioso
 * "no tests found" do Playwright que mascara baselines ausentes.
 *
 * Uso: `node scripts/check-visual-tests-specs.mjs`
 * Exit 0 = todos os specs existem. Exit 1 = lista os ausentes.
 */
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const WORKFLOW = '.github/workflows/visual-tests.yml';
const ROOT = process.cwd();

const yaml = readFileSync(resolve(ROOT, WORKFLOW), 'utf8');

// Coleta TODOS os tokens *.spec.ts referenciados em qualquer `run:` do YAML.
const specs = Array.from(yaml.matchAll(/(\S+\.spec\.ts)/g)).map((m) => m[1]);
const unique = [...new Set(specs)];

if (unique.length === 0) {
  console.error(`❌ Nenhum spec encontrado em ${WORKFLOW} (regex falhou?)`);
  process.exit(1);
}

const missing = unique.filter((p) => !existsSync(resolve(ROOT, p)));

if (missing.length > 0) {
  console.error(`❌ ${missing.length} spec(s) referenciado(s) em ${WORKFLOW} não existem no disco:`);
  for (const p of missing) console.error(`   • ${p}`);
  console.error('\nCorrija o YAML ou recrie os arquivos antes de executar o workflow.');
  process.exit(1);
}

console.log(`✅ ${unique.length} specs referenciados em ${WORKFLOW} existem no disco.`);
