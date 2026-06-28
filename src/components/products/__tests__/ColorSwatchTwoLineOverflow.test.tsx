/**
 * Contrato unificado V1 (ProductColorSwatches) + V2 (ColorSwatchPicker):
 *
 *  - Mostra TODAS as cores quando couberem em ≤ `max`/`maxVisible` (proibido abreviar).
 *  - Quando há overflow, a ÚLTIMA bolinha vira o chip "+N" — nunca aparece extra.
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

const countSwatchesV1 = () =>
  screen.queryAllByTestId(/^color-swatch-/).length;

const countSwatchesV2 = (container: HTMLElement) =>
  container.querySelectorAll('button[aria-pressed]').length;

// ─────────────────────────────────────────────────────────────────────────────
// V1 — ProductColorSwatches (modo wrap, usado no ProductCard)
// ─────────────────────────────────────────────────────────────────────────────
describe('V1 ProductColorSwatches (wrap, max=14)', () => {
  it('7 cores → exibe TODAS, sem chip "+N"', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={makeColors(7)} max={14} wrap hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    expect(countSwatchesV1()).toBe(7);
    expect(screen.queryByTestId('color-swatches-overflow')).toBeNull();
  });

  it('14 cores → exibe TODAS, sem chip "+N" (limite exato)', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={makeColors(14)} max={14} wrap hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    expect(countSwatchesV1()).toBe(14);
    expect(screen.queryByTestId('color-swatches-overflow')).toBeNull();
  });

  it('20 cores → 13 bolinhas + chip "+7" (substitui última)', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={makeColors(20)} max={14} wrap hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    expect(countSwatchesV1()).toBe(13);
    const chip = screen.getByTestId('color-swatches-overflow');
    expect(chip).toHaveTextContent('+7'); // 20 − 13 = 7
  });
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
    expect(countSwatchesV2(container)).toBe(7);
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
    expect(countSwatchesV2(container)).toBe(14);
    expect(container.querySelector('[aria-label^="Mais "]')).toBeNull();
  });

  it('25 swatches → 13 bolinhas + chip "+12" (substitui última)', () => {
    const { container } = render(
      <ColorSwatchPicker
        swatches={makeSwatches(25)}
        activeVariantId={null}
        onSelect={noop}
        onReset={noop}
      />,
    );
    expect(countSwatchesV2(container)).toBe(13);
    const chip = container.querySelector('[aria-label^="Mais "]');
    expect(chip).not.toBeNull();
    expect(chip!.textContent).toBe('+12'); // 25 − 13 = 12
  });
});
