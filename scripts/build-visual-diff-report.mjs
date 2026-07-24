#!/usr/bin/env node
/**
 * Gera um relatório HTML estático com Expected × Actual × Diff lado a lado
 * para todos os snapshots divergentes de um Playwright run.
 *
 * Uso:
 *   node scripts/build-visual-diff-report.mjs \
 *     --results test-results \
 *     --out visual-diff-report/index.html \
 *     [--title "Card Condições"]
 *
 * Lê `test-results/**` procurando trios `*-expected.png` / `*-actual.png` / `*-diff.png`
 * (padrão do Playwright em falhas de toHaveScreenshot) e monta um índice navegável.
 */
import { readdirSync, statSync, mkdirSync, copyFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join, relative, basename } from 'node:path';
import { parseArgs } from 'node:util';

const { values } = parseArgs({
  options: {
    results: { type: 'string', default: 'test-results' },
    out: { type: 'string', default: 'visual-diff-report/index.html' },
    title: { type: 'string', default: 'Visual diff report' },
  },
});

const resultsDir = values.results;
const outHtml = values.out;
const outDir = dirname(outHtml);
const assetsDir = join(outDir, 'assets');

if (!existsSync(resultsDir)) {
  console.error(`[visual-diff] diretório não encontrado: ${resultsDir}`);
  process.exit(0); // não falhar o job — só não há diffs
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) out.push(...walk(full));
    else out.push(full);
  }
  return out;
}

const all = walk(resultsDir);
const groups = new Map();
for (const file of all) {
  const b = basename(file);
  const m = b.match(/^(.*)-(expected|actual|diff)\.png$/i);
  if (!m) continue;
  const [, stem, kind] = m;
  const key = join(dirname(file), stem);
  const g = groups.get(key) ?? {};
  g[kind.toLowerCase()] = file;
  groups.set(key, g);
}

mkdirSync(assetsDir, { recursive: true });

const rows = [];
let idx = 0;
for (const [key, g] of [...groups.entries()].sort()) {
  if (!g.expected && !g.actual && !g.diff) continue;
  const copyAsset = (src) => {
    if (!src) return null;
    const name = `${String(idx).padStart(4, '0')}-${basename(src)}`;
    copyFileSync(src, join(assetsDir, name));
    return `assets/${name}`;
  };
  const exp = copyAsset(g.expected);
  const act = copyAsset(g.actual);
  const dif = copyAsset(g.diff);
  const label = relative(resultsDir, key);
  // Extrai viewport + tema de nomes tipo "...-375-light" / "...-1280-dark"
  const vpMatch = label.match(/(\d{3,4})[-_](light|dark)/i);
  const viewport = vpMatch ? vpMatch[1] : null;
  const theme = vpMatch ? vpMatch[2].toLowerCase() : null;
  const anchor = `case-${idx}`;
  rows.push({ anchor, label, viewport, theme, exp, act, dif });
  idx += 1;
}

const cell = (src, tag) =>
  src
    ? `<figure><figcaption>${tag}</figcaption><a href="${src}" target="_blank" rel="noopener"><img loading="lazy" src="${src}" alt="${tag}"/></a></figure>`
    : `<figure class="empty"><figcaption>${tag}</figcaption><span>—</span></figure>`;

const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"/>
<title>${values.title} — diffs (${rows.length})</title>
<style>
  :root { color-scheme: light dark; }
  body { font: 14px/1.4 system-ui, -apple-system, Segoe UI, Roboto, sans-serif; margin: 24px; }
  h1 { margin: 0 0 8px; font-size: 20px; }
  .meta { color: #6b7280; margin-bottom: 24px; }
  .case { border: 1px solid #e5e7eb; border-radius: 12px; padding: 16px; margin-bottom: 24px; scroll-margin-top: 16px; }
  .case h2 { font-size: 14px; margin: 0 0 12px; font-family: ui-monospace, SFMono-Regular, Menlo, monospace; word-break: break-all; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  figure { margin: 0; border: 1px solid #e5e7eb; border-radius: 8px; overflow: hidden; background: #f9fafb; }
  figcaption { font-size: 12px; font-weight: 600; padding: 6px 10px; background: #f3f4f6; }
  img { display: block; max-width: 100%; height: auto; background: #fff; }
  figure.empty { display: flex; flex-direction: column; align-items: stretch; }
  figure.empty span { padding: 24px; text-align: center; color: #9ca3af; }
  @media (prefers-color-scheme: dark) {
    .case, figure { border-color: #374151; }
    figcaption { background: #1f2937; color: #e5e7eb; }
    figure { background: #111827; }
    .meta { color: #9ca3af; }
  }
</style></head>
<body>
  <h1>${values.title}</h1>
  <p class="meta">${rows.length} snapshot(s) divergente(s) · gerado em ${new Date().toISOString()}</p>
  ${rows
    .map(
      (r) => `
    <section class="case" id="${r.anchor}">
      <h2>${r.label}${r.viewport ? ` <small>[${r.viewport}px · ${r.theme}]</small>` : ''}</h2>
      <div class="grid">
        ${cell(r.exp, 'Expected (baseline)')}
        ${cell(r.act, 'Actual (PR)')}
        ${cell(r.dif, 'Diff')}
      </div>
    </section>`,
    )
    .join('')}
  ${rows.length === 0 ? '<p><em>Nenhum diff encontrado.</em></p>' : ''}
</body></html>`;

mkdirSync(outDir, { recursive: true });
writeFileSync(outHtml, html, 'utf8');

// summary.json — consumido pelo comentário do PR para render de tabela por viewport/tema
const summary = {
  title: values.title,
  generatedAt: new Date().toISOString(),
  total: rows.length,
  cases: rows.map((r) => ({
    anchor: r.anchor,
    label: r.label,
    viewport: r.viewport,
    theme: r.theme,
    hasDiff: Boolean(r.dif),
  })),
};
writeFileSync(join(outDir, 'summary.json'), JSON.stringify(summary, null, 2), 'utf8');
console.log(`[visual-diff] ${rows.length} caso(s) → ${outHtml}`);

