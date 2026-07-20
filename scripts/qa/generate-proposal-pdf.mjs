#!/usr/bin/env node
/**
 * Gera PDFs headless a partir dos HTMLs de amostra em `qa/exports/`.
 *
 * Modo padrão: converte TODOS os `proposal-*.html` presentes.
 * Modo filtrado: `--only=<id>` (ou env `PROPOSAL_FIXTURE_ID`) processa
 *   apenas `proposal-<id>.html` — usado pelo `workflow_dispatch` do CI.
 *
 * Uso local:
 *   1. npx vitest run exportSampleProposal   # (re)gera HTMLs
 *   2. node scripts/qa/generate-proposal-pdf.mjs           # todos
 *   3. node scripts/qa/generate-proposal-pdf.mjs --only=10015-26
 */
import { chromium } from 'playwright';
import { existsSync, readdirSync, statSync } from 'node:fs';
import { resolve, join, basename } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const OUT_DIR = resolve(ROOT, 'qa/exports');

const onlyArg = process.argv.find((a) => a.startsWith('--only='))?.slice(7);
const only = onlyArg ?? process.env.PROPOSAL_FIXTURE_ID ?? '';

if (!existsSync(OUT_DIR)) {
  console.error(`[pdf-gen] diretório não encontrado: ${OUT_DIR}`);
  console.error('         rode antes: npx vitest run exportSampleProposal');
  process.exit(1);
}

let htmls = readdirSync(OUT_DIR)
  .filter((f) => f.startsWith('proposal-') && f.endsWith('.html'))
  .map((f) => join(OUT_DIR, f));

if (only) {
  const target = join(OUT_DIR, `proposal-${only}.html`);
  if (!existsSync(target)) {
    console.error(`[pdf-gen] fixture solicitada não encontrada: proposal-${only}.html`);
    console.error(`         disponíveis: ${htmls.map(basename).join(', ') || '(nenhuma)'}`);
    process.exit(1);
  }
  htmls = [target];
}

if (htmls.length === 0) {
  console.error('[pdf-gen] nenhum proposal-*.html encontrado em qa/exports/');
  process.exit(1);
}

const browser = await chromium.launch({
  executablePath: process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH ?? '/opt/pw-browsers/chromium',
});
const summary = [];
try {
  const context = await browser.newContext();
  for (const html of htmls) {
    const pdfPath = html.replace(/\.html$/, '.pdf');
    const page = await context.newPage();
    await page.goto(pathToFileURL(html).href, { waitUntil: 'networkidle' });
    await page.evaluate(() => document.fonts?.ready);
    await page.emulateMedia({ media: 'print' });
    await page.pdf({
      path: pdfPath,
      format: 'A4',
      printBackground: true,
      margin: { top: '0', right: '0', bottom: '0', left: '0' },
      preferCSSPageSize: true,
    });
    await page.close();
    const size = statSync(pdfPath).size;
    summary.push({ pdf: basename(pdfPath), kb: (size / 1024).toFixed(1), size });
  }
} finally {
  await browser.close();
}

for (const s of summary) {
  console.log(`[pdf-gen] OK · ${s.pdf} · ${s.kb} KB`);
}

const suspicious = summary.filter((s) => s.size < 5_000);
if (suspicious.length > 0) {
  console.error(`[pdf-gen] PDFs suspeitos de estar vazios (<5 KB): ${suspicious.map((s) => s.pdf).join(', ')}`);
  process.exit(2);
}
