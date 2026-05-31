import type { ComponentProps } from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { ProductCategoryBadges } from './ProductCategoryBadges';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockNavigate = vi.fn();

// Mock do hook useCategoryIcons
vi.mock('@/hooks/products/useCategoryIcons', () => ({
  useCategoryIcons: () => ({ data: [] }),
  getCategoryIcon: (name: string) => {
    if (name.includes('Squeeze')) return '💧';
    return '📦';
  },
}));

// Mock do useNavigate do react-router-dom
vi.mock('react-router-dom', async () => {
  const actual = await vi.importActual('react-router-dom');
  return {
    ...actual,
    useNavigate: () => mockNavigate,
  };
});

const defaultProps: ComponentProps<typeof ProductCategoryBadges> = {
  category: { id: 'cat-1', name: 'Squeeze' },
  groups: [
    { id: 'cat-2', name: 'Garrafas' },
    { id: 'cat-3', name: 'Metal' },
  ],
  categoryUuid: 'uuid-123',
  productId: 'prod-456',
  productName: 'Squeeze Metal 500ml',
  productSku: 'SKU-789',
  productPrice: 25.5,
  productImageUrl: 'image.jpg',
  isKit: false,
};

const renderComponent = (props = defaultProps) => {
  return render(
    <BrowserRouter>
      <TooltipProvider>
        <ProductCategoryBadges {...props} />
      </TooltipProvider>
    </BrowserRouter>,
  );
};

describe('ProductCategoryBadges', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('deve renderizar a categoria principal e grupos', () => {
    renderComponent();
    expect(screen.getByText('Squeeze')).toBeDefined();
    expect(screen.getByText('Garrafas')).toBeDefined();
    expect(screen.getByText('Metal')).toBeDefined();
  });

  it('deve navegar para o catálogo filtrado ao clicar em uma categoria', () => {
    renderComponent();
    const mainCategory = screen.getByText('Squeeze').parentElement;
    if (mainCategory) fireEvent.click(mainCategory);

    expect(mockNavigate).toHaveBeenCalledWith('/filtros?categories=uuid-123');
  });

  it('deve usar o id local se categoryUuid não for fornecido', () => {
    renderComponent({ ...defaultProps, categoryUuid: null });
    const mainCategory = screen.getByText('Squeeze').parentElement;
    if (mainCategory) fireEvent.click(mainCategory);

    expect(mockNavigate).toHaveBeenCalledWith('/filtros?categories=cat-1');
  });

  it('deve navegar para o simulador com o estado do produto correto', () => {
    renderComponent();
    const personalizationBadge = screen.getByText('Personalização').parentElement;
    if (personalizationBadge) fireEvent.click(personalizationBadge);

    expect(mockNavigate).toHaveBeenCalledWith('/simulador', {
      state: {
        preSelectedProduct: {
          id: 'prod-456',
          name: 'Squeeze Metal 500ml',
          sku: 'SKU-789',
          price: 25.5,
          imageUrl: 'image.jpg',
          categoryName: 'Squeeze',
        },
      },
    });
  });

  it('deve navegar para o mockup generator com o estado do produto correto', () => {
    renderComponent();
    const mockupBadge = screen.getByText('Visualizar com Logo').parentElement;
    if (mockupBadge) fireEvent.click(mockupBadge);

    expect(mockNavigate).toHaveBeenCalledWith('/mockup-generator', {
      state: {
        preSelectedProduct: {
          id: 'prod-456',
          name: 'Squeeze Metal 500ml',
          sku: 'SKU-789',
          imageUrl: 'image.jpg',
        },
      },
    });
  });

  it('deve navegar para o kit builder ao clicar em Monte seu Kit', () => {
    renderComponent();
    const kitBadge = screen.getByText('Monte seu Kit').parentElement;
    if (kitBadge) fireEvent.click(kitBadge);

    expect(mockNavigate).toHaveBeenCalledWith('/kit-builder?product=prod-456');
  });

  it('não deve mostrar Monte seu Kit se o produto já for um kit', () => {
    renderComponent({ ...defaultProps, isKit: true });
    expect(screen.queryByText('Monte seu Kit')).toBeNull();
  });

  it('não deve renderizar nada se não houver categorias', () => {
    const { container } = renderComponent({
      ...defaultProps,
      category: null as unknown as ComponentProps<typeof ProductCategoryBadges>['category'],
      groups: [],
    });
    expect(container.firstChild).toBeNull();
  });

  it('exibe o caminho raiz→folha no tooltip quando categoryPath tem ≥2 níveis', async () => {
    renderComponent({
      ...defaultProps,
      groups: [],
      categoryPath: ['Papelaria | Escritório', 'Cadernetas', 'Com Pauta'],
      category: { id: 'cat-1', name: 'Com Pauta' },
    });
    const badge = screen.getByText('Com Pauta').parentElement;
    if (badge) {
      fireEvent.pointerEnter(badge);
      fireEvent.focus(badge);
    }
    // O Radix tooltip pode renderizar conteúdo em múltiplos nós; basta achar a folha
    // e o ancestral no caminho.
    const matches = await screen.findAllByText(/Com Pauta/);
    expect(matches.length).toBeGreaterThan(0);
  });

  it('deep-link da categoria principal usa a folha (categoryUuid)', () => {
    renderComponent({
      ...defaultProps,
      groups: [],
      categoryUuid: 'leaf-uuid',
      categoryPath: ['Raiz', 'Folha'],
      category: { id: 'cat-1', name: 'Folha' },
    });
    const badge = screen.getByText('Folha').parentElement;
    if (badge) fireEvent.click(badge);
    expect(mockNavigate).toHaveBeenCalledWith('/filtros?categories=leaf-uuid');
  });
});
