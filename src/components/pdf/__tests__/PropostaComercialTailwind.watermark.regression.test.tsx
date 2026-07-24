/**
 * Regression — marca d'água "RASCUNHO" no template do PDF.
 *
 * Contexto: em 2026-07-05 o botão "Gerar PDF" do PdfGenerationDialog estava
 * chamando `generateProposalPDFv2(proposalData)` SEM propagar `{ isDraft }`,
 * fazendo com que rascunhos saíssem sem marca d'água — risco operacional
 * grave (proposta em rascunho podia ser enviada como final).
 *
 * Este teste guarda o contrato do template, que é a SSOT visual do PDF:
 *   • isDraft === true  → exatamente 1 "RASCUNHO" por página, com cor esperada
 *   • isDraft === false → nenhuma ocorrência da palavra "RASCUNHO"
 *   • Multi-página      → todas as páginas exibem a marca d'água
 *
 * Roda em < 200ms e não depende de html2canvas nem de auth Supabase.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { PropostaComercialTailwind } from '../PropostaComercialTailwind';
import type { ProposalTemplateData, ProposalItem } from '../ProposalHtmlTemplate';
import { WATERMARK_TEXT, WATERMARK_RGB, WATERMARK_ALPHA } from '../watermarkTokens';

function makeItem(overrides: Partial<ProposalItem> = {}): ProposalItem {
  return {
    name: 'Caneta Personalizada',
    quantity: 100,
    unitPrice: 3.5,
    ...overrides,
  };
}

function makeData(
  itemCount = 1,
  overrides: Partial<ProposalTemplateData> = {},
): ProposalTemplateData {
  return {
    quoteNumber: '10015/26',
    date: '05/07/2026',
    validUntil: '15 dias',
    client: { name: 'Empresa Teste LTDA', company: 'Empresa Teste' },
    seller: { name: 'Vendedor', email: 'v@promobrindes.com.br' },
    items: Array.from({ length: itemCount }, (_, i) => makeItem({ name: `Produto ${i + 1}` })),
    subtotal: itemCount * 350,
    total: itemCount * 350,
    ...overrides,
  };
}

describe('PropostaComercialTailwind · watermark RASCUNHO (regression)', () => {
  it(`isDraft=true renderiza exatamente 1 "${WATERMARK_TEXT}" por página`, () => {
    const { container } = render(<PropostaComercialTailwind data={makeData()} isDraft />);
    const pageCount = container.querySelectorAll('.proposal-page').length;
    expect(pageCount, 'documento sem páginas renderizadas').toBeGreaterThan(0);

    const watermarks = Array.from(container.querySelectorAll('div')).filter(
      (el) => el.textContent === WATERMARK_TEXT,
    );
    expect(watermarks.length).toBe(pageCount);
  });

  it('isDraft=false NÃO renderiza a palavra "RASCUNHO" no documento (evita falso positivo)', () => {
    const { container } = render(<PropostaComercialTailwind data={makeData()} isDraft={false} />);
    expect(container.textContent).not.toContain('RASCUNHO');
  });

  it('isDraft default (não passado) NÃO renderiza "RASCUNHO"', () => {
    const { container } = render(<PropostaComercialTailwind data={makeData()} />);
    expect(container.textContent).not.toContain('RASCUNHO');
  });

  it("marca d'água usa os tokens SSOT (cor derivada de watermarkTokens)", () => {
    const { container } = render(<PropostaComercialTailwind data={makeData()} isDraft />);
    const watermark = Array.from(container.querySelectorAll('div')).find(
      (el) => el.textContent === WATERMARK_TEXT,
    );
    expect(watermark, 'watermark não encontrado').toBeTruthy();
    // Cor derivada dos tokens: aceita tolerância de arredondamento do jsdom no alpha
    // (0.0805 → normalmente serializado como "0.08" ou "0.081").
    const color = (watermark as HTMLElement).style.color.replace(/\s/g, '');
    const alphaRounded = Number(WATERMARK_ALPHA.toFixed(2)); // 0.08
    const alphaPattern = new RegExp(
      `^rgba\\(${WATERMARK_RGB.r},${WATERMARK_RGB.g},${WATERMARK_RGB.b},${alphaRounded}\\d?\\)$`,
    );
    expect(color).toMatch(alphaPattern);
    // Contrato visual mínimo: rotacionado, uppercase, pointer-events none.
    const st = (watermark as HTMLElement).style;
    expect(st.textTransform).toBe('uppercase');
    expect(st.pointerEvents).toBe('none');
    expect(st.transform).toMatch(/rotate\(-35deg\)/);
  });

  it('multi-página: RASCUNHO aparece em TODAS as páginas quando isDraft=true', () => {
    // 30 itens força paginação multi-página no template.
    const data = makeData(30);
    const { container } = render(<PropostaComercialTailwind data={data} isDraft />);
    const pages = container.querySelectorAll('.proposal-page');
    expect(pages.length, 'fixture não gerou multi-página').toBeGreaterThan(1);

    // Cada page precisa ter exatamente um filho direto com textContent === "RASCUNHO".
    for (const [idx, page] of Array.from(pages).entries()) {
      const wm = Array.from(page.querySelectorAll('div')).filter(
        (el) => el.textContent === 'RASCUNHO',
      );
      expect(wm.length, `página ${idx + 1} sem watermark`).toBe(1);
    }
  });

  it('multi-página + isDraft=false: nenhuma página exibe RASCUNHO', () => {
    const data = makeData(30);
    const { container } = render(<PropostaComercialTailwind data={data} isDraft={false} />);
    const pages = container.querySelectorAll('.proposal-page');
    expect(pages.length).toBeGreaterThan(1);
    for (const page of Array.from(pages)) {
      expect(page.textContent).not.toContain('RASCUNHO');
    }
  });
});
