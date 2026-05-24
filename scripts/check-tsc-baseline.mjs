#!/usr/bin/env node
/**
 * Gate de CI: roda tsc e compara com .tsc-baseline.json.
 *
 * Política (mesma do ESLint baseline):
 *   • Falha SOMENTE se houver erro NOVO (file:rule não presente no baseline,
 *     ou contagem maior que a registrada).
 *   • Não falha se contagens diminuírem (apenas avisa "drift positivo").
 *
 * Saídas:
 *   exit 0 — sem regressão.
 *   exit 1 — regressão (lista até 50 problemas novos).
 *   exit 2 — erro de execução.
 *
 * Para aceitar mudanças (após resolver erros legados ou refactor grande):
 *   npm run typecheck:baseline:update
 *
 * Uso:
 *   node scripts/check-tsc-baseline.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const BASELINE_PATH = join(ROOT, '.tsc-baseline.json');
const MAX_LIST = 50;
const TSC_BIN = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');

if (!existsSync(BASELINE_PATH)) {
  console.error(
    '❌ .tsc-baseline.json não encontrado. Gere com: npm run typecheck:baseline:update',
  );
  process.exit(2);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const baselineCounts = baseline.counts ?? {};

console.log('⏳ Rodando tsc -p tsconfig.app.json --noEmit ...');
const res = spawnSync(process.execPath, [TSC_BIN, '-p', 'tsconfig.app.json', '--noEmit'], {
  encoding: 'utf8',
  maxBuffer: 50 * 1024 * 1024,
});

if (res.status === null || res.error) {
  console.error('❌ tsc falhou ao executar:', res.error?.message || 'desconhecido');
  process.exit(2);
}

const output = (res.stdout || '') + (res.stderr || '');
const lines = output.split('\n');

const ERR_RE = /^(\S+\.tsx?)\(\d+,\d+\): error (TS\d+):/;
const currentCounts = {};
let totalCurrent = 0;

for (const line of lines) {
  const m = line.match(ERR_RE);
  if (!m) continue;
  const [, file, rule] = m;
  currentCounts[file] ??= {};
  currentCounts[file][rule] = (currentCounts[file][rule] || 0) + 1;
  totalCurrent++;
}

const totalBaseline = baseline.totalErrors ?? 0;

console.log(`TS baseline gate — atual: ${totalCurrent} erros · baseline: ${totalBaseline} erros`);

// Comparar: regressões = (file:rule novos) ou (file:rule com count > baseline)
const regressions = [];
let positiveDrift = 0;

for (const [file, rules] of Object.entries(currentCounts)) {
  for (const [rule, count] of Object.entries(rules)) {
    const baselineCount = baselineCounts[file]?.[rule] ?? 0;
    if (count > baselineCount) {
      regressions.push({ file, rule, count, baselineCount, delta: count - baselineCount });
    }
  }
}

// Drift positivo (arquivos/regras que diminuíram)
for (const [file, rules] of Object.entries(baselineCounts)) {
  for (const [rule, baselineCount] of Object.entries(rules)) {
    const currentCount = currentCounts[file]?.[rule] ?? 0;
    if (currentCount < baselineCount) {
      positiveDrift += baselineCount - currentCount;
    }
  }
}

if (regressions.length > 0) {
  console.error(
    `❌ Regressão de TypeScript detectada — ${regressions.length} par(es) file:rule com erros novos.`,
  );
  console.error('');
  console.error(`Listando até ${MAX_LIST} primeiros:`);
  for (const r of regressions.slice(0, MAX_LIST)) {
    console.error(
      `  ${r.file}: ${r.rule} (atual: ${r.count}, baseline: ${r.baselineCount}, +${r.delta})`,
    );
  }
  if (regressions.length > MAX_LIST) {
    console.error(`  ... e mais ${regressions.length - MAX_LIST} entrada(s).`);
  }
  console.error('');
  console.error('Para investigar: npm run typecheck:full');
  console.error('Para aceitar (após resolver erros legados): npm run typecheck:baseline:update');
  process.exit(1);
}

if (positiveDrift > 0) {
  console.log(
    `✨ Drift positivo: ${positiveDrift} erro(s) eliminado(s). Considere atualizar o baseline.`,
  );
}

console.log('✅ Nenhuma regressão de TypeScript detectada.');
process.exit(0);
