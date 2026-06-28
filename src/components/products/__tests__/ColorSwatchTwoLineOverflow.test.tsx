/**
 * Contrato unificado V1 (ProductColorSwatches) + V2 (ColorSwatchPicker):
 *
 *  - Mostra TODAS as cores quando couberem em ≤ `max`/`maxVisible` (proibido abreviar).
 *  - Quando há overflow, a ÚLTIMA bolinha vira o chip "+N" — preserva a ordem.
 *  - Default do limite = 14 (≈ 2 linhas em cards típicos do grid).
 */
import { describe, it, expect, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ProductColorSwatches } from '@/components/products/ProductColorSwatches';
import { ColorSwatchPicker } from '@/components/ui/ColorSwatchPicker';
import type { ColorSwatch } from '@/hooks/useProductColorSwatch';

afterEach(cleanup);

const makeColors = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `cor-${i}`,
    hex: '#' + ((i * 0x111111) & 0xffffff).toString(16).padStart(6, '0'),
  }));

const makeSwatches = (n: number): ColorSwatch[] =>
  Array.from({ length: n }, (_, i) => ({
    variant_id: `v-${i}`,
    color_name: `cor-${i}`,
    color_hex: '#' + ((i * 0x111111) & 0xffffff).toString(16).padStart(6, '0'),
    is_in_stock: true,
    stock_quantity: 10,
  })) as unknown as ColorSwatch[];

const visibleNamesV1 = () =>
  screen
    .queryAllByTestId(/^color-swatch-/)
    .map((el) => el.getAttribute('data-color-name'));

const visibleNamesV2 = (container: HTMLElement) =>
  Array.from(container.querySelectorAll('button[aria-pressed]')).map((el) =>
    el.getAttribute('aria-label'),
  );

// ─────────────────────────────────────────────────────────────────────────────
// V1 — ProductColorSwatches (wrap, default max=14)
// ─────────────────────────────────────────────────────────────────────────────
describe('V1 ProductColorSwatches (wrap, max=14)', () => {
  it('7 cores → exibe TODAS, sem chip "+N"', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={makeColors(7)} max={14} wrap hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    expect(visibleNamesV1()).toHaveLength(7);
    expect(screen.queryByTestId('color-swatches-overflow')).toBeNull();
  });

  it('14 cores → exibe TODAS, sem chip "+N" (limite exato)', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={makeColors(14)} max={14} wrap hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    expect(visibleNamesV1()).toHaveLength(14);
    expect(screen.queryByTestId('color-swatches-overflow')).toBeNull();
  });

  it('20 cores → 13 bolinhas + chip "+7", ordem preservada', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={makeColors(20)} max={14} wrap hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    const names = visibleNamesV1();
    expect(names).toHaveLength(13);
    expect(names).toEqual(
      Array.from({ length: 13 }, (_, i) => `cor-${i}`),
    );
    expect(screen.getByTestId('color-swatches-overflow')).toHaveTextContent('+7');
  });

  // Cobertura adicional: ordem preservada nos cortes solicitados (8, 15, 20+)
  it.each([
    { total: 8, max: 5, visible: 4, chip: '+4' }, // 8 − 4 = 4
    { total: 15, max: 14, visible: 13, chip: '+2' }, // 15 − 13 = 2
    { total: 25, max: 14, visible: 13, chip: '+12' }, // 25 − 13 = 12
  ])(
    'preserva ordem das $visible primeiras cores quando total=$total (chip $chip)',
    ({ total, max, visible, chip }) => {
      render(
        <TooltipProvider>
          <ProductColorSwatches
            colors={makeColors(total)}
            max={max}
            wrap
            hideWhenEmpty={false}
          />
        </TooltipProvider>,
      );
      const names = visibleNamesV1();
      expect(names).toEqual(Array.from({ length: visible }, (_, i) => `cor-${i}`));
      expect(screen.getByTestId('color-swatches-overflow')).toHaveTextContent(chip);
    },
  );
});

// ─────────────────────────────────────────────────────────────────────────────
// V2 — ColorSwatchPicker (default maxVisible=14)
// ─────────────────────────────────────────────────────────────────────────────
describe('V2 ColorSwatchPicker (default maxVisible=14)', () => {
  const noop = () => {};

  it('7 swatches → exibe TODOS, sem chip "+N"', () => {
    const { container } = render(
      <ColorSwatchPicker
        swatches={makeSwatches(7)}
        activeVariantId={null}
        onSelect={noop}
        onReset={noop}
      />,
    );
    expect(visibleNamesV2(container)).toHaveLength(7);
    expect(container.querySelector('[aria-label^="Mais "]')).toBeNull();
  });

  it('14 swatches → exibe TODOS, sem chip "+N" (limite exato)', () => {
    const { container } = render(
      <ColorSwatchPicker
        swatches={makeSwatches(14)}
        activeVariantId={null}
        onSelect={noop}
        onReset={noop}
      />,
    );
    expect(visibleNamesV2(container)).toHaveLength(14);
    expect(container.querySelector('[aria-label^="Mais "]')).toBeNull();
  });

  it('25 swatches → 13 bolinhas + chip "+12", ordem preservada', () => {
    const { container } = render(
      <ColorSwatchPicker
        swatches={makeSwatches(25)}
        activeVariantId={null}
        onSelect={noop}
        onReset={noop}
      />,
    );
    const names = visibleNamesV2(container);
    expect(names).toEqual(Array.from({ length: 13 }, (_, i) => `cor-${i}`));
    expect(container.querySelector('[aria-label^="Mais "]')!.textContent).toBe('+12');
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// V1 — Modo legado single-line (sem wrap) — usado em BaseProductGridCard
// Regra preservada: mostra `max` bolinhas + chip "+N" APÓS (chip NÃO substitui).
// ─────────────────────────────────────────────────────────────────────────────
describe('V1 ProductColorSwatches (single-line, sem wrap)', () => {
  it('20 cores com max=6 → exibe 6 bolinhas + chip "+14" (chip não substitui última)', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={makeColors(20)} max={6} hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    const names = visibleNamesV1();
    expect(names).toEqual(Array.from({ length: 6 }, (_, i) => `cor-${i}`));
    expect(screen.getByTestId('color-swatches-overflow')).toHaveTextContent('+14');
  });

  it('6 cores com max=6 → exibe TODAS, sem chip', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={makeColors(6)} max={6} hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    expect(visibleNamesV1()).toHaveLength(6);
    expect(screen.queryByTestId('color-swatches-overflow')).toBeNull();
  });
});
