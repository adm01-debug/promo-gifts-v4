#!/usr/bin/env node
/**
 * Regenera .any-type-baseline.json com a contagem atual de `as any` / `: any`
 * em código de produção (excluindo testes e comentários).
 *
 * Uso:
 *   node scripts/update-any-type-baseline.mjs
 */
import { execSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const ROOT = process.cwd();
const BASELINE_PATH = join(ROOT, '.any-type-baseline.json');

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
      if (e.status === 1) continue;
      throw e;
    }

    for (const rawLine of output.split('\n')) {
      if (!rawLine) continue;
      if (
        rawLine.includes('.test.ts') ||
        rawLine.includes('.test.tsx') ||
        rawLine.includes('__tests__/') ||
        rawLine.includes('/src/tests/')
      ) continue;

      const colonIdx = rawLine.indexOf(':');
      if (colonIdx === -1) continue;
      const rest = rawLine.slice(colonIdx + 1);
      const colonIdx2 = rest.indexOf(':');
      if (colonIdx2 === -1) continue;
      const content = rest.slice(colonIdx2 + 1).trimStart();

      if (content.startsWith('*') || content.startsWith('//')) continue;

      const file = rawLine.slice(0, colonIdx);
      const relFile = relative(ROOT, file.startsWith('/') ? file : join(ROOT, file));
      counts[relFile] = (counts[relFile] ?? 0) + 1;
    }
  }

  return counts;
}

const counts = countAnyInSrc();
const total = Object.values(counts).reduce((a, b) => a + b, 0);

const baseline = {
  generatedAt: new Date().toISOString(),
  description: 'Baseline de `as any` / `: any` em código de produção (excluindo testes e comentários JSDoc). Falha apenas em REGRESSÃO (contagem cresce).',
  productionAnyCount: total,
  counts,
};

writeFileSync(BASELINE_PATH, JSON.stringify(baseline, null, 2) + '\n');
console.log(`✅ .any-type-baseline.json atualizado — ${total} cast(s) em ${Object.keys(counts).length} arquivo(s).`);
if (Object.keys(counts).length > 0) {
  for (const [f, c] of Object.entries(counts)) {
    console.log(`  ${f}: ${c}`);
  }
}
