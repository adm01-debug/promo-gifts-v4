/**
 * Regressão: o chip "+N" de overflow deve escalar em ALTURA com os dots, mas
 * NUNCA cortar o texto. Isso exige min-width (não largura fixa) — caso contrário
 * "+12" vaza do círculo nos tamanhos pequenos (tabela/lista/grid denso).
 */
import { afterEach, describe, expect, it } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';

import { TooltipProvider } from '@/components/ui/tooltip';
import { ProductColorSwatches } from '@/components/products/ProductColorSwatches';

afterEach(cleanup);

const many = Array.from({ length: 17 }, (_, i) => ({
  name: `cor${i}`,
  hex: `#${((i * 0x0f0f0f) & 0xffffff).toString(16).padStart(6, '0')}`,
}));

describe('chip "+N" — escala em altura, sem cortar texto', () => {
  it('usa min-w-[var(--swatch-size…)] (largura cresce com o texto)', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={many} max={5} hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    const chip = screen.getByTestId('color-swatches-overflow');
    expect(chip).toHaveTextContent('+12'); // single-line: 17 − 5 = 12
    expect(chip.className).toContain('min-w-[var(--swatch-size');
  });

  it('NÃO usa largura fixa w-[var(--swatch-size…)] (que cortaria "+12")', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={many} max={5} hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    const chip = screen.getByTestId('color-swatches-overflow');
    // min-w-[ é permitido; w-[ isolado (largura fixa) não.
    expect(chip.className).not.toMatch(/(^|\s)w-\[var\(--swatch-size/);
  });

  it('altura escala com os dots (h-[var(--swatch-size…)])', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={many} max={5} hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    const chip = screen.getByTestId('color-swatches-overflow');
    expect(chip.className).toContain('h-[var(--swatch-size');
  });
});
