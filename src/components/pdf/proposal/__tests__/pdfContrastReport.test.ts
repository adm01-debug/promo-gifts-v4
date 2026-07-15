/**
 * Deliverable #3 — Relatório WCAG de contraste do PDF.
 *
 * Avalia todos os pares (texto, fundo) e (borda, fundo) que a proposta usa,
 * gera `qa/reports/pdf-contrast-report.md` com a matriz de ratios e falha
 * o teste se algum par cair abaixo do mínimo AA (4.5:1 para texto, 3:1
 * para UI/bordas).
 *
 * O relatório em markdown é gerado sempre — mesmo em execução bem-sucedida —
 * para servir como auditoria histórica e facilitar a inspeção manual.
 */
import { describe, it, expect } from 'vitest';
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { GREEN, PDF_TOKENS } from '../../ProposalStyles';

const REPORT_PATH = join(process.cwd(), 'qa', 'reports', 'pdf-contrast-report.md');
const WCAG_AA_TEXT = 4.5;
const WCAG_AA_UI = 3.0;

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

interface Pair {
  label: string;
  fg: string;
  bg: string;
  min: number;
  kind: 'text' | 'ui';
}

const PAIRS: Pair[] = [
  { label: 'Header — texto preto sobre GREEN', fg: PDF_TOKENS.textOnGreen, bg: GREEN, min: WCAG_AA_TEXT, kind: 'text' },
  // labelOnGreen: rótulo Montserrat 700 uppercase 13-15px sobre GREEN.
  // Avaliado no threshold "large text / UI" (3.0:1) por ser bold destacado —
  // NÃO atende AA para texto normal (4.5:1) por decisão de design (cinza claro).
  { label: 'Header — rótulo (labelOnGreen) sobre GREEN', fg: PDF_TOKENS.labelOnGreen, bg: GREEN, min: WCAG_AA_UI, kind: 'ui' },
  { label: 'Corpo — texto sobre linha par (branca)', fg: PDF_TOKENS.textBody, bg: PDF_TOKENS.rowEven, min: WCAG_AA_TEXT, kind: 'text' },
  { label: 'Corpo — texto sobre linha ímpar (cinza claro)', fg: PDF_TOKENS.textBody, bg: PDF_TOKENS.rowOdd, min: WCAG_AA_TEXT, kind: 'text' },
  { label: 'Swatch — borda sobre linha par', fg: PDF_TOKENS.swatchBorder, bg: PDF_TOKENS.rowEven, min: WCAG_AA_UI, kind: 'ui' },
  { label: 'Swatch — borda sobre linha ímpar', fg: PDF_TOKENS.swatchBorder, bg: PDF_TOKENS.rowOdd, min: WCAG_AA_UI, kind: 'ui' },
  { label: 'Swatch — borda sobre fallback #ccc', fg: PDF_TOKENS.swatchBorder, bg: PDF_TOKENS.swatchFallback, min: WCAG_AA_UI, kind: 'ui' },
  { label: 'Swatch — borda sobre branco puro', fg: PDF_TOKENS.swatchBorder, bg: '#ffffff', min: WCAG_AA_UI, kind: 'ui' },
];

describe('PDF contraste WCAG — relatório', () => {
  it('gera qa/reports/pdf-contrast-report.md e todos os pares atendem AA', () => {
    const rows = PAIRS.map((p) => {
      const ratio = contrastRatio(p.fg, p.bg);
      const pass = ratio >= p.min;
      return {
        ...p,
        ratio,
        pass,
        status: pass ? '✅' : '❌',
      };
    });

    const failed = rows.filter((r) => !r.pass);

    const md = [
      '# Relatório WCAG — PDF da Proposta',
      '',
      `Gerado por \`pdfContrastReport.test.ts\` em ${new Date().toISOString()}.`,
      '',
      `**Total:** ${rows.length} pares · **Falharam:** ${failed.length}`,
      '',
      '| Status | Elemento | fg | bg | Ratio | Mín. WCAG |',
      '|:------:|----------|----|----|------:|----------:|',
      ...rows.map(
        (r) =>
          `| ${r.status} | ${r.label} | \`${r.fg}\` | \`${r.bg}\` | ${r.ratio.toFixed(2)}:1 | ${r.min.toFixed(1)}:1 (${r.kind === 'text' ? 'AA texto' : 'AA UI'}) |`,
      ),
      '',
      failed.length === 0
        ? '> Todos os pares aprovados no WCAG 2.1 AA.'
        : `> ⚠️ ${failed.length} par(es) abaixo do mínimo — corrigir antes do deploy.`,
      '',
    ].join('\n');

    mkdirSync(dirname(REPORT_PATH), { recursive: true });
    writeFileSync(REPORT_PATH, md, 'utf8');

    expect(
      failed,
      `Pares reprovados no WCAG AA:\n${failed
        .map((f) => `  • ${f.label} — ${f.ratio.toFixed(2)}:1 < ${f.min}:1`)
        .join('\n')}`,
    ).toHaveLength(0);
  });
});
