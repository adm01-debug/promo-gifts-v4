/**
 * Emissor local (não roda em CI) — usado por /tmp/pdf-diff para
 * gerar HTMLs isolados de TotalsSection (PDF interno) e ProposalTotals
 * (proposta exportada) e diffar pixel-a-pixel.
 *
 * Rodar com: bunx vitest run totalsBlocksEmitLocal
 */
import React from 'react';
import { describe, it, expect } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { writeFileSync, mkdirSync } from 'node:fs';
import { TotalsSection } from '../../ProposalSections';
import { ProposalTotals } from '../ProposalTotals';
import { PROPOSAL_10015_26 } from './fixtures/proposal-10015-26';

const OUT = '/tmp/pdf-diff';

function wrap(title: string, body: string): string {
  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
<link href="https://fonts.googleapis.com/css2?family=Montserrat:wght@400;600;700;800&family=Roboto:wght@400;500;700&display=swap" rel="stylesheet"/>
<style>body{margin:0;padding:24px;background:#fff;font-family:'Roboto',sans-serif;width:794px}</style>
<title>${title}</title></head><body><div id="block">${body}</div></body></html>`;
}

describe('emitter local — blocos de totais isolados', () => {
  it('emite HTMLs em /tmp/pdf-diff', () => {
    mkdirSync(OUT, { recursive: true });
    writeFileSync(
      `${OUT}/totals-internal.html`,
      wrap('internal', renderToStaticMarkup(<TotalsSection data={PROPOSAL_10015_26} />)),
      'utf8',
    );
    writeFileSync(
      `${OUT}/totals-exported.html`,
      wrap('exported', renderToStaticMarkup(<ProposalTotals data={PROPOSAL_10015_26} />)),
      'utf8',
    );
    expect(true).toBe(true);
  });
});
