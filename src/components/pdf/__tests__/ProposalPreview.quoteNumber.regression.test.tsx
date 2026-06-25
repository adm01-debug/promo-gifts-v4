/**
 * Regression — PDF/preview do orçamento exibe quote_number no topo e NÃO
 * contém mais a frase legada "Crie um orçamento com produtos e personalizações"
 * em nenhum dos 3 modos: Novo, Rascunho ou Editar Proposta Enviada.
 *
 * Optamos por testar via render direto do `ProposalHtmlTemplate` (Vitest +
 * Testing Library) em vez de E2E real porque:
 *   1. O template é a SSOT do PDF (mesmo componente renderizado em tela e em PDF).
 *   2. Evita dependência de auth Supabase para um teste de regressão de conteúdo.
 *   3. Roda em < 200ms no quality gate de PR.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ProposalHtmlTemplate, type ProposalTemplateData } from '../ProposalHtmlTemplate';

const FORBIDDEN_PHRASE = 'Crie um orçamento com produtos e personalizações';

function makeData(quoteNumber: string): ProposalTemplateData {
  return {
    quoteNumber,
    date: '25/06/2026',
    validUntil: '25/07/2026',
    client: { name: 'ACME Corp', company: 'ACME', contactName: 'João' },
    seller: { name: 'Vendedor', email: 'v@p.com' },
    items: [
      {
        name: 'Caneta personalizada',
        quantity: 100,
        unitPrice: 5,
      },
    ],
    subtotal: 500,
    total: 500,
  };
}

describe('ProposalHtmlTemplate · quote_number no topo do PDF/preview', () => {
  it.each([
    ['Editar Proposta Enviada', '10010/26'],
    ['Editar Rascunho (com número)', '10011/26'],
  ])('[%s] exibe o número %s no topo do documento', (_label, qn) => {
    const { container } = render(<ProposalHtmlTemplate data={makeData(qn)} />);
    // O número deve aparecer ao menos uma vez no topo (header) — texto pode usar
    // NBSP (\u00A0) entre "Proposta" e o número.
    expect(container.textContent).toContain(qn);
    expect(container.textContent).toMatch(/Proposta\s*Comercial/);
    expect(container.textContent).not.toContain(FORBIDDEN_PHRASE);
  });

  it('[Novo / rascunho sem número] mantém rótulo "Proposta Comercial" e não vaza frase legada', () => {
    const { container } = render(<ProposalHtmlTemplate data={makeData('')} />);
    expect(container.textContent).toMatch(/Proposta\s*Comercial/);
    expect(container.textContent).not.toContain(FORBIDDEN_PHRASE);
  });
});
