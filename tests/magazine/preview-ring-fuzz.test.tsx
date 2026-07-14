/**
 * Fuzz property-based do PreviewSidebar — invariantes de rings.
 *
 * Auditoria 2026-07-14, Fase 2. Cada propriedade é executada sobre 200
 * magazines gerados por um PRNG determinístico (mulberry32) semeado por
 * `SEED_BASE + i`. Em caso de falha, o seed é logado para reprodução exata.
 *
 * Propriedades:
 *   P1 — invariante de colisão base: ∀ thumb, NOT (base.primary AND base.amber)
 *   P2 — invariante focus-visible : ∀ thumb, fv.primary AND NOT fv.amber
 *   P3 — precedência do ativo    : ∀ thumb ativa (aria-current="true"),
 *                                   base.primary=true E base.amber=false
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { PreviewSidebar } from '@/pages/magazine/components/PreviewSidebar';
import { paginateMagazine } from '@/pages/magazine/pagination';
import type { Magazine, MagazineItem } from '@/types/magazine';
import { DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';
import { ringsOf, focusRingsOf, thumbsFrom } from './helpers';

vi.mock('@/pages/magazine/components/MagazinePageRenderer', () => ({
  MagazinePageRenderer: ({ page }: { page: { index: number } }) => (
    <div data-testid={`page-renderer-${page.index}`}>page-{page.index}</div>
  ),
}));

// ─── PRNG determinístico ──────────────────────────────────────────────────
function mulberry32(seed: number): () => number {
  return function random() {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T>(rng: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rng() * arr.length)]!;
}

const TEMPLATES = ['catalog-grid', 'editorial-vogue', 'catalog-list'] as const;

function makeItem(idx: number): MagazineItem {
  return {
    id: `item-${idx}`,
    productId: `prod-${idx}`,
    variantColorName: null,
    position: idx,
    pageNumber: null,
    overrides: {},
    productSnapshot: {
      id: `prod-${idx}`,
      name: `Produto ${idx + 1}`,
      sku: `SKU-${100 + idx}`,
      shortDescription: 'x',
      description: null,
      price: 49.9,
      image_url: 'https://example.com/x.png',
      images: [],
      colors: [],
      materials: [],
      hasPersonalization: false,
      category_id: null,
      category_name: pick(mulberry32(idx), ['A', 'B', 'C', null] as const) ?? null,
    },
  };
}

interface FuzzInput {
  seed: number;
  magazine: Magazine;
  activeIdx: number;
  highlightedItemId: string | null;
  groupByCategory: boolean;
  templateId: (typeof TEMPLATES)[number];
}

function makeFuzzInput(seed: number): FuzzInput {
  const rng = mulberry32(seed);
  const n = 1 + Math.floor(rng() * 30); // 1..30 itens
  const groupByCategory = rng() < 0.3;
  const templateId = pick(rng, TEMPLATES);
  const items = Array.from({ length: n }, (_, i) => makeItem(i));
  const magazine: Magazine = {
    id: `mag-${seed}`,
    ownerId: 'user-1',
    organizationId: null,
    title: 'Revista fuzz',
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
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  const pages = paginateMagazine(magazine);
  const activeIdx = Math.floor(rng() * pages.length);
  // 3 modos de highlight: null / item existente / id inexistente
  const mode = rng();
  let highlightedItemId: string | null;
  if (mode < 0.34) {
    highlightedItemId = null;
  } else if (mode < 0.67) {
    highlightedItemId = items[Math.floor(rng() * items.length)]!.id;
  } else {
    highlightedItemId = `id-inexistente-${seed}`;
  }
  return { seed, magazine, activeIdx, highlightedItemId, groupByCategory, templateId };
}

function renderCase(input: FuzzInput) {
  const pages = paginateMagazine(input.magazine);
  return {
    pages,
    ...render(
      <PreviewSidebar
        magazine={input.magazine}
        pages={pages}
        activeIdx={input.activeIdx}
        onSelect={() => {}}
        onOpenAll={() => {}}
        highlightedItemId={input.highlightedItemId}
      />,
    ),
  };
}

function describeCase(input: FuzzInput): string {
  return `seed=${input.seed} template=${input.templateId} groupBy=${input.groupByCategory} n=${input.magazine.items.length} activeIdx=${input.activeIdx} highlight=${input.highlightedItemId}`;
}

const SEED_BASE = 0xdeadbeef;
const RUNS = 200;

describe('PreviewSidebar — fuzz property-based (200 runs por propriedade)', () => {
  it('P1 · invariante de colisão base: NUNCA primary+amber juntos na mesma thumb', () => {
    const failures: string[] = [];
    for (let i = 0; i < RUNS; i++) {
      const input = makeFuzzInput(SEED_BASE + i);
      const { container, unmount } = renderCase(input);
      const thumbs = thumbsFrom(container);
      // Só há thumbs quando pages.length > 1 — o gerador quase sempre satisfaz.
      for (let idx = 0; idx < thumbs.length; idx++) {
        const { primary, amber } = ringsOf(thumbs[idx]!);
        if (primary && amber) {
          failures.push(`${describeCase(input)} thumbIdx=${idx}`);
        }
      }
      unmount();
    }
    if (failures.length > 0) {
      throw new Error(
        `P1 falhou em ${failures.length}/${RUNS} execuções. Reproduções:\n${failures.slice(0, 5).join('\n')}`,
      );
    }
    expect(failures).toHaveLength(0);
  });

  it('P2 · invariante focus-visible: TODA thumb pinta primary sob :focus-visible, jamais amber', () => {
    const failures: string[] = [];
    for (let i = 0; i < RUNS; i++) {
      const input = makeFuzzInput(SEED_BASE + i);
      const { container, unmount } = renderCase(input);
      const thumbs = thumbsFrom(container);
      for (let idx = 0; idx < thumbs.length; idx++) {
        const fv = focusRingsOf(thumbs[idx]!);
        if (!fv.primary || fv.amber) {
          failures.push(
            `${describeCase(input)} thumbIdx=${idx} fv.primary=${fv.primary} fv.amber=${fv.amber}`,
          );
        }
      }
      unmount();
    }
    if (failures.length > 0) {
      throw new Error(
        `P2 falhou em ${failures.length}/${RUNS} execuções. Reproduções:\n${failures.slice(0, 5).join('\n')}`,
      );
    }
    expect(failures).toHaveLength(0);
  });

  it('P3 · precedência do ativo: aria-current="true" ⇒ base.primary=true e base.amber=false', () => {
    const failures: string[] = [];
    let observedActive = 0;
    for (let i = 0; i < RUNS; i++) {
      const input = makeFuzzInput(SEED_BASE + i);
      const { container, pages, unmount } = renderCase(input);
      const thumbs = thumbsFrom(container);
      // Se activeIdx aponta para uma página real, deve existir exatamente 1 ativa.
      if (thumbs.length > 0 && input.activeIdx < pages.length) {
        const actives = thumbs.filter((b) => b.getAttribute('aria-current') === 'true');
        if (actives.length !== 1) {
          failures.push(`${describeCase(input)} ativas=${actives.length} (esperado 1)`);
        }
        for (const act of actives) {
          observedActive++;
          const r = ringsOf(act);
          if (!r.primary || r.amber) {
            failures.push(`${describeCase(input)} ativa violou precedência: ${JSON.stringify(r)}`);
          }
        }
      }
      unmount();
    }
    if (failures.length > 0) {
      throw new Error(
        `P3 falhou em ${failures.length}/${RUNS}. Ativas observadas=${observedActive}. Reproduções:\n${failures.slice(0, 5).join('\n')}`,
      );
    }
    expect(observedActive).toBeGreaterThan(RUNS * 0.5); // sanidade: majoritariamente ativas
    expect(failures).toHaveLength(0);
  });
});
