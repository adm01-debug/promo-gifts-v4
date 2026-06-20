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
  it.each(mockColors)('should render color $name', (color) => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={mockColors} />
      </TooltipProvider>,
    );

    expect(screen.getByLabelText(`Opção de cor: ${color.name}`)).toBeDefined();
  });

  it('should highlight the selected color', () => {
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={mockColors} selectedName="Amarelo" />
      </TooltipProvider>,
    );

    const selectedSwatch = screen.getByLabelText('Opção de cor: Amarelo');
    expect(selectedSwatch.className).toContain('ring-primary');
    expect(selectedSwatch.getAttribute('aria-checked')).toBe('true');
  });

  it('should call onSelect when a color is clicked', () => {
    const onSelect = vi.fn();
    render(
      <TooltipProvider>
        <ProductColorSwatches colors={mockColors} onSelect={onSelect} />
      </TooltipProvider>,
    );

    fireEvent.click(screen.getByLabelText('Opção de cor: Azul'));
    expect(onSelect).toHaveBeenCalledWith(mockColors[1], 1);
  });

  it('should respect color from URL query param for initial highlight', () => {
    // Mock window.location
    const originalLocation = window.location;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    delete (window as any).location;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).location = { search: '?cor=Azul' };

    render(
      <TooltipProvider>
        <ProductColorSwatches colors={mockColors} />
      </TooltipProvider>,
    );

    const selectedSwatch = screen.getByLabelText('Opção de cor: Azul');
    expect(selectedSwatch.className).toContain('ring-primary');

    window.location = originalLocation;
  });

  describe('modo wrap (grid de Catálogo/Super Filtro/Novidades/Reposição)', () => {
    const manyColors = Array.from({ length: 12 }, (_, i) => ({
      name: `Cor ${i + 1}`,
      hex: `#${((i + 1) * 1118481).toString(16).padStart(6, '0').slice(0, 6)}`,
    }));

    it('renderiza TODAS as bolinhas sem chip "+N" quando wrap=true', () => {
      render(
        <TooltipProvider>
          <ProductColorSwatches colors={manyColors} max={5} wrap hideWhenEmpty={false} />
        </TooltipProvider>,
      );

      for (const c of manyColors) {
        expect(screen.getByLabelText(`Opção de cor: ${c.name}`)).toBeInTheDocument();
      }
      expect(screen.queryByTestId('color-swatches-overflow')).toBeNull();
    });

    it('mantém comportamento legado com chip "+N" quando wrap=false', () => {
      render(
        <TooltipProvider>
          <ProductColorSwatches colors={manyColors} max={5} hideWhenEmpty={false} />
        </TooltipProvider>,
      );

      expect(screen.getAllByRole('radio')).toHaveLength(5);
      expect(screen.getByTestId('color-swatches-overflow')).toHaveTextContent('+7');
    });

    it('container wrap usa flex-wrap e height automático (sem clipping)', () => {
      render(
        <TooltipProvider>
          <ProductColorSwatches colors={manyColors} wrap hideWhenEmpty={false} />
        </TooltipProvider>,
      );

      const container = screen.getByTestId('product-colors-container');
      expect(container.className).toContain('flex-wrap');
      expect(container.className).not.toContain('overflow-hidden');
      expect(container.className).not.toContain('max-h-[var(--swatch-size-sm)]');
    });
  });
});
