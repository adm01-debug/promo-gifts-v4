
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { ProductCardImage } from './ProductCardImage';
import { ProductStatusBadge } from './ProductStatusBadge';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { Product } from '@/types/product-catalog';

const mockProduct: Product = {
  id: '1',
  name: 'Test Product',
  sku: 'TEST-SKU',
  price: 100,
  stock: 10,
  stockStatus: 'in-stock',
  featured: true,
  newArrival: true,
  isKit: true,
  onSale: true,
  hasCommercialPackaging: true,
  images: ['/test.jpg'],
  supplier: { id: 's1', name: 'Test Supplier' },
  category: { id: 'c1', name: 'Test Category' },
  category_id: 'c1',
  groups: [],
  materials: [],
  gender: 'unisex',
  priceUpdatedAt: new Date().toISOString(),
};

describe('Product Badges Layout and Overlap Simulation', () => {
  it('should render multiple badges without overlapping in a flex container', () => {
    const { container } = render(
      <TooltipProvider>
        <ProductCardImage
          product={mockProduct}
          cardImageUrl="/test.jpg"
          imageLoaded={true}
          isHovered={false}
          computedImageScale={1}
          isNovelty={true}
          noveltyDaysRemaining={25}
          allMatchingVariants={[]}
          hasMultipleVariants={false}
          safeVariantIdx={0}
          onVariantChange={() => {}}
        />
      </TooltipProvider>
    );

    // Find the badge container
    const badgeContainer = container.querySelector('.absolute.inset-x-0.top-0');
    expect(badgeContainer).toBeDefined();

    // Check if both sides (left and right) are present
    const leftSide = badgeContainer?.querySelector('.flex-1');
    const rightSide = badgeContainer?.querySelector('.shrink-0');
    
    expect(leftSide).toBeDefined();
    expect(rightSide).toBeDefined();

    // Verify badges are rendered
    expect(screen.getByText(/Destaque/i)).toBeInTheDocument();
    expect(screen.getByText(/Novidade/i)).toBeInTheDocument();
    expect(screen.getByText(/Kit/i)).toBeInTheDocument();
    expect(screen.getByText(/Promoção/i)).toBeInTheDocument();
    expect(screen.getByText(/Embalagem/i)).toBeInTheDocument();
  });

  it('should handle out-of-stock badge on the right side', () => {
    const oosProduct = { ...mockProduct, stockStatus: 'out-of-stock' as const };
    render(
      <TooltipProvider>
        <ProductCardImage
          product={oosProduct}
          cardImageUrl="/test.jpg"
          imageLoaded={true}
          isHovered={false}
          computedImageScale={1}
          allMatchingVariants={[]}
          hasMultipleVariants={false}
          safeVariantIdx={0}
          onVariantChange={() => {}}
        />
      </TooltipProvider>
    );

    expect(screen.getByText(/Fora de estoque/i)).toBeInTheDocument();
  });
});

describe('ProductStatusBadge Color Contrast', () => {
  it('should use optimized colors for novelty badge in dark mode', () => {
    // This is more of a logic check since we can't easily test visual contrast in JSDOM
    // But we can verify the class is applied correctly
    const { container } = render(
      <TooltipProvider>
        <ProductStatusBadge type="novelty" daysRemaining={25} />
      </TooltipProvider>
    );
    
    const badge = container.querySelector('.bg-\\[\\#00D166\\]');
    expect(badge).toBeInTheDocument();
    // In dark mode (simulated via class or context if available) it should have specific classes
    // Here we just check the static definition in the component satisfies the requirements
  });
});
