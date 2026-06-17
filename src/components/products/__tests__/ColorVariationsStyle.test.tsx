import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { ProductColorSelector, CompactColorDots } from '../ProductColorSelector';
import { ColorTooltipContent, colorTooltipClassName } from '../ColorTooltipContent';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock color data
const mockColors = [
  {
    id: '1',
    name: 'Vermelho',
    hex: '#FF0000',
    variationName: 'Vermelho',
    groupName: 'Cores Quentes',
  },
  { id: '2', name: 'Azul', hex: '#0000FF', variationName: 'Azul', groupName: 'Cores Frias' },
];

describe('Color Variation Layout Consistency', () => {
  it('ColorTooltipContent renders with correct structure and styles', () => {
    const { getByTestId, getByText } = render(
      <ColorTooltipContent colorName="Branco" colorHex="#FFFFFF" />,
    );

    const swatch = getByTestId('color-tooltip-swatch');
    expect(swatch).toHaveClass('h-2.5 w-2.5 shrink-0 rounded-full border border-white/20');
    expect(swatch.style.backgroundColor).toMatch(/rgb\(255, 255, 255\)|#ffffff/i);
    expect(getByText('Branco')).toBeInTheDocument();
  });

  it('colorTooltipClassName contains required design tokens', () => {
    expect(colorTooltipClassName).toContain('bg-popover/95');
    expect(colorTooltipClassName).toContain('backdrop-blur-sm');
    expect(colorTooltipClassName).toContain('border-border/40');
    expect(colorTooltipClassName).toContain('shadow-md');
  });

  it('Tooltips appear on hover with expected format', async () => {
    render(
      <TooltipProvider>
        <ProductColorSelector colors={mockColors} />
      </TooltipProvider>,
    );

    const swatches = screen.getAllByRole('button');
    const firstSwatch = swatches[0];

    // Trigger hover
    fireEvent.mouseEnter(firstSwatch);

    // Wait for the tooltip to appear in the DOM (searching globally since it might be in a portal)
    await waitFor(
      () => {
        // Check for the text inside the tooltip
        const tooltipText = document.body.textContent ?? '';
        expect(tooltipText).toContain('Vermelho');
      },
      { timeout: 2000 },
    );

    // Verify it's not a native title
    expect(firstSwatch.getAttribute('title')).toBeNull();
  });
});

describe('No Native Title Attributes', () => {
  it('ProductColorSelector swatches have no title attribute', () => {
    render(
      <TooltipProvider>
        <ProductColorSelector colors={mockColors} />
      </TooltipProvider>,
    );
    const swatches = screen.getAllByRole('button');
    expect(swatches).not.toHaveLength(0);
    for (const s of swatches) {
      expect(s.getAttribute('title')).toBeNull();
    }
  });

  it('CompactColorDots elements have no title attribute', () => {
    const { container } = render(
      <TooltipProvider>
        <CompactColorDots colors={mockColors} />
      </TooltipProvider>,
    );
    const dots = container.querySelectorAll('span');
    for (const d of Array.from(dots)) {
      if (d.style.backgroundColor) {
        expect(d.getAttribute('title')).toBeNull();
      }
    }
  });
});
