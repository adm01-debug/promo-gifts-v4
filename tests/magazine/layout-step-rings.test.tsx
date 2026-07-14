/**
 * LayoutStep — contrato de rings.
 *
 * Valida (via helpers SSOT `tests/utils/tailwindRings.ts`) que:
 *  1. O <li> destacado (`highlightedItemId`) ganha `ring-primary` na base
 *     (com opacidade tolerada: `ring-primary/40`) e NÃO ganha ring âmbar.
 *  2. Itens NÃO destacados não pintam nenhum ring na base.
 *  3. O drag handle (botão com aria-label "Arrastar…") tem
 *     `focus-visible:ring-primary` e nunca `focus-visible:ring-amber-*`,
 *     garantindo que o realce por teclado nunca colida com um highlight
 *     âmbar hipotético reutilizado em outros contextos.
 *
 * Cobertura complementar aos testes de PreviewSidebar: aqui garantimos
 * paridade de comportamento no LADO ESQUERDO da tela (LayoutStep) que
 * também participa do highlight bidirecional LayoutStep ↔ Preview.
 */

import { describe, it, expect } from 'vitest';
import { render } from '@testing-library/react';
import { LayoutStep } from '@/pages/magazine/components/steps/LayoutStep';
import type { Magazine, MagazineItem } from '@/types/magazine';
import { DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';
import { ringsOf, focusRingsOf } from '../utils/tailwindRings';

function makeItem(idx: number, name: string): MagazineItem {
  return {
    id: `item-${idx}`,
    productId: `prod-${idx}`,
    variantColorName: null,
    position: idx,
    pageNumber: null,
    overrides: {},
    productSnapshot: {
      id: `prod-${idx}`,
      name,
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

function buildMagazine(count: number): Magazine {
  const items = Array.from({ length: count }, (_, i) => makeItem(i, `Produto ${i + 1}`));
  return {
    id: 'mag-1',
    ownerId: 'user-1',
    organizationId: null,
    title: 'Revista teste',
    subtitle: '',
    templateId: 'catalog-grid',
    branding: { ...DEFAULT_BRANDING },
    content: { ...DEFAULT_MAGAZINE_CONTENT },
    items,
    pageOrder: null,
    status: 'draft',
    publicToken: null,
    pdfUrl: null,
    publishedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function rowsFrom(container: HTMLElement): HTMLElement[] {
  return Array.from(container.querySelectorAll<HTMLElement>('li[data-item-id]'));
}

function dragHandlesFrom(container: HTMLElement): HTMLButtonElement[] {
  return Array.from(
    container.querySelectorAll<HTMLButtonElement>('button[aria-label^="Arrastar"]'),
  );
}

describe('LayoutStep — rings via helper SSOT', () => {
  const magazine = buildMagazine(4);

  const renderLayout = (highlightedItemId: string | null) =>
    render(
      <LayoutStep
        magazine={magazine}
        onReorder={() => {}}
        onRemove={() => {}}
        onItemHover={() => {}}
        highlightedItemId={highlightedItemId}
      />,
    );

  it('não pinta rings quando nenhum item está destacado', () => {
    const { container } = renderLayout(null);
    const rows = rowsFrom(container);
    expect(rows.length).toBe(4);
    for (const row of rows) {
      const r = ringsOf(row);
      expect(r.primary).toBe(false);
      expect(r.amber).toBe(false);
    }
  });

  it('pinta ring-primary exclusivamente no <li> destacado', () => {
    const target = magazine.items[2]!.id;
    const { container } = renderLayout(target);
    const rows = rowsFrom(container);

    const highlighted = rows.find((r) => r.getAttribute('data-item-id') === target)!;
    const others = rows.filter((r) => r.getAttribute('data-item-id') !== target);

    const active = ringsOf(highlighted);
    expect(active.primary).toBe(true);
    expect(active.amber).toBe(false);

    for (const row of others) {
      const r = ringsOf(row);
      expect(r.primary).toBe(false);
      expect(r.amber).toBe(false);
    }
  });

  it('drag handle tem focus-visible:ring-primary sem colidir com âmbar', () => {
    const { container } = renderLayout(magazine.items[0]!.id);
    const handles = dragHandlesFrom(container);
    expect(handles.length).toBe(4);
    for (const handle of handles) {
      const fv = focusRingsOf(handle);
      expect(fv.primary).toBe(true);
      expect(fv.amber).toBe(false);
      // Base do handle não deve pintar rings — o ring só aparece com foco.
      const base = ringsOf(handle);
      expect(base.primary).toBe(false);
      expect(base.amber).toBe(false);
    }
  });

  it('propriedade: em qualquer highlightedItemId válido, no máximo um <li> ganha ring-primary', () => {
    for (const item of magazine.items) {
      const { container, unmount } = renderLayout(item.id);
      const rows = rowsFrom(container);
      const primaries = rows.filter((r) => ringsOf(r).primary);
      expect(primaries.length).toBe(1);
      expect(primaries[0]!.getAttribute('data-item-id')).toBe(item.id);
      unmount();
    }
  });
});
