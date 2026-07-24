import { render, screen } from '@testing-library/react';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';
import { describe, expect, it } from 'vitest';
import { ProductCardImage } from '../ProductCardImage';
import type { Product } from '@/types/product-catalog';

const baseProduct: Product = {
  id: 'prod-kit-fallback',
  name: 'Kit churrasco — ref. KC0124PP',
  description: '',
  shortDescription: '',
  price: 47.09,
  image_url: '/placeholder.svg',
  images: ['/placeholder.svg'],
  sku: 'KC0124PP',
  stock: 0,
  colors: [],
  materials: [],
  minQuantity: 1,
  stockStatus: 'out-of-stock',
  featured: false,
  newArrival: false,
  onSale: false,
  isKit: false,
  category: { id: 'cat-kit', name: 'Kit Churrasco' },
  supplier: { id: 'supplier', name: 'Asia Import' },
  tags: { publicoAlvo: [], datasComemorativas: [], endomarketing: [], ramo: [], nicho: [] },
};

function renderImage(product: Product, categoryName?: string | null) {
  return render(
    <BrowserRouter>
      <TooltipProvider>
        <ProductCardImage
          product={product}
          cardImageUrl="/placeholder.svg"
          imageLoaded
          isHovered={false}
          computedImageScale={1}
          allMatchingVariants={[]}
          hasMultipleVariants={false}
          safeVariantIdx={0}
          categoryName={categoryName}
          priority
        />
      </TooltipProvider>
    </BrowserRouter>,
  );
}

describe('ProductCardImage — badge Kit', () => {
  it('exibe o badge Kit quando isKit=true', () => {
    renderImage({ ...baseProduct, isKit: true, category: { id: 'cat', name: 'Churrasco' } });
    expect(screen.getByText('Kit')).toBeInTheDocument();
  });

  it('exibe o badge Kit pelo fallback de categoria quando isKit=false', () => {
    renderImage(baseProduct, 'Kit Churrasco');
    expect(screen.getByText('Kit')).toBeInTheDocument();
  });

  it('não exibe o badge Kit para produto comum', () => {
    renderImage({
      ...baseProduct,
      name: 'Caneca térmica',
      category: { id: 'cat', name: 'Canecas' },
    });
    expect(screen.queryByText('Kit')).not.toBeInTheDocument();
  });
});
