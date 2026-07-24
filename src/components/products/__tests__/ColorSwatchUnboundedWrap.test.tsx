/**
 * fix_version: list-swatch-unbounded-wrap-20260628
 *
 * Contrato do modo Lista (ProductListItem): `wrap` + `unbounded` + max=colors.length.
 * Espelha, em nível unitário, o e2e/catalog/list-color-swatches-wrap.spec.ts
 * (que não roda no CI local por exigir servidor + auth):
 *   1. Exibe TODAS as cores (nunca trunca).
 *   2. NÃO renderiza o chip "+N" (overflow).
 *   3. Container usa `flex-wrap` SEM `overflow-hidden` e SEM `max-h-` (não corta cores).
 *
 * + Guarda de regressão: o modo wrap CLAMPADO (ProductCard, sem `unbounded`)
 *   PRESERVA `overflow-hidden` + `max-h-` + chip "+N" — pré-requisito do
 *   e2e/catalog/color-swatch-selected-no-clip.spec.ts.
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ProductColorSwatches } from '@/components/products/ProductColorSwatches';

afterEach(cleanup);

const makeColors = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `cor-${i}`,
    hex: `#${((i * 0x111111) & 0xffffff).toString(16).padStart(6, '0')}`,
  }));

const renderSwatches = (ui: React.ReactElement) =>
  render(<TooltipProvider>{ui}</TooltipProvider>);

const dotCount = () => screen.queryAllByTestId(/^color-swatch-cor-/).length;
const chip = () => screen.queryByTestId('color-swatches-overflow');
const containerClass = () =>
  screen.getByTestId('product-colors-container').getAttribute('class') ?? '';

describe('ProductColorSwatches — modo Lista (wrap + unbounded)', () => {
  it('exibe TODAS as cores e NÃO mostra chip "+N" (30 cores, max=30)', () => {
    renderSwatches(
      <ProductColorSwatches colors={makeColors(30)} max={30} wrap unbounded hideWhenEmpty={false} />,
    );
    expect(dotCount()).toBe(30);
    expect(chip()).toBeNull();
  });

  it('container usa flex-wrap SEM overflow-hidden e SEM max-h (não corta cores)', () => {
    renderSwatches(
      <ProductColorSwatches colors={makeColors(24)} max={24} wrap unbounded hideWhenEmpty={false} />,
    );
    const cls = containerClass();
    expect(cls).toContain('flex-wrap');
    expect(cls).not.toContain('overflow-hidden');
    expect(cls).not.toMatch(/max-h-/);
  });

  it('unbounded ignora max finito: ainda mostra todas e sem chip (20 cores, max=5)', () => {
    renderSwatches(
      <ProductColorSwatches colors={makeColors(20)} max={5} wrap unbounded hideWhenEmpty={false} />,
    );
    expect(dotCount()).toBe(20);
    expect(chip()).toBeNull();
  });

  it('paridade com uso real do ProductListItem (max=colors.length, justify-start)', () => {
    const colors = makeColors(18);
    renderSwatches(
      <ProductColorSwatches
        colors={colors}
        max={colors.length}
        size="sm"
        wrap
        unbounded
        hideWhenEmpty
        className="justify-start"
      />,
    );
    // 18 cores excederiam 2 linhas no mobile (~10) → antes cortava em silêncio.
    expect(dotCount()).toBe(18);
    expect(chip()).toBeNull();
    expect(containerClass()).not.toContain('overflow-hidden');
  });
});

describe('ProductColorSwatches — guarda de regressão: wrap CLAMPADO (ProductCard)', () => {
  it('SEM unbounded: mantém overflow-hidden + max-h + chip "+N" (30 cores, max=14)', () => {
    renderSwatches(
      <ProductColorSwatches colors={makeColors(30)} max={14} wrap hideWhenEmpty={false} />,
    );
    // chip dispara (substitui última bolinha): 13 visíveis + "+17"
    const overflow = chip();
    expect(overflow).not.toBeNull();
    expect(overflow).toHaveTextContent('+17');
    const cls = containerClass();
    expect(cls).toContain('overflow-hidden');
    expect(cls).toMatch(/max-h-/);
  });
});
