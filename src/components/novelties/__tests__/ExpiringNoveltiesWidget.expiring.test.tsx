/**
 * Auditoria Novidades — cobre a seção "Expirando em breve" do widget.
 * Antes o componente se chamava ExpiringNoveltiesWidget mas NUNCA mostrava
 * novidades expirando (só "+ Recentes" e "Por Fornecedor"). Agora usa
 * useExpiringNovelties e renderiza só quando há itens.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import '@testing-library/jest-dom';
import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import type { NoveltyWithDetails } from '@/hooks/products/useNovelties';
import { ExpiringNoveltiesWidget } from '../ExpiringNoveltiesWidget';

const hooks = {
  useNoveltiesWithDetails: vi.fn(),
  useExpiringNovelties: vi.fn(),
  useNoveltyStats: vi.fn(),
};

vi.mock('@/hooks/products', () => ({
  useNoveltiesWithDetails: (...a: unknown[]) => hooks.useNoveltiesWithDetails(...a),
  useExpiringNovelties: (...a: unknown[]) => hooks.useExpiringNovelties(...a),
  useNoveltyStats: (...a: unknown[]) => hooks.useNoveltyStats(...a),
}));

function novelty(over: Partial<NoveltyWithDetails>): NoveltyWithDetails {
  return {
    novelty_id: 'n1',
    product_id: 'p1',
    product_sku: 'SKU',
    product_name: 'Caneca Expirando',
    product_description: null,
    base_price: 9.9,
    product_image: null,
    product_set_image: null,
    category_id: null,
    category_name: null,
    supplier_code: null,
    supplier_id: null,
    supplier_name: null,
    supplier_product_code: null,
    detected_at: new Date().toISOString(),
    expires_at: new Date().toISOString(),
    days_remaining: 3,
    days_as_novelty: 27,
    status: 'expiring_soon',
    is_highlighted: false,
    is_active: true,
    stock_quantity: 10,
    min_quantity: 10,
    stock_status: 'in-stock',
    ...over,
  };
}

const wrap = (ui: React.ReactNode) => render(<BrowserRouter>{ui}</BrowserRouter>);

describe('ExpiringNoveltiesWidget › seção "Expirando em breve"', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    hooks.useNoveltiesWithDetails.mockReturnValue({ data: [], isLoading: false });
    hooks.useNoveltyStats.mockReturnValue({ data: { supplierBreakdown: [] } });
  });

  it('mostra a seção e a contagem quando há novidades expirando', () => {
    hooks.useExpiringNovelties.mockReturnValue({
      data: [novelty({ novelty_id: 'a', product_name: 'Caneca A', days_remaining: 2 })],
    });
    wrap(<ExpiringNoveltiesWidget />);
    expect(screen.getByText('Expirando em breve')).toBeInTheDocument();
    expect(screen.getByText('Caneca A')).toBeInTheDocument();
    expect(screen.getByText('Restam 2 dias')).toBeInTheDocument();
  });

  it('singular "Resta 1 dia" e "Expira hoje" formatados corretamente', () => {
    hooks.useExpiringNovelties.mockReturnValue({
      data: [
        novelty({ novelty_id: 'a', product_name: 'Um Dia', days_remaining: 1 }),
        novelty({ novelty_id: 'b', product_name: 'Hoje', days_remaining: 0 }),
      ],
    });
    wrap(<ExpiringNoveltiesWidget />);
    expect(screen.getByText('Resta 1 dia')).toBeInTheDocument();
    expect(screen.getByText('Expira hoje')).toBeInTheDocument();
  });

  it('NÃO renderiza a seção quando não há novidades expirando', () => {
    hooks.useExpiringNovelties.mockReturnValue({ data: [] });
    wrap(<ExpiringNoveltiesWidget />);
    expect(screen.queryByText('Expirando em breve')).not.toBeInTheDocument();
  });
});
