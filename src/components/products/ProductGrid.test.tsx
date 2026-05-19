import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductGrid } from './ProductGrid';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      {children}
    </QueryClientProvider>
  </BrowserRouter>
);

describe('ProductGrid Skeleton', () => {
  it('renders skeletons when isLoading is true and products are empty', () => {
    render(
      <Wrapper>
        <ProductGrid 
          products={[]} 
          isLoading={true} 
        />
      </Wrapper>
    );
    
    // Check for shimmer elements which are part of ProductCardSkeleton
    const skeletons = document.querySelectorAll('.animate-shimmer');
    expect(skeletons.length).toBeGreaterThan(0);
  });

  it('renders actual products when not loading', () => {
    const mockProducts = [
      { 
        id: '1', 
        name: 'Product Test 1', 
        slug: 'p1', 
        supplier_id: 's1', 
        category_id: 'c1',
        colors: [],
        materials: [],
        images: ['img1.jpg'],
        og_image_url: 'img1.jpg',
        supplier: { name: 'Supplier Test' },
        category: { name: 'Category Test' }
      } as any
    ];
    
    render(
      <Wrapper>
        <ProductGrid 
          products={mockProducts} 
          isLoading={false} 
        />
      </Wrapper>
    );
    
    // Search for text in the document
    expect(screen.getByText(/Product Test 1/i)).toBeDefined();
    expect(screen.getByText(/Supplier Test/i)).toBeDefined();
    
    const skeletons = document.querySelectorAll('.animate-shimmer');
    expect(skeletons.length).toBe(0);
  });
});
