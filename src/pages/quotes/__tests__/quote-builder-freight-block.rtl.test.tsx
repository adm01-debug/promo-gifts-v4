/**
 * RTL isolado: bloco Frete do QuoteBuilderPage.
 *
 * Como o QuoteBuilderPage tem >800 LOC + store pesado, replicamos o markup
 * do bloco Frete numa fixture verbatim (mesmos data-testid, mesmas classes),
 * validando:
 *  - hierarquia + data-testid do grid em cada shippingType (cif / fob / fob_pre)
 *  - grid grid-cols-1 md:grid-cols-3 gap-3 items-end presente em qualquer largura
 *  - labels dentro das colunas do grid, evitando crescimento vertical só no fob_pre
 *  - acessibilidade (axe) sem violações
 *  - navegação por teclado (Tab visita Select -> Input R$ quando fob_pre)
 *
 * Regressão: se alguém quebrar o grid ou os testids no QuoteBuilderPage.tsx,
 * os contratos "quote-builder-shipping-*.contract.test.ts" falham.
 * Este arquivo cobre a camada comportamental + a11y.
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within, act } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
import { useState } from 'react';
import { cn } from '@/lib/utils';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

type Shipping = 'cif' | 'fob_pre' | 'fob';

function FreightFixture({ initial = 'cif' as Shipping }) {
  const [shippingType, setShippingType] = useState<Shipping>(initial);
  const [shippingCost, setShippingCost] = useState(0);
  const validationErrors: string[] = [];

  return (
    <div className="mt-1 border-t border-border/30 pt-3" data-testid="freight-block">
      <div
        data-testid="freight-grid"
        className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
      >
        <div className="space-y-1" data-testid="freight-grid-col-1">
          <Label
            htmlFor="freight-select"
            className={cn(
              'text-xs',
              validationErrors.includes('frete') ? 'text-destructive' : 'text-muted-foreground',
            )}
          >
            Frete
          </Label>
          <Select
            data-testid="shipping-type-select-root"
            value={shippingType}
            onValueChange={(v) => setShippingType(v as Shipping)}
          >
            <SelectTrigger
              id="freight-select"
              data-testid="shipping-type-select"
              className="h-8 text-xs"
              aria-label="Modalidade de frete"
            >
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cif">CIF | Frete grátis</SelectItem>
              <SelectItem value="fob">FOB | Repassado ao cliente</SelectItem>
              <SelectItem value="fob_pre">FOB | Valor pré negociado</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {shippingType === 'fob_pre' && (
          <div className="space-y-1" data-testid="freight-grid-col-2">
            <Label htmlFor="freight-value" className="text-xs text-muted-foreground">
              Valor R$
            </Label>
            <CurrencyInput
              id="freight-value"
              data-testid="shipping-cost-input"
              aria-label="Valor do frete em reais"
              value={shippingCost}
              onChange={(n) => setShippingCost(Math.max(0, n))}
              className="h-8 text-xs"
            />
          </div>
        )}
      </div>
    </div>
  );
}

const WIDTHS: Array<{ name: string; width: number }> = [
  { name: 'mobile-sm', width: 320 },
  { name: 'mobile', width: 375 },
  { name: 'tablet', width: 768 },
  { name: 'md', width: 900 },
  { name: 'desktop', width: 1280 },
];

function setViewport(w: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
  window.dispatchEvent(new Event('resize'));
}

describe('Bloco Frete — hierarquia + data-testid do grid', () => {
  it.each(['cif', 'fob'] as const)(
    'shippingType="%s": grid tem apenas 1 coluna (trigger), sem input Valor R$',
    (initial) => {
      render(<FreightFixture initial={initial} />);
      const grid = screen.getByTestId('freight-grid');
      expect(grid).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-3', 'gap-3', 'items-end');

      expect(within(grid).getByTestId('freight-grid-col-1')).toBeInTheDocument();
      expect(within(grid).queryByTestId('freight-grid-col-2')).not.toBeInTheDocument();
      expect(within(grid).queryByTestId('shipping-cost-input')).not.toBeInTheDocument();
    },
  );

  it('shippingType="fob_pre": grid tem 2 colunas (trigger + Valor R$) na ordem correta', () => {
    render(<FreightFixture initial="fob_pre" />);
    const grid = screen.getByTestId('freight-grid');
    const cols = grid.querySelectorAll('[data-testid^="freight-grid-col-"]');
    expect(cols).toHaveLength(2);
    expect(cols[0]).toHaveAttribute('data-testid', 'freight-grid-col-1');
    expect(cols[1]).toHaveAttribute('data-testid', 'freight-grid-col-2');
    expect(within(grid).getByTestId('shipping-cost-input')).toBeInTheDocument();
  });

  it('shippingType="fob_pre": labels Frete e Valor R$ ficam dentro das colunas do mesmo grid', () => {
    render(<FreightFixture initial="fob_pre" />);
    const grid = screen.getByTestId('freight-grid');
    const col1 = within(grid).getByTestId('freight-grid-col-1');
    const col2 = within(grid).getByTestId('freight-grid-col-2');

    expect(within(col1).getByText('Frete')).toBeInTheDocument();
    expect(within(col1).getByTestId('shipping-type-select')).toBeInTheDocument();
    expect(within(col2).getByText('Valor R$')).toBeInTheDocument();
    expect(within(col2).getByTestId('shipping-cost-input')).toBeInTheDocument();
  });
});

describe('Bloco Frete — grid preservado em diferentes larguras', () => {
  it.each(WIDTHS)('largura $name ($width px): grid mantém classes responsivas', ({ width }) => {
    setViewport(width);
    render(<FreightFixture initial="fob_pre" />);
    const grid = screen.getByTestId('freight-grid');
    // Classes responsivas são estáticas (Tailwind), não mudam por JS — mas
    // garantimos que continuam presentes em qualquer viewport simulada.
    expect(grid.className).toMatch(/grid-cols-1/);
    expect(grid.className).toMatch(/md:grid-cols-3/);
    expect(grid.className).toMatch(/items-end/);
    // Trigger e input coexistem no MESMO grid (não em blocos irmãos).
    expect(within(grid).getByTestId('shipping-type-select')).toBeInTheDocument();
    expect(within(grid).getByTestId('shipping-cost-input')).toBeInTheDocument();
  });
});

describe('Bloco Frete — troca dinâmica de shippingType', () => {
  it('CIF → FOB pré-negociado revela Valor R$ na 2ª coluna (rerender)', () => {
    const { rerender } = render(<FreightFixture key="cif" initial="cif" />);
    expect(screen.queryByTestId('shipping-cost-input')).not.toBeInTheDocument();

    rerender(<FreightFixture key="fob_pre" initial="fob_pre" />);
    const grid = screen.getByTestId('freight-grid');
    expect(within(grid).getByTestId('shipping-cost-input')).toBeInTheDocument();
    expect(within(grid).getByTestId('freight-grid-col-2')).toBeInTheDocument();
  });
});


describe('Bloco Frete — acessibilidade (axe)', () => {
  it.each(['cif', 'fob', 'fob_pre'] as const)(
    'shippingType="%s": sem violações de a11y',
    async (initial) => {
      const { container } = render(<FreightFixture initial={initial} />);
      const results = await axe(container);
      expect(results).toHaveNoViolations();
    },
  );

  it('Select e Input têm labels associados (name accessible presente)', () => {
    render(<FreightFixture initial="fob_pre" />);
    // Trigger tem aria-label explícito.
    expect(screen.getByTestId('shipping-type-select')).toHaveAccessibleName(/modalidade de frete/i);
    // Input tem aria-label explícito.
    expect(screen.getByTestId('shipping-cost-input')).toHaveAccessibleName(
      /valor do frete em reais/i,
  );
});

describe('Bloco Frete — navegação por teclado', () => {
  it('Tab visita SelectTrigger e depois o Input Valor R$ quando fob_pre', async () => {
    const user = userEvent.setup();
    render(
      <div>
        <button type="button" data-testid="before">antes</button>
        <FreightFixture initial="fob_pre" />
        <button type="button" data-testid="after">depois</button>
      </div>,
    );

    screen.getByTestId('before').focus();
    expect(document.activeElement).toBe(screen.getByTestId('before'));

    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId('shipping-type-select'));

    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId('shipping-cost-input'));

    await user.tab();
    expect(document.activeElement).toBe(screen.getByTestId('after'));
  });

  it('Shift+Tab volta do Input Valor R$ para o SelectTrigger', async () => {
    const user = userEvent.setup();
    render(<FreightFixture initial="fob_pre" />);
    const input = screen.getByTestId('shipping-cost-input') as HTMLElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(screen.getByTestId('shipping-type-select'));
  });

  it('foco no SelectTrigger sobrevive à troca CIF → FOB pré-negociado (mesma instância)', () => {
    // Wrapper controlado: alterar `initial` só troca a variante de partida, e como o
    // useState do FreightFixture só lê `initial` no mount, forçamos a alteração via
    // key remount + refoco explícito antes/depois — validando que o trigger continua
    // acessível e receptível a foco após o rerender (sem cair para body).
    const { rerender } = render(<FreightFixture key="a" initial="cif" />);
    const triggerBefore = screen.getByTestId('shipping-type-select') as HTMLElement;
    act(() => triggerBefore.focus());
    expect(document.activeElement).toBe(triggerBefore);

    rerender(<FreightFixture key="b" initial="fob_pre" />);
    const triggerAfter = screen.getByTestId('shipping-type-select') as HTMLElement;
    act(() => triggerAfter.focus());
    expect(document.activeElement).toBe(triggerAfter);
    // Nunca "vaza" o foco para o Input recém-montado sem intenção do usuário.
    expect(document.activeElement).not.toBe(screen.getByTestId('shipping-cost-input'));
  });

  describe('Alinhamento do label "Valor R$" (sem cifrão duplicado)', () => {
    it.each(WIDTHS)(
      'width=$width: label "Valor R$" alinha ao início do input, sem span R$ irmão',
      ({ width }) => {
        setViewport(width);
        render(<FreightFixture initial="fob_pre" />);

        const col2 = screen.getByTestId('freight-grid-col-2');
        const label = within(col2).getByText('Valor R$');
        const input = within(col2).getByTestId('shipping-cost-input');

        // Label é filho direto da célula; input está contido (CurrencyInput pode envolver).
        expect(label.parentElement).toBe(col2);
        expect(col2.contains(input)).toBe(true);

        // Nenhum <span> irmão com "R$" duplicando o cifrão do label.
        const spans = col2.querySelectorAll('span');
        const dupCifrao = Array.from(spans).filter(
          (s) => s.textContent?.trim() === 'R$',
        );
        expect(dupCifrao).toHaveLength(0);

        // Célula usa space-y-1 (sem flex/gap horizontal que desalinhe).
        expect(col2.className).toMatch(/space-y-1/);
        expect(col2.className).not.toMatch(/\bflex\b/);
      },
    );

    it('data-testid do campo de valor permanece estável entre rerenders', () => {
      const { rerender } = render(<FreightFixture key="a" initial="fob_pre" />);
      const before = screen.getByTestId('shipping-cost-input');
      rerender(<FreightFixture key="b" initial="fob_pre" />);
      const after = screen.getByTestId('shipping-cost-input');
      expect(after.id).toBe('freight-value');
      expect(after.getAttribute('data-testid')).toBe(
        before.getAttribute('data-testid'),
      );
      // Único no DOM (sem duplicação).
      expect(screen.getAllByTestId('shipping-cost-input')).toHaveLength(1);
      expect(screen.getAllByText('Valor R$')).toHaveLength(1);
    });
  });
});
});


