/**
 * Fábricas e utilitários compartilhados pelos testes da suíte magazine.
 *
 * Consolida em um único ponto o que estava duplicado em 6 arquivos de teste:
 *  - `makeItem` / `buildMagazine` — dados fictícios canônicos
 *  - `renderPreview` — render helper com mocks default sensatos
 *  - `ringsOf` — leitura de classes-base ignorando variantes (`hover:`, etc.)
 *  - `getThumbs` / `getThumbOptions` — seletores por role
 *
 * Regra: qualquer novo teste da suíte deve consumir estes helpers em vez de
 * redefinir os mocks. Facilita a evolução do domínio (ex.: novo campo no
 * `productSnapshot`) sem tocar em N arquivos.
 */

import { render } from '@testing-library/react';
import type { RenderOptions } from '@testing-library/react';
import type { Magazine, MagazineItem } from '@/types/magazine';
import { DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';
import { PreviewSidebar } from '@/pages/magazine/components/PreviewSidebar';
import { paginateMagazine } from '@/pages/magazine/pagination';

export function makeItem(idx: number, name?: string): MagazineItem {
  return {
    id: `item-${idx}`,
    productId: `prod-${idx}`,
    variantColorName: null,
    position: idx,
    pageNumber: null,
    overrides: {},
    productSnapshot: {
      id: `prod-${idx}`,
      name: name ?? `Produto ${idx + 1}`,
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

export function buildMagazine(count = 6, overrides?: Partial<Magazine>): Magazine {
  return {
    id: 'mag-1',
    ownerId: 'user-1',
    organizationId: null,
    title: 'Revista teste',
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

interface RenderPreviewOptions extends RenderOptions {
  count?: number;
  activeIdx?: number;
  highlightedItemId?: string | null;
  variant?: 'sidebar' | 'drawer';
  onSelect?: (idx: number) => void;
  onOpenAll?: () => void;
}

export function renderPreview(opts: RenderPreviewOptions = {}) {
  const magazine = buildMagazine(opts.count ?? 6);
  const pages = paginateMagazine(magazine);
  const utils = render(
    <PreviewSidebar
      magazine={magazine}
      pages={pages}
      activeIdx={opts.activeIdx ?? 0}
      onSelect={opts.onSelect ?? (() => {})}
      onOpenAll={opts.onOpenAll ?? (() => {})}
      highlightedItemId={opts.highlightedItemId ?? null}
      variant={opts.variant ?? 'sidebar'}
    />,
    opts,
  );
  return { magazine, pages, ...utils };
}

/**
 * Lê classes-base de um elemento, ignorando variantes (`hover:`, `focus-visible:`,
 * `motion-safe:`, `sm:`, etc.). Necessário porque `focus-visible:ring-primary`
 * está presente em todo botão e provocaria falso-positivo se detectássemos
 * `ring-primary` com regex ingênuo.
 */
export function ringsOf(el: HTMLElement): { primary: boolean; amber: boolean } {
  const base = el.className.split(/\s+/).filter((t) => !t.includes(':'));
  return {
    primary: base.includes('ring-primary'),
    amber: base.includes('ring-amber-500'),
  };
}
