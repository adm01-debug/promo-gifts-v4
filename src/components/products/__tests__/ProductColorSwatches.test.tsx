import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { ProductColorSwatches } from '../ProductColorSwatches';
import { TooltipProvider } from '@/components/ui/tooltip';

const mockColors = [
  { name: 'Amarelo', hex: '#FFFF00' },
  { name: 'Azul', hex: '#0000FF' },
  { name: 'Branco', hex: '#FFFFFF' },
];

describe('ProductColorSwatches', () => {
  it('should render all colors provided', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={mockColors} />
      </TooltipProvider>
    );
    
    mockColors.forEach(color => {
      expect(screen.getByLabelText(`Opção de cor: ${color.name}`)).toBeDefined();
    });
  });

  it('should highlight the selected color', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={mockColors} selectedName="Amarelo" />
      </TooltipProvider>
    );
    
    const selectedSwatch = screen.getByLabelText('Opção de cor: Amarelo');
    expect(selectedSwatch.className).toContain('ring-primary');
    expect(selectedSwatch.getAttribute('aria-pressed')).toBe('true');
  });

  it('should call onSelect when a color is clicked', () => {
    const onSelect = vi.fn();
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={mockColors} onSelect={onSelect} />
      </TooltipProvider>
    );
    
    fireEvent.click(screen.getByLabelText('Opção de cor: Azul'));
    expect(onSelect).toHaveBeenCalledWith(mockColors[1], 1);
  });

  it('should respect color from URL query param for initial highlight', () => {
    // Mock window.location
    const originalLocation = window.location;
    delete (window as any).location;
    (window as any).location = { search: '?cor=Azul' };

    render(
      <TooltipProvider>
        <ProductColorSwatches colors={mockColors} />
      </TooltipProvider>
    );
    
    const selectedSwatch = screen.getByLabelText('Opção de cor: Azul');
    expect(selectedSwatch.className).toContain('ring-primary');
    
    window.location = originalLocation;
  });
});
