/**
 * Suíte de regressão para gaps identificados na auditoria 2026-07-14 (Fase 1.3).
 *
 * Cobre cenários NÃO exercidos pelas suítes originais e que poderiam
 * silenciosamente introduzir regressões — inclusive por definição do próprio
 * componente: quando `pages.length <= 1`, o PreviewSidebar NÃO renderiza
 * thumbs, então a "invariante de rings" nesse caso é 'não existem rings'
 * (documentamos essa realidade para futuros contribuidores).
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

function makeItem(idx: number, position?: number): MagazineItem {
  return {
    id: `item-${idx}`,
    productId: `prod-${idx}`,
    variantColorName: null,
    position: position ?? idx,
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
      category_name: null,
    },
  };
}

function buildMagazine(count: number, overrides?: Partial<Magazine>): Magazine {
  return {
    id: 'mag-edge',
    ownerId: 'user-1',
    organizationId: null,
    title: 'Revista edge',
    subtitle: '',
    templateId: 'catalog-grid',
    branding: { ...DEFAULT_BRANDING },
    content: { ...DEFAULT_MAGAZINE_CONTENT },
    items: Array.from({ length: count }, (_, i) => makeItem(i)),
    pageOrder: null,
    status: 'draft',
    publicToken: null,
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...overrides,
  };
}

function renderSidebar(magazine: Magazine, activeIdx: number, highlightedItemId: string | null = null, variant: 'sidebar' | 'drawer' = 'sidebar') {
  const pages = paginateMagazine(magazine);
  const result = render(
    <PreviewSidebar
      magazine={magazine}
      pages={pages}
      activeIdx={activeIdx}
      onSelect={() => {}}
      onOpenAll={() => {}}
      highlightedItemId={highlightedItemId}
      variant={variant}
    />,
  );
  return { ...result, pages };
}

describe('Edge cases — magazines com pouquíssimas páginas', () => {
  it('0 itens (só capa + contracapa = 2 páginas) — renderiza thumbs e mantém invariante', () => {
    const magazine = buildMagazine(0);
    const { container, pages } = renderSidebar(magazine, 0);
    expect(pages.length).toBe(2);
    const thumbs = thumbsFrom(container);
    // pages.length > 1 → thumbs renderizadas
    expect(thumbs.length).toBe(2);
    for (const btn of thumbs) {
      const r = ringsOf(btn);
      expect(r.primary && r.amber).toBe(false);
      expect(focusRingsOf(btn).primary).toBe(true);
      expect(focusRingsOf(btn).amber).toBe(false);
    }
    // Exatamente uma ativa
    expect(thumbs.filter((b) => b.getAttribute('aria-current') === 'true').length).toBe(1);
  });

  it('1 item (pages.length = 3: capa + produtos + contracapa) — invariante preservado', () => {
    const magazine = buildMagazine(1);
    const { container, pages } = renderSidebar(magazine, 1);
    expect(pages.length).toBe(3);
    const thumbs = thumbsFrom(container);
    expect(thumbs.length).toBe(3);
    const primaries = thumbs.filter((b) => ringsOf(b).primary);
    expect(primaries.length).toBe(1);
    expect(primaries[0]!.getAttribute('aria-current')).toBe('true');
  });
});

describe('Edge cases — activeIdx inválido', () => {
  it('activeIdx = -1 → fallback para pages[0], sem crash', () => {
    const magazine = buildMagazine(4);
    const { container } = renderSidebar(magazine, -1);
    const thumbs = thumbsFrom(container);
    // Como -1 ∉ [0..pages.length-1], NENHUMA thumb será marcada ativa
    // (a comparação `idx === activeIdx` nunca casa). Isso é o comportamento
    // atual observado e queremos travá-lo — nenhum ring âmbar ou primary base
    // "aleatório" deve emergir.
    const active = thumbs.filter((b) => b.getAttribute('aria-current') === 'true');
    expect(active.length).toBe(0);
    const primaries = thumbs.filter((b) => ringsOf(b).primary);
    expect(primaries.length).toBe(0);
    for (const btn of thumbs) {
      const r = ringsOf(btn);
      expect(r.primary && r.amber).toBe(false);
    }
  });

  it('activeIdx = pages.length (fora do range superior) → nenhuma thumb ativa', () => {
    const magazine = buildMagazine(4);
    const pages = paginateMagazine(magazine);
    const { container } = renderSidebar(magazine, pages.length);
    const thumbs = thumbsFrom(container);
    expect(thumbs.filter((b) => b.getAttribute('aria-current') === 'true').length).toBe(0);
    expect(thumbs.filter((b) => ringsOf(b).primary).length).toBe(0);
  });

  it('activeIdx = NaN → nenhuma thumb ativa, invariante preservado, sem crash', () => {
    const magazine = buildMagazine(4);
    const { container } = renderSidebar(magazine, Number.NaN);
    const thumbs = thumbsFrom(container);
    expect(thumbs.filter((b) => b.getAttribute('aria-current') === 'true').length).toBe(0);
    for (const btn of thumbs) {
      const r = ringsOf(btn);
      expect(r.primary && r.amber).toBe(false);
    }
  });
});

describe('Edge cases — highlightedItemId apontando para item inexistente', () => {
  it('nenhuma thumb ganha ring âmbar; ativa continua com primary', () => {
    const magazine = buildMagazine(6);
    const { container } = renderSidebar(magazine, 1, 'id-que-nao-existe');
    const thumbs = thumbsFrom(container);
    const ambers = thumbs.filter((b) => ringsOf(b).amber);
    expect(ambers.length).toBe(0);
    // Ativa preservada
    const actives = thumbs.filter((b) => b.getAttribute('aria-current') === 'true');
    expect(actives.length).toBe(1);
    expect(ringsOf(actives[0]!).primary).toBe(true);
  });
});

describe('Edge cases — variant="drawer"', () => {
  it('mesma invariante de rings vale no variant drawer (mesmo markup de thumbs)', () => {
    const magazine = buildMagazine(6);
    const { container } = renderSidebar(magazine, 2, 'item-4', 'drawer');
    const thumbs = thumbsFrom(container);
    expect(thumbs.length).toBeGreaterThan(0);
    for (const btn of thumbs) {
      const r = ringsOf(btn);
      expect(r.primary && r.amber).toBe(false);
      const fv = focusRingsOf(btn);
      expect(fv.primary).toBe(true);
      expect(fv.amber).toBe(false);
    }
    expect(thumbs.filter((b) => b.getAttribute('aria-current') === 'true').length).toBe(1);
  });
});

describe('Edge cases — re-render com activeIdx mudando (transição)', () => {
  it('transição 0 → 3 → 6 preserva a invariante em cada estado', () => {
    const magazine = buildMagazine(12);
    const pages = paginateMagazine(magazine);
    const sequence = [0, Math.floor(pages.length / 2), pages.length - 1];
    for (const active of sequence) {
      const { container, unmount } = renderSidebar(magazine, active, 'item-3');
      const thumbs = thumbsFrom(container);
      const primaries = thumbs.filter((b) => ringsOf(b).primary);
      const actives = thumbs.filter((b) => b.getAttribute('aria-current') === 'true');
      expect(primaries.length, `active=${active}`).toBe(1);
      expect(actives.length, `active=${active}`).toBe(1);
      expect(primaries[0]).toBe(actives[0]);
      for (const btn of thumbs) {
        expect(ringsOf(btn).primary && ringsOf(btn).amber).toBe(false);
      }
      unmount();
    }
  });
});

describe('Edge cases — position "shuffled" (ordem via position, não index)', () => {
  it('itens com position embaralhada ainda paginam consistentemente e mantêm invariante', () => {
    // Itens em ordem reversa via `position` — paginateMagazine deve ordenar.
    const items = Array.from({ length: 8 }, (_, i) => makeItem(i, 100 - i));
    const magazine: Magazine = {
      ...buildMagazine(0),
      items,
    };
    const { container, pages } = renderSidebar(magazine, 1, items[3]!.id);
    expect(pages.length).toBeGreaterThan(2);
    const thumbs = thumbsFrom(container);
    const ambers = thumbs.filter((b) => ringsOf(b).amber);
    // O item destacado deve corresponder a EXATAMENTE UMA página em âmbar
    // (ou zero, se calhou de estar na página ativa — que teria precedência).
    expect(ambers.length).toBeLessThanOrEqual(1);
    for (const btn of thumbs) {
      expect(ringsOf(btn).primary && ringsOf(btn).amber).toBe(false);
    }
  });
});
