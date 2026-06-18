import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { ProductGallery } from '../ProductGallery';
import { QuickViewGallery } from '../quick-view/QuickViewGallery';
import { ZoomableGallery } from '../ZoomableGallery';
import { TooltipProvider } from '@/components/ui/tooltip';
import type { ProductImageMeta } from '@/utils/image-utils';

describe('Gallery Components - Tooltip Regression Audit', () => {
  const mockImages = ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'];
  const productName = 'Produto Teste';

  const renderWithProviders = (ui: React.ReactElement) => {
    return render(<TooltipProvider>{ui}</TooltipProvider>);
  };

  const auditNoTooltip = (container: HTMLElement) => {
    // 1. Check native title attribute on all images
    const allImages = container.querySelectorAll('img');
    expect(allImages.length).toBeGreaterThan(0);
    for (const img of allImages) {
      expect(img.getAttribute('title')).toBeFalsy();
    }

    // 2. Check for Radix Tooltip wrappers (TooltipTrigger/TooltipContent)
    // TooltipTrigger usually adds data-state or aria-describedby
    const tooltipTriggers = container.querySelectorAll('[data-state], [aria-describedby]');
    for (const trigger of tooltipTriggers) {
      // If it's a trigger, it shouldn't be the image itself or wrap the image directly for title purposes
      const isImageRelated = trigger.tagName === 'IMG' || trigger.querySelector('img');
      if (isImageRelated) {
        // We allow some triggers (like color variations), but not on the main gallery images
        const isMainImageContainer =
          trigger.classList.contains('aspect-[4/3]') ||
          trigger.classList.contains('aspect-square') ||
          trigger.tagName === 'IMG';
        if (isMainImageContainer) {
          // Radix tooltips for non-interactive elements are usually discouraged anyway
          // But here we specifically want to ensure the main images are clean
          expect(trigger.getAttribute('data-state')).not.toBe('closed');
          expect(trigger.getAttribute('data-state')).not.toBe('delayed-open');
        }
      }
    }
  };

  it('ProductGallery should be free of tooltips on main images', () => {
    const { container } = renderWithProviders(
      <ProductGallery images={mockImages} productName={productName} />,
    );
    auditNoTooltip(container);
  });

  it('QuickViewGallery should be free of tooltips on main images', () => {
    const displayImages: ProductImageMeta[] = [
      {
        url_cdn: mockImages[0],
        url_original: mockImages[0],
        alt_text: 'Alt 1',
        title_text: null,
        image_type: 'main',
        is_primary: true,
        is_og_image: true,
        applies_to_color: null,
        supplier_code: null,
        display_order: 0,
      },
      {
        url_cdn: mockImages[1],
        url_original: mockImages[1],
        alt_text: 'Alt 2',
        title_text: null,
        image_type: 'main',
        is_primary: false,
        is_og_image: false,
        applies_to_color: null,
        supplier_code: null,
        display_order: 1,
      },
    ];
    const { container } = renderWithProviders(
      <QuickViewGallery
        productName={productName}
        images={mockImages}
        displayImages={displayImages}
        currentImageIndex={0}
        onIndexChange={() => {}}
      />,
    );
    auditNoTooltip(container);
  });

  it('ZoomableGallery should be free of tooltips on main images', () => {
    const { container } = renderWithProviders(
      <ZoomableGallery images={mockImages} productName={productName} />,
    );
    auditNoTooltip(container);
  });
});
