#!/usr/bin/env node
/**
 * Gera o baseline do ESLint (apenas ERROS, severity=2) agregando
 * contagens por arquivo (relativo ao repo) + ruleId.
 *
 * Saída: .eslint-baseline.json
 *   {
 *     "generatedAt": "...",
 *     "totalErrors": <n>,
 *     "counts": { "src/foo.ts": { "rule-id": 3, ... }, ... }
 *   }
 *
 * Uso:
 *   node scripts/eslint-baseline-generate.mjs
 *   UPDATE_BASELINE=1 node scripts/eslint-baseline-generate.mjs   (idem; apenas semântico)
 */
import { spawnSync } from 'node:child_process';
import { writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import { readFileSync } from 'node:fs';

const ROOT = process.cwd();
const BASELINE_PATH = join(ROOT, '.eslint-baseline.json');
const ESLINT_BIN = join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');

function runEslint() {
  const dir = mkdtempSync(join(tmpdir(), 'eslint-base-'));
  const out = join(dir, 'report.json');
  const res = spawnSync(process.execPath, [ESLINT_BIN, 'src', '--format', 'json', '-o', out], {
    stdio: ['ignore', 'inherit', 'inherit'],
    shell: false,
  });
  if (res.status !== 0 && res.status !== 1) {
    // 0 = clean, 1 = lint problems found. Anything else = real failure.
    console.error(`eslint exited with status ${res.status}`);
    process.exit(res.status ?? 2);
  }
  return JSON.parse(readFileSync(out, 'utf8'));
}

function aggregate(report) {
  const counts = {};
  let totalErrors = 0;
  for (const file of report) {
    if (!file.messages?.length) continue;
    const rel = relative(ROOT, file.filePath).replaceAll('\\', '/');
    for (const m of file.messages) {
      if (m.severity === 0) continue; // ignora "off"; congela erros e warnings
      const rule = m.ruleId ?? '<no-rule>';
      counts[rel] ??= {};
      counts[rel][rule] = (counts[rel][rule] ?? 0) + 1;
      if (m.severity === 2) totalErrors += 1;
    }
  }
  // Ordena para diff estável.
  const sortedFiles = Object.keys(counts).sort();
  const sortedCounts = {};
  for (const f of sortedFiles) {
    const rules = counts[f];
    const sortedRules = {};
    for (const r of Object.keys(rules).sort()) sortedRules[r] = rules[r];
    sortedCounts[f] = sortedRules;
  }
  return { totalErrors, counts: sortedCounts };
}

const report = runEslint();
const { totalErrors, counts } = aggregate(report);
const payload = {
  generatedAt: new Date().toISOString(),
  totalErrors,
  counts,
};
writeFileSync(BASELINE_PATH, JSON.stringify(payload, null, 2) + '\n', 'utf8');
console.log(
  `✅ Baseline gravado em ${relative(ROOT, BASELINE_PATH)} — ${totalErrors} erros congelados em ${Object.keys(counts).length} arquivos.`,
);
