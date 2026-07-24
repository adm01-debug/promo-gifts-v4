/**
 * Unit — ProposalHeader exibe o quote_number no topo do PDF/preview.
 * Regressão: garante que a numeração aparece em modo full e em continuação,
 * para novos orçamentos (vazio → ainda renderiza "Proposta") e salvos.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ProposalHeader } from '../proposal/ProposalHeader';
import type { ProposalTemplateData } from '../ProposalHtmlTemplate';

const baseData: ProposalTemplateData = {
  quoteNumber: '10010/26',
  date: '25/06/2026',
  validUntil: '25/07/2026',
  client: { name: 'ACME' },
  seller: { name: 'Vendedor Teste' },
  items: [],
  subtotal: 0,
  total: 0,
};

describe('ProposalHeader · quote_number no topo', () => {
  it('renderiza "Proposta 10010/26" no header principal', () => {
    const { container } = render(<ProposalHeader data={baseData} />);
    expect(container.textContent).toMatch(/Proposta\s*10010\/26/);
  });

  it('renderiza "Proposta 10010/26" no header de continuação', () => {
    const { container } = render(<ProposalHeader data={baseData} isContinuation />);
    expect(container.textContent).toMatch(/Proposta\s*10010\/26/);
    expect(container.textContent).toMatch(/Continuação/);
  });

  it('em modo novo/rascunho (quoteNumber vazio) ainda renderiza o rótulo "Proposta"', () => {
    const draft = { ...baseData, quoteNumber: '' };
    const { container } = render(<ProposalHeader data={draft} />);
    // Sem número definitivo, deve manter o rótulo principal sem quebrar.
    expect(container.textContent).toMatch(/Proposta\s*Comercial/);
    expect(container.textContent).toMatch(/Proposta/);
  });
});
