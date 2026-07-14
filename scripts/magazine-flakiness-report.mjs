#!/usr/bin/env node
/**
 * Magazine Flakiness Report
 * -------------------------
 * Executa `vitest run tests/magazine/` N vezes (default 10) e agrega o
 * resultado por teste + por suíte, produzindo:
 *
 *   - `magazine-flakiness.json` (dado bruto — passes/fails por teste)
 *   - `magazine-flakiness.md`   (resumo humano — Markdown para PR/summary)
 *
 * Um teste é considerado FLAKY quando aparece com PELO MENOS 1 pass E
 * PELO MENOS 1 fail nas N rodadas. Um teste FAIL-ALL (todas as rodadas
 * falharam) é reportado separadamente e falha o script com exit 1.
 *
 * Motivação (auditoria 2026-07-14): as suítes de rings do Magazine
 * (fuzz, focus-visible, breakpoints) usam PRNG determinístico + jsdom,
 * mas dependem de timing de useState/effect. Rodar 10x no CI expõe
 * qualquer regressão de ordem de renderização antes que vire tempo
 * gasto debugando falso positivo local.
 *
 * Uso:
 *   node scripts/magazine-flakiness-report.mjs [--runs=10] [--pattern=tests/magazine/]
 *
 * Exit codes:
 *   0 → 100% verde OU apenas testes flaky (não falha CI por padrão)
 *   1 → algum teste FAIL-ALL, OU flag --strict + qualquer flaky
 *   2 → erro de infraestrutura (vitest não gerou JSON)
 */

import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync, existsSync, rmSync } from 'node:fs';
import { resolve, join } from 'node:path';

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v ?? true];
  }),
);

const RUNS = Number(args.runs ?? 10);
// `--pattern` aceita múltiplos padrões separados por vírgula. Ex.:
//   --pattern=tests/magazine/,tests/utils/tailwindRings.interaction.test.tsx
// Cada padrão vira um argumento posicional de `vitest run`.
const PATTERN_RAW = String(args.pattern ?? 'tests/magazine/');
const PATTERNS = PATTERN_RAW.split(',').map((p) => p.trim()).filter(Boolean);
const STRICT = Boolean(args.strict);
const OUT_DIR = resolve(String(args['out-dir'] ?? 'reports/flakiness'));
const TMP_DIR = resolve('.tmp/flakiness');

if (!Number.isFinite(RUNS) || RUNS < 1 || RUNS > 50) {
  console.error(`[flakiness] --runs inválido: ${RUNS} (aceito: 1..50)`);
  process.exit(2);
}
if (PATTERNS.length === 0) {
  console.error(`[flakiness] --pattern vazio`);
  process.exit(2);
}

mkdirSync(OUT_DIR, { recursive: true });
mkdirSync(TMP_DIR, { recursive: true });

/**
 * Aggregate shape:
 *   testsById[fullId] = {
 *     file, suite, name, passes, fails, statuses: [ 'pass'|'fail'|'skip' ]
 *   }
 */
const testsById = new Map();
const runFailures = []; // erros de infra por rodada

for (let i = 1; i <= RUNS; i++) {
  const outFile = join(TMP_DIR, `run-${i}.json`);
  if (existsSync(outFile)) rmSync(outFile);

  console.log(`\n[flakiness] Rodada ${i}/${RUNS} — vitest run ${PATTERNS.join(' ')}`);
  const started = Date.now();
  const res = spawnSync(
    'npx',
    [
      'vitest',
      'run',
      ...PATTERNS,
      '--reporter=json',
      `--outputFile=${outFile}`,
      // Silencia o reporter default para logs mais curtos no CI.
      '--reporter=default',
    ],
    {
      stdio: ['ignore', 'inherit', 'inherit'],
      env: { ...process.env, TZ: 'America/Sao_Paulo', CI: 'true', NODE_ENV: 'test' },
    },
  );
  const elapsed = ((Date.now() - started) / 1000).toFixed(1);
  console.log(`[flakiness] Rodada ${i} terminou em ${elapsed}s (exit=${res.status ?? 'null'})`);

  if (!existsSync(outFile)) {
    runFailures.push({ run: i, reason: 'JSON não gerado pelo vitest' });
    continue;
  }

  let json;
  try {
    json = JSON.parse(readFileSync(outFile, 'utf8'));
  } catch (err) {
    runFailures.push({ run: i, reason: `JSON inválido: ${err.message}` });
    continue;
  }

  const results = Array.isArray(json.testResults) ? json.testResults : [];
  for (const fileResult of results) {
    const file = fileResult.name ?? fileResult.testFilePath ?? 'unknown';
    const assertions = Array.isArray(fileResult.assertionResults) ? fileResult.assertionResults : [];
    for (const a of assertions) {
      const suite = Array.isArray(a.ancestorTitles) ? a.ancestorTitles.join(' > ') : '';
      const name = a.title ?? a.fullName ?? '?';
      const id = `${file}::${suite}::${name}`;
      let entry = testsById.get(id);
      if (!entry) {
        entry = { file, suite, name, passes: 0, fails: 0, skipped: 0, statuses: [] };
        testsById.set(id, entry);
      }
      const status = a.status ?? 'unknown';
      entry.statuses.push(status);
      if (status === 'passed') entry.passes++;
      else if (status === 'failed') entry.fails++;
      else if (status === 'skipped' || status === 'pending' || status === 'todo') entry.skipped++;
    }
  }
}

// Classificação por teste.
const tests = [...testsById.values()];
const flaky = tests.filter((t) => t.passes > 0 && t.fails > 0);
const failAll = tests.filter((t) => t.passes === 0 && t.fails > 0);
const stable = tests.filter((t) => t.fails === 0);

// Agregação por suíte (arquivo).
const bySuite = new Map();
for (const t of tests) {
  const key = t.file;
  let s = bySuite.get(key);
  if (!s) {
    s = { file: key, total: 0, flaky: 0, failAll: 0, stable: 0, passes: 0, fails: 0 };
    bySuite.set(key, s);
  }
  s.total++;
  s.passes += t.passes;
  s.fails += t.fails;
  if (t.passes > 0 && t.fails > 0) s.flaky++;
  else if (t.passes === 0 && t.fails > 0) s.failAll++;
  else s.stable++;
}
const suites = [...bySuite.values()].sort(
  (a, b) => b.flaky + b.failAll - (a.flaky + a.failAll) || a.file.localeCompare(b.file),
);

// Persistência — JSON bruto.
const jsonReport = {
  runs: RUNS,
  pattern: PATTERN,
  generatedAt: new Date().toISOString(),
  runFailures,
  totals: {
    tests: tests.length,
    flaky: flaky.length,
    failAll: failAll.length,
    stable: stable.length,
  },
  suites,
  flaky: flaky.map((t) => ({
    file: t.file,
    suite: t.suite,
    name: t.name,
    passes: t.passes,
    fails: t.fails,
    rate: `${((t.fails / (t.passes + t.fails)) * 100).toFixed(1)}%`,
  })),
  failAll: failAll.map((t) => ({
    file: t.file,
    suite: t.suite,
    name: t.name,
    fails: t.fails,
  })),
};
writeFileSync(join(OUT_DIR, 'magazine-flakiness.json'), JSON.stringify(jsonReport, null, 2));

// Persistência — Markdown resumido.
const md = [];
md.push(`# Magazine Flakiness Report`);
md.push('');
md.push(`- **Rodadas:** ${RUNS}`);
md.push(`- **Padrão:** \`${PATTERN}\``);
md.push(`- **Gerado em:** ${jsonReport.generatedAt}`);
md.push(
  `- **Totais:** ${tests.length} testes distintos · ${stable.length} estáveis · ${flaky.length} flaky · ${failAll.length} fail-all`,
);
if (runFailures.length) {
  md.push('');
  md.push(`> ⚠️ ${runFailures.length} rodada(s) sem JSON válido: ${runFailures.map((r) => `#${r.run} (${r.reason})`).join(', ')}`);
}
md.push('');
md.push(`## Resumo por suíte`);
md.push('');
md.push(`| Suíte | Testes | Estáveis | Flaky | Fail-all | Passes | Fails |`);
md.push(`|---|---:|---:|---:|---:|---:|---:|`);
for (const s of suites) {
  const label = s.file.replace(process.cwd() + '/', '');
  const flakyMark = s.flaky > 0 ? `⚠️ ${s.flaky}` : `${s.flaky}`;
  const failMark = s.failAll > 0 ? `❌ ${s.failAll}` : `${s.failAll}`;
  md.push(`| \`${label}\` | ${s.total} | ${s.stable} | ${flakyMark} | ${failMark} | ${s.passes} | ${s.fails} |`);
}
md.push('');

if (flaky.length) {
  md.push(`## Testes flaky (passaram em algumas rodadas, falharam em outras)`);
  md.push('');
  md.push(`| Arquivo | Teste | Passes | Fails | Taxa de falha |`);
  md.push(`|---|---|---:|---:|---:|`);
  for (const t of flaky) {
    const label = t.file.replace(process.cwd() + '/', '');
    const full = t.suite ? `${t.suite} > ${t.name}` : t.name;
    const rate = ((t.fails / (t.passes + t.fails)) * 100).toFixed(1);
    md.push(`| \`${label}\` | ${full} | ${t.passes} | ${t.fails} | ${rate}% |`);
  }
  md.push('');
}

if (failAll.length) {
  md.push(`## Testes que falharam em 100% das rodadas`);
  md.push('');
  md.push(`| Arquivo | Teste | Fails |`);
  md.push(`|---|---|---:|`);
  for (const t of failAll) {
    const label = t.file.replace(process.cwd() + '/', '');
    const full = t.suite ? `${t.suite} > ${t.name}` : t.name;
    md.push(`| \`${label}\` | ${full} | ${t.fails} |`);
  }
  md.push('');
}

if (!flaky.length && !failAll.length) {
  md.push(`✅ **Nenhuma flakiness detectada em ${RUNS} rodadas consecutivas.**`);
  md.push('');
}

writeFileSync(join(OUT_DIR, 'magazine-flakiness.md'), md.join('\n'));

// Console summary.
console.log('\n=== Magazine Flakiness Summary ===');
console.log(`Runs: ${RUNS} | Testes: ${tests.length} | Estáveis: ${stable.length} | Flaky: ${flaky.length} | Fail-all: ${failAll.length}`);
if (flaky.length) {
  console.log('\n⚠️ Flaky:');
  for (const t of flaky) console.log(`  - ${t.name} (${t.passes}✓/${t.fails}✗)`);
}
if (failAll.length) {
  console.log('\n❌ Fail-all:');
  for (const t of failAll) console.log(`  - ${t.name} (${t.fails}✗)`);
}
console.log(`\nRelatório: ${OUT_DIR}/magazine-flakiness.{json,md}`);

// GitHub Actions job summary.
if (process.env.GITHUB_STEP_SUMMARY) {
  try {
    const summary = readFileSync(join(OUT_DIR, 'magazine-flakiness.md'), 'utf8');
    writeFileSync(process.env.GITHUB_STEP_SUMMARY, summary, { flag: 'a' });
  } catch {
    /* summary é best-effort */
  }
}

if (failAll.length > 0) {
  console.error('\n[flakiness] FAIL — há teste(s) falhando em 100% das rodadas.');
  process.exit(1);
}
if (STRICT && flaky.length > 0) {
  console.error('\n[flakiness] FAIL (--strict) — flakiness detectada.');
  process.exit(1);
}
process.exit(0);
