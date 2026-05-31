import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProductColorSelector } from '../ProductColorSelector';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock color data
const mockColors = [
  { id: '1', name: 'Vermelho', hex: '#FF0000', variationName: 'Vermelho', groupName: 'Cores Quentes' },
  { id: '2', name: 'Azul', hex: '#0000FF', variationName: 'Azul', groupName: 'Cores Frias' },
];

describe('ProductColorSelector Tooltip', () => {
  it('does not have a native title attribute on swatches', () => {
    render(
      <TooltipProvider>
        <ProductColorSelector colors={mockColors} />
      </TooltipProvider>
    );

    const swatches = screen.getAllByRole('button');
    swatches.forEach(swatch => {
      expect(swatch.getAttribute('title')).toBeNull();
    });
  });

  it('shows the custom tooltip on hover and hides it on leave', async () => {
    render(
      <TooltipProvider>
        <ProductColorSelector colors={mockColors} />
      </TooltipProvider>
    );

    const swatches = screen.getAllByRole('button');
    const firstSwatch = swatches[0];
    
    // Initial state
    expect(screen.queryByTestId('color-tooltip-swatch')).not.toBeInTheDocument();

    // Hover
    fireEvent.mouseEnter(firstSwatch);
    
    // Wait for tooltip to appear (with small delayDuration=150)
    await waitFor(() => {
      expect(screen.getByTestId('color-tooltip-swatch')).toBeInTheDocument();
    }, { timeout: 1000 });

    const swatch = screen.getByTestId('color-tooltip-swatch');
    expect(swatch.style.backgroundColor).toMatch(/rgb\(255, 0, 0\)|#ff0000/i);
    expect(screen.getByText('Vermelho')).toBeInTheDocument();

    // Leave
    fireEvent.mouseLeave(firstSwatch);
    
    await waitFor(() => {
      expect(screen.queryByTestId('color-tooltip-swatch')).not.toBeInTheDocument();
    }, { timeout: 1000 });
  });
});
