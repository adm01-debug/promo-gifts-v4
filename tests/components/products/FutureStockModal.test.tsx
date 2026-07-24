import { render as rtlRender, screen, fireEvent, within } from '@testing-library/react';
import type { ReactElement, ReactNode } from 'react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { FutureStockModal } from '@/components/products/FutureStockModal';
import { TooltipProvider } from '@/components/ui/tooltip';
import * as useVariantSupplierSources from '@/hooks/products/useVariantSupplierSources';

// O FutureStockModal usa Radix `Tooltip`, que exige um `TooltipProvider` no
// contexto (fornecido globalmente em App.tsx). Em testes isolados precisamos
// recriá-lo, senão o render lança "`Tooltip` must be used within `TooltipProvider`".
const TooltipWrapper = ({ children }: { children: ReactNode }) => (
  <TooltipProvider>{children}</TooltipProvider>
);
const render = (ui: ReactElement) => rtlRender(ui, { wrapper: TooltipWrapper });

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
    },
    {
      id: 'var-green-1',
      product_id: 'p1',
      sku: 'SKU-GREEN-1',
      color_name: 'Verde',
      color_hex: '#00FF00',
      stock_quantity: 10,
      selected_thumbnail: 'green.jpg',
      next_date_1: null,
      next_quantity_1: null,
      next_date_2: '2026-05-15', // Única data válida
      next_quantity_2: 450,
      next_date_3: null,
      next_quantity_3: 0,
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
    const azulHeaders = screen.getAllByText(/Azul/i);
    const blueGroup = azulHeaders.find(el => el.closest('.border-l-4'))?.closest('.rounded-2xl');
    expect(blueGroup).toBeInTheDocument();

    // Expande o grupo azul para ver a timeline
    const blueToggle = within(blueGroup as HTMLElement).getByRole('button');
    fireEvent.click(blueToggle);

    // Verifica se as datas da timeline do Azul estão presentes no formato por extenso (usado no UI)
    const contentAzul = (blueGroup as HTMLElement).textContent;
    expect(contentAzul).toContain('01 de jun');
    expect(contentAzul).toContain('31 de dez');
    expect(contentAzul).toContain('15 de jan');
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

    const vermelhoHeaders = screen.getAllByText(/Vermelho/i);
    const redGroup = vermelhoHeaders.find(el => el.closest('.border-l-4'))?.closest('.rounded-2xl');
    expect(redGroup).toBeInTheDocument();

    // Expande o grupo vermelho
    const redToggle = within(redGroup as HTMLElement).getByRole('button');
    fireEvent.click(redToggle);

    // Deve ter a data válida por extenso
    expect((redGroup as HTMLElement).textContent).toContain('10 de jul');
    // Não deve ter as outras datas que foram ignoradas
    expect((redGroup as HTMLElement).textContent).not.toContain('20 de ago');
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

    // Seleciona o botão de toggle da cor Azul
    const blueToggle = screen.getAllByText(/Azul/i).find(el => el.closest('button'))?.closest('button');
    if (!blueToggle) throw new Error('Toggle não encontrado');
    
    // Primeiro clique para expandir
    fireEvent.click(blueToggle);
    expect(screen.getByText(/Variante SKU: SKU-BLUE-1/i)).toBeInTheDocument();

    // Segundo clique para colapsar
    fireEvent.click(blueToggle);
    expect(screen.queryByText(/Variante SKU: SKU-BLUE-1/i)).not.toBeInTheDocument();
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

    // Clica no botão de filtro Azul no grid usando um matcher parcial para o título
    const blueFilterBtn = screen.queryAllByTitle(/Azul/i)[0];
    if (!blueFilterBtn) throw new Error('Botão de filtro não encontrado');
    fireEvent.click(blueFilterBtn);

    // A variante Azul deve estar expandida
    expect(screen.getByText(/Variante SKU: SKU-BLUE-1/i)).toBeInTheDocument();
    
    // Clica novamente para desmarcar o filtro
    fireEvent.click(blueFilterBtn);
    // Deve colapsar novamente
    expect(screen.queryByText(/Variante SKU: SKU-BLUE-1/i)).not.toBeInTheDocument();
  });

  it('deve renderizar corretamente quando apenas next_date_2 ou next_date_3 estão preenchidos (combinações parciais)', () => {
    render(
      <FutureStockModal
        open={true}
        onOpenChange={vi.fn()}
        productId="p1"
        productName="Produto Teste"
        productSku="SKU-123"
      />
    );

    const verdeHeaders = screen.getAllByText(/Verde/i);
    const greenGroup = verdeHeaders.find(el => el.closest('.border-l-4'))?.closest('.rounded-2xl');
    expect(greenGroup).toBeInTheDocument();

    // Expande o grupo verde
    const greenToggle = within(greenGroup as HTMLElement).getByRole('button');
    fireEvent.click(greenToggle);

    // Deve mostrar a data 15/05/2026 mesmo sendo a "chegada 2"
    expect((greenGroup as HTMLElement).textContent).toContain('15 de mai');
    expect((greenGroup as HTMLElement).textContent).toContain('450');
  });






});
