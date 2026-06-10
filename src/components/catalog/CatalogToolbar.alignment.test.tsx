import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { CatalogToolbar } from './CatalogToolbar';
import { TooltipProvider } from '@/components/ui/tooltip';
import React from 'react';

// Mock types/constants to avoid heavy imports
const mockSortOptions = [
  { value: 'name', label: 'Nome' },
  { value: 'price_asc', label: 'Menor Preço' },
];

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
  LayoutPopover: ({ viewMode, setViewMode }: any) => (
    <div data-testid="layout-popover-container">
      <button data-testid="layout-popover-trigger">Layout</button>
    </div>
  ),
}));

describe('CatalogToolbar - Alignment and Responsiveness', () => {
  const defaultProps = {
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
    gridColumns: 4 as any,
    setGridColumns: vi.fn(),
    selectionMode: false,
    onToggleSelectionMode: vi.fn(),
    selectedCount: 0,
  };

  const renderToolbar = (props = {}) => {
    return render(
      <TooltipProvider>
        <CatalogToolbar {...defaultProps} {...props} />
      </TooltipProvider>
    );
  };

  it('positions Select and Layout buttons on the right side (flex-row items-center justify-between)', () => {
    const { container } = renderToolbar();
    
    const toolbarRoot = container.firstChild as HTMLElement;
    expect(toolbarRoot).toHaveClass('flex-row');
    expect(toolbarRoot).toHaveClass('justify-between');

    // Group 1 (Left): Filters, Sort, Stats
    const leftGroup = toolbarRoot.children[0];
    expect(leftGroup).toHaveClass('flex-wrap');
    
    // Group 2 (Right): Selection, Layout
    const rightGroup = toolbarRoot.children[1];
    expect(rightGroup).toHaveClass('ml-auto'); // Ensures it stays right even if justify-between is not enough
  });

  it('maintains buttons on the right even on small screens using ml-auto', () => {
    // We mock window.innerWidth via standard vitest approach if needed, 
    // but the CSS class check is more robust for "intended" layout.
    const { container } = renderToolbar();
    const rightGroup = container.querySelector('.ml-auto');
    expect(rightGroup).toBeInTheDocument();
    
    // Check for responsiveness classes
    const toolbarRoot = container.firstChild as HTMLElement;
    expect(toolbarRoot).toHaveClass('sm:flex-row');
    expect(toolbarRoot).toHaveClass('sm:justify-between');
  });

  it('ensures the selection button and layout trigger are visible in the right group', () => {
    renderToolbar();
    
    const selectBtn = screen.getByLabelText(/Selecionar/i);
    const layoutBtn = screen.getByTestId('layout-popover-trigger');
    
    expect(selectBtn).toBeInTheDocument();
    expect(layoutBtn).toBeInTheDocument();
    
    // Verify they are children of the right group (the one with ml-auto)
    const rightGroup = selectBtn.closest('.ml-auto');
    expect(rightGroup).toBeInTheDocument();
    expect(rightGroup).toContainElement(layoutBtn);
  });
});
