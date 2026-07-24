import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CatalogToolbar } from '../components/catalog/CatalogToolbar';
import { TooltipProvider } from '../components/ui/tooltip';
import { vi, describe, it, expect } from 'vitest';
import { defaultFilters } from '../components/filters/FilterPanel';
import '@testing-library/jest-dom';

describe('CatalogToolbar Regression', () => {
  it('SelectTrigger should receive click events despite being inside a Tooltip', async () => {
    const user = userEvent.setup();
    // Mock scrollIntoView and Pointer Events for Radix Select compatibility in JSDOM
    window.HTMLElement.prototype.scrollIntoView = vi.fn();
    window.HTMLElement.prototype.hasPointerCapture = vi.fn();
    window.HTMLElement.prototype.setPointerCapture = vi.fn();
    window.HTMLElement.prototype.releasePointerCapture = vi.fn();

    const setSortBy = vi.fn();
    const mockProps = {
      filters: defaultFilters,
      setFilters: vi.fn(),
      activeFiltersCount: 0,
      filterSheetOpen: false,
      setFilterSheetOpen: vi.fn(),
      resetFilters: vi.fn(),
      sortBy: 'name' as const,
      setSortBy,
      statBadges: [],
      viewMode: 'grid' as const,
      setViewMode: vi.fn(),
      gridColumns: 4 as const,
      setGridColumns: vi.fn(),
      selectionMode: false,
      onToggleSelectionMode: vi.fn(),
    };

    render(
      <TooltipProvider>
        <CatalogToolbar {...mockProps} />
      </TooltipProvider>,
    );

    // Find the select trigger
    const trigger = screen.getByTestId('catalog-sort-trigger');
    expect(trigger).toBeInTheDocument();

    // 1. Verify Tooltip works
    await user.hover(trigger);

    // Tooltip content: "Ordenar produtos (relevância, preço, novidades…)"
    await waitFor(() => {
      expect(screen.getByRole('tooltip')).toHaveTextContent(/Ordenar produtos/i);
    });

    // 2. Click the trigger to open the dropdown while tooltip is likely visible
    await user.click(trigger);

    // 3. Confirm the menu is open
    await waitFor(() => {
      // Find one of the options to confirm the menu is open
      expect(screen.getByText(/Preço \(Menor/i)).toBeInTheDocument();
    });

    // 4. Select an option to ensure the event reaches the handler
    const option = screen.getByText(/Preço \(Menor/i);
    await user.click(option);

    expect(setSortBy).toHaveBeenCalledWith('price-asc');
  });
});
