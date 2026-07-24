import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { CatalogToolbar } from './CatalogToolbar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { defaultFilters } from '@/components/filters/FilterPanel';

vi.mock('@/constants/filters', () => ({
  SORT_OPTIONS: [
    { value: 'name', label: 'Nome' },
    { value: 'price_asc', label: 'Menor Preço' },
  ],
}));

// Mock the popovers to simplify position testing
vi.mock('@/components/products/StatsPopover', () => ({
  StatsPopover: () => <div data-testid="stats-popover">Stats</div>,
}));

// LayoutPopover mock that renders its content when triggered
vi.mock('@/components/products/LayoutPopover', () => ({
  LayoutPopover: () => (
    <div data-testid="layout-popover-container">
      <button data-testid="layout-popover-trigger">Layout</button>
    </div>
  ),
}));

describe('CatalogToolbar - Alignment and Responsiveness', () => {
  const defaultProps = {
    filters: defaultFilters,
    setFilters: vi.fn(),
    activeFiltersCount: 0,
    filterSheetOpen: false,
    setFilterSheetOpen: vi.fn(),
    resetFilters: vi.fn(),
    sortBy: 'name' as const,
    setSortBy: vi.fn(),
    statBadges: [],
    viewMode: 'grid' as const,
    setViewMode: vi.fn(),
    gridColumns: 4 as const,
    setGridColumns: vi.fn(),
    selectionMode: false,
    onToggleSelectionMode: vi.fn(),
    selectedCount: 0,
  };

  const renderToolbar = (props = {}) => {
    return render(
      <TooltipProvider>
        <CatalogToolbar {...defaultProps} {...props} />
      </TooltipProvider>,
    );
  };

  it('positions Select and Layout buttons on the right side (flex-wrap justify-between)', () => {
    const { container } = renderToolbar();

    const toolbarRoot = container.firstChild as HTMLElement;
    // Lovable bot changed sm:flex-row/sm:justify-between to plain flex-wrap/justify-between
    expect(toolbarRoot).toHaveClass('justify-between');
    expect(toolbarRoot).toHaveClass('flex-wrap');

    // Group 1 (Left): Filters, Sort, Stats — uses flex-shrink-0 to not grow
    const leftGroup = toolbarRoot.children[0];
    expect(leftGroup).toHaveClass('flex-shrink-0');

    // Group 2 (Right): Selection, Layout — uses items-center alignment
    const rightGroup = toolbarRoot.children[1];
    expect(rightGroup).toHaveClass('items-center');
  });

  it('maintains buttons on the right via justify-between on parent', () => {
    // Parent uses justify-between so the right group stays on the right side
    const { container } = renderToolbar();
    const toolbarRoot = container.firstChild as HTMLElement;

    // Parent layout keeps right group on the right via justify-between
    expect(toolbarRoot).toHaveClass('justify-between');
    expect(toolbarRoot).toHaveClass('flex-wrap');
  });

  it('ensures the selection button and layout trigger are visible in the right group', () => {
    const { container } = renderToolbar();

    const selectBtn = screen.getByLabelText(/Selecionar/i);
    const layoutBtn = screen.getByTestId('layout-popover-trigger');

    expect(selectBtn).toBeInTheDocument();
    expect(layoutBtn).toBeInTheDocument();

    // Verify they are children of the right group (second child of toolbar root)
    const toolbarRoot = container.firstChild as HTMLElement;
    const rightGroup = toolbarRoot.children[1];
    expect(rightGroup).toContainElement(selectBtn);
    expect(rightGroup).toContainElement(layoutBtn);
  });
});
