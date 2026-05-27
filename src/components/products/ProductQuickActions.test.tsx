import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProductQuickActions } from './ProductQuickActions';
import { BrowserRouter } from 'react-router-dom';

const mockProduct = {
  id: '123',
  name: 'Test Product',
  price: 100,
  minQuantity: 10,
  supplier: { id: 's1', name: 'Supplier' },
  images: [],
  tags: {},
  variations: [],
} as any;

describe('ProductQuickActions', () => {
  it('should disable Indicação button when no tags are provided', () => {
    render(
      <BrowserRouter>
        <ProductQuickActions
          productId="123"
          productName="Test Product"
          basePrice={100}
          minQuantity={10}
          tags={{}}
        />
      </BrowserRouter>
    );

    const button = screen.getByRole('button', { name: /Indicação/i });
    expect(button).toBeDisabled();
    expect(button).toHaveAttribute('title', 'Sem dados de indicação para este produto');
  });

  it('should enable Indicação button when tags are provided', () => {
    const tags = {
      'Público-Alvo': ['Jovens'],
    };

    render(
      <BrowserRouter>
        <ProductQuickActions
          productId="123"
          productName="Test Product"
          basePrice={100}
          minQuantity={10}
          tags={tags}
        />
      </BrowserRouter>
    );

    const button = screen.getByRole('button', { name: /Indicação/i });
    expect(button).not.toBeDisabled();
  });

  it('should show loading state in modal', async () => {
    const tags = { 'Público-Alvo': ['Jovens'] };
    render(
      <BrowserRouter>
        <ProductQuickActions
          productId="123"
          productName="Test Product"
          basePrice={100}
          minQuantity={10}
          tags={tags}
          isLoadingTags={true}
        />
      </BrowserRouter>
    );

    const button = screen.getByRole('button', { name: /Indicação/i });
    fireEvent.click(button);

    // Should show skeleton/loading indicators (looking for animate-pulse)
    const skeletons = document.querySelectorAll('.animate-pulse');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('should show error state with try again button in modal', async () => {
    const tags = { 'Público-Alvo': ['Jovens'] };
    render(
      <BrowserRouter>
        <ProductQuickActions
          productId="123"
          productName="Test Product"
          basePrice={100}
          minQuantity={10}
          tags={tags}
          hasErrorTags={true}
        />
      </BrowserRouter>
    );

    const button = screen.getByRole('button', { name: /Indicação/i });
    fireEvent.click(button);

    expect(screen.getByText('Não foi possível carregar as indicações.')).toBeInTheDocument();
    expect(screen.getByText('Tentar novamente')).toBeInTheDocument();
  });
});
