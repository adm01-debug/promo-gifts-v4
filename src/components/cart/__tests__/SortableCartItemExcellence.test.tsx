import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, cleanup } from '@testing-library/react';
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
    img: ({ children, ...props }: React.HTMLAttributes<HTMLImageElement>) => (
      <img {...(props as React.ImgHTMLAttributes<HTMLImageElement>)}>{children}</img>
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

const renderComponent = (item = mockItem, stockMap = new Map<string, number>()) => {
  return render(
    <BrowserRouter>
      <SortableCartItem
        item={item}
        index={0}
        otherCarts={[]}
        stockMap={stockMap}
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

afterEach(() => cleanup());

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

describe('SortableCartItem Accessibility (WCAG 2.1)', () => {
  it('image button carries an accessible name for the product', () => {
    renderComponent();
    const imageBtn = screen.getByTestId('cart-item-image');
    expect(imageBtn).toHaveAttribute('aria-label', `Ver produto ${mockItem.product_name}`);
  });

  it('notes textarea has an accessible name independent of placeholder', () => {
    // Notes textarea is inside a Collapsible; open it via an item that already has notes
    // so notesOpen initialises to true.
    const itemWithNotes = { ...mockItem, notes: 'Enviar logo do cliente' };
    renderComponent(itemWithNotes);
    const textarea = screen.getByTestId('cart-item-notes-input');
    expect(textarea).toHaveAttribute(
      'aria-label',
      `Observações para ${itemWithNotes.product_name}`,
    );
  });

  it('quantity input has an accessible name', () => {
    renderComponent();
    expect(screen.getByTestId('cart-qty-input')).toHaveAttribute(
      'aria-label',
      `Quantidade para ${mockItem.product_name}`,
    );
  });

  it('decrement button says "Remover" when quantity is 1', () => {
    const singleItem = { ...mockItem, quantity: 1 };
    renderComponent(singleItem);
    expect(screen.getByTestId('cart-qty-decrement')).toHaveAttribute(
      'aria-label',
      `Remover ${singleItem.product_name}`,
    );
  });

  it('decrement button says "Diminuir" when quantity > 1', () => {
    renderComponent();
    expect(screen.getByTestId('cart-qty-decrement')).toHaveAttribute(
      'aria-label',
      `Diminuir quantidade de ${mockItem.product_name}`,
    );
  });
});

describe('SortableCartItem Quantity stepper', () => {
  it('displays the initial quantity in the stepper input', () => {
    renderComponent();
    expect(screen.getByTestId('cart-qty-input')).toHaveValue(mockItem.quantity);
  });
});

describe('SortableCartItem Stock badges', () => {
  it('shows out-of-stock badge when stock is 0', () => {
    const stockMap = new Map([[mockItem.product_id, 0]]);
    renderComponent(mockItem, stockMap);
    expect(screen.getByTestId('cart-item-stock-out')).toBeDefined();
  });

  it('shows low-stock badge when stock is less than quantity', () => {
    const stockMap = new Map([[mockItem.product_id, 1]]); // quantity is 2
    renderComponent(mockItem, stockMap);
    expect(screen.getByTestId('cart-item-stock-low')).toBeDefined();
  });

  it('does not show any stock badge when stock is sufficient', () => {
    const stockMap = new Map([[mockItem.product_id, 100]]);
    renderComponent(mockItem, stockMap);
    expect(screen.queryByTestId('cart-item-stock-out')).toBeNull();
    expect(screen.queryByTestId('cart-item-stock-low')).toBeNull();
  });
});

describe('SortableCartItem Color', () => {
  it('renders color name badge when item has a color', () => {
    const itemWithColor = { ...mockItem, color_name: 'Azul Marinho', color_hex: '#001F5A' };
    renderComponent(itemWithColor);
    expect(screen.getByTestId('cart-item-color-name')).toHaveTextContent('Azul Marinho');
  });

  it('does not render color badge when item has no color', () => {
    renderComponent();
    expect(screen.queryByTestId('cart-item-color')).toBeNull();
  });
});
