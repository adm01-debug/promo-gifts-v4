import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductStatusBadge } from '../ProductStatusBadge';
import { BrowserRouter } from 'react-router-dom';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { TooltipProvider } from '@/components/ui/tooltip';

const renderWithProviders = (ui: React.ReactElement) => {
  return render(
    <BrowserRouter>
      <ThemeProvider>
        <TooltipProvider>{ui}</TooltipProvider>
      </ThemeProvider>
    </BrowserRouter>,
  );
};

describe('ProductStatusBadge Visual Regressions', () => {
  it('renders novelty badge with correct legible colors', () => {
    const { container } = renderWithProviders(
      <ProductStatusBadge type="novelty" daysRemaining={30} size="sm" />,
    );
    const badge = container.querySelector('.inline-flex');
    expect(badge).toBeInTheDocument();
    // Check for the vibrant blue background (current NEW badge color)
    expect(badge).toHaveClass('bg-[#2563EB]');
    // Check for white text (contrast)
    expect(badge).toHaveClass('text-white');
  });

  it('renders multiple badges without overlapping in a flex container', () => {
    renderWithProviders(
      <div style={{ width: '200px', position: 'relative' }}>
        <div className="flex flex-wrap gap-1">
          <ProductStatusBadge type="featured" size="sm" />
          <ProductStatusBadge type="novelty" daysRemaining={30} size="sm" />
          <ProductStatusBadge type="kit" size="sm" />
          <ProductStatusBadge type="promotion" size="sm" />
        </div>
      </div>,
    );

    const badges = screen.getAllByRole('status');
    expect(badges).toHaveLength(4);
    for (const badge of badges) {
      expect(badge).toHaveClass('truncate');
    }
  });

  it('adjusts text size and padding for smaller screens', () => {
    const { container } = renderWithProviders(<ProductStatusBadge type="novelty" size="md" />);
    const badge = container.querySelector('.inline-flex');
    // Verify responsive text classes
    expect(badge).toHaveClass('text-[10px]');
    expect(badge).toHaveClass('sm:text-xs');
  });
});
