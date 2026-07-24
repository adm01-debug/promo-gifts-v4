/**
 * Paridade de largura entre o bloco de totais do PDF interno
 * (`ProposalSections.TotalsSection`) e o da proposta exportada
 * (`proposal/ProposalTotals`).
 *
 * Guarda o SSOT `TOTALS_BLOCK_WIDTH_PX` — se alguém trocar a largura
 * inline em qualquer um dos dois componentes, este teste falha antes
 * de o PDF divergir em produção.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProposalTotals } from '../ProposalTotals';
import { TotalsSection } from '../../ProposalSections';
import { TOTALS_BLOCK_WIDTH_PX } from '../../ProposalStyles';
import { PROPOSAL_10015_26 } from './fixtures/proposal-10015-26';

describe('PDF totais — paridade de largura', () => {
  it('ProposalTotals (proposta exportada) usa TOTALS_BLOCK_WIDTH_PX', () => {
    const html = renderToStaticMarkup(<ProposalTotals data={PROPOSAL_10015_26} />);
    expect(html).toContain(`width:${TOTALS_BLOCK_WIDTH_PX}px`);
  });

  it('TotalsSection (PDF interno) usa TOTALS_BLOCK_WIDTH_PX', () => {
    const html = renderToStaticMarkup(<TotalsSection data={PROPOSAL_10015_26} />);
    expect(html).toContain(`width:${TOTALS_BLOCK_WIDTH_PX}px`);
  });

  it('constante reflete o aumento de 20% (valor atual = 276px)', () => {
    expect(TOTALS_BLOCK_WIDTH_PX).toBe(276);
  });

});
