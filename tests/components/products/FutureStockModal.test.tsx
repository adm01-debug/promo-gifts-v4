import { render, screen, fireEvent, within } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FutureStockModal } from '@/components/products/FutureStockModal';
import * as useVariantSupplierSources from '@/hooks/products/useVariantSupplierSources';

// Mock do hook useProductVariantsWithStock
vi.mock('@/hooks/products/useVariantSupplierSources', async () => {
  const actual = await vi.importActual<typeof useVariantSupplierSources>('@/hooks/products/useVariantSupplierSources');
  return {
    ...actual,
    useProductVariantsWithStock: vi.fn(),
  };
});

describe('FutureStockModal (UI Tests)', () => {
  const mockVariants = [
    {
      id: 'var-blue-1',
      product_id: 'p1',
      sku: 'SKU-BLUE-1',
      color_name: 'Azul',
      color_hex: '#0000FF',
      stock_quantity: 50,
      selected_thumbnail: 'blue.jpg',
      next_date_1: '2026-12-31',
      next_quantity_1: 1000,
      next_date_2: '2026-06-01', // Chegada mais próxima
      next_quantity_2: 500,
      next_date_3: '2027-01-15',
      next_quantity_3: 2000,
    },
    {
      id: 'var-red-1',
      product_id: 'p1',
      sku: 'SKU-RED-1',
      color_name: 'Vermelho',
      color_hex: '#FF0000',
      stock_quantity: 20,
      selected_thumbnail: 'red.jpg',
      next_date_1: '2026-07-10',
      next_quantity_1: 300,
      next_date_2: null, // Ignorado
      next_quantity_2: 500,
      next_date_3: '2026-08-20',
      next_quantity_3: 0, // Ignorado
    }
  ];

  beforeEach(() => {
    vi.mocked(useVariantSupplierSources.useProductVariantsWithStock).mockReturnValue({
      data: mockVariants as any,
      isLoading: false,
      error: null,
    } as any);
  });

  it('deve renderizar o modal com as previsões ordenadas cronologicamente', () => {
    render(
      <FutureStockModal
        open={true}
        onOpenChange={vi.fn()}
        productId="p1"
        productName="Produto Teste"
        productSku="SKU-123"
      />
    );

    // Verifica se o título e info aparecem
    expect(screen.getByText('Estoque Futuro')).toBeInTheDocument();
    expect(screen.getByText(/Produto Teste/)).toBeInTheDocument();

    // Verifica a seção Azul
    const blueGroup = screen.getByText(/^Azul/).closest('.rounded-2xl');
    expect(blueGroup).toBeInTheDocument();

    // Verifica se as datas da timeline do Azul estão na ordem correta
    // No UI usamos format(parseISO(date), 'dd/MM/yyyy')
    const dates = within(blueGroup as HTMLElement).getAllByText(/\d{2}\/\d{2}\/\d{4}/);
    expect(dates).toHaveLength(3);
    expect(dates[0]).toHaveTextContent('01/06/2026'); // Mais próxima
    expect(dates[1]).toHaveTextContent('31/12/2026');
    expect(dates[2]).toHaveTextContent('15/01/2027');
  });

  it('deve ignorar pares nulos ou com quantidade zero na visualização', () => {
    render(
      <FutureStockModal
        open={true}
        onOpenChange={vi.fn()}
        productId="p1"
        productName="Produto Teste"
        productSku="SKU-123"
      />
    );

    const redGroup = screen.getByText(/^Vermelho/).closest('.rounded-2xl');
    expect(redGroup).toBeInTheDocument();

    // Deve ter apenas 1 item de timeline para o Vermelho
    const redDates = within(redGroup as HTMLElement).getAllByText(/\d{2}\/\d{2}\/\d{4}/);
    expect(redDates).toHaveLength(1);
    expect(redDates[0]).toHaveTextContent('10/07/2026');
  });

  it('deve alternar o estado de colapso/expandir ao clicar no header da cor', () => {
    render(
      <FutureStockModal
        open={true}
        onOpenChange={vi.fn()}
        productId="p1"
        productName="Produto Teste"
        productSku="SKU-123"
      />
    );

    // Por padrão, se não houver selectedColor, os grupos podem começar colapsados
    // Vamos verificar se o conteúdo (SKU) está visível
    const blueHeader = screen.getByRole('button', { name: /^Azul/ });
    
    // Simula clique para expandir/colapsar
    // O conteúdo da variante Azul inclui o SKU
    const blueSku = screen.queryByText('SKU-BLUE-1');
    
    // Se estiver colapsado (como é o padrão do expandedGroups = []), não deve estar no DOM ou estar oculto
    // No nosso componente: {isExpanded && ...}
    
    // Primeiro clique para expandir
    fireEvent.click(blueHeader);
    expect(screen.getByText('SKU-BLUE-1')).toBeInTheDocument();

    // Segundo clique para colapsar
    fireEvent.click(blueHeader);
    expect(screen.queryByText('SKU-BLUE-1')).not.toBeInTheDocument();
  });

  it('deve expandir automaticamente a cor selecionada no grid de filtros', () => {
    render(
      <FutureStockModal
        open={true}
        onOpenChange={vi.fn()}
        productId="p1"
        productName="Produto Teste"
        productSku="SKU-123"
      />
    );

    // Clica no botão de filtro Azul no grid
    const blueFilterBtn = screen.getByTitle(/Azul/);
    fireEvent.click(blueFilterBtn);

    // A variante Azul deve estar expandida
    expect(screen.getByText('SKU-BLUE-1')).toBeInTheDocument();
    
    // Clica novamente para desmarcar o filtro
    fireEvent.click(blueFilterBtn);
    // Deve colapsar novamente (se não estiver em expandedGroups)
    expect(screen.queryByText('SKU-BLUE-1')).not.toBeInTheDocument();
  });
});
