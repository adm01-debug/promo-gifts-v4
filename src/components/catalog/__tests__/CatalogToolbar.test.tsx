import { render, screen } from '@testing-library/react';
import { CatalogToolbar } from '../CatalogToolbar';
import { TooltipProvider } from '@/components/ui/tooltip';
import { BrowserRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';

// Mock components that might cause issues in a unit test environment
vi.mock('@/components/products/StatsPopover', () => ({
  StatsPopover: () => <div data-testid="stats-popover">Stats</div>,
}));

vi.mock('@/components/products/LayoutPopover', () => ({
  LayoutPopover: () => <div data-testid="layout-popover">Layout</div>,
}));

const mockProps = {
  filters: {},
  setFilters: vi.fn(),
  activeFiltersCount: 0,
  filterSheetOpen: false,
  setFilterSheetOpen: vi.fn(),
  resetFilters: vi.fn(),
  sortBy: 'name' as any,
  setSortBy: vi.fn(),
  statBadges: [],
  viewMode: 'grid' as any,
  setViewMode: vi.fn(),
  gridColumns: 3 as any,
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
    </BrowserRouter>
  );
};

describe('CatalogToolbar Alignment and Responsiveness', () => {
  it('should have filters on the left and actions on the right in desktop', () => {
    const { container } = renderToolbar();
    
    // Main container should be justify-between in sm screens
    const mainContainer = container.firstChild as HTMLElement;
    expect(mainContainer.className).toContain('sm:justify-between');
    
    // Left group
    const leftGroup = mainContainer.firstChild as HTMLElement;
    expect(leftGroup.className).toContain('flex-wrap');
    expect(screen.getByLabelText(/Abrir filtros/i)).toBeInTheDocument();
    
    // Right group
    const rightGroup = mainContainer.lastChild as HTMLElement;
    expect(rightGroup.className).toContain('ml-auto');
    expect(rightGroup.className).toContain('sm:ml-0');
    expect(screen.getByLabelText(/Selecionar vários produtos/i)).toBeInTheDocument();
    expect(screen.getByTestId('layout-popover')).toBeInTheDocument();
  });

  it('should maintain accessibility and layout in mobile', () => {
    const { container } = renderToolbar();
    const mainContainer = container.firstChild as HTMLElement;
    
    // flex-col on mobile
    expect(mainContainer.className).toContain('flex-col');
    
    // Actions should still be accessible
    const rightGroup = mainContainer.lastChild as HTMLElement;
    expect(rightGroup.className).toContain('ml-auto'); // Pushes to right even in mobile if possible
  });
});
