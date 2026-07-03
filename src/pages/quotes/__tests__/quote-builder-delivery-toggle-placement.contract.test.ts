/**
 * Guarda: o toggle "Contar dias | Data fixa" deve ficar ao lado do rótulo
 * "Prazo | Entrega" (dentro do mesmo flex row do label), não na extremidade
 * direita do container.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, '../QuoteBuilderPage.tsx'), 'utf8');

describe('QuoteBuilderPage — posição do toggle "Contar dias / Data fixa"', () => {
  it('o role="tablist" fica logo após </TooltipProvider> do label Prazo|Entrega', () => {
    // TooltipProvider fecha e, na sequência (apenas whitespace/comentário), abre o div do tablist.
    expect(SRC).toMatch(
      /<\/TooltipProvider>\s*<div\s+role="tablist"\s+aria-label="Modo de prazo de entrega"/,
    );
  });

  it('o tablist NÃO aparece como irmão direto do wrapper flex (fora do grupo do label)', () => {
    // Padrão antigo (regressão): </div>\n\n<div role="tablist" ...>
    expect(SRC).not.toMatch(
      /<\/div>\s*\n\s*\n\s*<div\s+role="tablist"\s+aria-label="Modo de prazo de entrega"/,
    );
  });

  it('mantém aria-label e ambos os botões (Contar dias / Data fixa)', () => {
    expect(SRC).toMatch(/aria-label="Modo de prazo de entrega"/);
    expect(SRC).toMatch(/>\s*Contar dias\s*<\/button>/);
    expect(SRC).toMatch(/>\s*Data fixa\s*<\/button>/);
  });
});
