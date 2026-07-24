import type { ReactNode } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BaseProductGridCard } from '../BaseProductGridCard';
import type { ColorDotLike } from '@/components/products/ProductColorSwatches';

vi.mock('@/components/products/ProductQuickActionsFAB', () => ({ ProductQuickActionsFAB: () => null }));
vi.mock('@/components/products/ProductCategoryBadges', () => ({ ProductCategoryBadges: () => null }));
vi.mock('@/components/products/QuickViewThumb', () => ({
  QuickViewThumb: ({ children }: { children?: ReactNode }) => <>{children}</>,
}));
vi.mock('@/components/products/HoverSetImage', () => ({
  HoverSetImage: ({ primary, alt }: { primary?: string | null; alt?: string }) => (
    <img data-testid="hsi-img" src={primary ?? ''} alt={alt ?? ''} />
  ),
}));

const COLORS: ColorDotLike[] = [
  { name: 'Azul', hex: '#00f', image: 'https://img/azul.png', stockQty: 3 },
  { name: 'Verde', hex: '#0f0', image: 'https://img/verde.png', stockQty: 0 },
  { name: 'Preto', hex: '#000', image: 'https://img/preto.png', stockQty: 500 },
  { name: 'Limiar', hex: '#888', image: 'https://img/limiar.png', stockQty: 10 },
  { name: 'Negativa', hex: '#111', image: 'https://img/neg.png', stockQty: -5 },
];

function renderCard(onClick = vi.fn(), colors: ColorDotLike[] = COLORS) {
  const utils = render(
    <MemoryRouter>
      <TooltipProvider>
        <BaseProductGridCard
          productId="prod-1"
          productName="Mochila"
          productImage="https://img/default.png"
          basePrice={50}
          minQuantity={10}
          stockQuantity={200}
          stockStatus={null}
          colors={colors}
          onClick={onClick}
          testId="repo-card"
          footerTestId="repo-footer"
        />
      </TooltipProvider>
    </MemoryRouter>,
  );
  return { ...utils, onClick };
}

describe('BaseProductGridCard (grid Reposição) — interação de cor (e2e)', () => {
  it('inicial: total 200 (in-stock), sem Todos, imagem default', () => {
    const { getByTestId, queryByTestId } = renderCard();
    expect(within(getByTestId('repo-footer')).getByText(/200 un\./)).toBeInTheDocument();
    expect(queryByTestId('color-swatches-clear')).toBeNull();
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('https://img/default.png');
  });

  it('Azul: imagem+estoque(3, low) + marca + Todos; clique na cor NÃO abre o card', () => {
    const { getByTestId, queryByTestId, onClick } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    const f = getByTestId('repo-footer');
    expect(within(f).getByText(/3 un\./)).toBeInTheDocument();
    expect(f.querySelector('[class*="warning"]')).not.toBeNull();
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('https://img/azul.png');
    expect(getByTestId('color-swatch-azul').getAttribute('aria-checked')).toBe('true');
    expect(queryByTestId('color-swatches-clear')).not.toBeNull();
    expect(onClick).not.toHaveBeenCalled();
  });

  it('Verde: 0 => out-of-stock (destructive)', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-verde'));
    const f = getByTestId('repo-footer');
    expect(within(f).getByText(/0 un\./)).toBeInTheDocument();
    expect(f.querySelector('[class*="destructive"]')).not.toBeNull();
  });

  it('Preto: 500 => in-stock + imagem', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-preto'));
    expect(within(getByTestId('repo-footer')).getByText(/500 un\./)).toBeInTheDocument();
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('https://img/preto.png');
  });

  it('Todos: reseta imagem + total', () => {
    const { getByTestId, queryByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-azul'));
    fireEvent.click(getByTestId('color-swatches-clear'));
    expect(within(getByTestId('repo-footer')).getByText(/200 un\./)).toBeInTheDocument();
    expect(getByTestId('hsi-img').getAttribute('src')).toBe('https://img/default.png');
    expect(queryByTestId('color-swatches-clear')).toBeNull();
  });

  it('corpo do card chama onClick', () => {
    const { getByTestId, onClick } = renderCard();
    fireEvent.click(getByTestId('repo-card'));
    expect(onClick).toHaveBeenCalled();
  });

  it('[UNIFICADO] qty=10 => in-stock (getCatalogStockStatus), idêntico a Novidades', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-limiar'));
    const f = getByTestId('repo-footer');
    expect(within(f).getByText(/10 un\./)).toBeInTheDocument();
    expect(f.querySelector('[class*="warning"]')).toBeNull();
    expect(f.querySelector('[class*="destructive"]')).toBeNull();
  });

  it('[CORRIGIDO] stockQty negativo => out-of-stock (getCatalogStockStatus), não mais low', () => {
    const { getByTestId } = renderCard();
    fireEvent.click(getByTestId('color-swatch-negativa'));
    const f = getByTestId('repo-footer');
    expect(f.querySelector('[class*="destructive"]')).not.toBeNull();
    expect(f.querySelector('[class*="warning"]')).toBeNull();
  });
});
