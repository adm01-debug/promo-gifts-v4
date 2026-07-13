#!/usr/bin/env node
/**
 * bundle-size-report — Gera resumo em markdown do impacto de bundle do PR
 * comparado com o snapshot em `bundle-size-baseline.json` (baseline do main).
 *
 * NÃO falha o build (gate bloqueante fica em scripts/check-bundle-size.mjs).
 * Emite:
 *   - stdout: markdown para uso em GH Actions (actions/github-script)
 *   - GITHUB_STEP_SUMMARY (se disponível)
 *
 * Uso:
 *   node scripts/bundle-size-report.mjs [--out <file>]
 *
 * Thresholds (alinhados com check-bundle-size.mjs):
 *   ✅ Δ ≤ 5%
 *   ⚠️ 5% < Δ ≤ 15%
 *   🔴 Δ > 15%
 */
import { readdirSync, statSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const DIST_ASSETS = join(ROOT, 'dist', 'assets');
const BASELINE_PATH = join(ROOT, 'bundle-size-baseline.json');

const WARN_PCT = 5;
const FAIL_PCT = 15;

function formatBytes(bytes) {
  if (bytes === 0) return '0 B';
  if (Math.abs(bytes) < 1024) return `${bytes} B`;
  if (Math.abs(bytes) < 1_048_576) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1_048_576).toFixed(2)} MB`;
}

function extractChunkPrefix(filename) {
  const withoutExt = filename.replace(/\.js$/, '');
  const match = withoutExt.match(/^(.+)-[A-Za-z0-9_-]{8,}$/);
  return match ? match[1] : withoutExt;
}

function statusFor(deltaPct, isNew) {
  if (isNew) return '🆕';
  if (Math.abs(deltaPct) <= WARN_PCT) return '✅';
  if (Math.abs(deltaPct) <= FAIL_PCT) return '⚠️';
  return '🔴';
}

export function buildReport({ currentByPrefix, baseline }) {
  const critical = baseline?.criticalChunks ?? {};
  const snapshotByPrefix = baseline?.snapshot?.chunksByPrefix ?? {};

  const rows = [];

  // Critical chunks — always shown
  for (const [prefix, meta] of Object.entries(critical)) {
    const current = currentByPrefix[prefix] ?? 0;
    const prev = meta.currentBytes ?? snapshotByPrefix[prefix] ?? 0;
    const delta = current - prev;
    const pct = prev > 0 ? (delta / prev) * 100 : 0;
    const isNew = prev === 0;
    rows.push({
      prefix,
      label: meta.label ?? prefix,
      critical: true,
      prev,
      current,
      delta,
      pct,
      isNew,
    });
  }

  // Non-critical prefixes with significant delta (> 20KB or > 10%)
  const criticalPrefixes = new Set(Object.keys(critical));
  for (const [prefix, current] of Object.entries(currentByPrefix)) {
    if (criticalPrefixes.has(prefix)) continue;
    const prev = snapshotByPrefix[prefix] ?? 0;
    const delta = current - prev;
    const pct = prev > 0 ? (delta / prev) * 100 : 0;
    if (Math.abs(delta) < 20_480 && Math.abs(pct) < 10) continue;
    rows.push({
      prefix,
      label: prefix,
      critical: false,
      prev,
      current,
      delta,
      pct,
      isNew: prev === 0,
    });
  }

  // Totals
  const totalCurrent = Object.values(currentByPrefix).reduce((a, b) => a + b, 0);
  const totalPrev = baseline?.snapshot?.totalBytes ?? 0;
  const totalDelta = totalCurrent - totalPrev;
  const totalPct = totalPrev > 0 ? (totalDelta / totalPrev) * 100 : 0;

  let md = '### 📦 Bundle size report\n\n';
  md += `**Total JS**: ${formatBytes(totalCurrent)} `;
  md += totalPrev > 0
    ? `(baseline ${formatBytes(totalPrev)}, Δ **${totalDelta >= 0 ? '+' : ''}${formatBytes(totalDelta)}** / ${totalPct >= 0 ? '+' : ''}${totalPct.toFixed(1)}%)\n\n`
    : '(sem baseline)\n\n';

  md += '#### Chunks críticos\n\n';
  md += '| Chunk | Baseline | PR | Δ | Δ % | Status |\n';
  md += '|---|---:|---:|---:|---:|:---:|\n';
  for (const r of rows.filter((r) => r.critical)) {
    const deltaStr = r.isNew ? '—' : `${r.delta >= 0 ? '+' : ''}${formatBytes(r.delta)}`;
    const pctStr = r.isNew ? '—' : `${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(1)}%`;
    md += `| \`${r.prefix}\` (${r.label}) | ${formatBytes(r.prev)} | ${formatBytes(r.current)} | ${deltaStr} | ${pctStr} | ${statusFor(r.pct, r.isNew)} |\n`;
  }

  const nonCritical = rows.filter((r) => !r.critical);
  if (nonCritical.length > 0) {
    md += '\n#### Outros chunks com variação relevante\n\n';
    md += '| Chunk | Baseline | PR | Δ | Δ % | Status |\n';
    md += '|---|---:|---:|---:|---:|:---:|\n';
    for (const r of nonCritical.sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 15)) {
      const deltaStr = r.isNew ? '—' : `${r.delta >= 0 ? '+' : ''}${formatBytes(r.delta)}`;
      const pctStr = r.isNew ? '—' : `${r.pct >= 0 ? '+' : ''}${r.pct.toFixed(1)}%`;
      md += `| \`${r.prefix}\` | ${formatBytes(r.prev)} | ${formatBytes(r.current)} | ${deltaStr} | ${pctStr} | ${statusFor(r.pct, r.isNew)} |\n`;
    }
  }

  md += '\n<sub>Thresholds: ✅ Δ ≤ 5% · ⚠️ 5–15% · 🔴 > 15% (mesmo gate bloqueante em `scripts/check-bundle-size.mjs`)</sub>\n';
  md += '<!-- bundle-size-report -->\n';
  return md;
}

function readCurrentByPrefix() {
  if (!existsSync(DIST_ASSETS)) {
    console.error('❌ dist/assets/ não encontrado. Rode `npm run build` primeiro.');
    process.exit(2);
  }
  const byPrefix = {};
  for (const name of readdirSync(DIST_ASSETS)) {
    if (!name.endsWith('.js')) continue;
    const size = statSync(join(DIST_ASSETS, name)).size;
    const prefix = extractChunkPrefix(name);
    byPrefix[prefix] = (byPrefix[prefix] ?? 0) + size;
  }
  return byPrefix;
}

function main() {
  const outIdx = process.argv.indexOf('--out');
  const outFile = outIdx > -1 ? process.argv[outIdx + 1] : null;

  const currentByPrefix = readCurrentByPrefix();
  const baseline = existsSync(BASELINE_PATH)
    ? JSON.parse(readFileSync(BASELINE_PATH, 'utf8'))
    : null;

  const md = buildReport({ currentByPrefix, baseline });
  process.stdout.write(md);

  if (outFile) writeFileSync(outFile, md);
  if (process.env.GITHUB_STEP_SUMMARY) {
    try {
      writeFileSync(process.env.GITHUB_STEP_SUMMARY, md, { flag: 'a' });
    } catch {
      /* noop */
    }
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main();
}
