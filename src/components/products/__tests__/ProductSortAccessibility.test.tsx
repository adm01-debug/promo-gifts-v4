import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StickyFilterBar } from '@/components/filters/StickyFilterBar';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

describe('ProductSort Accessibility and UI', () => {
  const defaultProps = {
    isVisible: true,
    activeFiltersCount: 0,
    totalProducts: 100,
    sortBy: 'name',
    onSortChange: vi.fn(),
    onOpenFilters: vi.fn(),
    onClearFilters: vi.fn(),
    onScrollToTop: vi.fn(),
    viewMode: 'grid' as const,
    onViewModeChange: vi.fn(),
  };

  const Wrapper = ({ children }: { children: React.ReactNode }) => (
    <BrowserRouter>
      <TooltipProvider>{children}</TooltipProvider>
    </BrowserRouter>
  );

  it('should have correct accessibility attributes on the sort select', () => {
    render(
      <Wrapper>
        <StickyFilterBar {...defaultProps} />
      </Wrapper>,
    );

    const combobox = screen.getByRole('combobox');
    expect(combobox).toBeDefined();

    // Radix UI Select usually provides these
    expect(combobox).toHaveAttribute('aria-expanded');
    expect(combobox).toHaveAttribute('aria-autocomplete', 'none');
  });

  it('should update indicators when sort changes', () => {
    const { rerender } = render(
      <Wrapper>
        <StickyFilterBar {...defaultProps} sortBy="name" />
      </Wrapper>,
    );

    // Initial value check (usually displayed in the trigger)
    expect(screen.getByText(/Nome \(A-Z\)/i)).toBeDefined();

    rerender(
      <Wrapper>
        <StickyFilterBar {...defaultProps} sortBy="price-asc" />
      </Wrapper>,
    );

    expect(screen.getByText(/Preço \(Menor → Maior\)/i)).toBeDefined();
  });

  it('should show badge when filters are active', () => {
    render(
      <Wrapper>
        <StickyFilterBar {...defaultProps} activeFiltersCount={3} />
      </Wrapper>,
    );

    // The "3" should appear in a badge
    const badge = screen.getByText('3');
    expect(badge).toBeDefined();
    expect(badge.className).toContain('bg-secondary');
  });
});
