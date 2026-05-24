#!/usr/bin/env node
// scripts/check-eslint-config-current.mjs
//
// ─────────────────────────────────────────────────────────────────────
// T-FIX-5 follow-up: detecta arquivos `*.proposed.*` órfãos no ROOT do
// repo que deveriam ter sido aplicados via `mv` mas ficaram esquecidos.
//
// Origem do padrão:
//   T-FIX-5 (docs/redeploy/T-FIX-5-LINT-GUARDRAIL.md) criou
//   `eslint.config.t-fix-5.proposed.js` no root porque o agente não
//   conseguiu fazer apply direto no eslint.config.js via MCP (sem
//   acesso ao blob SHA do arquivo existente).
//
// Fluxo esperado:
//   1. Agente cria <name>.proposed.<ext> no root
//   2. Sponsor aplica:   mv <name>.proposed.<ext> <name>.<ext>
//   3. Este script garante que o passo 2 não foi esquecido — vira
//      ação observável em CI, não dependente de memória humana
//
// Como rodar:
//   node scripts/check-eslint-config-current.mjs           # warn (exit 0)
//   node scripts/check-eslint-config-current.mjs --strict  # error (exit 1)
//
// Como integrar no CI (próximo PR — não escopo deste commit):
//   1. Adicionar em package.json:
//      "check:proposed-configs": "node scripts/check-eslint-config-current.mjs --strict"
//   2. Chamar no quality gate ou pre-merge:
//      "test:quality": "... && npm run check:proposed-configs"
//
// ─────────────────────────────────────────────────────────────────────

import { readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ROOT = resolve(process.cwd());
const STRICT = process.argv.includes('--strict');

// Detecta arquivos proposed órfãos no ROOT do repo.
// Match: <name>.proposed.<ext> onde ext ∈ {js,mjs,cjs,mts,cts,ts,tsx,json}
//
// Apenas no root — subdirs (ex: docs/redeploy/) podem conter arquivos
// `.proposed.*` legítimos por questões de documentação ou estudo de
// alternativas, sem que sejam órfãos pendentes de apply.
const ORPHAN_PATTERN = /^.+\.proposed\.(js|mjs|cjs|mts|cts|ts|tsx|json)$/;

/**
 * Vasculha o diretório (não-recursivo) procurando arquivos órfãos.
 * @param {string} dir Caminho absoluto.
 * @returns {string[]} Nomes dos arquivos (sem path), em ordem alfabética.
 */
function findOrphanedProposedConfigs(dir) {
  const orphans = [];
  let entries;
  try {
    entries = readdirSync(dir);
  } catch (err) {
    console.error(`Could not read directory ${dir}: ${err.message}`);
    process.exit(2);
  }
  for (const name of entries) {
    const fullPath = join(dir, name);
    try {
      if (statSync(fullPath).isFile() && ORPHAN_PATTERN.test(name)) {
        orphans.push(name);
      }
    } catch {
      // ignore stat errors (symlinks dangling, permissions, race with deletion)
    }
  }
  return orphans.sort();
}

const orphans = findOrphanedProposedConfigs(ROOT);

if (orphans.length === 0) {
  console.log('✅ check-eslint-config-current: no orphaned *.proposed.* configs in repo root');
  process.exit(0);
}

const tag = STRICT ? '❌' : '⚠️ ';
const out = STRICT ? console.error : console.warn;

out(`${tag} check-eslint-config-current: found ${orphans.length} orphaned proposed config(s):`);
for (const name of orphans) {
  out(`   - ${name}`);
}
out('');
out('To resolve, either:');
out('  (a) Apply the proposed config (most common):');
out('      mv <file>.proposed.<ext> <file>.<ext>');
out('      git add <file>.<ext>');
out('      git commit -m "chore: apply <file>"');
out('  (b) Remove the proposed config if no longer needed:');
out('      git rm <file>.proposed.<ext>');
out('      git commit -m "chore: remove orphaned proposed config"');
out('');
out('Context: docs/redeploy/T-FIX-5-LINT-GUARDRAIL.md');

if (STRICT) {
  console.error('');
  console.error('Exiting with code 1 because --strict was specified.');
  process.exit(1);
}

process.exit(0);
