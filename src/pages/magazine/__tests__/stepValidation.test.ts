/**
 * stepValidation — Comprehensive test suite
 * PhD-level coverage: null inputs, all steps, business rules.
 */

import { describe, it, expect } from 'vitest';
import { type Magazine, DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';

import { validateStep, canPublish, getCompletionPercentage } from '../utils/stepValidation';

// ============================================================================
// Helpers
// ============================================================================

function mkMag(overrides: Partial<Magazine> = {}): Magazine {
  return {
    id: 'mag_1',
    ownerId: 'u1',
    organizationId: null,
    title: 'Teste',
    subtitle: '',
    templateId: 'editorial-vogue',
    branding: { ...DEFAULT_BRANDING },
    content: { ...DEFAULT_MAGAZINE_CONTENT },
    items: [],
    pageOrder: null,
    status: 'draft',
    publicToken: null,
    pdfUrl: null,
    publishedAt: null,
    createdAt: '2026-07-12T00:00:00Z',
    updatedAt: '2026-07-12T00:00:00Z',
    ...overrides,
  };
}

const DUMMY_ITEM = {
  id: 'i1',
  productId: 'p1',
  productSnapshot: {
    id: 'p1',
    name: 'Produto A',
    sku: 'SKU-A',
    shortDescription: '',
    description: null,
    price: 10,
    image_url: 'https://example.com/x.jpg',
    images: [],
    colors: [],
    category_name: null,
    category_id: null,
    materials: [],
    hasPersonalization: null,
  },
  variantColorName: null,
  position: 0,
  pageNumber: null,
  overrides: {},
};

// ============================================================================
// validateStep: identity
// ============================================================================

describe('validateStep identity', () => {
  it('bloqueia se título vazio', () => {
    const { blocks } = validateStep('identity', mkMag({ title: '' }));
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('bloqueia se título apenas espaços', () => {
    const { blocks } = validateStep('identity', mkMag({ title: '   ' }));
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('NÃO bloqueia se título preenchido', () => {
    const { blocks } = validateStep('identity', mkMag({ title: 'Minha Revista' }));
    expect(blocks).toHaveLength(0);
  });

  it('null title → block (no crash)', () => {
    // @ts-expect-error testing null title
    const { blocks } = validateStep('identity', mkMag({ title: null }));
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('undefined title → block (no crash)', () => {
    // @ts-expect-error testing undefined title
    const { blocks } = validateStep('identity', mkMag({ title: undefined }));
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('null branding → no crash, no warning', () => {
    // @ts-expect-error testing null branding
    const result = validateStep('identity', mkMag({ branding: null }));
    expect(result.blocks.length).toBe(0); // Title is 'Teste', valid
    expect(result.warnings.length).toBe(0); // No logoUrl to validate
  });

  it('invalid logo URL → warning', () => {
    const { warnings } = validateStep(
      'identity',
      mkMag({ branding: { ...DEFAULT_BRANDING, clientLogoUrl: 'not-a-url' } }),
    );
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('valid https logo URL → no warning', () => {
    const { warnings } = validateStep(
      'identity',
      mkMag({ branding: { ...DEFAULT_BRANDING, clientLogoUrl: 'https://cdn.example.com/logo.png' } }),
    );
    expect(warnings).toHaveLength(0);
  });
});

// ============================================================================
// validateStep: products
// ============================================================================

describe('validateStep products', () => {
  it('bloqueia se items vazio', () => {
    const { blocks } = validateStep('products', mkMag({ items: [] }));
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('null items → block (no crash)', () => {
    // @ts-expect-error testing null items
    const { blocks } = validateStep('products', mkMag({ items: null }));
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('1 item → warning de one-pager', () => {
    const { warnings } = validateStep('products', mkMag({ items: [DUMMY_ITEM] }));
    expect(warnings.length).toBeGreaterThan(0);
  });

  it('2+ itens → sem blocks, sem warnings', () => {
    const { blocks, warnings } = validateStep(
      'products',
      mkMag({ items: [DUMMY_ITEM, { ...DUMMY_ITEM, id: 'i2' }] }),
    );
    expect(blocks).toHaveLength(0);
    expect(warnings).toHaveLength(0);
  });
});

// ============================================================================
// validateStep: design / layout
// ============================================================================

describe('validateStep design/layout', () => {
  it('design: bloqueia sem produtos', () => {
    const { blocks } = validateStep('design', mkMag({ items: [] }));
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('layout: bloqueia sem produtos', () => {
    const { blocks } = validateStep('layout', mkMag({ items: [] }));
    expect(blocks.length).toBeGreaterThan(0);
  });

  it('design: NÃO bloqueia com produtos', () => {
    const { blocks } = validateStep('design', mkMag({ items: [DUMMY_ITEM] }));
    expect(blocks).toHaveLength(0);
  });
});

// ============================================================================
// canPublish
// ============================================================================

describe('canPublish', () => {
  it('false se sem título e sem produtos', () => {
    expect(canPublish(mkMag({ title: '', items: [] }))).toBe(false);
  });

  it('false se título vazio (mesmo com produtos)', () => {
    expect(canPublish(mkMag({ title: '', items: [DUMMY_ITEM] }))).toBe(false);
  });

  it('false se sem produtos (mesmo com título)', () => {
    expect(canPublish(mkMag({ title: 'Minha Revista', items: [] }))).toBe(false);
  });

  it('true se título + ao menos 1 produto', () => {
    expect(canPublish(mkMag({ title: 'OK', items: [DUMMY_ITEM] }))).toBe(true);
  });

  it('null title → false (no crash)', () => {
    // @ts-expect-error testing null
    expect(canPublish(mkMag({ title: null, items: [DUMMY_ITEM] }))).toBe(false);
  });

  it('null items → false (no crash)', () => {
    // @ts-expect-error testing null
    expect(canPublish(mkMag({ title: 'OK', items: null }))).toBe(false);
  });

  it('whitespace-only title → false', () => {
    expect(canPublish(mkMag({ title: '   ', items: [DUMMY_ITEM] }))).toBe(false);
  });
});

// ============================================================================
// getCompletionPercentage
// ============================================================================

describe('getCompletionPercentage', () => {
  it('0% para revista completamente vazia', () => {
    // @ts-expect-error testing
    const pct = getCompletionPercentage(mkMag({ title: '', items: [], content: null }));
    expect(pct).toBe(0);
  });

  it('aumenta conforme campos são preenchidos', () => {
    const base = getCompletionPercentage(mkMag({ title: '' }));
    const withTitle = getCompletionPercentage(mkMag({ title: 'Título' }));
    const withTitleAndProduct = getCompletionPercentage(
      mkMag({ title: 'Título', items: [DUMMY_ITEM] }),
    );
    expect(withTitle).toBeGreaterThanOrEqual(base);
    expect(withTitleAndProduct).toBeGreaterThan(withTitle);
  });

  it('máximo 100%', () => {
    const pct = getCompletionPercentage(
      mkMag({
        title: 'Título',
        items: Array.from({ length: 3 }, (_, i) => ({ ...DUMMY_ITEM, id: String(i) })),
        content: { ...DEFAULT_MAGAZINE_CONTENT, introText: 'Intro', closingText: 'Fim' },
        templateId: 'editorial-vogue',
      }),
    );
    expect(pct).toBeLessThanOrEqual(100);
    expect(pct).toBeGreaterThan(60);
  });
});
