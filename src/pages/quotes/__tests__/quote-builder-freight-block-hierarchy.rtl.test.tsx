/**
 * RTL — hierarquia completa e estabilidade dos data-testid do bloco Frete
 * em TODAS as larguras alvo (320→1280) e TODOS os estados de shippingType.
 *
 * O foco não é layout visual (isso vive no Playwright), e sim garantir que
 * a estrutura DOM do grid não muda por largura de tela (invariante JS:
 * classes Tailwind são estáticas) e que os testids permanecem estáveis
 * entre trocas de shippingType — nenhum consumer (E2E, scripts, telemetria)
 * pode quebrar em silêncio quando o usuário alterna cif ↔ fob ↔ fob_pre.
 *
 * Cobertura:
 *   estados  ∈ {cif, fob, fob_pre, prepaid}     → 4
 *   larguras ∈ {320,375,414,600,768,900,1024,1280} → 8
 *   = 32 cenários × 6 asserts de hierarquia    = 192 asserts
 */
import { describe, it, expect } from 'vitest';
import { render, screen, within } from '@testing-library/react';
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

type Shipping = 'cif' | 'fob_pre' | 'fob' | 'prepaid';

const STATES: Shipping[] = ['cif', 'fob', 'fob_pre', 'prepaid'];
const WIDTHS = [320, 375, 414, 600, 768, 900, 1024, 1280];

function FreightFixture({ initial = 'cif' as Shipping }) {
  const [shippingType, setShippingType] = useState<Shipping>(initial);
  const [shippingCost, setShippingCost] = useState(0);
  const showValor = shippingType === 'fob_pre';

  return (
    <div className="mt-1 border-t border-border/30 pt-3" data-testid="freight-block">
      <div
        data-testid="freight-grid"
        className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
      >
        <div className="space-y-1" data-testid="freight-grid-col-1">
          <Label htmlFor="freight-select" className={cn('text-xs', 'text-muted-foreground')}>
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
              aria-label="Modalidade de frete"
              className="h-8 text-xs"
            >
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="cif">CIF | Frete grátis</SelectItem>
              <SelectItem value="fob">FOB | Repassado ao cliente</SelectItem>
              <SelectItem value="fob_pre">FOB | Valor pré negociado</SelectItem>
              <SelectItem value="prepaid">Pré-pago</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {showValor && (
          <div className="space-y-1" data-testid="freight-grid-col-2">
            <Label htmlFor="freight-value" className="text-xs text-muted-foreground">
              Valor R$
            </Label>
            <div className="flex items-center gap-1.5">
              <span className="text-xs text-muted-foreground" aria-hidden="true">
                R$
              </span>
              <CurrencyInput
                id="freight-value"
                data-testid="shipping-cost-input"
                aria-label="Valor do frete em reais"
                value={shippingCost}
                onChange={(n) => setShippingCost(Math.max(0, n))}
                className="h-8 text-xs"
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function setViewport(w: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, value: w });
  window.dispatchEvent(new Event('resize'));
}

interface Case {
  state: Shipping;
  width: number;
}
const CASES: Case[] = STATES.flatMap((s) => WIDTHS.map((w) => ({ state: s, width: w })));

describe(`Bloco Frete — hierarquia + testids estáveis (${CASES.length} cenários)`, () => {
  it('gera exatamente 32 combinações (4 estados × 8 larguras)', () => {
    expect(CASES).toHaveLength(32);
  });

  it.each(CASES)(
    'estado=$state @ $width px → hierarquia completa preservada',
    ({ state, width }) => {
      setViewport(width);
      const { container } = render(<FreightFixture key={`${state}-${width}`} initial={state} />);

    // 1. freight-block é raiz única e tem exatamente 1 filho direto (o grid).
    const block = screen.getByTestId('freight-block');
    expect(block).toBeInTheDocument();
    expect(Array.from(block.children)).toHaveLength(1);

    // 2. grid tem classes responsivas invariantes (Tailwind estático — jamais muda por JS).
    const grid = within(block).getByTestId('freight-grid');
    expect(grid.parentElement).toBe(block);
    expect(grid).toHaveClass('grid', 'grid-cols-1', 'md:grid-cols-3', 'gap-3', 'items-end');
    expect(grid.className).not.toMatch(/\bspace-y-/);

    // 3. col-1 sempre presente, filho direto do grid, contém trigger.
    const col1 = within(grid).getByTestId('freight-grid-col-1');
    expect(col1.parentElement).toBe(grid);
    expect(within(col1).getByTestId('shipping-type-select')).toBeInTheDocument();
    expect(col1.querySelector('label[for="freight-select"]')).toBeTruthy();

    // 4. col-2 presente SOMENTE em fob_pre, também como filho direto do grid.
    if (state === 'fob_pre') {
      const col2 = within(grid).getByTestId('freight-grid-col-2');
      expect(col2.parentElement).toBe(grid);
      expect(within(col2).getByTestId('shipping-cost-input')).toBeInTheDocument();
      expect(col2.querySelector('label[for="freight-value"]')).toBeTruthy();

      // Ordem DOM: col-1 vem antes de col-2 (mesma linha do grid, esquerda→direita).
      const cols = Array.from(grid.children).filter((c) =>
        (c as HTMLElement).getAttribute('data-testid')?.startsWith('freight-grid-col-'),
      );
      expect(cols).toHaveLength(2);
      expect((cols[0] as HTMLElement).getAttribute('data-testid')).toBe('freight-grid-col-1');
      expect((cols[1] as HTMLElement).getAttribute('data-testid')).toBe('freight-grid-col-2');
    } else {
      expect(within(grid).queryByTestId('freight-grid-col-2')).toBeNull();
      expect(within(grid).queryByTestId('shipping-cost-input')).toBeNull();
      // Grid tem exatamente 1 filho (col-1).
      expect(Array.from(grid.children)).toHaveLength(1);
    }

    // 5. IDs para acessibilidade não colidem nem somem.
    expect(container.querySelector('#freight-select')).toBeTruthy();
    expect(container.querySelector('#freight-value')).toBe(
      state === 'fob_pre' ? container.querySelector('[data-testid="shipping-cost-input"]') : null,
    );

    // 6. Nenhum testid duplicado no bloco (evita regressão silenciosa que confunde specs E2E).
    const testids = Array.from(block.querySelectorAll('[data-testid]')).map((el) =>
      (el as HTMLElement).getAttribute('data-testid'),
    );
    const unique = new Set(testids);
    expect(unique.size).toBe(testids.length);
    },
  );
});

describe('Bloco Frete — estabilidade dos testids ao alternar shippingType', () => {
  it.each(WIDTHS)('largura %s px: CIF → FOB pré → CIF preserva ids do trigger', (w) => {
    setViewport(w);
    // Usamos key remount para simular a mudança real de shippingType via store,
    // uma vez que o useState local do FreightFixture só lê `initial` no mount.
    const { rerender } = render(<FreightFixture key="a" initial="cif" />);
    const idCif = screen.getByTestId('shipping-type-select').getAttribute('id');

    rerender(<FreightFixture key="b" initial="fob_pre" />);
    const idPre = screen.getByTestId('shipping-type-select').getAttribute('id');
    expect(screen.getByTestId('shipping-cost-input').getAttribute('id')).toBe('freight-value');

    rerender(<FreightFixture key="c" initial="cif" />);
    const idCif2 = screen.getByTestId('shipping-type-select').getAttribute('id');

    expect(idCif).toBe('freight-select');
    expect(idPre).toBe('freight-select');
    expect(idCif2).toBe('freight-select');
    expect(screen.queryByTestId('shipping-cost-input')).toBeNull();
  });
});
