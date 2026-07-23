#!/usr/bin/env node
/**
 * Round Quality Report
 * --------------------
 * Executa após cada rodada de mudanças e gera um relatório automático com:
 *   • Erros TypeScript (atual vs baseline em .tsc-baseline.json)
 *   • Erros ESLint (atual vs baseline em .eslint-baseline.json)
 *   • Arquivos alterados na rodada (git diff --name-status)
 *   • Tendência vs a rodada anterior (delta TS/ESLint/arquivos)
 *
 * Saídas:
 *   • qa/quality-rounds/round-<timestamp>.json  (histórico completo)
 *   • qa/quality-rounds/latest.json             (símbolo para a última rodada)
 *   • qa/quality-rounds/history.jsonl           (uma linha por rodada, p/ trend)
 *   • qa/quality-rounds/latest.md               (resumo humano)
 *   • Resumo pretty-print no stdout
 *
 * Uso:
 *   node scripts/round-quality-report.mjs               # base = HEAD~1
 *   node scripts/round-quality-report.mjs --base main   # base custom
 *   node scripts/round-quality-report.mjs --no-eslint   # pula ESLint (rápido)
 *   node scripts/round-quality-report.mjs --no-ts       # pula tsc
 *
 * Exit codes:
 *   0 — relatório gerado (mesmo com regressões — não é um gate)
 *   2 — falha de execução (tsc/eslint crashou de forma inesperada)
 */
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, writeFileSync, appendFileSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const OUT_DIR = join(ROOT, 'qa', 'quality-rounds');
const TS_BASELINE = join(ROOT, '.tsc-baseline.json');
const ESLINT_BASELINE = join(ROOT, '.eslint-baseline.json');
const TSC_BIN = join(ROOT, 'node_modules', 'typescript', 'bin', 'tsc');
const ESLINT_BIN = join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');

const args = new Set(process.argv.slice(2));
const argValue = (name) => {
  const i = process.argv.indexOf(name);
  return i >= 0 ? process.argv[i + 1] : null;
};
const runTs = !args.has('--no-ts');
const runEslint = !args.has('--no-eslint');
const baseRef = argValue('--base') ?? 'HEAD~1';

mkdirSync(OUT_DIR, { recursive: true });

const log = (msg) => console.log(msg);
const fmtDelta = (n) => (n > 0 ? `+${n}` : String(n));
const now = new Date();
const timestamp = now.toISOString().replace(/[:.]/g, '-');

// ── 1. TypeScript ──────────────────────────────────────────────────────────
function runTypescript() {
  if (!runTs) return { skipped: true };
  if (!existsSync(TSC_BIN)) return { skipped: true, reason: 'tsc não instalado' };

  log('⏳ Rodando tsc -p tsconfig.app.json --noEmit ...');
  const res = spawnSync(process.execPath, [TSC_BIN, '-p', 'tsconfig.app.json', '--noEmit'], {
    encoding: 'utf8',
    maxBuffer: 100 * 1024 * 1024,
  });
  if (res.status === null || res.error) {
    return { error: res.error?.message || 'tsc crash' };
  }
  const output = (res.stdout || '') + (res.stderr || '');
  const ERR_RE = /^(\S+\.tsx?)\(\d+,\d+\): error (TS\d+):/;
  const byFile = {};
  const byRule = {};
  let total = 0;
  for (const line of output.split('\n')) {
    const m = line.match(ERR_RE);
    if (!m) continue;
    const [, file, rule] = m;
    byFile[file] = (byFile[file] || 0) + 1;
    byRule[rule] = (byRule[rule] || 0) + 1;
    total++;
  }
  return { total, byFile, byRule };
}

// ── 2. ESLint ──────────────────────────────────────────────────────────────
function runEslintCheck() {
  if (!runEslint) return { skipped: true };
  if (!existsSync(ESLINT_BIN)) return { skipped: true, reason: 'eslint não instalado' };

  log('⏳ Rodando eslint . --format json ...');
  const res = spawnSync(
    process.execPath,
    [ESLINT_BIN, '.', '--format', 'json', '--no-warn-ignored'],
    { encoding: 'utf8', maxBuffer: 200 * 1024 * 1024 },
  );
  if (res.status === null || res.error) {
    return { error: res.error?.message || 'eslint crash' };
  }
  let results;
  try {
    results = JSON.parse(res.stdout || '[]');
  } catch (err) {
    return { error: `parse ESLint JSON: ${(err instanceof Error ? err.message : String(err))}` };
  }
  const byFile = {};
  const byRule = {};
  let total = 0;
  for (const file of results) {
    const rel = file.filePath.replace(`${ROOT}/`, '');
    for (const msg of file.messages) {
      if (msg.severity !== 2) continue; // só erros
      byFile[rel] = (byFile[rel] || 0) + 1;
      const rule = msg.ruleId || '<parser>';
      byRule[rule] = (byRule[rule] || 0) + 1;
      total++;
    }
  }
  return { total, byFile, byRule };
}

// ── 3. Arquivos alterados (git) ────────────────────────────────────────────
function gitChangedFiles() {
  const res = spawnSync('git', ['diff', '--name-status', `${baseRef}...HEAD`], {
    encoding: 'utf8',
  });
  if (res.status !== 0) return { error: (res.stderr || '').trim(), files: [] };
  const files = [];
  for (const line of (res.stdout || '').split('\n')) {
    if (!line.trim()) continue;
    const [status, ...rest] = line.split('\t');
    files.push({ status, path: rest.join('\t') });
  }
  return { files };
}

function readBaselineTotals() {
  const out = { ts: null, eslint: null };
  try {
    if (existsSync(TS_BASELINE)) {
      out.ts = JSON.parse(readFileSync(TS_BASELINE, 'utf8')).totalErrors ?? null;
    }
  } catch {}
  try {
    if (existsSync(ESLINT_BASELINE)) {
      out.eslint = JSON.parse(readFileSync(ESLINT_BASELINE, 'utf8')).totalErrors ?? null;
    }
  } catch {}
  return out;
}

function readPreviousRound() {
  const historyPath = join(OUT_DIR, 'history.jsonl');
  if (!existsSync(historyPath)) return null;
  const lines = readFileSync(historyPath, 'utf8').trim().split('\n').filter(Boolean);
  if (lines.length === 0) return null;
  try {
    return JSON.parse(lines[lines.length - 1]);
  } catch {
    return null;
  }
}

// ── Execução ───────────────────────────────────────────────────────────────
const ts = runTypescript();
const eslint = runEslintCheck();
const git = gitChangedFiles();
const baseline = readBaselineTotals();
const prev = readPreviousRound();

const report = {
  timestamp: now.toISOString(),
  base: baseRef,
  typescript: ts,
  eslint,
  changedFiles: git.files ?? [],
  changedFilesError: git.error ?? null,
  baseline,
  trend: {
    tsVsPrev: ts?.total != null && prev?.typescript?.total != null
      ? ts.total - prev.typescript.total
      : null,
    eslintVsPrev: eslint?.total != null && prev?.eslint?.total != null
      ? eslint.total - prev.eslint.total
      : null,
    tsVsBaseline: ts?.total != null && baseline.ts != null ? ts.total - baseline.ts : null,
    eslintVsBaseline:
      eslint?.total != null && baseline.eslint != null ? eslint.total - baseline.eslint : null,
  },
};

// ── Persistência ───────────────────────────────────────────────────────────
const jsonPath = join(OUT_DIR, `round-${timestamp}.json`);
writeFileSync(jsonPath, JSON.stringify(report, null, 2));
writeFileSync(join(OUT_DIR, 'latest.json'), JSON.stringify(report, null, 2));
appendFileSync(join(OUT_DIR, 'history.jsonl'), JSON.stringify(report) + '\n');

// ── Markdown ───────────────────────────────────────────────────────────────
const topEntries = (obj, n = 5) =>
  Object.entries(obj || {})
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `  - \`${k}\` — ${v}`)
    .join('\n') || '  _(nenhum)_';

const md = `# Round Quality Report — ${now.toISOString()}

**Base git:** \`${baseRef}\`

## TypeScript
- Total: **${ts?.total ?? (ts?.skipped ? 'skipped' : 'erro')}**
- Baseline: ${baseline.ts ?? '—'} (delta: ${report.trend.tsVsBaseline != null ? fmtDelta(report.trend.tsVsBaseline) : '—'})
- Vs rodada anterior: ${report.trend.tsVsPrev != null ? fmtDelta(report.trend.tsVsPrev) : '—'}
- Top arquivos:
${topEntries(ts?.byFile)}
- Top regras:
${topEntries(ts?.byRule)}

## ESLint
- Total: **${eslint?.total ?? (eslint?.skipped ? 'skipped' : 'erro')}**
- Baseline: ${baseline.eslint ?? '—'} (delta: ${report.trend.eslintVsBaseline != null ? fmtDelta(report.trend.eslintVsBaseline) : '—'})
- Vs rodada anterior: ${report.trend.eslintVsPrev != null ? fmtDelta(report.trend.eslintVsPrev) : '—'}
- Top arquivos:
${topEntries(eslint?.byFile)}
- Top regras:
${topEntries(eslint?.byRule)}

## Arquivos alterados (${report.changedFiles.length})
${report.changedFiles.slice(0, 40).map((f) => `- \`${f.status}\` ${f.path}`).join('\n') || '_(nenhum)_'}
${report.changedFiles.length > 40 ? `\n_… +${report.changedFiles.length - 40} arquivos_` : ''}
`;
writeFileSync(join(OUT_DIR, 'latest.md'), md);

// ── Console summary ────────────────────────────────────────────────────────
const trendIcon = (n) => (n == null ? '·' : n > 0 ? '⬆' : n < 0 ? '⬇' : '=');
log('');
log('═══════════════════════════════════════════════════════════════');
log(`  Round Quality Report — ${now.toISOString()}`);
log('═══════════════════════════════════════════════════════════════');
log(`  TypeScript : ${String(ts?.total ?? (ts?.skipped ? 'skipped' : 'ERR')).padStart(5)} `
  + `${trendIcon(report.trend.tsVsPrev)} prev(${report.trend.tsVsPrev ?? '—'}) `
  + `${trendIcon(report.trend.tsVsBaseline)} baseline(${report.trend.tsVsBaseline ?? '—'})`);
log(`  ESLint     : ${String(eslint?.total ?? (eslint?.skipped ? 'skipped' : 'ERR')).padStart(5)} `
  + `${trendIcon(report.trend.eslintVsPrev)} prev(${report.trend.eslintVsPrev ?? '—'}) `
  + `${trendIcon(report.trend.eslintVsBaseline)} baseline(${report.trend.eslintVsBaseline ?? '—'})`);
log(`  Arquivos   : ${report.changedFiles.length} alterados (base ${baseRef})`);
log('───────────────────────────────────────────────────────────────');
log(`  📄 ${jsonPath.replace(ROOT + '/', '')}`);
log(`  📝 qa/quality-rounds/latest.md`);
log(`  📊 qa/quality-rounds/history.jsonl (${
  existsSync(join(OUT_DIR, 'history.jsonl'))
    ? readFileSync(join(OUT_DIR, 'history.jsonl'), 'utf8').trim().split('\n').length
    : 0
} rodadas)`);
log('═══════════════════════════════════════════════════════════════');

if (ts?.error) console.error(`⚠ TypeScript: ${ts.error}`);
if (eslint?.error) console.error(`⚠ ESLint: ${eslint.error}`);
process.exit(ts?.error || eslint?.error ? 2 : 0);
