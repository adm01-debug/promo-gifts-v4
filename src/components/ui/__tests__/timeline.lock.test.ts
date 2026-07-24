/**
 * Lock estrutural do TimelineDot/TimelineLine (SSOT).
 *
 * Garante invariantes que evitam clipping do dot destacado em containers
 * com overflow (ex.: ScrollArea do QuoteHistoryPanel).
 *
 * Decisão: ring-offset-1 (não ring-offset-2) — o offset de 2px estourava
 * 4px à esquerda do dot e era cortado pelo viewport do ScrollArea.
 * Padronizar no SSOT evita ter que adicionar padding em cada consumidor.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, '../timeline.tsx'), 'utf8');
const PANEL = readFileSync(
  resolve(__dirname, '../../quotes/QuoteHistoryPanel.tsx'),
  'utf8',
);

describe('Timeline SSOT — anti-clipping invariants', () => {
  it('TimelineDot usa ring-offset-1 (não ring-offset-2) para caber em containers com overflow', () => {
    expect(SRC).toMatch(/ring-offset-1 ring-offset-background/);
    expect(SRC).not.toMatch(/ring-offset-2 ring-offset-background/);
  });

  it('QuoteHistoryPanel não precisa de padding extra no wrapper (solução vive no SSOT)', () => {
    // wrapper relativo permanece sem padding-left compensatório
    expect(PANEL).toMatch(/<div className="relative">\s*\n\s*<TimelineLine leftClassName="left-\[15px\]"/);
    expect(PANEL).not.toMatch(/<div className="relative pl-1">/);
  });
});
