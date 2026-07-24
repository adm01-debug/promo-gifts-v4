/**
 * stepValidation — matriz combinatorial (2^5 = 32) sobre os flags booleanos
 * que afetam validação/progresso. Garante que o fix "templateId sem título
 * não pontua" não regride e que canPublish é monotônico.
 */
import { describe, it, expect } from 'vitest';
import { type Magazine, type MagazineItem, DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';

import {
  canPublish,
  getCompletionPercentage,
  validateStep,
} from '../utils/stepValidation';

const DUMMY_ITEM: MagazineItem = {
  id: 'i',
  productId: 'p',
  productSnapshot: {
    id: 'p',
    name: 'x',
    sku: 'x',
    shortDescription: '',
    description: null,
    price: 1,
    image_url: '',
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

interface Flags {
  title: boolean;
  hasItems: boolean;
  hasTwoItems: boolean;
  hasIntro: boolean;
  hasTemplate: boolean;
}

function mkFromFlags(f: Flags): Magazine {
  const items: MagazineItem[] = f.hasTwoItems
    ? [DUMMY_ITEM, { ...DUMMY_ITEM, id: 'i2' }]
    : f.hasItems
      ? [DUMMY_ITEM]
      : [];
  return {
    id: 'm',
    ownerId: 'u',
    organizationId: null,
    title: f.title ? 'Título' : '',
    subtitle: '',
    templateId: f.hasTemplate ? 'editorial-vogue' : ('' as unknown as Magazine['templateId']),
    branding: { ...DEFAULT_BRANDING },
    content: {
      ...DEFAULT_MAGAZINE_CONTENT,
      introText: f.hasIntro ? 'Bem-vindo' : undefined,
    } as Magazine['content'],
    items,
    pageOrder: null,
    status: 'draft',
    publicToken: null,
    viewCount: 0,
    publishedAt: null,
    archivedAt: null,
    createdAt: '',
    updatedAt: '',
  };
}

function allCombinations(): Flags[] {
  const out: Flags[] = [];
  for (let mask = 0; mask < 32; mask++) {
    out.push({
      title: !!(mask & 1),
      hasItems: !!(mask & 2),
      hasTwoItems: !!(mask & 4),
      hasIntro: !!(mask & 8),
      hasTemplate: !!(mask & 16),
    });
  }
  return out;
}

describe('stepValidation — matriz 32 combinações', () => {
  const combos = allCombinations();

  it.each(combos)('canPublish coerente com título + itens (%o)', (f) => {
    const m = mkFromFlags(f);
    // hasTwoItems implica hasItems para efeito real
    const effectiveHasItems = f.hasItems || f.hasTwoItems;
    expect(canPublish(m)).toBe(f.title && effectiveHasItems);
  });

  it.each(combos)('getCompletionPercentage entre 0-100 e templateId sem título não pontua (%o)', (f) => {
    const m = mkFromFlags(f);
    const pct = getCompletionPercentage(m);
    expect(pct).toBeGreaterThanOrEqual(0);
    expect(pct).toBeLessThanOrEqual(100);

    // Fix crítico: templateId sozinho (sem título) não deve pontuar
    if (!f.title && !f.hasItems && !f.hasTwoItems && !f.hasIntro && f.hasTemplate) {
      expect(pct).toBe(0);
    }
  });

  it('progresso é monotônico ao acumular flags', () => {
    const prog: number[] = [];
    const seq: Flags[] = [
      { title: false, hasItems: false, hasTwoItems: false, hasIntro: false, hasTemplate: false },
      { title: true, hasItems: false, hasTwoItems: false, hasIntro: false, hasTemplate: false },
      { title: true, hasItems: true, hasTwoItems: false, hasIntro: false, hasTemplate: false },
      { title: true, hasItems: true, hasTwoItems: true, hasIntro: false, hasTemplate: false },
      { title: true, hasItems: true, hasTwoItems: true, hasIntro: true, hasTemplate: false },
      { title: true, hasItems: true, hasTwoItems: true, hasIntro: true, hasTemplate: true },
    ];
    for (const f of seq) prog.push(getCompletionPercentage(mkFromFlags(f)));
    for (let i = 1; i < prog.length; i++) {
      expect(prog[i]).toBeGreaterThanOrEqual(prog[i - 1]);
    }
    expect(prog[prog.length - 1]).toBe(100);
  });

  it.each(['identity', 'products', 'design', 'layout'] as const)(
    'validateStep(%s) nunca lança sob qualquer combo',
    (step) => {
      for (const f of combos) {
        const m = mkFromFlags(f);
        expect(() => validateStep(step, m)).not.toThrow();
      }
    },
  );
});
