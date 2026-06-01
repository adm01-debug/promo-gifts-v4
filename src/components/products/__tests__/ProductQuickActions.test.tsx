import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductQuickActions } from '../ProductQuickActions';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Product } from '@/hooks/products';

// Mock Lucide icons
vi.mock('lucide-react', async () => {
  const actual = await vi.importActual('lucide-react');
  return {
    ...actual,
    TableProperties: () => <div data-testid="icon-table" />,
    Palette: () => <div data-testid="icon-palette" />,
    Target: () => <div data-testid="icon-target" />,
    Layers: () => <div data-testid="icon-layers" />,
    Share2: () => <div data-testid="icon-share" />,
    X: () => <div data-testid="icon-x" />,
  };
});

describe('ProductQuickActions Tooltips and Titles', () => {
  const defaultProps = {
    productId: '123',
    productName: 'Test Product',
    basePrice: 100,
    minQuantity: 10,
    tags: { 'Público-Alvo': ['Empresas'] },
    niches: ['Tecnologia'],
    product: {
      id: '123',
      name: 'Test',
      images: [],
      category_id: 'cat1',
      brand: 'Brand',
      description: 'Desc',
      sku: 'SKU',
      colors: [],
      sizes: [],
    } as unknown as Product,
  };

  const renderComponent = (props = defaultProps) => {
    return render(
      <TooltipProvider>
        <ProductQuickActions {...props} />
      </TooltipProvider>,
    );
  };

  it('should not have native title attributes on any button', () => {
    renderComponent();
    const buttons = screen.getAllByRole('button');
    expect(buttons).not.toHaveLength(0);
    for (const button of buttons) {
      expect(button.getAttribute('title')).toBeNull();
    }
  });

  it('should have correct action labels on buttons', () => {
    renderComponent();
    expect(screen.getByText('Preços')).toBeInTheDocument();
    expect(screen.getByText('Gravação')).toBeInTheDocument();
    expect(screen.getByText('Indicação')).toBeInTheDocument();
    expect(screen.getByText('Nicho')).toBeInTheDocument();
  });
});
