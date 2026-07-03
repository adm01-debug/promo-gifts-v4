/**
 * Guarda: trigger de "Prazo | Entrega" deve usar md:w-1/3 para casar
 * proporcionalmente com o card "Validade | Proposta".
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, '../QuoteBuilderPage.tsx'), 'utf8');

describe('QuoteBuilderPage — largura do trigger "Prazo | Entrega"', () => {
  it('usa md:w-1/4 e não regride para larguras antigas', () => {
    expect(SRC).toMatch(/w-full md:w-1\/4/);
    expect(SRC).not.toMatch(/md:w-2\/5/);
    expect(SRC).not.toMatch(/md:w-1\/2(?![0-9])/);
    expect(SRC).not.toMatch(/md:w-1\/3(?![0-9])/);
  });
});
