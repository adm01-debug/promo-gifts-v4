/**
 * Contrato unificado V1 (ProductColorSwatches) + V2 (ColorSwatchPicker):
 *
 *  - Mostra TODAS as cores quando couberem em ≤ `max`/`maxVisible` (proibido abreviar).
 *  - Quando há overflow, a ÚLTIMA bolinha vira o chip "+N" — preserva a ordem.
 *  - Default do limite = 14 (≈ 2 linhas em cards típicos do grid).
 */
import { describe, it, expect, afterEach, vi } from 'vitest';
import { render, screen, cleanup, fireEvent } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ProductColorSwatches } from '@/components/products/ProductColorSwatches';
import { ColorSwatchPicker } from '@/components/ui/ColorSwatchPicker';
import type { ColorSwatch } from '@/hooks/useProductColorSwatch';

afterEach(cleanup);

const makeColors = (n: number) =>
  Array.from({ length: n }, (_, i) => ({
    name: `cor-${i}`,
    hex: `#${((i * 0x111111) & 0xffffff).toString(16).padStart(6, '0')}`,
  }));

const makeSwatches = (n: number): ColorSwatch[] =>
  Array.from({ length: n }, (_, i) => ({
    variant_id: `v-${i}`,
    color_name: `cor-${i}`,
    color_hex: `#${((i * 0x111111) & 0xffffff).toString(16).padStart(6, '0')}`,
    is_in_stock: true,
    stock_quantity: 10,
  })) as unknown as ColorSwatch[];

const visibleNamesV1 = () =>
  screen.queryAllByTestId(/^color-swatch-/).map((el) => el.getAttribute('data-color-name'));

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
    expect(names).toEqual(Array.from({ length: 13 }, (_, i) => `cor-${i}`));
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
          <ProductColorSwatches colors={makeColors(total)} max={max} wrap hideWhenEmpty={false} />
        </TooltipProvider>,
      );
      const names = visibleNamesV1();
      expect(names).toEqual(Array.from({ length: visible }, (_, i) => `cor-${i}`));
      expect(screen.getByTestId('color-swatches-overflow')).toHaveTextContent(chip);
    },
  );

  it('distribuição em 2 linhas: 30 cores com max=14 → 13 visíveis + "+17" (cobertura total = visíveis + overflow)', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={makeColors(30)} max={14} wrap hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    const names = visibleNamesV1();
    const chip = screen.getByTestId('color-swatches-overflow').textContent ?? '';
    const hidden = Number(chip.replace(/\D/g, ''));
    // Contrato: visíveis + ocultas no chip = total de cores
    expect(names.length + hidden).toBe(30);
    expect(hidden).toBe(17);
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

// ─────────────────────────────────────────────────────────────────────────────
// Invariante paramétrico — wrap V1: visíveis + ocultas = total para 1..50
// ─────────────────────────────────────────────────────────────────────────────
describe('V1 wrap — invariante visíveis + chip = total (1..50)', () => {
  const MAX = 14;
  const totals = Array.from({ length: 50 }, (_, i) => i + 1);

  it.each(totals)('total=%i mantém o invariante', (total) => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={makeColors(total)} max={MAX} wrap hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    const visible = visibleNamesV1().length;
    const chipEl = screen.queryByTestId('color-swatches-overflow');
    const hidden = chipEl ? Number((chipEl.textContent ?? '').replace(/\D/g, '')) : 0;

    expect(visible + hidden).toBe(total);
    // Nunca ultrapassa o limite visual de 2 linhas (max - 1 quando há overflow, ou total)
    expect(visible).toBeLessThanOrEqual(MAX);
    // Ordem preservada: primeiras N cores
    const names = visibleNamesV1();
    expect(names).toEqual(Array.from({ length: visible }, (_, i) => `cor-${i}`));
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Acessibilidade — chip "+N" e swatches têm role/aria corretos
// ─────────────────────────────────────────────────────────────────────────────
describe('A11y — chip "+N" e swatches', () => {
  it('V1: cada swatch tem role="radio" e o container role="radiogroup" com aria-label', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={makeColors(5)} max={14} wrap hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    const group = screen.getByRole('radiogroup');
    expect(group.getAttribute('aria-label')).toMatch(/5 cores dispon/i);
    expect(screen.getAllByRole('radio')).toHaveLength(5);
  });

  it('V1: chip "+N" expõe aria-label legível ("Mais N cores") com pluralização', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={makeColors(16)} max={14} wrap hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    const chip = screen.getByTestId('color-swatches-overflow');
    expect(chip.getAttribute('aria-label')).toBe('Mais 3 cores');
    expect(chip).toHaveTextContent('+3');
  });

  it('V1: chip singular usa "Mais 1 cor" (sem "s") — single-line', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={makeColors(7)} max={6} hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    expect(screen.getByTestId('color-swatches-overflow').getAttribute('aria-label')).toBe(
      'Mais 1 cor',
    );
  });

  it('V2: cada swatch é button com aria-label = nome da cor', () => {
    const { container } = render(
      <ColorSwatchPicker
        swatches={makeSwatches(5)}
        activeVariantId={null}
        onSelect={() => {}}
        onReset={() => {}}
      />,
    );
    const btns = Array.from(container.querySelectorAll('button[aria-pressed]'));
    expect(btns).toHaveLength(5);
    for (const [i, b] of btns.entries()) {
      expect(b.getAttribute('aria-label')).toBe(`cor-${i}`);
    }
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A11y — teclado e foco
// ─────────────────────────────────────────────────────────────────────────────
describe('A11y — teclado/foco em swatches', () => {
  it('V1: swatch recebe foco e dispara onSelect via Enter e Space', () => {
    const onSelect = vi.fn();
    render(
      <TooltipProvider>
        <ProductColorSwatches
          colors={makeColors(3)}
          max={14}
          wrap
          hideWhenEmpty={false}
          onSelect={onSelect}
        />
      </TooltipProvider>,
    );
    const first = screen.getAllByRole('radio')[0] as HTMLButtonElement;
    first.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.keyDown(first, { key: 'Enter' });
    fireEvent.keyDown(first, { key: ' ' });
    expect(onSelect).toHaveBeenCalledTimes(2);
  });

  it('V1: chip "+N" é informacional (não interativo, não está no tab order)', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={makeColors(20)} max={14} wrap hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    const chip = screen.getByTestId('color-swatches-overflow');
    // Contrato: chip é <span> com aria-label, sem tabindex — affordance interativa
    // fica no botão separado "Mostrar todas as variações".
    expect(chip.tagName).toBe('SPAN');
    expect(chip.getAttribute('tabindex')).toBeNull();
  });

  it('V2: swatch recebe foco e dispara onSelect via clique do teclado', () => {
    const onSelect = vi.fn();
    const swatches = makeSwatches(3);
    const { container } = render(
      <ColorSwatchPicker
        swatches={swatches}
        activeVariantId={null}
        onSelect={onSelect}
        onReset={() => {}}
      />,
    );
    const first = container.querySelector('button[aria-pressed]')!;
    first.focus();
    expect(document.activeElement).toBe(first);
    fireEvent.click(first);
    expect(onSelect).toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A11y — aria-labels do chip plural/singular paramétrico
// ─────────────────────────────────────────────────────────────────────────────
describe('A11y — aria-label do chip plural/singular (single-line)', () => {
  it.each([
    { total: 7, max: 6, expected: 'Mais 1 cor' },
    { total: 8, max: 6, expected: 'Mais 2 cores' },
    { total: 10, max: 6, expected: 'Mais 4 cores' },
    { total: 50, max: 6, expected: 'Mais 44 cores' },
  ])('total=$total max=$max → aria-label "$expected"', ({ total, max, expected }) => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={makeColors(total)} max={max} hideWhenEmpty={false} />
      </TooltipProvider>,
    );
    expect(screen.getByTestId('color-swatches-overflow').getAttribute('aria-label')).toBe(expected);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// A11y — tab order e navegação por teclado entre swatches
// Contrato: chip "+N" é informacional (span sem tabindex). Foco percorre apenas
// os swatches focáveis; Tab/Shift+Tab alternam entre eles.
// ─────────────────────────────────────────────────────────────────────────────
describe('A11y — navegação por teclado entre swatches', () => {
  it('V1 wrap com overflow: tab order pula o chip (apenas swatches focáveis)', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches
          colors={makeColors(20)}
          max={14}
          wrap
          hideWhenEmpty={false}
          onSelect={() => {}}
        />
      </TooltipProvider>,
    );
    const radios = screen.getAllByRole('radio') as HTMLButtonElement[];
    const chip = screen.getByTestId('color-swatches-overflow');

    // Todos os swatches participam do tab order natural (button sem tabindex=-1)
    for (const r of radios) {
      expect(r.getAttribute('tabindex')).not.toBe('-1');
    }
    // Chip fora do tab order (span sem tabindex)
    expect(chip.getAttribute('tabindex')).toBeNull();

    // Alterna foco entre swatches programaticamente (jsdom não dispara Tab nativo)
    radios[0].focus();
    expect(document.activeElement).toBe(radios[0]);
    radios[1].focus();
    expect(document.activeElement).toBe(radios[1]);
  });

  it('V1: Enter alterna seleção entre dois swatches diferentes', () => {
    const onSelect = vi.fn();
    render(
      <TooltipProvider>
        <ProductColorSwatches
          colors={makeColors(4)}
          max={14}
          wrap
          hideWhenEmpty={false}
          onSelect={onSelect}
        />
      </TooltipProvider>,
    );
    const [a, b] = screen.getAllByRole('radio') as HTMLButtonElement[];
    a.focus();
    fireEvent.keyDown(a, { key: 'Enter' });
    b.focus();
    fireEvent.keyDown(b, { key: 'Enter' });
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect.mock.calls[0][0].name).toBe('cor-0');
    expect(onSelect.mock.calls[1][0].name).toBe('cor-1');
  });
});
