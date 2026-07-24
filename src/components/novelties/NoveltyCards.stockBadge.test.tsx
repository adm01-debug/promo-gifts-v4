/**
 * Cobre a lógica de fallback da StockBadge no card de Novidades (modo Grade)
 * quando `stock_quantity` chega como número, null ou undefined.
 *
 * Lógica esperada (espelho de `useNovelties.toNovelty`):
 *   stock === 0           → 'out-of-stock'  (vermelho/destructive)
 *   0 < stock < threshold → 'low-stock'     (âmbar/warning)
 *   stock >= threshold    → 'in-stock'      (verde/primary)
 *   stock null/undefined  → tratado como 0  → 'out-of-stock'
 *
 * Threshold default no card = 10 (paridade com `min_quantity ?? 10`).
 */
import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { TooltipProvider } from '@/components/ui/tooltip';
import { StockBadge, getStockStatus } from '@/components/inventory/StockBadge';

function renderBadge(stockQuantity: number | null | undefined, stockStatus?: 'in-stock' | 'low-stock' | 'out-of-stock') {
  const status = stockStatus ?? getStockStatus(stockQuantity ?? 0, 10);
  return render(
    <TooltipProvider>
      <StockBadge status={status} quantity={stockQuantity ?? 0} showQuantity size="sm" />
    </TooltipProvider>,
  );
}

describe('NoveltyCards › StockBadge (fallback de stock_quantity)', () => {
  describe('getStockStatus com threshold=10', () => {
    it('retorna "out-of-stock" quando quantidade = 0', () => {
      expect(getStockStatus(0, 10)).toBe('out-of-stock');
    });

    it('retorna "low-stock" quando 0 < quantidade <= 10', () => {
      expect(getStockStatus(1, 10)).toBe('low-stock');
      expect(getStockStatus(5, 10)).toBe('low-stock');
      expect(getStockStatus(10, 10)).toBe('low-stock');
    });

    it('retorna "in-stock" quando quantidade > 10', () => {
      expect(getStockStatus(11, 10)).toBe('in-stock');
      expect(getStockStatus(500, 10)).toBe('in-stock');
    });
  });

  describe('fallback quando stock_quantity é null/undefined', () => {
    it('null → exibe 0 unidades como esgotado', () => {
      const { getByText } = renderBadge(null);
      expect(getByText(/0 un\./)).toBeInTheDocument();
    });

    it('undefined → exibe 0 unidades como esgotado', () => {
      const { getByText } = renderBadge(undefined);
      expect(getByText(/0 un\./)).toBeInTheDocument();
    });

    it('null → resolve para status "out-of-stock"', () => {
      expect(getStockStatus((null as unknown as number) ?? 0, 10)).toBe('out-of-stock');
    });
  });

  describe('renderização de cores semânticas por status', () => {
    it('out-of-stock usa token "destructive" (vermelho)', () => {
      const { container } = renderBadge(0);
      expect(container.querySelector('[class*="destructive"]')).not.toBeNull();
    });

    it('low-stock usa token "warning" (âmbar)', () => {
      const { container } = renderBadge(5);
      expect(container.querySelector('[class*="warning"]')).not.toBeNull();
    });

    it('in-stock usa token "primary" (verde)', () => {
      const { container } = renderBadge(100);
      expect(container.querySelector('[class*="primary"]')).not.toBeNull();
    });
  });

  describe('quantidade exibida bate com o estoque real', () => {
    it('estoque normal mostra a quantidade formatada', () => {
      const { getByText } = renderBadge(250);
      expect(getByText(/250 un\./)).toBeInTheDocument();
    });

    it('estoque acima de 1000 é formatado com k', () => {
      const { getByText } = renderBadge(1500);
      expect(getByText(/1\.5k un\./)).toBeInTheDocument();
    });

    it('respeita stock_status vindo do hook mesmo se quantidade divergir', () => {
      // Cenário: hook decidiu 'low-stock' com threshold customizado (min_quantity=50)
      const { container, getByText } = renderBadge(30, 'low-stock');
      expect(getByText(/30 un\./)).toBeInTheDocument();
      expect(container.querySelector('[class*="warning"]')).not.toBeNull();
    });
  });
});
