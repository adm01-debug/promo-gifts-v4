import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NoveltyTableView } from '../NoveltyCards';
import type { NoveltyWithDetails } from '@/hooks/products/useNovelties';
import type { ColorDotLike } from '@/components/products/ProductColorSwatches';

vi.mock('@/components/products/ProductQuickActionsFAB', () => ({ ProductQuickActionsFAB: () => null }));
vi.mock('@/components/products/NoveltyBadge', () => ({ NoveltyBadge: () => null }));
vi.mock('@/components/products/QuickViewThumb', () => ({
  QuickViewThumb: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));

function mk(id: string, name: string, img: string, stock: number): NoveltyWithDetails {
  return {
    novelty_id: `nov-${id}`, product_id: id, product_sku: `SKU-${id}`, product_name: name,
    product_description: null, base_price: 10, product_image: img, product_set_image: null,
    category_id: 'c', category_name: 'Cat', supplier_code: null, supplier_id: 's', supplier_name: 'Sup',
    supplier_product_code: null, detected_at: new Date().toISOString(),
    expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    days_remaining: 10, days_as_novelty: 3, status: 'active', is_highlighted: false, is_active: true,
    stock_quantity: stock, min_quantity: 10, stock_status: 'in-stock',
  };
}
const products = [
  mk('prod-1', 'Mochila', 'https://img/default1.png', 200),
  mk('prod-2', 'Caneta', 'https://img/default2.png', 99),
];
const colorsByProduct = new Map<string, ColorDotLike[]>([
  ['prod-1', [{ name: 'Azul', hex: '#00f', image: 'https://img/azul.png', stockQty: 3 }, { name: 'Verde', hex: '#0f0', image: 'https://img/verde.png', stockQty: 0 }]],
  ['prod-2', [{ name: 'Roxo', hex: '#808', image: 'https://img/roxo.png', stockQty: 7 }, { name: 'Preto', hex: '#000', image: 'https://img/preto.png', stockQty: 50 }]],
]);

function setup() {
  const onSelect = vi.fn();
  const { container } = render(
    <MemoryRouter>
      <TooltipProvider>
        <NoveltyTableView products={products} colorsByProduct={colorsByProduct} onSelect={onSelect} />
      </TooltipProvider>
    </MemoryRouter>,
  );
  const row = (name: string) =>
    container.querySelector<HTMLTableRowElement>(`tr[aria-label="Produto: ${name}"]`)!;
  const img = (name: string) => within(row(name)).getByRole('img').getAttribute('src');
  return { container, onSelect, row, img };
}

describe('NoveltyTableView — isolamento de seleção por linha', () => {
  it('inicial: cada linha mostra seu total e imagem default', () => {
    const { row, img } = setup();
    expect(within(row('Mochila')).getByText(/200 un\./)).toBeInTheDocument();
    expect(img('Mochila')).toBe('https://img/default1.png');
    expect(within(row('Caneta')).getByText(/99 un\./)).toBeInTheDocument();
    expect(img('Caneta')).toBe('https://img/default2.png');
  });

  it('selecionar cor na linha 1 NÃO afeta a linha 2', () => {
    const { row, img, onSelect } = setup();
    fireEvent.click(within(row('Mochila')).getByTestId('color-swatch-azul'));
    expect(within(row('Mochila')).getByText(/3 un\./)).toBeInTheDocument();
    expect(img('Mochila')).toBe('https://img/azul.png');
    expect(within(row('Caneta')).getByText(/99 un\./)).toBeInTheDocument();
    expect(img('Caneta')).toBe('https://img/default2.png');
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('seleções coexistem independentes (linha1=Azul, linha2=Roxo)', () => {
    const { row, img } = setup();
    fireEvent.click(within(row('Mochila')).getByTestId('color-swatch-azul'));
    fireEvent.click(within(row('Caneta')).getByTestId('color-swatch-roxo'));
    expect(within(row('Mochila')).getByText(/3 un\./)).toBeInTheDocument();
    expect(img('Mochila')).toBe('https://img/azul.png');
    expect(within(row('Caneta')).getByText(/7 un\./)).toBeInTheDocument();
    expect(img('Caneta')).toBe('https://img/roxo.png');
  });

  it('Todos numa linha limpa só aquela linha', () => {
    const { row, img } = setup();
    fireEvent.click(within(row('Mochila')).getByTestId('color-swatch-azul'));
    fireEvent.click(within(row('Caneta')).getByTestId('color-swatch-roxo'));
    fireEvent.click(within(row('Mochila')).getByTestId('color-swatches-clear'));
    expect(within(row('Mochila')).getByText(/200 un\./)).toBeInTheDocument();
    expect(img('Mochila')).toBe('https://img/default1.png');
    expect(within(row('Caneta')).getByText(/7 un\./)).toBeInTheDocument();
    expect(img('Caneta')).toBe('https://img/roxo.png');
  });

  it('clicar no corpo da linha dispara onSelect(productId)', () => {
    const { row, onSelect } = setup();
    fireEvent.click(row('Caneta'));
    expect(onSelect).toHaveBeenCalledWith('prod-2');
  });
});
