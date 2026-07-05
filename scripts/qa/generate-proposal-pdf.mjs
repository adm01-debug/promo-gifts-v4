#!/usr/bin/env node
/**
 * Gera o PDF headless da proposta 10015/26 a partir do HTML de amostra
 * produzido por `exportSampleProposal.test.tsx`.
 *
 * Entrada:  qa/exports/proposal-10015-26.html
 * Saída:    qa/exports/proposal-10015-26.pdf
 *
 * Uso:
 *   1. npx vitest run exportSampleProposal   # (re)gera o HTML
 *   2. node scripts/qa/generate-proposal-pdf.mjs
 *
 * No CI o job `pdf-quality` roda os dois passos em sequência.
 */
import { chromium } from 'playwright';
import { existsSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const ROOT = process.cwd();
const HTML = resolve(ROOT, 'qa/exports/proposal-10015-26.html');
const PDF = resolve(ROOT, 'qa/exports/proposal-10015-26.pdf');

if (!existsSync(HTML)) {
  console.error(`[pdf-gen] HTML não encontrado: ${HTML}`);
  console.error('         Rode antes:  npx vitest run exportSampleProposal');
  process.exit(1);
}

const browser = await chromium.launch();
try {
  const context = await browser.newContext();
  const page = await context.newPage();
  await page.goto(pathToFileURL(HTML).href, { waitUntil: 'networkidle' });
  // Aguarda fontes (Roboto/Montserrat carregados via Google Fonts) antes de imprimir.
  await page.evaluate(() => document.fonts?.ready);
  await page.emulateMedia({ media: 'print' });
  await page.pdf({
    path: PDF,
    format: 'A4',
    printBackground: true,
    margin: { top: '0', right: '0', bottom: '0', left: '0' },
    preferCSSPageSize: true,
  });
} finally {
  await browser.close();
}

const size = statSync(PDF).size;
console.log(`[pdf-gen] OK · ${PDF} · ${(size / 1024).toFixed(1)} KB`);
if (size < 5_000) {
  console.error('[pdf-gen] PDF suspeito de estar vazio (< 5 KB).');
  process.exit(2);
}
