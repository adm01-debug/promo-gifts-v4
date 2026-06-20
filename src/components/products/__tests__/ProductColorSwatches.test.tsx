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

  describe('botão "Todos" (limpar seleção)', () => {
    it('não renderiza quando não há cor selecionada', () => {
      const onClear = vi.fn();
      render(
        <TooltipProvider>
          <ProductColorSwatches colors={mockColors} onClear={onClear} />
        </TooltipProvider>,
      );
      expect(screen.queryByTestId('color-swatches-clear')).toBeNull();
    });

    it('renderiza e dispara onClear ao clicar quando há cor selecionada', () => {
      const onClear = vi.fn();
      render(
        <TooltipProvider>
          <ProductColorSwatches colors={mockColors} selectedName="Amarelo" onClear={onClear} />
        </TooltipProvider>,
      );
      fireEvent.click(screen.getByTestId('color-swatches-clear'));
      expect(onClear).toHaveBeenCalledTimes(1);
    });

    it('dispara onClear via teclado (Enter/Space)', () => {
      const onClear = vi.fn();
      render(
        <TooltipProvider>
          <ProductColorSwatches colors={mockColors} selectedName="Amarelo" onClear={onClear} />
        </TooltipProvider>,
      );
      const btn = screen.getByTestId('color-swatches-clear');
      fireEvent.keyDown(btn, { key: 'Enter' });
      fireEvent.keyDown(btn, { key: ' ' });
      expect(onClear).toHaveBeenCalledTimes(2);
    });
  });

  describe('acessibilidade por teclado nos swatches', () => {
    it('dispara onSelect ao pressionar Enter ou Space', () => {
      const onSelect = vi.fn();
      render(
        <TooltipProvider>
          <ProductColorSwatches colors={mockColors} onSelect={onSelect} />
        </TooltipProvider>,
      );
      const swatch = screen.getByLabelText('Opção de cor: Azul');
      fireEvent.keyDown(swatch, { key: 'Enter' });
      fireEvent.keyDown(swatch, { key: ' ' });
      expect(onSelect).toHaveBeenCalledTimes(2);
      expect(onSelect).toHaveBeenLastCalledWith(mockColors[1], 1);
    });
  });

  describe('estado de estoque (Reposição)', () => {
    const stockColors = [
      { name: 'Verde', hex: '#00FF00', stockQty: 25 },
      { name: 'Preto', hex: '#000000', stockQty: 0 },
      {
        name: 'Vermelho',
        hex: '#FF0000',
        stockQty: 0,
        hasUpcomingRestock: true,
        nextRestockDate: '2026-12-01',
      },
    ];

    it('marca swatch sem estoque com data-stock-state="out" e visual atenuado', () => {
      render(
        <TooltipProvider>
          <ProductColorSwatches colors={stockColors} />
        </TooltipProvider>,
      );
      const oos = screen.getByLabelText(/Preto.*esgotada/);
      expect(oos.getAttribute('data-stock-state')).toBe('out');
      expect(oos.className).toContain('opacity-40');
      expect(oos.className).toContain('grayscale');
    });

    it('marca swatch com reposição prevista como "upcoming" e exibe badge', () => {
      render(
        <TooltipProvider>
          <ProductColorSwatches colors={stockColors} />
        </TooltipProvider>,
      );
      const upcoming = screen.getByLabelText(/Vermelho.*reposição prevista/);
      expect(upcoming.getAttribute('data-stock-state')).toBe('upcoming');
      expect(screen.getByTestId('swatch-upcoming-dot')).toBeInTheDocument();
    });

    it('marca swatch com estoque positivo como "in-stock"', () => {
      render(
        <TooltipProvider>
          <ProductColorSwatches colors={stockColors} />
        </TooltipProvider>,
      );
      expect(screen.getByLabelText('Opção de cor: Verde').getAttribute('data-stock-state')).toBe(
        'in-stock',
      );
    });

    it('permanece clicável mesmo quando esgotado (não quebra layout)', () => {
      const onSelect = vi.fn();
      render(
        <TooltipProvider>
          <ProductColorSwatches colors={stockColors} onSelect={onSelect} />
        </TooltipProvider>,
      );
      fireEvent.click(screen.getByLabelText(/Preto.*esgotada/));
      expect(onSelect).toHaveBeenCalledWith(stockColors[1], 1);
    });
  });
});
