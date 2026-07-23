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
const minimatch = typeof minimatchPkg === 'function' ? minimatchPkg : minimatchPkg.minimatch;

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

// ── Flags de saída ────────────────────────────────────────────────────────
const jsonMode = process.argv.includes('--json');
const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
const listLimit = verbose ? Number.POSITIVE_INFINITY : MAX_LIST;

// ── Diff detalhado por regra e por arquivo (regressões + melhorias) ──────
function aggregate(entries, deltaFn) {
  const byRule = new Map();
  const byFile = new Map();
  for (const e of entries) {
    const d = deltaFn(e);
    const r = byRule.get(e.rule) ?? { rule: e.rule, delta: 0, pairs: 0, files: new Set() };
    r.delta += d;
    r.pairs += 1;
    r.files.add(e.file);
    byRule.set(e.rule, r);
    const f = byFile.get(e.file) ?? { file: e.file, delta: 0, pairs: 0, rules: new Set() };
    f.delta += d;
    f.pairs += 1;
    f.rules.add(e.rule);
    byFile.set(e.file, f);
  }
  return {
    byRule: [...byRule.values()].sort((a, b) => b.delta - a.delta),
    byFile: [...byFile.values()].sort((a, b) => b.delta - a.delta),
  };
}

const regAgg = aggregate(regressions, (r) => r.delta);
const impAgg = aggregate(improvements, (i) => i.baseline - i.current);

// Saldo líquido por regra (regressão − melhoria) — mostra quais regras
// pioraram ou melhoraram no total.
const netByRule = new Map();
for (const r of regAgg.byRule) netByRule.set(r.rule, (netByRule.get(r.rule) ?? 0) + r.delta);
for (const r of impAgg.byRule) netByRule.set(r.rule, (netByRule.get(r.rule) ?? 0) - r.delta);
const netRules = [...netByRule.entries()]
  .map(([rule, net]) => ({ rule, net }))
  .sort((a, b) => Math.abs(b.net) - Math.abs(a.net));

const totalRegDelta = regressions.reduce((s, r) => s + r.delta, 0);
const totalImpDelta = improvements.reduce((s, i) => s + (i.baseline - i.current), 0);
const netDelta = totalRegDelta - totalImpDelta;

// ── Saída JSON estruturada (para CI / relatórios) ────────────────────────
if (jsonMode) {
  const payload = {
    mode: incrementalMode ? 'incremental' : 'full',
    scope: { include: includeGlobs, exclude: excludeGlobs },
    totals: {
      baselineErrors: baselineTotal,
      currentErrors: totalErrors,
      currentWarnings: totalWarnings,
      regressionsDelta: totalRegDelta,
      improvementsDelta: totalImpDelta,
      netDelta,
    },
    regressions: regressions.map((r) => ({
      ...r,
      inScope: fileInScope(r.file),
    })),
    improvements,
    byRule: {
      regressions: regAgg.byRule.map((r) => ({ ...r, files: [...r.files] })),
      improvements: impAgg.byRule.map((r) => ({ ...r, files: [...r.files] })),
      net: netRules,
    },
    byFile: {
      regressions: regAgg.byFile.map((f) => ({ ...f, rules: [...f.rules] })),
      improvements: impAgg.byFile.map((f) => ({ ...f, rules: [...f.rules] })),
    },
  };
  console.log(JSON.stringify(payload, null, 2));
  const hasBlockingJson = incrementalMode
    ? regressions.some((r) => fileInScope(r.file))
    : regressions.length > 0;
  process.exit(hasBlockingJson ? 1 : 0);
}

// ── Cabeçalho ────────────────────────────────────────────────────────────
console.log(
  `ESLint baseline gate [${modeLabel}] — atual: ${totalErrors} erros, ${totalWarnings} warnings · baseline: ${baselineTotal} erros`,
);
console.log(
  `Δ vs baseline: regressões +${totalRegDelta} · melhorias −${totalImpDelta} · líquido ${netDelta >= 0 ? '+' : ''}${netDelta}`,
);

// ── Breakdown por regra (net) ────────────────────────────────────────────
if (netRules.length) {
  console.log('\n📐 Diferença por regra (saldo líquido, top 15):');
  for (const { rule, net } of netRules.slice(0, 15)) {
    const sign = net > 0 ? `+${net}` : `${net}`;
    const marker = net > 0 ? '↑' : net < 0 ? '↓' : '=';
    console.log(`  ${marker} ${rule.padEnd(48)} ${sign}`);
  }
  if (netRules.length > 15 && !verbose) {
    console.log(`  … e mais ${netRules.length - 15} regra(s). Use --verbose para ver tudo.`);
  }
}

// ── Melhorias (drift positivo) ───────────────────────────────────────────
if (improvements.length) {
  console.log(
    `\n✨ Drift positivo: ${totalImpDelta} erro(s) eliminado(s) em ${improvements.length} par(es) file:rule.`,
  );
  if (impAgg.byRule.length) {
    console.log('   Por regra (top 10):');
    for (const r of impAgg.byRule.slice(0, 10)) {
      console.log(`     − ${r.rule.padEnd(46)} −${r.delta} (${r.files.size} arquivo(s))`);
    }
  }
  if (impAgg.byFile.length && verbose) {
    console.log('   Por arquivo:');
    for (const f of impAgg.byFile) {
      console.log(`     − ${f.file} (−${f.delta}, ${f.rules.size} regra(s))`);
    }
  }
  console.log('   → Rode `npm run lint:baseline:update` para consolidar.');
}

if (regressions.length === 0) {
  console.log('\n✅ Nenhuma regressão de lint detectada.');
  process.exit(0);
}

regressions.sort((a, b) => b.delta - a.delta);

// ── Split por escopo quando em modo incremental ──────────────────────────
const blocking = incrementalMode ? regressions.filter((r) => fileInScope(r.file)) : regressions;
const informational = incrementalMode ? regressions.filter((r) => !fileInScope(r.file)) : [];
const blockingDelta = blocking.reduce((s, r) => s + r.delta, 0);
const infoDelta = informational.reduce((s, r) => s + r.delta, 0);

// ── Exemplos concretos (linha/coluna/msg) das regressões ─────────────────
const examplesByKey = new Map();
for (const r of [...blocking, ...informational].slice(0, listLimit)) {
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

// ── Breakdown de regressões por regra e por arquivo ──────────────────────
console.log(`\n📊 Regressões por regra (top 10):`);
for (const r of regAgg.byRule.slice(0, 10)) {
  console.log(`  ↑ ${r.rule.padEnd(46)} +${r.delta} (${r.files.size} arquivo(s), ${r.pairs} par(es))`);
}
if (regAgg.byRule.length > 10 && !verbose) {
  console.log(`  … e mais ${regAgg.byRule.length - 10} regra(s). Use --verbose para ver tudo.`);
}

console.log(`\n📁 Regressões por arquivo (top 10):`);
for (const f of regAgg.byFile.slice(0, 10)) {
  console.log(`  ↑ ${f.file}  +${f.delta}  [${[...f.rules].join(', ')}]`);
}
if (regAgg.byFile.length > 10 && !verbose) {
  console.log(`  … e mais ${regAgg.byFile.length - 10} arquivo(s). Use --verbose para ver tudo.`);
}

// ── Regressões fora do escopo (informacionais) ───────────────────────────
if (informational.length) {
  console.log(
    `\nℹ️  ${infoDelta} regressão(ões) FORA do escopo incremental em ${informational.length} par(es) file:rule — não bloqueia o gate:`,
  );
  const infoLimit = verbose ? informational.length : 20;
  for (const r of informational.slice(0, infoLimit)) {
    console.log(
      `  · ${r.file} [${r.rule}] baseline=${r.baseline} → atual=${r.current} (+${r.delta})`,
    );
  }
  if (informational.length > infoLimit) {
    console.log(`  … e mais ${informational.length - infoLimit} par(es) fora de escopo omitido(s).`);
  }
}

if (blocking.length === 0) {
  console.log('\n✅ Nenhuma regressão dentro do escopo incremental. Gate aprovado.');
  process.exit(0);
}

// ── Detalhamento das regressões bloqueantes ──────────────────────────────
console.error(
  `\n❌ ${blockingDelta} problema(s) novo(s) de ESLint ${incrementalMode ? 'dentro do escopo ' : ''}em ${blocking.length} par(es) file:rule:`,
);

for (const r of blocking.slice(0, listLimit)) {
  console.error(
    `  • ${r.file} [${r.rule}] baseline=${r.baseline} → atual=${r.current} (+${r.delta})`,
  );
  const ex = examplesByKey.get(`${r.file}::${r.rule}`) ?? [];
  for (const e of ex) console.error(`      ${e}`);
}
if (blocking.length > listLimit) {
  console.error(`  … e mais ${blocking.length - listLimit} par(es) omitido(s). Use --verbose para ver tudo.`);
}
console.error('\nDicas:');
console.error('  · Ver saída completa:              node scripts/check-eslint-baseline.mjs --verbose');
console.error('  · Ver JSON estruturado (CI):       node scripts/check-eslint-baseline.mjs --json');
console.error('  · Consolidar baseline após fix:    npm run lint:baseline:update');
console.error("  · Expandir escopo incremental:     node scripts/eslint-baseline-scope-add.mjs 'src/<area>/**'");
process.exit(1);


