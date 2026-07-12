import { describe, it, expect } from 'vitest';
import type { Magazine, MagazineItem, MagazineTemplateId } from '@/types/magazine';
import { DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';
import { paginateMagazine } from '../pagination';

function mkItem(id: string, position: number, category: string | null = null): MagazineItem {
  return {
    id,
    productId: `p_${id}`,
    productSnapshot: {
      id: `p_${id}`,
      name: `Produto ${id}`,
      sku: `SKU-${id}`,
      shortDescription: '',
      description: null,
      price: 10,
      image_url: 'https://example.com/x.jpg',
      images: [],
      colors: [],
      category_name: category,
      category_id: null,
      materials: [],
      hasPersonalization: null,
    },
    variantColorName: null,
    position,
    pageNumber: null,
    overrides: {},
  };
}

function mkMagazine(
  templateId: MagazineTemplateId,
  items: MagazineItem[],
  groupByCategory = false,
): Magazine {
  return {
    id: 'mag_1',
    ownerId: 'u1',
    organizationId: null,
    title: 'Teste',
    subtitle: '',
    templateId,
    branding: { ...DEFAULT_BRANDING },
    content: { ...DEFAULT_MAGAZINE_CONTENT, groupByCategory },
    items,
    pageOrder: null,
    status: 'draft',
    publicToken: null,
    pdfUrl: null,
    publishedAt: null,
    createdAt: '2026-07-12T00:00:00Z',
    updatedAt: '2026-07-12T00:00:00Z',
  };
}

describe('paginateMagazine', () => {
  it('gera capa + contracapa mesmo sem produtos', () => {
    const pages = paginateMagazine(mkMagazine('editorial-vogue', []));
    expect(pages).toHaveLength(2);
    expect(pages[0].kind).toBe('cover');
    expect(pages[1].kind).toBe('back-cover');
  });

  it('paginação simples: template vogue = 1 produto por página', () => {
    const items = [mkItem('a', 0), mkItem('b', 1), mkItem('c', 2)];
    const pages = paginateMagazine(mkMagazine('editorial-vogue', items));
    // capa + 3 páginas de produtos + contracapa
    expect(pages).toHaveLength(5);
    expect(pages[1].kind).toBe('products');
    expect(pages[1].items).toHaveLength(1);
  });

  it('catalog-grid-3x3 empacota 9 produtos por página', () => {
    const items = Array.from({ length: 20 }, (_, i) => mkItem(String(i), i));
    const pages = paginateMagazine(mkMagazine('catalog-grid-3x3', items));
    const productPages = pages.filter((p) => p.kind === 'products');
    expect(productPages).toHaveLength(3);
    expect(productPages[0].items).toHaveLength(9);
    expect(productPages[2].items).toHaveLength(2);
  });

  it('agrupa por categoria inserindo página de seção', () => {
    const items = [
      mkItem('a', 0, 'Canetas'),
      mkItem('b', 1, 'Canetas'),
      mkItem('c', 2, 'Cadernos'),
    ];
    const pages = paginateMagazine(mkMagazine('catalog-grid-2x3', items, true));
    const sections = pages.filter((p) => p.kind === 'section').map((p) => p.sectionTitle);
    expect(sections).toContain('Canetas');
    expect(sections).toContain('Cadernos');
  });
});
