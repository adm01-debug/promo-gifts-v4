/**
 * Deliverable #2 — Regressão visual estendida do PDF.
 *
 * Snapshots renderizados (renderToStaticMarkup) de cada seção da proposta,
 * usando os componentes modulares em `src/components/pdf/proposal/*.tsx`.
 * Assim qualquer mudança involuntária de layout/cor em Header, ClientBar,
 * Totals, Notes ou Footer é detectada — não apenas em ProductTable.
 */
import React from 'react';
import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { ProposalHeader } from '../ProposalHeader';
import { ProposalClientBar } from '../ProposalClientBar';
import { ProposalTotals } from '../ProposalTotals';
import { ProposalNotes } from '../ProposalNotes';
import { ProposalFooter } from '../ProposalFooter';
import { PROPOSAL_10015_26 } from './fixtures/proposal-10015-26';

// Congela o relógio para remover flakiness do ProposalFooter (usa new Date()
// para renderizar "Impresso em: DD/MM/YYYY, HH:MM"). Sem isso, o snapshot
// falha quando o minuto muda entre a geração e a comparação.
const FROZEN_ISO = '2026-03-15T12:34:56.000Z';
beforeAll(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date(FROZEN_ISO));
});
afterAll(() => {
  vi.useRealTimers();
});

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
