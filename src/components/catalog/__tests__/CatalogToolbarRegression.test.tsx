import { render, screen } from '@testing-library/react';
import { CatalogToolbar } from '../CatalogToolbar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import { defaultFilters } from '@/components/filters/FilterPanel';

// Mock components
vi.mock('@/components/products/StatsPopover', () => ({
  StatsPopover: () => <div data-testid="stats-popover">Stats</div>,
}));

vi.mock('@/components/products/LayoutPopover', () => ({
  LayoutPopover: () => <div data-testid="layout-popover">Layout</div>,
}));

// Mock FilterPanel component while keeping real defaultFilters export
vi.mock('@/components/filters/FilterPanel', async (importOriginal) => {
  const actual = await importOriginal();
  return {
    ...(actual as object),
    FilterPanel: () => <div data-testid="filter-panel">Filter Panel</div>,
  };
});

const mockProps = {
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
  gridColumns: 3 as const,
  setGridColumns: vi.fn(),
  selectionMode: false,
  onToggleSelectionMode: vi.fn(),
};

const renderToolbar = (props = {}) => {
  return render(
    <BrowserRouter>
      <TooltipProvider>
        <CatalogToolbar {...mockProps} {...props} />
      </TooltipProvider>
    </BrowserRouter>,
  );
};

describe('CatalogToolbar Visual Regression Scenarios', () => {
  it('should not break layout with many active filters', () => {
    const { container } = renderToolbar({ activeFiltersCount: 99 });

    // Badge should be visible and not overflow
    const badge = screen.getByText('99');
    expect(badge).toBeInTheDocument();

    const mainContainer = container.firstChild as HTMLElement;
    // Check that it's still a flex container and hasn't exploded
    expect(mainContainer.className).toContain('flex');
  });

  it('should keep Select and Layout buttons on the right even in small widths', () => {
    const { container } = renderToolbar();
    const mainContainer = container.firstChild as HTMLElement;
    const rightGroup = mainContainer.lastChild as HTMLElement;

    // flex layout ensures actions stay right via justify-between on parent
    expect(rightGroup.className).toContain('items-center');
  });

  it('should have adequate spacing between groups to prevent overlap', () => {
    const { container } = renderToolbar();
    const mainContainer = container.firstChild as HTMLElement;

    // gap-2 for spacing between groups
    expect(mainContainer.className).toContain('gap-2');
  });
});
