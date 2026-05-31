import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ProductGallery } from '../ProductGallery';
import { QuickViewGallery } from '../quick-view/QuickViewGallery';
import { ZoomableGallery } from '../ZoomableGallery';

describe('Gallery Components - No native title attribute on images', () => {
  const mockImages = ['https://example.com/image1.jpg', 'https://example.com/image2.jpg'];
  const productName = 'Produto Teste';

  it('ProductGallery main image should not have a title attribute', () => {
    render(<ProductGallery images={mockImages} productName={productName} />);
    const img = screen.getByRole('img', { name: /Produto Teste - Imagem 1/i });
    expect(img).not.toHaveAttribute('title');
  });

  it('QuickViewGallery main image should not have a title attribute', () => {
    const displayImages = [
      { url_cdn: mockImages[0], alt_text: 'Alt 1' },
      { url_cdn: mockImages[1], alt_text: 'Alt 2' }
    ];
    render(
      <QuickViewGallery 
        productName={productName} 
        images={mockImages} 
        displayImages={displayImages}
        currentImageIndex={0}
        onIndexChange={() => {}}
      />
    );
    const img = screen.getByRole('img', { name: /Alt 1/i });
    expect(img).not.toHaveAttribute('title');
  });

  it('ZoomableGallery main image should not have a title attribute', () => {
    render(<ZoomableGallery images={mockImages} productName={productName} />);
    const img = screen.getByRole('img', { name: /Produto Teste - 1/i });
    expect(img).not.toHaveAttribute('title');
  });
});
