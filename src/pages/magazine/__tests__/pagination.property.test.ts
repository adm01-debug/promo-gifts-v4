/**
 * paginateMagazine — property-based fuzz.
 * Gera 100+ revistas aleatórias (fast-check) e verifica invariantes universais.
 */
import { describe, it, expect } from 'vitest';
import fc from 'fast-check';
import { type Magazine, type MagazineItem, type MagazineTemplateId, DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';

import { paginateMagazine } from '../pagination';

const TEMPLATES: MagazineTemplateId[] = [
  'editorial-vogue',
  'editorial-magazine',
  'editorial-hero-grid',
  'editorial-mono',
  'editorial-manifesto',
  'catalog-grid-2x3',
  'catalog-grid-3x3',
  'catalog-list',
  'catalog-giftset',
  'corporate-hero',
  'corporate-split',
  'corporate-executive',
];

const itemArb = fc.record({
  id: fc.string({ minLength: 1, maxLength: 8 }),
  position: fc.oneof(
    fc.integer({ min: -100, max: 100 }),
    fc.constant(0),
    fc.constant(null as unknown as number),
    fc.double({ min: -10, max: 10, noNaN: true }),
  ),
  category: fc.oneof(fc.string({ maxLength: 12 }), fc.constant(null)),
});

function mkItem(seed: {
  id: string;
  position: number;
  category: string | null;
}): MagazineItem {
  return {
    id: seed.id,
    productId: `p_${seed.id}`,
    productSnapshot: {
      id: `p_${seed.id}`,
      name: `Produto ${seed.id}`,
      sku: `SKU-${seed.id}`,
      shortDescription: '',
      description: null,
      price: 10,
      image_url: '',
      images: [],
      colors: [],
      category_name: seed.category,
      category_id: null,
      materials: [],
      hasPersonalization: null,
    },
    variantColorName: null,
    position: seed.position,
    pageNumber: null,
    overrides: {},
  };
}

function mkMag(
  templateId: MagazineTemplateId,
  items: MagazineItem[],
  groupByCategory: boolean,
): Magazine {
  return {
    id: 'm',
    ownerId: 'u',
    organizationId: null,
    title: 't',
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
    createdAt: '',
    updatedAt: '',
  };
}

describe('paginateMagazine — property-based (100 casos)', () => {
  it('invariantes universais sob entradas aleatórias', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...TEMPLATES),
        fc.array(itemArb, { maxLength: 40 }),
        fc.boolean(),
        (tpl, seeds, group) => {
          // dedupe por id para evitar chaves ambíguas
          const uniq = Array.from(new Map(seeds.map((s) => [s.id, s])).values());
          const items = uniq.map(mkItem);
          const mag = mkMag(tpl, items, group);
          const pages = paginateMagazine(mag);

          // 1. sempre começa com cover e termina com back-cover
          expect(pages[0].kind).toBe('cover');
          expect(pages[pages.length - 1].kind).toBe('back-cover');

          // 2. índices sequenciais únicos
          const idxs = pages.map((p) => p.index);
          expect(new Set(idxs).size).toBe(pages.length);

          // 3. soma dos items nas páginas 'products' == total de items
          const total = pages
            .filter((p) => p.kind === 'products')
            .reduce((s, p) => s + p.items.length, 0);
          expect(total).toBe(items.length);

          // 4. groupByCategory: cada 'section' precede ≥1 páginas de products
          if (group && items.length > 0) {
            const sections = pages.filter((p) => p.kind === 'section');
            const cats = new Set(
              items.map((i) => i.productSnapshot?.category_name ?? 'Outros'),
            );
            expect(sections.length).toBe(cats.size);
          }

          // 5. determinismo
          const p2 = paginateMagazine(mag);
          expect(pages.map((p) => p.kind)).toEqual(p2.map((p) => p.kind));

          // 6. sem mutação da entrada
          expect(items.map((i) => i.position)).toEqual(uniq.map((s) => s.position));
        },
      ),
      { numRuns: 100 },
    );
  });

  it('null/undefined magazine nunca lança', () => {
    fc.assert(
      fc.property(fc.oneof(fc.constant(null), fc.constant(undefined)), (v) => {
        const pages = paginateMagazine(v);
        expect(pages).toHaveLength(2);
      }),
      { numRuns: 20 },
    );
  });
});
