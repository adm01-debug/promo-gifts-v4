/**
 * Renderiza uma cópia fiel do bloco de preço recolhido do QuoteBuilderSummaryColumn
 * (linhas 810–837 do source) e valida estruturalmente que rótulo (título) e valor
 * são elementos IRMÃOS separados dentro de um wrapper `flex flex-col gap-2`.
 *
 * Cobertura de viewport: como o layout usa apenas Tailwind (CSS puro, sem media
 * queries no bloco), a estrutura DOM é idêntica em 360px / 375px / 414px. O
 * teste itera pelos três widths para deixar essa invariância explícita e servir
 * de guarda contra regressões que adicionem `sm:`, `md:`, etc. no bloco.
 *
 * (Visual regression pixel-perfect com Playwright + baselines fica para PR
 * dedicado de infra.)
 */
import React from 'react';
import { describe, it, expect, beforeEach } from 'vitest';
import { render } from '@testing-library/react';

const brl = (v: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(v);

function CollapsedPriceBlock({ quantity, unit }: { quantity: number; unit: number }) {
  return (
    <div
      data-testid="quote-summary-collapsed-price-0"
      className="flex shrink-0 items-start gap-8 tabular-nums"
    >
      <div className="flex flex-col items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Qtd
        </span>
        <span className="text-xs font-medium leading-none">{quantity}</span>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Vl Unitário
        </span>
        <span className="text-xs font-medium leading-none">{brl(unit)}</span>
      </div>
      <div className="flex flex-col items-end gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/70">
          Subtotal
        </span>
        <span className="text-xs font-semibold leading-none text-foreground">
          {brl(quantity * unit)}
        </span>
      </div>
    </div>
  );
}

const VIEWPORTS = [360, 375, 414] as const;

describe.each(VIEWPORTS)(
  'Bloco de preço recolhido — estrutura estável em %dpx',
  (width) => {
    beforeEach(() => {
      Object.defineProperty(window, 'innerWidth', { configurable: true, value: width });
      window.dispatchEvent(new Event('resize'));
    });

    it('cada coluna tem 2 filhos: rótulo (span 10px uppercase) + valor (span xs)', () => {
      const { getByTestId } = render(<CollapsedPriceBlock quantity={200} unit={20} />);
      const block = getByTestId('quote-summary-collapsed-price-0');
      // 3 colunas
      const cols = Array.from(block.children) as HTMLElement[];
      expect(cols).toHaveLength(3);
      for (const col of cols) {
        expect(col.className).toMatch(/flex flex-col.*gap-2/);
        const kids = Array.from(col.children) as HTMLElement[];
        // Rótulo e valor DEVEM ser irmãos separados (não aninhados)
        expect(kids).toHaveLength(2);
        const [label, value] = kids;
        expect(label.tagName).toBe('SPAN');
        expect(value.tagName).toBe('SPAN');
        expect(label.className).toMatch(/text-\[10px\].*uppercase.*text-muted-foreground\/70/);
        expect(value.className).toMatch(/text-xs/);
        // Rótulo ≠ valor (defesa contra colar em um único node)
        expect(label).not.toBe(value);
        expect(label.textContent?.trim()).not.toBe(value.textContent?.trim());
      }
    });

    it('wrapper externo mantém gap-8 horizontal entre colunas', () => {
      const { getByTestId } = render(<CollapsedPriceBlock quantity={10} unit={458.55} />);
      const block = getByTestId('quote-summary-collapsed-price-0');
      expect(block.className).toMatch(/\bgap-8\b/);
      expect(block.className).not.toMatch(/\bgap-4\b/);
      expect(block.className).not.toMatch(/\bgap-6\b/);
    });

    it('rótulos das 3 colunas são exatamente Qtd / Vl Unitário / Subtotal (ordem estável)', () => {
      const { getByTestId } = render(<CollapsedPriceBlock quantity={1} unit={44.79} />);
      const block = getByTestId('quote-summary-collapsed-price-0');
      const labels = Array.from(block.querySelectorAll('span.uppercase')).map(
        (n) => n.textContent?.trim(),
      );
      expect(labels).toEqual(['Qtd', 'Vl Unitário', 'Subtotal']);
    });
  },
);
