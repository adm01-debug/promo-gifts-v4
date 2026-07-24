/**
 * Guarda: trigger de "Prazo | Entrega" deve usar o mesmo grid do card
 * "Validade | Proposta" para ter largura exatamente igual à primeira coluna.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, '../QuoteBuilderPage.tsx'), 'utf8');

describe('QuoteBuilderPage — largura do trigger "Prazo | Entrega"', () => {
  it('usa o mesmo grid de 3 colunas do campo Validade | Proposta', () => {
    expect(SRC).toMatch(
      /<div className="grid grid-cols-1 md:grid-cols-3 gap-3">\s*<div>\s*\{s\.deliveryMode === 'prazo' \? \(/,
    );
    expect(SRC).not.toMatch(/md:w-2\/5/);
    expect(SRC).not.toMatch(/md:w-1\/2(?![0-9])/);
    expect(SRC).not.toMatch(/md:w-1\/3(?![0-9])/);
    expect(SRC).not.toMatch(/md:w-1\/4(?![0-9])/);
  });
});
