#!/usr/bin/env node
/**
 * Gate de CI: conta ocorrências de `as any` / `: any` em código de produção
 * (excluindo arquivos de teste e linhas que são comentários JSDoc/inline).
 *
 * Política (mesma do ESLint/TSC baseline):
 *   • Falha SOMENTE se houver REGRESSÃO (arquivo com contagem maior que a baseline).
 *   • Drift positivo (count diminuiu) apenas avisa — não requer update.
 *
 * Saídas:
 *   exit 0 — sem regressão
 *   exit 1 — regressão detectada
 *   exit 2 — erro de execução
 *
 * Para aceitar novas reduções (atualize baseline após resolver casts legados):
 *   node scripts/update-any-type-baseline.mjs
 */
import { execSync } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const BASELINE_PATH = join(ROOT, '.any-type-baseline.json');

if (!existsSync(BASELINE_PATH)) {
  console.error('❌ .any-type-baseline.json não encontrado. Gere com: node scripts/update-any-type-baseline.mjs');
  process.exit(2);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const baselineCounts = baseline.counts ?? {};

function countAnyInSrc() {
  const patterns = ['as any', ': any'];
  const counts = {};

  for (const pattern of patterns) {
    let output = '';
    try {
      output = execSync(
        `grep -rn "${pattern}" src/ --include="*.ts" --include="*.tsx"`,
        { encoding: 'utf8', cwd: ROOT },
      );
    } catch (e) {
      if (e.status === 1) continue; // grep returns 1 when no match found
      throw e;
    }

    for (const rawLine of output.split('\n')) {
      if (!rawLine) continue;

      // Exclude test files
      if (
        rawLine.includes('.test.ts') ||
        rawLine.includes('.test.tsx') ||
        rawLine.includes('__tests__/') ||
        rawLine.includes('/src/tests/')
      ) continue;

      // Extract the content portion after "file:lineno:"
      const colonIdx = rawLine.indexOf(':');
      if (colonIdx === -1) continue;
      const rest = rawLine.slice(colonIdx + 1);
      const colonIdx2 = rest.indexOf(':');
      if (colonIdx2 === -1) continue;
      const content = rest.slice(colonIdx2 + 1).trimStart();

      // Exclude JSDoc block comment lines (` * ...`) and inline comments (`// ...`)
      if (content.startsWith('*') || content.startsWith('//')) continue;

      const file = rawLine.slice(0, colonIdx);
      const relFile = relative(ROOT, file.startsWith('/') ? file : join(ROOT, file));
      counts[relFile] = (counts[relFile] ?? 0) + 1;
    }
  }

  return counts;
}

let currentCounts;
try {
  currentCounts = countAnyInSrc();
} catch (err) {
  console.error('❌ Erro ao rodar grep:', err.message);
  process.exit(2);
}

const totalCurrent = Object.values(currentCounts).reduce((a, b) => a + b, 0);
const totalBaseline = baseline.productionAnyCount ?? 0;

console.log(`\`as any\` baseline gate — atual: ${totalCurrent} · baseline: ${totalBaseline}`);

const regressions = [];
let positiveDrift = 0;

// Check for regressions (new or increased)
for (const [file, count] of Object.entries(currentCounts)) {
  const baselineCount = baselineCounts[file] ?? 0;
  if (count > baselineCount) {
    regressions.push({ file, count, baselineCount, delta: count - baselineCount });
  }
}

// Check for positive drift (decreased)
for (const [file, baselineCount] of Object.entries(baselineCounts)) {
  const currentCount = currentCounts[file] ?? 0;
  if (currentCount < baselineCount) {
    positiveDrift += baselineCount - currentCount;
  }
}

if (regressions.length > 0) {
  console.error(`\n❌ Regressão de \`as any\` detectada — ${regressions.length} arquivo(s) com casts novos:`);
  for (const r of regressions) {
    console.error(`  ${r.file}: ${r.count} (baseline: ${r.baselineCount}, +${r.delta})`);
  }
  console.error('\nPor favor, use tipos explícitos em vez de `as any`.');
  console.error('Para atualizar o baseline (após correção): node scripts/update-any-type-baseline.mjs');
  process.exit(1);
}

if (positiveDrift > 0) {
  console.log(`✨ Drift positivo: ${positiveDrift} cast(s) eliminado(s). Considere atualizar o baseline com: node scripts/update-any-type-baseline.mjs`);
}

console.log('✅ Nenhuma regressão de `as any` detectada.');
process.exit(0);
