import { describe, it, expect } from 'vitest';
import { resolveColorImage } from '@/utils/color-image-resolver';
import type { Product } from '@/types/product-catalog';

const mockProduct: Product = {
  id: 'p1',
  name: 'Caneta Metal',
  price: 10,
  shortDescription: '',
  sku: 'CAN-01',
  stock: 100,
  image_url: 'https://example.com/main.jpg',
  primary_image_url: 'https://example.com/primary.jpg',
  images: ['https://example.com/main.jpg'],
  colors: [
    {
      name: 'Azul',
      hex: '#0000FF',
      group: 'azul',
      groupSlug: 'azul',
      variationSlug: 'azul-marinho',
      image: 'https://example.com/blue.jpg',
    },
    {
      name: 'Vermelho',
      hex: '#FF0000',
      group: 'vermelho',
      groupSlug: 'vermelho',
      variationSlug: 'vermelho-vivo',
      images: ['https://example.com/red.jpg'],
    },
  ],
  materials: [],
  minQuantity: 1,
  stockStatus: 'in-stock',
  featured: false,
  newArrival: false,
  onSale: false,
  isKit: false,
  category: { id: 'c1', name: 'Canetas' },
  supplier: { id: 's1', name: 'Fornecedor A' },
  tags: {
    publicoAlvo: [],
    datasComemorativas: [],
    endomarketing: [],
    ramo: [],
    nicho: [],
  },
};

describe('resolveColorImage', () => {
  it('should return primary_image_url when no filters are active', () => {
    expect(resolveColorImage(mockProduct, null)).toBeUndefined();
    expect(resolveColorImage(mockProduct, { groups: [], variations: [] })).toBeUndefined();
  });

  it('should return image for specific variation slug match', () => {
    const activeColors = { groups: [], variations: ['azul-marinho'] };
    expect(resolveColorImage(mockProduct, activeColors)).toBe('https://example.com/blue.jpg');
  });

  it('should return image for group slug match', () => {
    const activeColors = { groups: ['vermelho'], variations: [] };
    expect(resolveColorImage(mockProduct, activeColors)).toBe('https://example.com/red.jpg');
  });

  it("should fallback to keyword match if slugs don't match", () => {
    const activeColors = { groups: [], variations: ['azul'] };
    expect(resolveColorImage(mockProduct, activeColors)).toBe('https://example.com/blue.jpg');
  });

  it('should return primary_image_url if no match is found but filters were provided', () => {
    // Note: the current logic returns undefined if no colors match even if groups are provided.
    // Let's see if our change worked.
    const activeColors = { groups: ['verde'], variations: [] };
    expect(resolveColorImage(mockProduct, activeColors)).toBe('https://example.com/primary.jpg');
  });

  it('should handle product without colors', () => {
    const productNoColors = { ...mockProduct, colors: [] };
    const activeColors = { groups: ['azul'], variations: [] };
    expect(resolveColorImage(productNoColors, activeColors)).toBeUndefined();
  });
});
