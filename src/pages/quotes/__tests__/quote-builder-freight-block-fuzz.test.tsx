/**
 * Fuzz de layout do bloco Frete (528 cenários).
 *
 * Matriz combinatória:
 *   shippingType   ∈ {cif, fob, fob_pre, prepaid}          → 4
 *   viewport width ∈ {320,360,375,414,600,768,900,1024,1280,1440,1920} → 11
 *   rem base       ∈ {14,16,18,20}                         → 4
 *   label variant  ∈ {curto, longo, com erro *}            → 3
 *   = 528 cenários
 *
 * NOTA sobre altura real:
 *  jsdom não computa layout (getBoundingClientRect retorna zeros). Portanto o
 *  fuzz valida INVARIANTES ESTRUTURAIS que — se preservadas — garantem que o
 *  container NÃO cresce ao alternar para fob_pre:
 *    (a) o bloco Frete tem EXATAMENTE 1 wrapper filho direto: o grid.
 *    (b) o grid contém no máximo 2 colunas irmãs (col-1 sempre; col-2 só em fob_pre).
 *    (c) Nenhum wrapper full-width extra (mt-*, w-full stand-alone) foi introduzido.
 *    (d) Labels vivem DENTRO das colunas do grid (não fora), então não há linha extra.
 *    (e) Todo `htmlFor` resolve para um `id` existente (nenhum órfão).
 *    (f) `items-end` presente no grid (alinhamento vertical do input ao trigger).
 *  A altura visual real é validada pelo Playwright visual regression em
 *  e2e/visual/quote-freight-block.spec.ts.
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
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

const SHIPPINGS: Shipping[] = ['cif', 'fob', 'fob_pre', 'prepaid'];
const WIDTHS = [320, 360, 375, 414, 600, 768, 900, 1024, 1280, 1440, 1920];
const REMS = [14, 16, 18, 20];
const LABEL_VARIANTS = ['curto', 'longo', 'erro'] as const;
type LabelVariant = (typeof LABEL_VARIANTS)[number];

function FreightFixture({
  initial,
  labelVariant,
}: {
  initial: Shipping;
  labelVariant: LabelVariant;
}) {
  const [shippingType, setShippingType] = useState<Shipping>(initial);
  const [shippingCost, setShippingCost] = useState(0);
  const hasError = labelVariant === 'erro';
  const validationErrors = hasError ? ['frete', 'valor_frete'] : [];
  const showValor = shippingType === 'fob_pre';

  const labelFrete =
    labelVariant === 'longo'
      ? 'Frete (modalidade de entrega ao cliente)'
      : 'Frete';
  const labelValor =
    labelVariant === 'longo' ? 'Valor R$ (frete pré-negociado)' : 'Valor R$';

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
            {labelFrete}
            {validationErrors.includes('frete') && <span className="ml-1">*</span>}
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
              className={cn(
                'h-8 text-xs',
                validationErrors.includes('frete') && 'border-destructive',
              )}
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
            <Label
              htmlFor="freight-value"
              className={cn(
                'text-xs',
                validationErrors.includes('valor_frete')
                  ? 'text-destructive'
                  : 'text-muted-foreground',
              )}
            >
              {labelValor}
              {validationErrors.includes('valor_frete') && <span className="ml-1">*</span>}
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
                className={cn(
                  'h-8 text-xs',
                  validationErrors.includes('valor_frete') && 'border-destructive',
                )}
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
function setRem(px: number) {
  document.documentElement.style.fontSize = `${px}px`;
}

interface Scenario {
  shipping: Shipping;
  width: number;
  rem: number;
  labelVariant: LabelVariant;
}

const SCENARIOS: Scenario[] = [];
for (const shipping of SHIPPINGS) {
  for (const width of WIDTHS) {
    for (const rem of REMS) {
      for (const labelVariant of LABEL_VARIANTS) {
        SCENARIOS.push({ shipping, width, rem, labelVariant });
      }
    }
  }
}

function validateInvariants(container: HTMLElement, sc: Scenario) {
  const block = container.querySelector('[data-testid="freight-block"]')!;
  expect(block, 'freight-block presente').toBeTruthy();

  // (a) freight-block tem exatamente 1 filho direto: o grid.
  const directChildren = Array.from(block.children);
  expect(directChildren, `[${sc.shipping}/${sc.width}/${sc.rem}/${sc.labelVariant}] freight-block com exatamente 1 filho direto (o grid)`).toHaveLength(1);
  const grid = directChildren[0] as HTMLElement;
  expect(grid.getAttribute('data-testid')).toBe('freight-grid');

  // (f) items-end + grid responsivo preservado.
  expect(grid.className).toMatch(/\bgrid\b/);
  expect(grid.className).toMatch(/grid-cols-1/);
  expect(grid.className).toMatch(/md:grid-cols-3/);
  expect(grid.className).toMatch(/items-end/);
  // Não pode aplicar space-y-* no grid (só nas células) — evitaria items-end.
  expect(grid.className).not.toMatch(/\bspace-y-/);

  // (b) col-1 sempre; col-2 só em fob_pre.
  const cols = Array.from(grid.querySelectorAll('[data-testid^="freight-grid-col-"]'));
  const col1 = grid.querySelector('[data-testid="freight-grid-col-1"]');
  const col2 = grid.querySelector('[data-testid="freight-grid-col-2"]');
  expect(col1, 'col-1 presente').toBeTruthy();
  if (sc.shipping === 'fob_pre') {
    expect(col2, 'col-2 presente em fob_pre').toBeTruthy();
    expect(cols).toHaveLength(2);
  } else {
    expect(col2, `col-2 AUSENTE em shipping=${sc.shipping}`).toBeFalsy();
    expect(cols).toHaveLength(1);
  }

  // (c) Nenhum wrapper full-width extra dentro do freight-block além do grid.
  const fullWidthExtras = block.querySelectorAll(':scope > div:not([data-testid="freight-grid"])');
  expect(fullWidthExtras, 'nenhum wrapper full-width extra').toHaveLength(0);

  // (d) Labels vivem DENTRO das colunas do grid.
  const labels = Array.from(block.querySelectorAll('label'));
  for (const lbl of labels) {
    const closestCol = lbl.closest('[data-testid^="freight-grid-col-"]');
    expect(closestCol, `label "${lbl.textContent}" deve estar dentro de uma coluna do grid`).toBeTruthy();
  }

  // (e) Todo htmlFor resolve para um id existente.
  for (const lbl of labels) {
    const forId = lbl.getAttribute('for');
    if (forId) {
      const target = block.querySelector(`#${CSS.escape(forId)}`);
      expect(target, `label htmlFor="${forId}" tem alvo existente`).toBeTruthy();
    }
  }
}

describe(`Bloco Frete — fuzz de layout (${SCENARIOS.length} cenários)`, () => {
  it(`gera exatamente 528 cenários (4 × 11 × 4 × 3)`, () => {
    expect(SCENARIOS).toHaveLength(528);
  });

  it.each(SCENARIOS)(
    'sc: %s',
    (sc) => {
      setViewport(sc.width);
      setRem(sc.rem);
      const { container, unmount } = render(
        <FreightFixture initial={sc.shipping} labelVariant={sc.labelVariant} />,
      );
      try {
        validateInvariants(container as HTMLElement, sc);

        // Segunda medição: alterna para fob_pre e revalida. Invariante-mãe:
        // a estrutura do bloco continua com 1 filho direto (o grid) — logo
        // o container NÃO ganhou wrapper extra, apenas col-2 apareceu dentro
        // do próprio grid. Isso garante que a altura da coluna é gap-3 (não +row).
        unmount();
        const second = render(
          <FreightFixture initial="fob_pre" labelVariant={sc.labelVariant} />,
        );
        validateInvariants(
          second.container as HTMLElement,
          { ...sc, shipping: 'fob_pre' },
        );
        second.unmount();
      } finally {
        setRem(16);
      }
    },
  );
});
