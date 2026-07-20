#!/usr/bin/env node
/**
 * Gate: proíbe NOVOS elementos não-nativos com `role="button"` inline em src/.
 *
 * Novos call-sites devem usar `<Clickable>` de `@/components/shared/Clickable`.
 * Uma allowlist (drift baseline) preserva os call-sites legados para refactor progressivo.
 *
 * Uso:
 *   node scripts/check-clickable-drift.mjs                # falha se houver arquivos novos
 *   node scripts/check-clickable-drift.mjs --update       # regrava baseline
 *
 * @see docs/architecture/A11Y_CLICKABLE.md
 */
import { readFileSync, writeFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, extname } from 'node:path';

const ROOT = resolve(process.cwd());
const BASELINE = resolve(ROOT, '.a11y/clickable-baseline.json');
const UPDATE = process.argv.includes('--update');

const PATTERN = /role=["']button["']/;
const SKIP_DIRS = new Set(['node_modules', 'dist', 'build', '.git', '__tests__']);

function* walk(dir) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name)) continue;
      yield* walk(full);
    } else if (extname(entry.name) === '.tsx') {
      if (entry.name.includes('.test.') || entry.name.includes('.spec.')) continue;
      if (entry.name === 'Clickable.tsx') continue;
      yield full;
    }
  }
}

const srcDir = resolve(ROOT, 'src');
const matches = [];

if (existsSync(srcDir)) {
  for (const file of walk(srcDir)) {
    let content;
    try {
      content = readFileSync(file, 'utf8');
    } catch {
      continue;
    }
    if (PATTERN.test(content)) {
      // Normalize to relative path with forward slashes (matches rg output style)
      matches.push(file.slice(ROOT.length + 1).replace(/\\/g, '/'));
    }
  }
}

const current = new Set(matches.sort());

let baseline = { files: [] };
if (existsSync(BASELINE)) {
  baseline = JSON.parse(readFileSync(BASELINE, 'utf8'));
}
const baselineSet = new Set(baseline.files ?? []);

if (UPDATE) {
  const next = {
    description:
      'Baseline de arquivos com `role="button"` inline em elementos não-nativos. Regressões (arquivos novos fora da baseline) falham CI. Refatore para `<Clickable>` de @/components/shared/Clickable.',
    updated_at: new Date().toISOString(),
    files: [...current].sort(),
  };
  writeFileSync(BASELINE, JSON.stringify(next, null, 2) + '\n');
  console.log(`✅ Baseline regravada: ${next.files.length} arquivo(s).`);
  process.exit(0);
}

const added = [...current].filter((f) => !baselineSet.has(f));
const removed = [...baselineSet].filter((f) => !current.has(f));

if (removed.length > 0) {
  console.log(`ℹ️  ${removed.length} arquivo(s) removido(s) da baseline (refatorado(s) para <Clickable>):`);
  removed.forEach((f) => console.log(`   - ${f}`));
  console.log(`   Rode "node scripts/check-clickable-drift.mjs --update" para consolidar o ganho.`);
}

if (added.length === 0) {
  console.log(`✅ Sem regressões de a11y clickable. Baseline: ${baselineSet.size} legado(s).`);
  process.exit(0);
}

console.error(`\n❌ ${added.length} arquivo(s) novo(s) com \`role="button"\` inline detectado(s):\n`);
added.forEach((f) => console.error(`   - ${f}`));
console.error(`\n💡 Use \`<Clickable>\` de "@/components/shared/Clickable" em vez de duplicar o padrão.`);
console.error(`   Doc: docs/architecture/A11Y_CLICKABLE.md`);
console.error(`   Se for uso legítimo (não migrável), regrave a baseline: node scripts/check-clickable-drift.mjs --update\n`);
process.exit(1);
