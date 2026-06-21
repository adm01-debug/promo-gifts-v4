import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { NoveltyGridCard } from '../NoveltyCards';
import type { NoveltyWithDetails } from '@/hooks/products/useNovelties';
import type { ColorDotLike } from '@/components/products/ProductColorSwatches';

vi.mock('@/components/products/ProductQuickActionsFAB', () => ({ ProductQuickActionsFAB: () => null }));
vi.mock('@/components/products/ProductCategoryBadges', () => ({ ProductCategoryBadges: () => null }));
vi.mock('@/components/products/NoveltyBadge', () => ({ NoveltyBadge: () => null }));
vi.mock('@/components/products/ProductStatusBadge', () => ({ ProductStatusBadge: () => null }));
vi.mock('@/components/products/QuickViewThumb', () => ({
  QuickViewThumb: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/products/HoverSetImage', () => ({
  HoverSetImage: ({ primary, alt }: { primary?: string | null; alt?: string }) => (
    <img data-testid="hsi-img" src={primary ?? ''} alt={alt ?? ''} />
  ),
}));

function makeNovelty(overrides: Partial<NoveltyWithDetails> = {}): NoveltyWithDetails {
  return {
    novelty_id: 'nov-1', product_id: 'prod-1', product_sku: 'SKU-1', product_name: 'Caneta',
    product_description: null, base_price: 31.02, product_image: 'https://img/default.png',
    product_set_image: null, category_id: 'cat-1', category_name: 'Esportes', supplier_code: null,
    supplier_id: 'sup-1', supplier_name: 'Spot', supplier_product_code: null,
    detected_at: new Date().toISOString(), expires_at: new Date(Date.now() + 30 * 86400000).toISOString(),
    days_remaining: 27, days_as_novelty: 3, status: 'active', is_highlighted: false, is_active: true,
    stock_quantity: 200, min_quantity: 10, stock_status: 'in-stock', ...overrides,
  };
}
const COLORS: ColorDotLike[] = [
  { name: 'Azul', hex: '#0000ff', image: 'https://img/azul.png', stockQty: 3 },
  { name: 'Verde', hex: '#00ff00', image: 'https://img/verde.png', stockQty: 0 },
  { name: 'Preto', hex: '#000000', image: 'https://img/preto.png', stockQty: 500 },
];

function renderCard(onSelect = vi.fn(), colors: ColorDotLike[] = COLORS, novelty = makeNovelty()) {
  const utils = render(
    <MemoryRouter>
      <TooltipProvider>
        <NoveltyGridCard product={novelty} colors={colors} onSelect={onSelect} />
      </TooltipProvider>
    </MemoryRouter>,
  );
  return { ...utils, onSelect };
}

describe('NoveltyGridCard — interação de seleção de cor (e2e)', () => {
  it('estado inicial: total do produto, sem botão Todos, nenhuma cor marcada', () => {
    const { getByTestId, queryByTestId } = renderCard();
    const footer = getByTestId('novelty-card-footer');
    expect(within(footer).getByText(/200 un\./)).toBeInTheDocument();
    expect(queryByTestId('color-swatches-clear')).toBeNull();
    expect(getByTestId('color-swatch-azul').getAttribute('aria-checked')).toBe('false');
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('https://img/default.png');
  });

  it('clicar Azul: troca imagem + estoque(3, low) + marca a cor + mostra Todos; NÃO abre o card', () => {
    const { getByTestId, queryByTestId, onSelect } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    const footer = getByTestId('novelty-card-footer');
    expect(within(footer).getByText(/3 un\./)).toBeInTheDocument();
    expect(footer.querySelector('[class*="warning"]')).not.toBeNull();
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('https://img/azul.png');
    expect(getByTestId('color-swatch-azul').getAttribute('aria-checked')).toBe('true');
    expect(queryByTestId('color-swatches-clear')).not.toBeNull();
    expect(onSelect).not.toHaveBeenCalled();
  });

  it('clicar Verde: estoque 0 => out-of-stock (destructive) + imagem verde', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-verde'));
    const footer = getByTestId('novelty-card-footer');
    expect(within(footer).getByText(/0 un\./)).toBeInTheDocument();
    expect(footer.querySelector('[class*="destructive"]')).not.toBeNull();
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('https://img/verde.png');
  });

  it('clicar Preto: estoque 500 (in-stock) + imagem preto', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-preto'));
    const footer = getByTestId('novelty-card-footer');
    expect(within(footer).getByText(/500 un\./)).toBeInTheDocument();
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('https://img/preto.png');
  });

  it('Todos (clear): volta para imagem + estoque do produto', () => {
    const { getByTestId, queryByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('https://img/azul.png');
    fireEvent.click(getByTestId('color-swatches-clear'));
    const footer = getByTestId('novelty-card-footer');
    expect(within(footer).getByText(/200 un\./)).toBeInTheDocument();
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('https://img/default.png');
    expect(queryByTestId('color-swatches-clear')).toBeNull();
  });

  it('clicar no corpo do card dispara onSelect(product_id)', () => {
    const { getByTestId, onSelect } = renderCard();
    fireEvent.click(getByTestId('novelty-grid-card'));
    expect(onSelect).toHaveBeenCalledWith('prod-1');
  });

  it('cor sem stockQty NÃO sobrescreve o total do produto, mas troca a imagem', () => {
    const colors: ColorDotLike[] = [{ name: 'Roxo', hex: '#800080', image: 'https://img/roxo.png' }];
    const { getByTestId } = renderCard(vi.fn(), colors);
    fireEvent.click(getByTestId('color-swatch-roxo'));
    const footer = getByTestId('novelty-card-footer');
    expect(within(footer).getByText(/200 un\./)).toBeInTheDocument();
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('https://img/roxo.png');
  });
});
