/**
 * Regressão SSOT — `TOTALS_BLOCK_WIDTH_PX` deve ser a ÚNICA fonte de
 * largura do bloco de totais.
 *
 * Falha se:
 *  - Algum componente relacionado (`ProposalTotals.tsx`, `ProposalSections.tsx`)
 *    voltar a inline uma largura literal (`width: '230px'`, `width:243px`, etc.)
 *    para o wrapper do totals.
 *  - Algum export HTML em `qa/exports/proposal-*.html` divergir da constante.
 *
 * Isso captura o caso real que motivou o SSOT: `ProposalTotals` usava 230px
 * e `TotalsSection` usava 243px — divergência silenciosa entre as duas
 * variações do PDF.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { TOTALS_BLOCK_WIDTH_PX } from '../../ProposalStyles';

const ROOT = resolve(__dirname, '../../../../..');

/** Regex genérico p/ largura inline com valor literal em px (JSX ou CSS string). */
// Aceita: width: '230px' | width:"230px" | width: `230px` | width:230px
const LITERAL_WIDTH_RE = /width\s*:\s*['"`]?(\d{2,4})px['"`]?/g;

/** Arquivos onde a largura DEVE vir da constante (não pode haver literal). */
const COMPONENT_FILES = [
  'src/components/pdf/proposal/ProposalTotals.tsx',
  'src/components/pdf/ProposalSections.tsx',
];

/**
 * Larguras que naturalmente aparecem nesses arquivos por outras razões
 * (thumbs, colunas de tabela, SVG do header/footer, swatches, etc.).
 * Só a largura do wrapper de totais precisa vir do SSOT — todo o resto
 * é irrelevante para este teste e fica no allowlist.
 */
const UNRELATED_WIDTHS = new Set<number>([
  4, 6, 7, 14, 30, 50, 55, 80, 90, 100, 110, 160, 180, 314, 324, 480, 505, 794, 1123,
]);

describe('SSOT — TOTALS_BLOCK_WIDTH_PX', () => {
  it.each(COMPONENT_FILES)(
    '%s não usa largura literal em px equivalente à do bloco de totais',
    (relPath) => {
      const src = readFileSync(join(ROOT, relPath), 'utf8');
      const offenders: string[] = [];
      for (const match of src.matchAll(LITERAL_WIDTH_RE)) {
        const px = Number(match[1]);
        if (UNRELATED_WIDTHS.has(px)) continue;
        // Qualquer largura "grande" restante (que não esteja no allowlist)
        // provavelmente é o wrapper de totais — deve vir da constante.
        offenders.push(match[0]);
      }
      expect(
        offenders,
        `Encontrado literal em ${relPath}: ${offenders.join(', ')}. ` +
          `Use TOTALS_BLOCK_WIDTH_PX de ProposalStyles ou adicione a largura ao allowlist.`,
      ).toEqual([]);
    },
  );

  it('exports HTML em qa/exports/ usam a largura do SSOT', () => {
    const exportsDir = join(ROOT, 'qa/exports');
    const files = readdirSync(exportsDir).filter(
      (f) => f.startsWith('proposal-') && f.endsWith('.html'),
    );
    expect(files.length, 'esperava ao menos uma fixture exportada').toBeGreaterThan(0);

    const expected = `width:${TOTALS_BLOCK_WIDTH_PX}px`;
    // Todas as larguras potencialmente conflitantes com totais.
    // Se o teste falhar aqui, rode `bunx vitest run exportSampleProposal -u`
    // (ou o helper `scripts/qa/generate-proposal-pdf.mjs`) para regenerar.
    const forbidden = [/width:230px/, /width:243px/, /width:288px/, /width:304px/]

      .map((r) => r.source)
      .filter((s) => s !== `width:${TOTALS_BLOCK_WIDTH_PX}px`);

    for (const file of files) {
      const html = readFileSync(join(exportsDir, file), 'utf8');
      expect(html, `${file} não contém a largura canônica`).toContain(expected);
      for (const bad of forbidden) {
        expect(html, `${file} ainda contém largura antiga: ${bad}`).not.toMatch(new RegExp(bad));
      }
    }
  });
});
