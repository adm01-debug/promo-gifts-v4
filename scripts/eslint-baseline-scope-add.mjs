#!/usr/bin/env node
/**
 * Adiciona (ou remove) globs ao `.eslint-baseline-scope.json` e ativa modo incremental.
 *
 * Uso:
 *   node scripts/eslint-baseline-scope-add.mjs <glob> [<glob>...]
 *   node scripts/eslint-baseline-scope-add.mjs --exclude <glob>
 *   node scripts/eslint-baseline-scope-add.mjs --remove <glob>
 *   node scripts/eslint-baseline-scope-add.mjs --list
 *   node scripts/eslint-baseline-scope-add.mjs --reset
 *
 * Ao adicionar o primeiro glob, o `mode` é promovido para 'incremental'.
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const SCOPE_PATH = join(ROOT, '.eslint-baseline-scope.json');

const DEFAULT = {
  $schema: './docs/schemas/eslint-baseline-scope.schema.json',
  mode: 'full',
  include: [],
  exclude: [],
  notes: [
    'Gerido por scripts/eslint-baseline-scope-add.mjs. Ver docs no próprio arquivo inicial.',
  ],
};

function load() {
  if (!existsSync(SCOPE_PATH)) return { ...DEFAULT };
  try {
    const raw = JSON.parse(readFileSync(SCOPE_PATH, 'utf8'));
    return {
      ...DEFAULT,
      ...raw,
      include: Array.isArray(raw.include) ? raw.include : [],
      exclude: Array.isArray(raw.exclude) ? raw.exclude : [],
    };
  } catch (err) {
    console.error(`❌ .eslint-baseline-scope.json inválido: ${err.message}`);
    process.exit(2);
  }
}

function save(cfg) {
  writeFileSync(SCOPE_PATH, JSON.stringify(cfg, null, 2) + '\n');
}

const args = process.argv.slice(2);
if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
  console.log(
    'Uso:\n' +
      "  node scripts/eslint-baseline-scope-add.mjs 'src/lib/inventory/**'\n" +
      "  node scripts/eslint-baseline-scope-add.mjs --exclude 'src/legacy/**'\n" +
      "  node scripts/eslint-baseline-scope-add.mjs --remove 'src/lib/inventory/**'\n" +
      '  node scripts/eslint-baseline-scope-add.mjs --list\n' +
      '  node scripts/eslint-baseline-scope-add.mjs --reset',
  );
  process.exit(0);
}

const cfg = load();

if (args.includes('--list')) {
  console.log(`mode: ${cfg.mode}`);
  console.log(`include (${cfg.include.length}):`);
  cfg.include.forEach((g) => console.log(`  + ${g}`));
  console.log(`exclude (${cfg.exclude.length}):`);
  cfg.exclude.forEach((g) => console.log(`  - ${g}`));
  process.exit(0);
}

if (args.includes('--reset')) {
  save({ ...DEFAULT });
  console.log('✅ Escopo resetado para modo "full" (bloqueio clássico).');
  process.exit(0);
}

let target = 'include';
const globs = [];
let remove = false;
for (const a of args) {
  if (a === '--exclude') target = 'exclude';
  else if (a === '--include') target = 'include';
  else if (a === '--remove') remove = true;
  else if (a.startsWith('--')) {
    console.error(`Flag desconhecida: ${a}`);
    process.exit(2);
  } else globs.push(a);
}

if (globs.length === 0) {
  console.error('Informe ao menos um glob.');
  process.exit(2);
}

const set = new Set(cfg[target]);
for (const g of globs) {
  if (remove) set.delete(g);
  else set.add(g);
}
cfg[target] = [...set].sort();

if (!remove && cfg.include.length > 0 && cfg.mode !== 'incremental') {
  cfg.mode = 'incremental';
  console.log('ℹ️  Modo promovido para "incremental".');
}

save(cfg);
console.log(
  `✅ ${remove ? 'Removido' : 'Adicionado'} ${globs.length} glob(s) em "${target}". Total: include=${cfg.include.length}, exclude=${cfg.exclude.length}.`,
);
