import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductInfoBar } from '../ProductInfoBar';
import { BrowserRouter } from 'react-router-dom';

// Mock useNavigate
const mockNavigate = vi.fn();
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

// Mock Tooltip components to simplify rendering
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: any) => <div>{children}</div>,
  TooltipTrigger: ({ children }: any) => <div>{children}</div>,
  TooltipContent: ({ children }: any) => <div data-testid="tooltip-content">{children}</div>,
  TooltipProvider: ({ children }: any) => <div>{children}</div>,
}));

describe('ProductInfoBar', () => {
  const defaultProps = {
    sku: 'ABC-123',
    supplierName: 'XBZ Brindes',
    supplierId: 'supp_001',
    onOpenFutureStock: vi.fn(),
    onOpenSupplierComparison: vi.fn(),
  };

  const renderComponent = (props = defaultProps) => {
    return render(
      <BrowserRouter>
        <ProductInfoBar {...props} />
      </BrowserRouter>
    );
  };

  it('renders the SKU correctly', () => {
    renderComponent();
    expect(screen.getByText('SKU: ABC-123')).toBeInTheDocument();
  });

  it('renders the supplier name correctly', () => {
    renderComponent();
    expect(screen.getByText('XBZ Brindes')).toBeInTheDocument();
  });

  it('navigates to filter page when clicking supplier badge (if supplierId exists)', () => {
    renderComponent();
    const supplierBadge = screen.getByText('XBZ Brindes').parentElement;
    fireEvent.click(supplierBadge!);
    expect(mockNavigate).toHaveBeenCalledWith('/filtros?supplier=supp_001');
  });

  it('does NOT navigate when clicking supplier badge if supplierId is missing', () => {
    mockNavigate.mockClear();
    renderComponent({
      ...defaultProps,
      supplierId: undefined,
    });
    const supplierBadge = screen.getByText('XBZ Brindes').parentElement;
    fireEvent.click(supplierBadge!);
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it('calls onOpenFutureStock when clicking Future Stock button', () => {
    renderComponent();
    const futureStockButton = screen.getByText('Estoque Futuro');
    fireEvent.click(futureStockButton);
    expect(defaultProps.onOpenFutureStock).toHaveBeenCalled();
  });

  it('calls onOpenSupplierComparison when clicking Compare Suppliers button', () => {
    renderComponent();
    const compareButton = screen.getByText('Comparar Fornecedores');
    fireEvent.click(compareButton);
    expect(defaultProps.onOpenSupplierComparison).toHaveBeenCalled();
  });

  it('applies the correct supplier color icon class based on supplierName', () => {
    // XBZ is blue according to src/lib/supplier-colors.ts
    renderComponent({ ...defaultProps, supplierName: 'XBZ' });
    const icon = screen.getByText('XBZ').previousElementSibling;
    expect(icon).toHaveClass('text-[#1E40AF]');
  });

  it('applies the correct supplier color icon class for Spot/Stricker (green)', () => {
    renderComponent({ ...defaultProps, supplierName: 'Spot | Stricker' });
    const icon = screen.getByText('Spot | Stricker').previousElementSibling;
    expect(icon).toHaveClass('text-[#065F46]');
  });

  it('applies default supplier color if name does not match', () => {
    renderComponent({ ...defaultProps, supplierName: 'Fornecedor Genérico' });
    const icon = screen.getByText('Fornecedor Genérico').previousElementSibling;
    // Default is text-[#9A3412] (orange)
    expect(icon).toHaveClass('text-[#9A3412]');
  });
});
