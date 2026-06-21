import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { SortableCartItem } from '../SortableCartItem';
import { type SellerCartItem } from '@/hooks/products';
import { BrowserRouter } from 'react-router-dom';

// Mock do framer-motion para evitar erros de animação em ambiente de teste
vi.mock('framer-motion', async () => {
  const actual = await vi.importActual('framer-motion');
  const motionStub = {
    div: ({ children, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
      <div {...props}>{children}</div>
    ),
    img: ({ children: _children, ...props }: React.HTMLAttributes<HTMLImageElement>) => (
      <img {...(props as React.ImgHTMLAttributes<HTMLImageElement>)} />
    ),
  };
  return {
    ...actual,
    motion: motionStub,
    // Components now import the lightweight `m` (aliased as `motion`) under LazyMotion.
    m: motionStub,
    LazyMotion: ({ children }: { children: React.ReactNode }) => <>{children}</>,
    AnimatePresence: ({ children }: { children: React.ReactNode }) => <>{children}</>,
  };
});

// Mock do dnd-kit
vi.mock('@dnd-kit/sortable', () => ({
  useSortable: () => ({
    attributes: {},
    listeners: {},
    setNodeRef: vi.fn(),
    transform: null,
    transition: null,
    isDragging: false,
  }),
}));

const mockItem: SellerCartItem = {
  id: 'item-1',
  cart_id: 'cart-1',
  product_id: 'prod-1',
  product_name: 'Produto Teste Excelência',
  product_sku: 'SKU-EXCEL-123',
  product_price: 125.5,
  quantity: 2,
  product_image_url: 'https://example.com/image.jpg',
  created_at: new Date().toISOString(),
  updated_at: new Date().toISOString(),
  sort_order: 0,
  color_name: null,
  color_hex: null,
  notes: null,
};

const renderComponent = (item = mockItem) => {
  return render(
    <BrowserRouter>
      <SortableCartItem
        item={item}
        index={0}
        otherCarts={[]}
        stockMap={new Map()}
        onRemove={vi.fn()}
        onUpdateQuantity={vi.fn()}
        onUpdateNotes={vi.fn()}
        onMoveToCart={vi.fn()}
        onDuplicateToCart={vi.fn()}
        onNavigate={vi.fn()}
      />
    </BrowserRouter>,
  );
};

describe('SortableCartItem Excellence UI', () => {
  it('renders product name correctly', () => {
    renderComponent();
    expect(screen.getByTestId('cart-item-name')).toHaveTextContent(mockItem.product_name);
  });

  it('renders SKU with correct formatting', () => {
    renderComponent();
    const skuElement = screen.getByTestId('cart-item-sku');
    expect(skuElement).toHaveTextContent(mockItem.product_sku!);
    expect(skuElement).toHaveClass('font-mono');
  });

  it('renders unit price correctly using PriceLabel', () => {
    renderComponent();
    const unitPrice = screen.getByTestId('cart-item-unit-price');
    // Valor 125.50 em pt-BR deve ser R$ 125,50
    expect(unitPrice.textContent).toMatch(/R\$\s*125,50/);
  });

  it('renders subtotal correctly using PriceLabel', () => {
    renderComponent();
    const total = screen.getByTestId('cart-item-total');
    // 125.50 * 2 = 251.00 -> R$ 251,00
    expect(total.textContent).toMatch(/R\$\s*251,00/);
  });

  it('shows correct labels for Unitário and Subtotal', () => {
    renderComponent();
    // No PriceLabel, o label é renderizado em um span
    expect(screen.getByText(/Unitário/i)).toBeDefined();
    expect(screen.getByText(/Subtotal/i)).toBeDefined();
  });

  it('uses standard price styling', () => {
    renderComponent();
    const subtotalLabel = screen.getByText(/Subtotal/i);
    expect(subtotalLabel).toHaveClass('uppercase', 'font-bold', 'opacity-60');
  });
});
