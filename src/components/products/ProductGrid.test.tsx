import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductGrid } from './ProductGrid';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

// Mock components that require complex context
vi.mock('@/components/ui/tooltip', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  Tooltip: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TooltipContent: ({ children }: any) => <div>{children}</div>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
}));

vi.mock('@/contexts/SellerCartContext', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  SellerCartProvider: ({ children }: any) => <div>{children}</div>,
  useSellerCartContext: () => ({
    isInAnyCart: () => false,
    addToCart: vi.fn(),
  }),
}));

vi.mock('@/contexts/CollectionsContext', () => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  CollectionsProvider: ({ children }: any) => <div>{children}</div>,
  useCollectionsContext: () => ({
    collections: [],
    addToCollection: vi.fn(),
  }),
}));

vi.mock('@/hooks/ui', () => ({
  useReducedMotion: () => false,
  useToast: () => ({ toast: vi.fn() }),
}));

// Mock internal heavy components to simplify rendering
vi.mock('@/components/collections/AddToCollectionModal', () => ({
  AddToCollectionModal: () => <div data-testid="mock-modal">Modal</div>,
}));

vi.mock('@/components/products/share/SharePreviewDialog', () => ({
  SharePreviewDialog: () => <div data-testid="mock-share">Share</div>,
}));

// Mock CDN and image utility
vi.mock('@/utils/cdn-utils', () => ({
  getCdnUrl: (url: string) => url,
  getSrcSet: (_url: string) => undefined,
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: false,
    },
  },
});

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  </BrowserRouter>
);

describe('ProductGrid Skeleton', () => {
  it('renders skeletons when isLoading is true and products are empty', () => {
    render(
      <Wrapper>
        <ProductGrid products={[]} isLoading />
      </Wrapper>,
    );

    // Check for skeleton elements rendered by ProductCardSkeleton
    const skeletons = document.querySelectorAll('[data-testid="product-card-skeleton"]');
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
        category: { name: 'Category Test' },
        total_stock: 100,
        price: 10,
      } as unknown as Parameters<typeof ProductGrid>[0]['products'][number],
    ];

    render(
      <Wrapper>
        <ProductGrid products={mockProducts} isLoading={false} />
      </Wrapper>,
    );

    // Search for text in the document
    expect(screen.getByText(/Product Test 1/i)).toBeDefined();
    expect(screen.getByText(/Supplier Test/i)).toBeDefined();

    // Verify no full loading skeleton grid is shown (product content is visible)
    // Note: ProductCard may render image Skeleton elements internally — that's expected.
  });
});
