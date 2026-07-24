import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { ReplenishmentTableView } from '../ReplenishmentCards';
import type { ReplenishmentWithDetails } from '@/hooks/products/useReplenishments';
import type { ColorDotLike } from '@/components/products/ProductColorSwatches';

vi.mock('@/components/products/QuickViewThumb', () => ({
  QuickViewThumb: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/products/ReplenishmentBadge', () => ({ ReplenishmentBadge: () => null }));

function mk(id: string, name: string, img: string, stock: number): ReplenishmentWithDetails {
  return {
    replenishment_id: `rep-${id}`, product_id: id, product_sku: `SKU-${id}`, product_name: name,
    product_description: null, base_price: 10, product_image: img, product_set_image: null,
    category_id: 'c', category_name: 'Cat', supplier_code: null, supplier_id: 's', supplier_name: 'Sup',
    supplier_product_code: null, replenished_at: new Date().toISOString(), created_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(), days_remaining: 10, days_since: 2,
    status: 'active', is_highlighted: false, is_active: true, stock_quantity: stock, min_quantity: 10,
    stock_status: 'in-stock',
  };
}
const products = [
  mk('prod-1', 'Mochila', 'https://img/default1.png', 200),
  mk('prod-2', 'Caneta', 'https://img/default2.png', 99),
];
const colorsByProduct = new Map<string, ColorDotLike[]>([
  ['prod-1', [{ name: 'Azul', hex: '#00f', image: 'https://img/azul.png', stockQty: 3 }, { name: 'Verde', hex: '#0f0', image: 'https://img/verde.png', stockQty: 0 }]],
  ['prod-2', [{ name: 'Roxo', hex: '#808', image: 'https://img/roxo.png', stockQty: 10 }, { name: 'Preto', hex: '#000', image: 'https://img/preto.png', stockQty: 500 }]],
]);

function setup() {
  const onProductClick = vi.fn();
  const onToggleSelect = vi.fn();
  render(
    <MemoryRouter>
      <TooltipProvider>
        <ReplenishmentTableView
          products={products}
          colorsByProduct={colorsByProduct}
          onProductClick={onProductClick}
          onToggleSelect={onToggleSelect}
          selectionMode={false}
          selectedIds={new Set<string>()}
        />
      </TooltipProvider>
    </MemoryRouter>,
  );
  const rowOf = (name: string) => screen.getByText(name).closest<HTMLTableRowElement>('tr')!;
  const imgSrc = (name: string) => screen.getByAltText(`Foto de ${name}`).getAttribute('src');
  const statusOf = (name: string, label: string) => within(rowOf(name)).queryByText(label);
  const clickSwatch = (name: string, swatch: string) =>
    fireEvent.click(within(rowOf(name)).getByTestId(swatch));
  return { onProductClick, onToggleSelect, rowOf, imgSrc, statusOf, clickSwatch };
}

describe('ReplenishmentTableView (tabela Reposição) — isolamento por linha', () => {
  it('inicial: imagens default e "Em estoque" nas duas linhas', () => {
    const { imgSrc, statusOf } = setup();
    expect(imgSrc('Mochila')).toBe('https://img/default1.png');
    expect(imgSrc('Caneta')).toBe('https://img/default2.png');
    expect(statusOf('Mochila', 'Em estoque')).not.toBeNull();
    expect(statusOf('Caneta', 'Em estoque')).not.toBeNull();
  });

  it('Azul na linha 1: muda só a linha 1 (imagem+low); swatch não abre a linha', () => {
    const { imgSrc, statusOf, onProductClick, clickSwatch } = setup();
    clickSwatch('Mochila', 'color-swatch-azul');
    expect(imgSrc('Mochila')).toBe('https://img/azul.png');
    expect(statusOf('Mochila', 'Estoque baixo')).not.toBeNull();
    expect(imgSrc('Caneta')).toBe('https://img/default2.png');
    expect(statusOf('Caneta', 'Em estoque')).not.toBeNull();
    expect(onProductClick).not.toHaveBeenCalled();
  });

  it('[UNIFICADO] Roxo stockQty=10 => "Em estoque" (getCatalogStockStatus), idêntico a Novidades', () => {
    const { imgSrc, statusOf, clickSwatch } = setup();
    clickSwatch('Caneta', 'color-swatch-roxo');
    expect(imgSrc('Caneta')).toBe('https://img/roxo.png');
    expect(statusOf('Caneta', 'Em estoque')).not.toBeNull();
    expect(statusOf('Caneta', 'Estoque baixo')).toBeNull();
  });

  it('Verde stockQty=0 => "Estoque zerado"', () => {
    const { statusOf, clickSwatch } = setup();
    clickSwatch('Mochila', 'color-swatch-verde');
    expect(statusOf('Mochila', 'Estoque zerado')).not.toBeNull();
  });

  it('seleções coexistem + Todos limpa só a linha alvo', () => {
    const { imgSrc, statusOf, clickSwatch } = setup();
    clickSwatch('Mochila', 'color-swatch-azul');
    clickSwatch('Caneta', 'color-swatch-preto');
    expect(imgSrc('Mochila')).toBe('https://img/azul.png');
    expect(imgSrc('Caneta')).toBe('https://img/preto.png');
    expect(statusOf('Caneta', 'Em estoque')).not.toBeNull();
    clickSwatch('Mochila', 'color-swatches-clear');
    expect(imgSrc('Mochila')).toBe('https://img/default1.png');
    expect(statusOf('Mochila', 'Em estoque')).not.toBeNull();
    expect(imgSrc('Caneta')).toBe('https://img/preto.png');
  });

  it('clique no corpo da linha chama onProductClick(productId)', () => {
    const { rowOf, onProductClick } = setup();
    fireEvent.click(rowOf('Caneta'));
    expect(onProductClick).toHaveBeenCalledWith('prod-2');
  });
});
