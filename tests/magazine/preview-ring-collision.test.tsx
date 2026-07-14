/**
 * Regressão visual dos anéis de destaque nas miniaturas do PreviewSidebar.
 *
 * Invariante: em NENHUM estado uma miniatura pode exibir simultaneamente
 * `ring-primary` (página ativa/selecionada) e `ring-amber-500` (highlight
 * do item em hover/foco do LayoutStep). O ativo tem precedência absoluta.
 *
 * Estados cobertos (produto cartesiano):
 *   activeIdx ∈ {0, meio, último}
 *   highlightedItemId ∈ {null, item na página ativa, item em outra página}
 *   origem do highlight ∈ {mouse, teclado}
 */

import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import { useState } from 'react';
import { PreviewSidebar } from '@/pages/magazine/components/PreviewSidebar';
import { LayoutStep } from '@/pages/magazine/components/steps/LayoutStep';
import { paginateMagazine } from '@/pages/magazine/pagination';
import type { Magazine, MagazineItem, MagazinePage } from '@/types/magazine';
import { DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';

vi.mock('@/pages/magazine/components/MagazinePageRenderer', () => ({
  MagazinePageRenderer: ({ page }: { page: { index: number } }) => (
    <div data-testid={`page-renderer-${page.index}`}>page-{page.index}</div>
  ),
}));

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
      category_name: null,
    },
  };
}

function buildMagazine(count = 8): Magazine {
  return {
    id: 'mag-1',
    ownerId: 'user-1',
    organizationId: null,
    title: 'Revista',
    subtitle: '',
    templateId: 'catalog-grid',
    branding: { ...DEFAULT_BRANDING },
    content: { ...DEFAULT_MAGAZINE_CONTENT },
    items: Array.from({ length: count }, (_, i) => makeItem(i)),
    pageOrder: null,
    status: 'draft',
    publicToken: null,
    pdfUrl: null,
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

/** Retorna o conjunto de classes de ring aplicadas numa miniatura. */
function ringsOf(btn: HTMLElement): { primary: boolean; amber: boolean } {
  const cls = btn.className;
  return {
    primary: /\bring-primary\b/.test(cls),
    amber: /\bring-amber-500\b/.test(cls),
  };
}

function thumbsFrom(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Ir para página"]'),
  );
}

function findPageIdxOfItem(pages: MagazinePage[], itemId: string): number {
  return pages.findIndex((p) => p.items.some((it) => it.id === itemId));
}

describe('PreviewSidebar — regressão visual dos rings de destaque', () => {
  const magazine = buildMagazine(8);
  const pages = paginateMagazine(magazine);

  // Escolhe uma página ATIVA que contenha itens (a capa costuma ser vazia),
  // um item dessa página e outro fora dela.
  const activePageIdx = pages.findIndex((p) => p.items.length > 0);
  expect(activePageIdx).toBeGreaterThanOrEqual(0);
  const itemInActive = pages[activePageIdx]!.items[0]!;
  const itemOutsideActive =
    magazine.items.find((it) => findPageIdxOfItem(pages, it.id) !== activePageIdx) ??
    magazine.items.at(-1)!;

  const otherPageWithItems = pages.findIndex((p, i) => i !== activePageIdx && p.items.length > 0);
  const activeIndices = Array.from(
    new Set([activePageIdx, Math.max(0, otherPageWithItems), pages.length - 1]),
  );
  const highlightCases: Array<{ label: string; id: string | null }> = [
    { label: 'sem highlight', id: null },
    { label: 'highlight na página ativa', id: itemInActive.id },
    { label: 'highlight fora da página ativa', id: itemOutsideActive.id },
  ];

  for (const activeIdx of activeIndices) {
    for (const hc of highlightCases) {
      it(`activeIdx=${activeIdx} · ${hc.label} — rings nunca coexistem numa mesma thumb`, () => {
        const { container } = render(
          <PreviewSidebar
            magazine={magazine}
            pages={pages}
            activeIdx={activeIdx}
            onSelect={() => {}}
            onOpenAll={() => {}}
            highlightedItemId={hc.id}
          />,
        );

        const thumbs = thumbsFrom(container);
        expect(thumbs.length).toBe(pages.length);

        const highlightedPageIdx = hc.id ? findPageIdxOfItem(pages, hc.id) : -1;

        thumbs.forEach((btn, idx) => {
          const { primary, amber } = ringsOf(btn);

          // Invariante central: nunca os dois simultaneamente.
          expect(
            primary && amber,
            `thumb ${idx} não pode ter ring-primary + ring-amber-500 juntos`,
          ).toBe(false);

          if (idx === activeIdx) {
            // Página ativa: sempre ring-primary, jamais âmbar (mesmo que o
            // highlight caia nela — precedência do ativo).
            expect(primary).toBe(true);
            expect(amber).toBe(false);
            expect(btn.getAttribute('aria-current')).toBe('true');
          } else if (idx === highlightedPageIdx) {
            // Outras páginas com highlight: apenas âmbar.
            expect(amber).toBe(true);
            expect(primary).toBe(false);
          } else {
            // Sem ativo, sem highlight: sem rings.
            expect(primary).toBe(false);
            expect(amber).toBe(false);
          }
        });

        // Sanidade: no máximo UMA thumb âmbar e UMA thumb primary.
        const amberCount = thumbs.filter((b) => ringsOf(b).amber).length;
        const primaryCount = thumbs.filter((b) => ringsOf(b).primary).length;
        expect(amberCount).toBeLessThanOrEqual(1);
        expect(primaryCount).toBe(1);
      });
    }
  }
});

describe('Rings de destaque — invariante persiste sob interação (mouse e teclado)', () => {
  function Harness({ activeIdx }: { activeIdx: number }) {
    const magazine = buildMagazine(8);
    const pages = paginateMagazine(magazine);
    const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
    return (
      <div>
        <LayoutStep
          magazine={magazine}
          onReorder={() => {}}
          onRemove={() => {}}
          onItemHover={setHighlightedItemId}
          highlightedItemId={highlightedItemId}
        />
        <PreviewSidebar
          magazine={magazine}
          pages={pages}
          activeIdx={activeIdx}
          onSelect={() => {}}
          onOpenAll={() => {}}
          highlightedItemId={highlightedItemId}
        />
      </div>
    );
  }

  function getLayoutItems(container: HTMLElement): HTMLLIElement[] {
    return Array.from(
      container.querySelectorAll<HTMLLIElement>('li[aria-label^="Produto "]'),
    );
  }

  function assertNoRingCollision(container: HTMLElement) {
    const thumbs = thumbsFrom(container);
    for (const btn of thumbs) {
      const { primary, amber } = ringsOf(btn);
      expect(primary && amber).toBe(false);
    }
  }

  it('mouseEnter em cada item do LayoutStep — nunca colide com a thumb ativa', () => {
    const { container } = render(<Harness activeIdx={0} />);
    const items = getLayoutItems(container);
    expect(items.length).toBeGreaterThan(0);

    for (const li of items) {
      fireEvent.mouseEnter(li);
      assertNoRingCollision(container);

      // A thumb ativa (idx 0) mantém primary e permanece SEM âmbar,
      // mesmo se o item destacado pertence a ela.
      const thumbs = thumbsFrom(container);
      const active = thumbs[0]!;
      const { primary, amber } = ringsOf(active);
      expect(primary).toBe(true);
      expect(amber).toBe(false);

      fireEvent.mouseLeave(li);
    }
  });

  it('focus por teclado em cada item do LayoutStep — nunca colide, e blur limpa', () => {
    const { container } = render(<Harness activeIdx={2} />);
    const items = getLayoutItems(container);
    for (const li of items) {
      fireEvent.focus(li);
      assertNoRingCollision(container);

      // Nunca mais de uma thumb âmbar.
      const amberCount = thumbsFrom(container).filter((b) => ringsOf(b).amber).length;
      expect(amberCount).toBeLessThanOrEqual(1);

      fireEvent.blur(li);
      // Após blur, nenhum âmbar remanescente.
      const remaining = thumbsFrom(container).filter((b) => ringsOf(b).amber).length;
      expect(remaining).toBe(0);
    }
  });

  it('alternância rápida entre itens (mouse) não deixa rings "presos" em thumbs erradas', () => {
    const { container } = render(<Harness activeIdx={1} />);
    const items = getLayoutItems(container);
    // Bate em vários itens sem mouseLeave intermediário — só o último deve
    // ficar destacado (o hook onMouseEnter propaga o novo id).
    const sequence = [items[0], items[2], items[items.length - 1]].filter(Boolean) as HTMLLIElement[];
    for (const li of sequence) fireEvent.mouseEnter(li);

    assertNoRingCollision(container);
    const amberThumbs = thumbsFrom(container).filter((b) => ringsOf(b).amber);
    expect(amberThumbs.length).toBeLessThanOrEqual(1);
  });
});
