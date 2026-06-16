import { render, screen } from '@testing-library/react';
import { CatalogToolbar } from '../CatalogToolbar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import { defaultFilters } from '@/components/filters/FilterPanel';

// Mock components that might cause issues in a unit test environment
vi.mock('@/components/products/StatsPopover', () => ({
  StatsPopover: () => <div data-testid="stats-popover">Stats</div>,
}));

vi.mock('@/components/products/LayoutPopover', () => ({
  LayoutPopover: () => <div data-testid="layout-popover">Layout</div>,
}));

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

describe('CatalogToolbar Alignment and Responsiveness', () => {
  it('should have filters on the left and actions on the right in desktop', () => {
    const { container } = renderToolbar();

    // Main container should be justify-between
    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer.className).toContain('justify-between');

    // Left group
    const leftGroup = mainContainer.firstChild as HTMLElement;
    expect(leftGroup.className).toContain('flex-shrink-0');
    expect(screen.getByLabelText(/Abrir filtros/i)).toBeInTheDocument();

    // Right group
    const rightGroup = mainContainer.lastChild as HTMLElement;
    expect(rightGroup.className).toContain('items-center');
    // flex layout ensures actions stay on the right via justify-between on parent
    expect(rightGroup.className).toContain('items-center');
    expect(screen.getByLabelText(/Selecionar vários produtos/i)).toBeInTheDocument();
    expect(screen.getByTestId('layout-popover')).toBeInTheDocument();
  });

  it('should maintain accessibility and layout in mobile', () => {
    const { container } = renderToolbar();
    const mainContainer = container.firstChild as HTMLElement;

    // flex-wrap allows items to wrap on mobile
    expect(mainContainer.className).toContain('flex-wrap');

    // Actions should still be accessible
    const rightGroup = mainContainer.lastChild as HTMLElement;
    expect(rightGroup.className).toContain('items-center'); // Aligned via justify-between on parent
  });
});
