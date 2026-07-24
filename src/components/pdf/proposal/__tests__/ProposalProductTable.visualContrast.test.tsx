/**
 * Regressão visual + contraste WCAG do PDF da proposta.
 *
 * A) Snapshot HTML (renderToStaticMarkup) detecta mudanças involuntárias
 *    de layout/cor no cabeçalho, linha de conteúdo e badge de gravação.
 *
 * B) Contraste WCAG 2.1 AA (≥ 4.5:1 para texto normal, ≥ 3:1 para
 *    swatch/UI) valida os tokens centralizados em `PDF_TOKENS` contra
 *    os fundos usados (GREEN, rowEven, rowOdd). Falha se algum par
 *    ficar abaixo do mínimo.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProposalProductTable } from '../ProposalProductTable';
import { GREEN, PDF_TOKENS } from '../../ProposalStyles';
import type { ProposalItem } from '../../ProposalHtmlTemplate';

// ---- WCAG helpers ---------------------------------------------------------

function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  const full = h.length === 3 ? h.split('').map((c) => c + c).join('') : h;
  return [
    parseInt(full.slice(0, 2), 16),
    parseInt(full.slice(2, 4), 16),
    parseInt(full.slice(4, 6), 16),
  ];
}

function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((v) => {
    const c = v / 255;
    return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055)**2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrastRatio(fg: string, bg: string): number {
  const l1 = relativeLuminance(fg);
  const l2 = relativeLuminance(bg);
  const [lighter, darker] = l1 > l2 ? [l1, l2] : [l2, l1];
  return (lighter + 0.05) / (darker + 0.05);
}

// ---- Fixtures determinísticos --------------------------------------------

const ITEM_CANONICAL: ProposalItem = {
  name: 'Garrafa esportiva em alumínio 400 ml',
  sku: '94297-7.1',
  color: 'LARANJA',
  colorHex: '#ff8800',
  description: 'Descrição curta.',
  quantity: 200,
  unitPrice: 32.05,
  imageUrl: undefined,
  personalizations: [
    { technique_name: 'Fiber Laser', location_name: 'Lado A', colors_count: 1, width_cm: 3, height_cm: 5 },
  ],
};

// ---- A) Snapshot regression ----------------------------------------------

describe('PDF regressão visual — snapshot renderizado', () => {
  it('1 item · 1 gravação (linha canônica) — snapshot estável', () => {
    const html = renderToStaticMarkup(<ProposalProductTable items={[ITEM_CANONICAL]} />);
    expect(html).toMatchSnapshot();
  });

  it('1 item · 2 gravações (empilhamento) — snapshot estável', () => {
    const html = renderToStaticMarkup(
      <ProposalProductTable
        items={[{
          ...ITEM_CANONICAL,
          personalizations: [
            { technique_name: 'Fiber Laser', location_name: 'Lado A', colors_count: 1, width_cm: 3, height_cm: 5 },
            { technique_name: 'Fiber Laser', location_name: 'Lado B', colors_count: 1, width_cm: 3, height_cm: 4 },
          ],
        }]}
      />,
    );
    expect(html).toMatchSnapshot();
  });

  it('3 itens mistos (com/sem gravação, com/sem cor) — snapshot estável', () => {
    const html = renderToStaticMarkup(
      <ProposalProductTable
        items={[
          ITEM_CANONICAL,
          { ...ITEM_CANONICAL, sku: 'PV-10570', color: 'Colorido', colorHex: '#8844cc', personalizations: [], quantity: 1, unitPrice: 56.44 },
          { ...ITEM_CANONICAL, sku: 'X-1', color: undefined, colorHex: undefined, personalizations: [] },
        ]}
      />,
    );
    expect(html).toMatchSnapshot();
  });
});

// ---- B) Contraste WCAG ----------------------------------------------------

describe('PDF contraste WCAG 2.1', () => {
  const WCAG_AA_TEXT = 4.5;
  const WCAG_AA_UI = 3.0;

  it.each([
    ['texto header preto sobre GREEN', PDF_TOKENS.textOnGreen, GREEN, WCAG_AA_TEXT],
    ['texto body sobre linha par (branca)', PDF_TOKENS.textBody, PDF_TOKENS.rowEven, WCAG_AA_TEXT],
    ['texto body sobre linha ímpar (cinza claro)', PDF_TOKENS.textBody, PDF_TOKENS.rowOdd, WCAG_AA_TEXT],
    ['borda do swatch sobre linha par', PDF_TOKENS.swatchBorder, PDF_TOKENS.rowEven, WCAG_AA_UI],
    ['borda do swatch sobre linha ímpar', PDF_TOKENS.swatchBorder, PDF_TOKENS.rowOdd, WCAG_AA_UI],
    ['swatch fallback (#ccc) sobre linha par — contorno via borda', PDF_TOKENS.swatchBorder, PDF_TOKENS.swatchFallback, WCAG_AA_UI],
  ])('%s ≥ %s:1', (_label, fg, bg, min) => {
    const ratio = contrastRatio(fg, bg);
    expect(ratio, `contraste ${ratio.toFixed(2)}:1 abaixo do mínimo ${min}:1`).toBeGreaterThanOrEqual(min);
  });

  it('caso extremo: swatch branco (#ffffff) sobre linha par (#ffffff) — apenas borda garante visibilidade', () => {
    // O fundo do swatch pode ser igual ao da linha; a borda #666 é o
    // único elemento que garante o contorno visível (≥ 3:1).
    expect(contrastRatio(PDF_TOKENS.swatchBorder, '#ffffff')).toBeGreaterThanOrEqual(WCAG_AA_UI);
  });
});
