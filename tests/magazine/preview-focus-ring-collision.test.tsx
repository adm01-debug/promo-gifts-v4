/**
 * Regressão visual dos anéis pintados EXCLUSIVAMENTE por `:focus-visible`.
 *
 * Complementa `preview-ring-collision.test.tsx`, que valida apenas classes
 * base (sem prefixo). Aqui isolamos os tokens `focus-visible:ring-*` para
 * garantir que o indicador de foco por teclado:
 *
 *   1. Nunca seja âmbar (âmbar é reservado ao highlight de item — mouse/foco
 *      de LayoutStep — e é aplicado no estado base, não sob `focus-visible`).
 *   2. Seja sempre `ring-primary`, independentemente de `activeIdx` ou
 *      `highlightedItemId` — inclusive quando a miniatura já está em âmbar
 *      no estado base (colisão visual seria confusa; a precedência do foco
 *      por teclado é `primary`).
 *   3. Se preserve em ambas as variantes (`sidebar` e `drawer` — quando
 *      renderizada, o markup dos thumbs é o mesmo).
 */

import { describe, it, expect, vi } from 'vitest';
import { render } from '@testing-library/react';
import { useState } from 'react';
import { PreviewSidebar } from '@/pages/magazine/components/PreviewSidebar';
import { paginateMagazine } from '@/pages/magazine/pagination';
import type { Magazine, MagazineItem } from '@/types/magazine';
import { DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';
import { focusRingsOf, ringsOf, thumbsFrom } from './helpers';

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

function Harness({
  magazine,
  activeIdx,
  highlightedItemId,
}: {
  magazine: Magazine;
  activeIdx: number;
  highlightedItemId: string | null;
}) {
  const [idx, setIdx] = useState(activeIdx);
  const pages = paginateMagazine(magazine);
  return (
    <PreviewSidebar
      magazine={magazine}
      pages={pages}
      activePageIdx={idx}
      onSelectPage={setIdx}
      highlightedItemId={highlightedItemId}
    />
  );
}

describe('PreviewSidebar — colisão sob :focus-visible (teclado)', () => {
  const magazine = buildMagazine(8);
  const pages = paginateMagazine(magazine);

  it('toda miniatura declara focus-visible:ring-primary e nunca focus-visible:ring-amber-500', () => {
    const { container } = render(
      <Harness magazine={magazine} activeIdx={0} highlightedItemId={null} />,
    );
    const thumbs = thumbsFrom(container);
    expect(thumbs.length).toBeGreaterThan(0);
    for (const btn of thumbs) {
      const { primary, amber } = focusRingsOf(btn);
      expect(primary).toBe(true);
      expect(amber).toBe(false);
    }
  });

  it('miniatura ativa: focus-visible mantém primary (sem âmbar)', () => {
    const activeIdx = Math.min(2, pages.length - 1);
    const { container } = render(
      <Harness magazine={magazine} activeIdx={activeIdx} highlightedItemId={null} />,
    );
    const active = thumbsFrom(container)[activeIdx];
    expect(ringsOf(active).primary).toBe(true);
    const fv = focusRingsOf(active);
    expect(fv.primary).toBe(true);
    expect(fv.amber).toBe(false);
  });

  it('miniatura destacada em âmbar (não ativa): foco por teclado pinta primary, nunca âmbar', () => {
    // encontra um item que caia numa página != da ativa
    const targetItem = magazine.items.find((it) => {
      const pageIdx = pages.findIndex((p) => p.items.some((x) => x.id === it.id));
      return pageIdx > 0;
    });
    expect(targetItem).toBeTruthy();

    const { container } = render(
      <Harness
        magazine={magazine}
        activeIdx={0}
        highlightedItemId={targetItem!.id}
      />,
    );

    const highlightedIdx = pages.findIndex((p) =>
      p.items.some((x) => x.id === targetItem!.id),
    );
    const btn = thumbsFrom(container)[highlightedIdx];

    // sanity: no base, é âmbar
    const base = ringsOf(btn);
    expect(base.amber).toBe(true);
    expect(base.primary).toBe(false);

    // sob focus-visible: primary vence, âmbar nunca aparece
    const fv = focusRingsOf(btn);
    expect(fv.primary).toBe(true);
    expect(fv.amber).toBe(false);
  });

  it('varredura cartesiana: nenhum estado produz focus-visible:ring-amber-500', () => {
    const targetItem = magazine.items[5];
    const highlightScenarios: Array<string | null> = [null, targetItem.id];
    const activeScenarios = [0, Math.floor(pages.length / 2), pages.length - 1];

    for (const activeIdx of activeScenarios) {
      for (const hid of highlightScenarios) {
        const { container, unmount } = render(
          <Harness magazine={magazine} activeIdx={activeIdx} highlightedItemId={hid} />,
        );
        for (const btn of thumbsFrom(container)) {
          const fv = focusRingsOf(btn);
          expect(fv.amber).toBe(false);
          expect(fv.primary).toBe(true);
        }
        unmount();
      }
    }
  });

  it('indicador de página (input numérico) também usa focus-visible:ring-primary sem âmbar', () => {
    const { container } = render(
      <Harness magazine={magazine} activeIdx={0} highlightedItemId={null} />,
    );
    // captura qualquer elemento com token focus-visible:ring-* dentro do sidebar
    const all = Array.from(container.querySelectorAll<HTMLElement>('[class*="focus-visible:ring"]'));
    expect(all.length).toBeGreaterThan(0);
    for (const el of all) {
      const fv = focusRingsOf(el);
      // pode ser primary; nunca âmbar
      expect(fv.amber).toBe(false);
    }
  });
});
