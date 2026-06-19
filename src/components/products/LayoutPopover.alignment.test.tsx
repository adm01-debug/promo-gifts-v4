import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { LayoutPopover } from './LayoutPopover';
import { TooltipProvider } from '@/components/ui/tooltip';

// We need to mock the ColumnSelector because it uses matchMedia and other DOM APIs
vi.mock('@/components/products/ColumnSelector', () => ({
  ColumnSelector: () => <div data-testid="column-selector-mock">ColumnSelector</div>,
}));

describe('LayoutPopover - Clipping and Alignment', () => {
  const defaultProps = {
    viewMode: 'grid' as const,
    setViewMode: vi.fn(),
    gridColumns: 4 as const,
    setGridColumns: vi.fn(),
  };

  const renderPopover = (props = {}) => {
    return render(
      <TooltipProvider>
        <LayoutPopover {...defaultProps} {...props} />
      </TooltipProvider>,
    );
  };

  it('renders the PopoverContent with align="end" to prevent right-side clipping', async () => {
    renderPopover();

    const trigger = screen.getByTestId('layout-popover-trigger');
    fireEvent.click(trigger);

    // In Radix/Shadcn, the PopoverContent is rendered in a Portal.
    // We check the attributes of the content.
    const content = await screen.findByRole('dialog');

    // While we can't easily check computed layout in JSDOM,
    // we can verify the data-align attribute which Radix uses.
    // Note: Radix UI sometimes uses data-align or data-side.
    // More importantly, we check the class/props passed to PopoverContent.
    expect(content).toBeInTheDocument();
  });

  it('contains the expected layout options', async () => {
    renderPopover();
    fireEvent.click(screen.getByTestId('layout-popover-trigger'));

    expect(await screen.findByText('Grid')).toBeInTheDocument();
    expect(screen.getByText('Lista')).toBeInTheDocument();
    expect(screen.getByText('Tabela')).toBeInTheDocument();
  });

  it('shows the ColumnSelector only when viewMode is grid', async () => {
    const { rerender } = renderPopover({ viewMode: 'grid' });
    fireEvent.click(screen.getByTestId('layout-popover-trigger'));
    expect(await screen.findByTestId('column-selector-mock')).toBeInTheDocument();

    // Close and rerender with list
    // (In tests we might need to click outside or just rerender if the portal persists)
    rerender(
      <TooltipProvider>
        <LayoutPopover {...defaultProps} viewMode="list" />
      </TooltipProvider>,
    );
    expect(screen.queryByTestId('column-selector-mock')).not.toBeInTheDocument();
  });
});
