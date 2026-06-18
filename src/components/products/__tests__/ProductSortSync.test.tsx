import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { SORT_OPTIONS } from '@/constants/filters';
import { StickyFilterBar } from '@/components/filters/StickyFilterBar';
import { NoveltyProductGrid } from '@/components/novelties/NoveltyProductGrid';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { TooltipProvider } from '@/components/ui/tooltip';
import { Toaster } from 'sonner';

// Mock dependencies
vi.mock('@/hooks/products', () => ({
  useNoveltiesWithDetails: vi.fn(() => ({
    data: [],
    isLoading: false,
    isFetching: false,
    error: null,
  })),
  useNoveltiesSelectionMode: vi.fn(() => ({
    selectedIds: new Set(),
    toggleSelect: vi.fn(),
    clearSelection: vi.fn(),
    noveltyToProduct: vi.fn(),
  })),
  sortNovelties: (arr: unknown[]) => arr,
}));

vi.mock('@/stores/useFavoritesStore', () => ({
  useFavoritesStore: vi.fn(() => ({
    isFavorite: vi.fn(),
    toggleFavorite: vi.fn(),
  })),
}));

vi.mock('@/stores/useComparisonStore', () => ({
  useComparisonStore: vi.fn(() => ({
    isInCompare: vi.fn(),
    addToCompare: vi.fn(),
    removeFromCompare: vi.fn(),
    canAddMore: true,
  })),
}));

// Mock internal components to simplify rendering
vi.mock('@/components/catalog/BulkVariantWizard', () => ({
  BulkVariantWizard: () => <div data-testid="mock-wizard" />,
}));

vi.mock('@/components/catalog/BulkAddToCartModal', () => ({
  BulkAddToCartModal: () => <div data-testid="mock-add-to-cart" />,
}));

vi.mock('@/components/collections/AddToCollectionModal', () => ({
  AddToCollectionModal: () => <div data-testid="mock-collection-modal" />,
}));

vi.mock('@/components/products/BulkActionBar', () => ({
  BulkActionBar: () => <div data-testid="mock-bulk-action" />,
}));

vi.mock('@/components/products/LayoutPopover', () => ({
  LayoutPopover: () => <div data-testid="mock-layout-popover" />,
}));

const queryClient = new QueryClient();

const Wrapper = ({ children }: { children: React.ReactNode }) => (
  <BrowserRouter>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        {children}
        <Toaster />
      </TooltipProvider>
    </QueryClientProvider>
  </BrowserRouter>
);

describe('Product Sort Standardization', () => {
  it('StickyFilterBar should use labels from SORT_OPTIONS', () => {
    const onSortChange = vi.fn();
    render(
      <Wrapper>
        <StickyFilterBar
          isVisible={true}
          activeFiltersCount={0}
          totalProducts={100}
          sortBy="name"
          onSortChange={onSortChange}
          onOpenFilters={vi.fn()}
          onClearFilters={vi.fn()}
          onScrollToTop={vi.fn()}
          viewMode="grid"
          onViewModeChange={vi.fn()}
        />
      </Wrapper>,
    );

    // Click trigger to open select
    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    // Verify all labels from SORT_OPTIONS are present
    expect(SORT_OPTIONS).not.toHaveLength(0);
    for (const option of SORT_OPTIONS) {
      // Radix Select renders options in a Portal, but testing-library usually finds them
      // if they are in the document.
      const elements = screen.queryAllByText(option.label);
      expect.soft(elements.length, `option "${option.label}"`).toBeGreaterThan(0);
    }
  });

  it('NoveltyProductGrid should use the same SORT_OPTIONS as StickyFilterBar', () => {
    render(
      <Wrapper>
        <NoveltyProductGrid />
      </Wrapper>,
    );

    // Find the sort select. By index: Supplier=0, Category=1, Sort=2
    const selects = screen.getAllByRole('combobox');
    const sortSelect = selects[2];

    if (sortSelect) {
      fireEvent.click(sortSelect);
      // We might need to wait for the Portal content
      expect(SORT_OPTIONS).not.toHaveLength(0);
      for (const option of SORT_OPTIONS) {
        const elements = screen.queryAllByText(option.label);
        expect.soft(elements.length, `option "${option.label}"`).toBeGreaterThan(0);
      }
    }
  });

  it('changing sort in StickyFilterBar triggers state change', () => {
    const onSortChange = vi.fn();
    render(
      <Wrapper>
        <StickyFilterBar
          isVisible={true}
          activeFiltersCount={0}
          totalProducts={100}
          sortBy="name"
          onSortChange={onSortChange}
          onOpenFilters={vi.fn()}
          onClearFilters={vi.fn()}
          onScrollToTop={vi.fn()}
          viewMode="grid"
          onViewModeChange={vi.fn()}
        />
      </Wrapper>,
    );

    const trigger = screen.getByRole('combobox');
    fireEvent.click(trigger);

    const targetOption = SORT_OPTIONS.find((o) => o.value === 'price-asc');
    if (targetOption) {
      const optionElement = screen.getByText(targetOption.label);
      fireEvent.click(optionElement);
      expect(onSortChange).toHaveBeenCalledWith('price-asc');
    }
  });
});
