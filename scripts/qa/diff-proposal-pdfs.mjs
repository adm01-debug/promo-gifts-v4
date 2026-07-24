#!/usr/bin/env node
/**
 * PDF visual-regression gate.
 *
 * 1. Regenera HTMLs via vitest (`exportSampleProposal`).
 * 2. Converte para PDF via `scripts/qa/generate-proposal-pdf.mjs`.
 * 3. Rasteriza cada PDF em PNGs (`pdftoppm -r 150`).
 * 4. Compara pixel-a-pixel com `qa/exports/baseline/*.png` usando `pixelmatch`.
 * 5. Falha se o diff exceder o threshold (default 0.1%) e grava
 *    `qa/exports/diff/*.png` como artifact.
 *
 * Modos:
 *   - `--update-baseline` → copia os PNGs atuais para `qa/exports/baseline/`
 *     (sem falhar). Usado por dispatch manual do workflow.
 *   - `SKIP_PDF_VISUAL_GATE=1` → sai com 0 sem comparar (hotfix escape hatch).
 */
import { execSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  copyFileSync,
  statSync,
} from 'node:fs';
import { join, resolve, basename } from 'node:path';
import { PNG } from 'pngjs';
import pixelmatch from 'pixelmatch';

const ROOT = process.cwd();
const EXPORTS_DIR = resolve(ROOT, 'qa/exports');
const BASELINE_DIR = join(EXPORTS_DIR, 'baseline');
const DIFF_DIR = join(EXPORTS_DIR, 'diff');
const RENDER_DIR = join(EXPORTS_DIR, 'rendered');

const UPDATE_BASELINE = process.argv.includes('--update-baseline');
const THRESHOLD_PCT = Number(process.env.PDF_VISUAL_THRESHOLD_PCT ?? '0.1');

if (process.env.SKIP_PDF_VISUAL_GATE === '1') {
  console.log('[pdf-diff] SKIP_PDF_VISUAL_GATE=1 — pulando gate visual do PDF.');
  process.exit(0);
}

mkdirSync(BASELINE_DIR, { recursive: true });
mkdirSync(DIFF_DIR, { recursive: true });
mkdirSync(RENDER_DIR, { recursive: true });

function sh(cmd) {
  console.log(`$ ${cmd}`);
  execSync(cmd, { stdio: 'inherit' });
}

console.log('[pdf-diff] 1/4 · regenerando HTMLs de proposta...');
sh('bunx vitest run exportSampleProposal --silent');

console.log('[pdf-diff] 2/4 · gerando PDFs headless...');
sh('node scripts/qa/generate-proposal-pdf.mjs');

const pdfs = readdirSync(EXPORTS_DIR).filter(
  (f) => f.startsWith('proposal-') && f.endsWith('.pdf'),
);
if (pdfs.length === 0) {
  console.error('[pdf-diff] nenhum PDF gerado em qa/exports/');
  process.exit(1);
}

console.log(`[pdf-diff] 3/4 · rasterizando ${pdfs.length} PDF(s) em PNG (150 DPI)...`);
const renderedByFixture = {};
for (const pdf of pdfs) {
  const fixture = pdf.replace(/\.pdf$/, '');
  const outPrefix = join(RENDER_DIR, fixture);
  sh(`pdftoppm -png -r 150 "${join(EXPORTS_DIR, pdf)}" "${outPrefix}"`);
  renderedByFixture[fixture] = readdirSync(RENDER_DIR)
    .filter((f) => f.startsWith(`${fixture}-`) && f.endsWith('.png'))
    .sort();
}

if (UPDATE_BASELINE) {
  console.log('[pdf-diff] --update-baseline · copiando PNGs para baseline/...');
  for (const [fixture, pngs] of Object.entries(renderedByFixture)) {
    for (const png of pngs) {
      copyFileSync(join(RENDER_DIR, png), join(BASELINE_DIR, png));
      console.log(`  → baseline/${png}`);
    }
  }
  console.log('[pdf-diff] baseline atualizado. Commite qa/exports/baseline/*.png.');
  process.exit(0);
}

console.log('[pdf-diff] 4/4 · comparando com baseline...');
const failures = [];
const missingBaselines = [];

for (const [fixture, pngs] of Object.entries(renderedByFixture)) {
  for (const pngName of pngs) {
    const renderedPath = join(RENDER_DIR, pngName);
    const baselinePath = join(BASELINE_DIR, pngName);

    if (!existsSync(baselinePath)) {
      missingBaselines.push(pngName);
      continue;
    }

    const img1 = PNG.sync.read(readFileSync(baselinePath));
    const img2 = PNG.sync.read(readFileSync(renderedPath));

    if (img1.width !== img2.width || img1.height !== img2.height) {
      failures.push({
        fixture: pngName,
        reason: `dimensão diferente: baseline ${img1.width}x${img1.height} vs render ${img2.width}x${img2.height}`,
        diffPct: 100,
      });
      continue;
    }

    const { width, height } = img1;
    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(img1.data, img2.data, diff.data, width, height, {
      threshold: 0.1,
    });
    const totalPixels = width * height;
    const diffPct = (diffPixels / totalPixels) * 100;

    if (diffPct > THRESHOLD_PCT) {
      const diffPath = join(DIFF_DIR, pngName);
      writeFileSync(diffPath, PNG.sync.write(diff));
      failures.push({ fixture: pngName, diffPct, diffPath });
      console.log(`  ❌ ${pngName} · ${diffPct.toFixed(3)}% divergente (> ${THRESHOLD_PCT}%)`);
    } else {
      console.log(`  ✅ ${pngName} · ${diffPct.toFixed(3)}%`);
    }
  }
}

if (missingBaselines.length > 0) {
  console.error('\n[pdf-diff] baseline ausente para:');
  for (const m of missingBaselines) console.error(`  · ${m}`);
  console.error('\nRode: `node scripts/qa/diff-proposal-pdfs.mjs --update-baseline` e commite qa/exports/baseline/*.png');
  process.exit(2);
}

if (failures.length > 0) {
  console.error(`\n[pdf-diff] ${failures.length} divergência(s) acima de ${THRESHOLD_PCT}%.`);
  console.error('Artifacts de diff: qa/exports/diff/*.png');
  console.error('Se a mudança é intencional, rode:');
  console.error('  node scripts/qa/diff-proposal-pdfs.mjs --update-baseline');
  process.exit(3);
}

console.log(`\n[pdf-diff] ✅ todos os PDFs dentro do threshold ${THRESHOLD_PCT}%.`);
