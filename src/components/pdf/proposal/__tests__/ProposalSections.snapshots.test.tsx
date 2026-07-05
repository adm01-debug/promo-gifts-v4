/**
 * Deliverable #2 — Regressão visual estendida do PDF.
 *
 * Snapshots renderizados (renderToStaticMarkup) de cada seção da proposta,
 * usando os componentes modulares em `src/components/pdf/proposal/*.tsx`.
 * Assim qualquer mudança involuntária de layout/cor em Header, ClientBar,
 * Totals, Notes ou Footer é detectada — não apenas em ProductTable.
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProposalHeader } from '../ProposalHeader';
import { ProposalClientBar } from '../ProposalClientBar';
import { ProposalTotals } from '../ProposalTotals';
import { ProposalNotes } from '../ProposalNotes';
import { ProposalFooter } from '../ProposalFooter';
import { PROPOSAL_10015_26 } from './fixtures/proposal-10015-26';

describe('PDF regressão visual — seções da proposta', () => {
  it('ProposalHeader (primeira página) — snapshot estável', () => {
    const html = renderToStaticMarkup(<ProposalHeader data={PROPOSAL_10015_26} />);
    expect(html).toMatchSnapshot();
  });

  it('ProposalHeader (página de continuação) — snapshot estável', () => {
    const html = renderToStaticMarkup(<ProposalHeader data={PROPOSAL_10015_26} isContinuation />);
    expect(html).toMatchSnapshot();
  });

  it('ProposalClientBar — snapshot estável', () => {
    const html = renderToStaticMarkup(<ProposalClientBar data={PROPOSAL_10015_26} />);
    expect(html).toMatchSnapshot();
  });

  it('ProposalTotals — snapshot estável', () => {
    const html = renderToStaticMarkup(<ProposalTotals data={PROPOSAL_10015_26} />);
    expect(html).toMatchSnapshot();
  });

  it('ProposalNotes — snapshot estável', () => {
    const html = renderToStaticMarkup(<ProposalNotes data={PROPOSAL_10015_26} />);
    expect(html).toMatchSnapshot();
  });

  it('ProposalFooter — snapshot estável', () => {
    const html = renderToStaticMarkup(<ProposalFooter data={PROPOSAL_10015_26} />);
    expect(html).toMatchSnapshot();
  });
});
