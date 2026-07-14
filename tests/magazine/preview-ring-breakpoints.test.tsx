/**
 * Regressão visual dos rings do PreviewSidebar em múltiplos breakpoints.
 *
 * jsdom não aplica CSS de mídia, então "breakpoint" aqui significa:
 *   1. `window.innerWidth` + `matchMedia` mockados para responder positivamente
 *      às queries Tailwind (`(min-width: 640px)`, `768px`, `1280px`).
 *   2. Snapshots dos tokens de ring (base + focus-visible) por miniatura,
 *      capturados por breakpoint e comparados entre si.
 *
 * Invariante: os tokens de ring são idênticos em TODOS os breakpoints
 * (mobile, sm, md, xl). Se um refactor introduzir uma variante responsiva
 * que altere `ring-primary` / `ring-amber-500` / `focus-visible:ring-*`,
 * este teste falha e aponta o breakpoint divergente.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render } from '@testing-library/react';
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

type BP = { name: string; width: number };
const BREAKPOINTS: BP[] = [
  { name: 'mobile', width: 375 },
  { name: 'sm', width: 640 },
  { name: 'md', width: 768 },
  { name: 'xl', width: 1280 },
];

const originalMatchMedia = window.matchMedia;
const originalInnerWidth = window.innerWidth;

function setViewport(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  Object.defineProperty(window, 'matchMedia', {
    configurable: true,
    writable: true,
    value: (query: string) => {
      // parse `(min-width: NNNpx)` — suficiente para as queries Tailwind
      const m = /\(min-width:\s*(\d+)px\)/.exec(query);
      const matches = m ? width >= Number(m[1]) : false;
      return {
        matches,
        media: query,
        onchange: null,
        addListener: () => {},
        removeListener: () => {},
        addEventListener: () => {},
        removeEventListener: () => {},
        dispatchEvent: () => false,
      };
    },
  });
  window.dispatchEvent(new Event('resize'));
}

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

type RingSig = {
  ariaLabel: string;
  ariaCurrent: string | null;
  base: { primary: boolean; amber: boolean };
  focus: { primary: boolean; amber: boolean };
};

function signature(container: HTMLElement): RingSig[] {
  return thumbsFrom(container).map((btn) => ({
    ariaLabel: btn.getAttribute('aria-label') ?? '',
    ariaCurrent: btn.getAttribute('aria-current'),
    base: ringsOf(btn),
    focus: focusRingsOf(btn),
  }));
}

function renderAt(
  magazine: Magazine,
  activeIdx: number,
  highlightedItemId: string | null,
) {
  const pages = paginateMagazine(magazine);
  return render(
    <PreviewSidebar
      magazine={magazine}
      pages={pages}
      activeIdx={activeIdx}
      onSelect={() => {}}
      onOpenAll={() => {}}
      highlightedItemId={highlightedItemId}
    />,
  );
}

describe('PreviewSidebar — snapshots de rings por breakpoint', () => {
  beforeEach(() => {
    setViewport(1280);
  });

  afterEach(() => {
    Object.defineProperty(window, 'matchMedia', {
      configurable: true,
      writable: true,
      value: originalMatchMedia,
    });
    Object.defineProperty(window, 'innerWidth', {
      configurable: true,
      writable: true,
      value: originalInnerWidth,
    });
  });

  const scenarios = [
    { label: 'sem highlight, ativa=0', activeIdx: 0, highlight: null as string | null },
    { label: 'com highlight fora da ativa', activeIdx: 0, highlight: 'item-5' },
    { label: 'ativa no meio, sem highlight', activeIdx: 3, highlight: null },
  ];

  for (const sc of scenarios) {
    it(`[${sc.label}] rings idênticos em mobile/sm/md/xl`, () => {
      const magazine = buildMagazine(8);

      const signatures = new Map<string, RingSig[]>();
      for (const bp of BREAKPOINTS) {
        setViewport(bp.width);
        const { container, unmount } = renderAt(magazine, sc.activeIdx, sc.highlight);
        signatures.set(bp.name, signature(container));
        unmount();
      }

      // Todos devem ter o MESMO número de thumbs
      const sizes = new Set(Array.from(signatures.values()).map((s) => s.length));
      expect(sizes.size).toBe(1);

      // E os mesmos tokens de ring por índice
      const reference = signatures.get(BREAKPOINTS[0].name)!;
      for (const bp of BREAKPOINTS.slice(1)) {
        const sig = signatures.get(bp.name)!;
        expect(sig, `divergência de rings em breakpoint ${bp.name}`).toEqual(reference);
      }

      // Invariantes globais (independem do breakpoint)
      for (const item of reference) {
        // colisão base: nunca primary+amber simultâneos
        expect(item.base.primary && item.base.amber).toBe(false);
        // focus-visible: sempre primary, nunca amber
        expect(item.focus.primary).toBe(true);
        expect(item.focus.amber).toBe(false);
      }
    });
  }

  it('snapshot inline (breakpoint mobile) — congelamento explícito da distribuição de rings', () => {
    const magazine = buildMagazine(8);
    setViewport(375);
    const { container } = renderAt(magazine, 0, 'item-5');
    const sig = signature(container).map((s) => ({
      label: s.ariaLabel,
      active: s.ariaCurrent === 'true',
      basePrimary: s.base.primary,
      baseAmber: s.base.amber,
      fvPrimary: s.focus.primary,
      fvAmber: s.focus.amber,
    }));

    // exatamente uma ativa
    expect(sig.filter((s) => s.active).length).toBe(1);
    // exatamente uma em âmbar (highlight de item-5)
    expect(sig.filter((s) => s.baseAmber).length).toBe(1);
    // exatamente uma em primary base (a ativa)
    expect(sig.filter((s) => s.basePrimary).length).toBe(1);
    // TODAS declaram focus-visible:ring-primary
    expect(sig.every((s) => s.fvPrimary && !s.fvAmber)).toBe(true);
  });
});
