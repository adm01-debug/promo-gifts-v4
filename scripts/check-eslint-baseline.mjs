#!/usr/bin/env node
/**
 * Gate de CI: roda ESLint e compara com .eslint-baseline.json.
 *
 * Política:
 *   • Falha SOMENTE se houver erro NOVO (file:rule não presente no baseline,
 *     ou contagem maior que a registrada).
 *   • Não falha se contagens diminuírem (apenas avisa "drift positivo").
 *   • Falha se houver qualquer warning (severity=1) ou erro novo.

 *
 * Saídas:
 *   exit 0 — sem regressão.
 *   exit 1 — regressão (lista até 50 problemas novos).
 *   exit 2 — erro de execução (eslint quebrou ou baseline ausente).
 *
 * Para aceitar mudanças (após resolver erros legados ou refactor grande):
 *   node scripts/eslint-baseline-generate.mjs
 *
 * Uso:
 *   node scripts/check-eslint-baseline.mjs
 */
import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, relative } from 'node:path';
import minimatchPkg from 'minimatch';
const { minimatch } = minimatchPkg;

const ROOT = process.cwd();
const BASELINE_PATH = join(ROOT, '.eslint-baseline.json');
const SCOPE_PATH = join(ROOT, '.eslint-baseline-scope.json');
const MAX_LIST = 50;
const ESLINT_BIN = join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');

if (!existsSync(BASELINE_PATH)) {
  console.error(
    '❌ .eslint-baseline.json não encontrado. Gere com: node scripts/eslint-baseline-generate.mjs',
  );
  process.exit(2);
}

const baseline = JSON.parse(readFileSync(BASELINE_PATH, 'utf8'));
const baselineCounts = baseline.counts ?? {};

// ── Modo incremental (escopo) ─────────────────────────────────────────────
// Lê `.eslint-baseline-scope.json` (opcional) e/ou flag `--incremental`.
// Em modo incremental, regressões fora do `include` (menos `exclude`) viram
// informacionais e NÃO bloqueiam o CI. Regressões dentro do escopo bloqueiam
// normalmente. Assim novas ondas de correção não são atrapalhadas por drift
// legado em áreas ainda não trabalhadas.
const cliIncremental = process.argv.includes('--incremental');
const cliFull = process.argv.includes('--full');
let scopeConfig = { mode: 'full', include: [], exclude: [] };
if (existsSync(SCOPE_PATH)) {
  try {
    const raw = JSON.parse(readFileSync(SCOPE_PATH, 'utf8'));
    scopeConfig = {
      mode: raw.mode === 'incremental' ? 'incremental' : 'full',
      include: Array.isArray(raw.include) ? raw.include : [],
      exclude: Array.isArray(raw.exclude) ? raw.exclude : [],
    };
  } catch (err) {
    console.error(`⚠️  .eslint-baseline-scope.json inválido, ignorando: ${err.message}`);
  }
}
const incrementalMode = cliFull ? false : cliIncremental || scopeConfig.mode === 'incremental';
const includeGlobs = scopeConfig.include;
const excludeGlobs = scopeConfig.exclude;

function fileInScope(file) {
  if (!incrementalMode) return true;
  if (includeGlobs.length === 0) return false; // escopo vazio ⇒ nada bloqueia
  const included = includeGlobs.some((g) => minimatch(file, g));
  if (!included) return false;
  const excluded = excludeGlobs.some((g) => minimatch(file, g));
  return !excluded;
}

const dir = mkdtempSync(join(tmpdir(), 'eslint-gate-'));
const out = join(dir, 'report.json');
const res = spawnSync(process.execPath, [ESLINT_BIN, 'src', '--format', 'json', '-o', out], {
  stdio: ['ignore', 'inherit', 'inherit'],
  shell: false,
});
if (res.status !== 0 && res.status !== 1) {
  console.error(`❌ eslint falhou com status ${res.status}`);
  process.exit(2);
}

const report = JSON.parse(readFileSync(out, 'utf8'));

// Agrega current igual ao generator.
const current = {};
let totalErrors = 0;
let totalWarnings = 0;
for (const file of report) {
  if (!file.messages?.length) continue;
  const rel = relative(ROOT, file.filePath).replaceAll('\\', '/');
  for (const m of file.messages) {
    // Agora processamos tanto erros (2) quanto warnings (1)
    if (m.severity === 0) continue;

    const rule = m.ruleId ?? '<no-rule>';
    current[rel] ??= {};
    current[rel][rule] = (current[rel][rule] ?? 0) + 1;

    if (m.severity === 2) totalErrors += 1;
    if (m.severity === 1) totalWarnings += 1;
  }
}

// Compara: por (file,rule), conta quantas excedem o baseline.
// Quando há regressão, escolhemos as primeiras N mensagens daquele par
// para listar no relatório.
const regressions = []; // {file, rule, baseline, current, delta}
for (const [file, rules] of Object.entries(current)) {
  for (const [rule, count] of Object.entries(rules)) {
    const base = baselineCounts[file]?.[rule] ?? 0;
    if (count > base) {
      regressions.push({ file, rule, baseline: base, current: count, delta: count - base });
    }
  }
}

// Drift positivo (melhorias): não falha, só informa.
const improvements = [];
for (const [file, rules] of Object.entries(baselineCounts)) {
  for (const [rule, count] of Object.entries(rules)) {
    const cur = current[file]?.[rule] ?? 0;
    if (cur < count) improvements.push({ file, rule, baseline: count, current: cur });
  }
}

const baselineTotal = baseline.totalErrors ?? 0;
const modeLabel = incrementalMode
  ? `incremental (include=${includeGlobs.length} exclude=${excludeGlobs.length})`
  : 'full';
console.log(
  `ESLint baseline gate [${modeLabel}] — atual: ${totalErrors} erros, ${totalWarnings} warnings · baseline: ${baselineTotal} erros`,
);

if (improvements.length) {
  const improved = improvements.reduce((s, i) => s + (i.baseline - i.current), 0);
  console.log(
    `✨ Drift positivo: ${improved} erro(s) eliminado(s) em ${improvements.length} par(es) file:rule. Considere atualizar o baseline.`,
  );
}

if (regressions.length === 0) {
  console.log('✅ Nenhuma regressão de lint detectada.');
  process.exit(0);
}

regressions.sort((a, b) => b.delta - a.delta);

// Split por escopo quando em modo incremental.
const blocking = incrementalMode ? regressions.filter((r) => fileInScope(r.file)) : regressions;
const informational = incrementalMode
  ? regressions.filter((r) => !fileInScope(r.file))
  : [];
const blockingDelta = blocking.reduce((s, r) => s + r.delta, 0);
const infoDelta = informational.reduce((s, r) => s + r.delta, 0);

// Coleta exemplos concretos (linha/coluna/msg) das regressões bloqueantes.
const examplesByKey = new Map();
for (const r of blocking.slice(0, MAX_LIST)) {
  examplesByKey.set(`${r.file}::${r.rule}`, []);
}
for (const file of report) {
  const rel = relative(ROOT, file.filePath).replaceAll('\\', '/');
  for (const m of file.messages ?? []) {
    if (m.severity === 0) continue;
    const key = `${rel}::${m.ruleId ?? '<no-rule>'}`;
    const arr = examplesByKey.get(key);
    if (arr && arr.length < 3) {
      const prefix = m.severity === 2 ? 'ERROR' : 'WARN';
      arr.push(`${prefix} ${m.line}:${m.column} ${m.message}`);
    }
  }
}

if (informational.length) {
  console.log(
    `\nℹ️  ${infoDelta} regressão(ões) FORA do escopo incremental em ${informational.length} par(es) file:rule — não bloqueia o gate:`,
  );
  for (const r of informational.slice(0, 20)) {
    console.log(
      `  · ${r.file} [${r.rule}] baseline=${r.baseline} → atual=${r.current} (+${r.delta})`,
    );
  }
  if (informational.length > 20) {
    console.log(`  … e mais ${informational.length - 20} par(es) fora de escopo omitido(s).`);
  }
}

if (blocking.length === 0) {
  console.log('\n✅ Nenhuma regressão dentro do escopo incremental. Gate aprovado.');
  process.exit(0);
}

console.error(
  `\n❌ ${blockingDelta} problema(s) novo(s) de ESLint dentro do escopo em ${blocking.length} par(es) file:rule:`,
);

for (const r of blocking.slice(0, MAX_LIST)) {
  console.error(
    `  • ${r.file} [${r.rule}] baseline=${r.baseline} → atual=${r.current} (+${r.delta})`,
  );
  const ex = examplesByKey.get(`${r.file}::${r.rule}`) ?? [];
  for (const e of ex) console.error(`      ${e}`);
}
if (blocking.length > MAX_LIST) {
  console.error(`  … e mais ${blocking.length - MAX_LIST} par(es) omitido(s).`);
}
console.error('\nPara atualizar o baseline (após corrigir os legados ou refactor intencional):');
console.error('  node scripts/eslint-baseline-generate.mjs');
console.error('Para expandir o escopo incremental após uma onda:');
console.error("  node scripts/eslint-baseline-scope-add.mjs 'src/<area>/**'");
process.exit(1);

