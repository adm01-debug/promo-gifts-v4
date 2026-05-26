import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { CatalogToolbar } from '../components/catalog/CatalogToolbar';
import { TooltipProvider } from '../components/ui/tooltip';
import { vi, describe, it, expect } from 'vitest';
import type { FilterState } from '../components/filters/FilterPanel';
import { defaultFilters } from '../components/filters/FilterPanel';

describe('CatalogToolbar Regression', () => {
  it('SelectTrigger should receive click events despite being inside a Tooltip', async () => {
    const setSortBy = vi.fn();
    const mockProps = {
      filters: defaultFilters,
      setFilters: vi.fn(),
      activeFiltersCount: 0,
      filterSheetOpen: false,
      setFilterSheetOpen: vi.fn(),
      resetFilters: vi.fn(),
      sortBy: 'relevance' as const,
      setSortBy,
      statBadges: [],
      viewMode: 'grid' as const,
      setViewMode: vi.fn(),
      gridColumns: 4 as any,
      setGridColumns: vi.fn(),
      selectionMode: false,
      onToggleSelectionMode: vi.fn(),
    };

    render(
      <TooltipProvider>
        <CatalogToolbar {...mockProps} />
      </TooltipProvider>
    );

    // Find the select trigger (it has aria-label="Ordenar por")
    const trigger = screen.getByLabelText(/ordenar por/i);
    expect(trigger).toBeDefined();

    // Click the trigger to open the dropdown
    fireEvent.click(trigger);

    // Since we are using Radix UI Select, we look for items in the portal
    // We expect the menu to open. We can check for one of the sort options.
    // Note: In tests, Select might need some wait if it's animated or uses Portals
    await waitFor(() => {
      const items = screen.queryAllByRole('option');
      // If it doesn't find by role, we check by text as a fallback for the specific mock setup
      if (items.length === 0) {
        // Fallback to searching for the text of an option
        expect(screen.getByText(/Menor Preço/i)).toBeDefined();
      } else {
        expect(items.length).toBeGreaterThan(0);
      }
    });
  });
});
