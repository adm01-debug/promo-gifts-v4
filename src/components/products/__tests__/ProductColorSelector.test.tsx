import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ProductColorSelector, CompactColorDots } from '../ProductColorSelector';
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

describe('ProductColorSelector Tooltip Requirements', () => {
  it('does not have a native title attribute on swatches in ProductColorSelector', () => {
    const { getAllByRole } = render(
      <TooltipProvider>
        <ProductColorSelector colors={mockColors} />
      </TooltipProvider>,
    );

    const swatches = getAllByRole('button');
    expect(swatches).not.toHaveLength(0);
    for (const swatch of swatches) {
      expect(swatch.getAttribute('title')).toBeNull();
    }
  });

  it('does not have a native title attribute on dots in CompactColorDots', () => {
    const { container } = render(
      <TooltipProvider>
        <CompactColorDots colors={mockColors} />
      </TooltipProvider>,
    );

    // CompactColorDots renders spans that act as triggers
    const dots = container.querySelectorAll('span');
    for (const dot of dots) {
      // Check if it's one of our color dots (they have a background color set)
      if (dot.style.backgroundColor) {
        expect(dot.getAttribute('title')).toBeNull();
      }
    }
  });
});
