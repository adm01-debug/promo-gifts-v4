/**
 * Guarda: o toggle "Contar dias | Data fixa" (DeliveryModeToggle) deve ficar
 * ao lado do rótulo "Prazo | Entrega" (dentro do mesmo flex row do label),
 * não na extremidade direita do container.
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const SRC = readFileSync(resolve(__dirname, '../QuoteBuilderPage.tsx'), 'utf8');

describe('QuoteBuilderPage — posição do toggle "Contar dias / Data fixa"', () => {
  it('o <DeliveryModeToggle /> aparece logo após </TooltipProvider> do label Prazo|Entrega', () => {
    expect(SRC).toMatch(/<\/TooltipProvider>\s*<DeliveryModeToggle\b/);
  });

  it('o DeliveryModeToggle NÃO aparece como irmão direto do wrapper flex (fora do grupo do label)', () => {
    // Padrão antigo (regressão): </div>\n\n<DeliveryModeToggle .../> ou <div role="tablist" .../>
    expect(SRC).not.toMatch(
      /<\/div>\s*\n\s*\n\s*<DeliveryModeToggle\b/,
    );
    expect(SRC).not.toMatch(
      /<\/div>\s*\n\s*\n\s*<div\s+role="tablist"\s+aria-label="Modo de prazo de entrega"/,
    );
  });

  it('importa o subcomponente DeliveryModeToggle', () => {
    expect(SRC).toMatch(
      /import\s*\{\s*DeliveryModeToggle\s*\}\s*from\s*'@\/pages\/quotes\/components\/DeliveryModeToggle'/,
    );
  });

  it('não mantém mais o markup inline do tablist (foi extraído)', () => {
    expect(SRC).not.toMatch(/aria-label="Modo de prazo de entrega"/);
    expect(SRC).not.toMatch(/>\s*Contar dias\s*<\/button>/);
    expect(SRC).not.toMatch(/>\s*Data fixa\s*<\/button>/);
  });
});
