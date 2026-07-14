/**
 * Onda 3 — auditoria automatizada axe-core do editor Magazine (WCAG 2.1 AA).
 *
 * Foco: `LayoutStep` (DnD + sumário), etapa onde a interação por teclado
 * é mais complexa. Valida:
 *  - Estrutura semântica (list/listitem)
 *  - `aria-label` dinâmico com nome do produto nos botões de arrastar/remover
 *  - `aria-current` no item destacado
 *  - Imagens com alt significativo
 *  - Ausência de violações axe-core (button-name, aria-*, image-alt, label,
 *    nested-interactive, focus-order-semantics)
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { axe } from './axe-helper';
import { LayoutStep } from '@/pages/magazine/components/steps/LayoutStep';
import type { Magazine, MagazineItem } from '@/types/magazine';
import { DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';

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
      shortDescription: 'Produto de amostra',
      description: null,
      price: 49.9 + idx * 10,
      image_url: 'https://example.com/img.png',
      images: [],
      colors: [],
      materials: [],
      hasPersonalization: false,
      category_id: null,
      category_name: null,
    },
  };
}

function buildMagazine(items: MagazineItem[]): Magazine {
  return {
    id: 'mag-1',
    ownerId: 'user-1',
    organizationId: null,
    title: 'Revista de teste',
    subtitle: 'Auditoria de acessibilidade',
    templateId: 'editorial-vogue',
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

describe('Onda 3 — Magazine editor a11y (WCAG 2.1 AA)', () => {
  const items = [
    makeItem(0, 'Aurora Notebook'),
    makeItem(1, 'Copo Térmico Signature'),
    makeItem(2, 'Ecobag Premium'),
  ];
  const magazine = buildMagazine(items);

  it('não viola regras WCAG na etapa LayoutStep (DnD + sumário)', async () => {
    const { container } = render(
      <LayoutStep
        magazine={magazine}
        onReorder={() => {}}
        onRemove={() => {}}
      />,
    );
    const results = await axe(container);
    expect(results).toHaveNoViolations();
  });

  it('expõe aria-label dinâmico com nome do produto nos botões de arrastar e remover', () => {
    render(
      <LayoutStep
        magazine={magazine}
        onReorder={() => {}}
        onRemove={() => {}}
      />,
    );
    expect(
      screen.getByRole('button', { name: /arrastar para reordenar aurora notebook/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /remover aurora notebook da revista/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: /arrastar para reordenar copo térmico signature/i }),
    ).toBeInTheDocument();
  });

  it('marca item destacado com aria-current="true" e mantém demais sem aria-current', () => {
    const { container } = render(
      <LayoutStep
        magazine={magazine}
        onReorder={() => {}}
        onRemove={() => {}}
        highlightedItemId={items[1].id}
      />,
    );
    const highlighted = container.querySelectorAll('[aria-current="true"]');
    expect(highlighted).toHaveLength(1);
    expect(highlighted[0].getAttribute('aria-label')).toMatch(/copo térmico signature/i);
  });

  it('imagens dos produtos usam alt significativo (não vazio, não decorativo)', () => {
    render(
      <LayoutStep
        magazine={magazine}
        onReorder={() => {}}
        onRemove={() => {}}
      />,
    );
    const imgs = screen.getAllByRole('img');
    expect(imgs.length).toBeGreaterThanOrEqual(3);
    for (const img of imgs) {
      const alt = img.getAttribute('alt') ?? '';
      expect(alt.length).toBeGreaterThan(0);
    }
    expect(screen.getByAltText('Aurora Notebook')).toBeInTheDocument();
  });

  it('usa estrutura semântica de lista (ul/li) na ordenação e no sumário', () => {
    const { container } = render(
      <LayoutStep
        magazine={magazine}
        onReorder={() => {}}
        onRemove={() => {}}
      />,
    );
    const lists = container.querySelectorAll('ul');
    // 1 lista para ordenação de produtos + 1 lista para o sumário de páginas.
    expect(lists.length).toBeGreaterThanOrEqual(2);
    const productList = Array.from(lists).find(
      (ul) => ul.getAttribute('aria-labelledby') === 'layout-step-title',
    );
    expect(productList).toBeTruthy();
    expect(productList!.querySelectorAll('li').length).toBe(items.length);
  });
});
