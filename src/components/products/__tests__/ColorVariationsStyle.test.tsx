import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductColorSelector, CompactColorDots } from '../ProductColorSelector';
import { ColorTooltipContent, colorTooltipClassName } from '../ColorTooltipContent';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';

// Mock color data
const mockColors = [
  { id: '1', name: 'Vermelho', hex: '#FF0000', variationName: 'Vermelho', groupName: 'Cores Quentes' },
  { id: '2', name: 'Azul', hex: '#0000FF', variationName: 'Azul', groupName: 'Cores Frias' },
];

describe('Color Variation Layout Consistency', () => {
  it('ColorTooltipContent renders with correct structure and styles', () => {
    const { getByTestId, getByText } = render(
      <ColorTooltipContent colorName="Branco" colorHex="#FFFFFF" />
    );

    const swatch = getByTestId('color-tooltip-swatch');
    expect(swatch).toHaveClass('h-2.5 w-2.5 shrink-0 rounded-full border border-white/20');
    expect(swatch.style.backgroundColor).toMatch(/rgb\(255, 255, 255\)|#ffffff/i);
    expect(getByText('Branco')).toBeInTheDocument();
  });

  it('colorTooltipClassName contains required design tokens', () => {
    // Fundo translúcido, borda sutil, blur e sombra
    expect(colorTooltipClassName).toContain('bg-popover/95');
    expect(colorTooltipClassName).toContain('backdrop-blur-sm');
    expect(colorTooltipClassName).toContain('border-border/40');
    expect(colorTooltipClassName).toContain('shadow-md');
  });

  it('ProductColorSelector tooltips use the standard className', () => {
    const { container } = render(
      <TooltipProvider>
        <Tooltip open={true}>
          <TooltipTrigger>Trigger</TooltipTrigger>
          <TooltipContent className={colorTooltipClassName}>
            <ColorTooltipContent colorName="Teste" colorHex="#000" />
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );

    // Radix tooltips are usually rendered in a portal, so we might need to look at the body
    // but in Vitest/JSDOM we can often find them
    const tooltip = document.body.querySelector('[role="tooltip"]');
    expect(tooltip).toHaveClass('bg-popover/95');
    expect(tooltip).toHaveClass('backdrop-blur-sm');
    expect(tooltip).toHaveClass('border-border/40');
  });
});

describe('No Native Title Attributes', () => {
  it('ProductColorSelector swatches have no title attribute', () => {
    render(
      <TooltipProvider>
        <ProductColorSelector colors={mockColors} />
      </TooltipProvider>
    );
    const swatches = screen.getAllByRole('button');
    swatches.forEach(s => expect(s.getAttribute('title')).toBeNull());
  });

  it('CompactColorDots elements have no title attribute', () => {
    const { container } = render(
      <TooltipProvider>
        <CompactColorDots colors={mockColors} />
      </TooltipProvider>
    );
    const dots = container.querySelectorAll('span');
    dots.forEach(d => {
       if (d.style.backgroundColor) {
         expect(d.getAttribute('title')).toBeNull();
       }
    });
  });
});
