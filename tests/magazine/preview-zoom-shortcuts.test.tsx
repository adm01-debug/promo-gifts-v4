/**
 * Atalhos de teclado do zoom do PreviewSidebar.
 *
 * Contratos:
 *  - `+`/`=` aumenta um passo; `-`/`_` diminui; `0` reseta para Fit.
 *  - Atalhos são ignorados quando o foco está em INPUT/TEXTAREA/SELECT ou
 *    em elemento contentEditable — protege a digitação em outras áreas
 *    do editor (título, form fields, drawer de configuração).
 *  - Ignora quando há Ctrl/Meta/Alt para não colidir com o zoom nativo
 *    do navegador.
 *  - Botões expõem `aria-keyshortcuts` correspondentes.
 *  - Focus-visible dos botões preservado (classe `focus-visible:ring-*`).
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { PreviewSidebar } from '@/pages/magazine/components/PreviewSidebar';
import { paginateMagazine } from '@/pages/magazine/pagination';
import type { Magazine, MagazineItem } from '@/types/magazine';
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

function buildMagazine(count: number): Magazine {
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

function renderSidebar() {
  const magazine = buildMagazine(6);
  const pages = paginateMagazine(magazine);
  const utils = render(
    <div>
      <input data-testid="outside-input" defaultValue="" />
      <PreviewSidebar
        magazine={magazine}
        pages={pages}
        activeIdx={0}
        onSelect={() => {}}
        onOpenAll={() => {}}
        highlightedItemId={null}
      />
    </div>,
  );
  const wrapper = () => {
    const nodes = utils.container.querySelectorAll<HTMLElement>('[style*="width"]');
    return Array.from(nodes).find((el) => /%/.test(el.style.width))!;
  };
  return { ...utils, wrapper };
}

describe('PreviewSidebar — atalhos de teclado do zoom', () => {
  it('"+" e "=" aumentam o zoom em passos; "-" reduz; "0" reseta', () => {
    const { wrapper } = renderSidebar();
    expect(wrapper().style.width).toBe('100%');

    fireEvent.keyDown(window, { key: '+' });
    expect(wrapper().style.width).toBe('150%');

    fireEvent.keyDown(window, { key: '=' });
    expect(wrapper().style.width).toBe('200%');

    fireEvent.keyDown(window, { key: '+' });
    expect(wrapper().style.width).toBe('300%');

    // Passou do teto — permanece em 300%.
    fireEvent.keyDown(window, { key: '+' });
    expect(wrapper().style.width).toBe('300%');

    fireEvent.keyDown(window, { key: '-' });
    expect(wrapper().style.width).toBe('200%');

    fireEvent.keyDown(window, { key: '_' });
    expect(wrapper().style.width).toBe('150%');

    fireEvent.keyDown(window, { key: '0' });
    expect(wrapper().style.width).toBe('100%');
  });

  it('atalhos são ignorados quando o foco está em INPUT (não sequestra digitação)', () => {
    const { wrapper } = renderSidebar();
    const input = screen.getByTestId('outside-input') as HTMLInputElement;
    input.focus();
    expect(document.activeElement).toBe(input);

    fireEvent.keyDown(input, { key: '+', bubbles: true });
    fireEvent.keyDown(input, { key: '-', bubbles: true });
    fireEvent.keyDown(input, { key: '0', bubbles: true });
    expect(wrapper().style.width).toBe('100%');
  });

  it('ignora atalho com Ctrl/Meta/Alt (não interfere com o zoom nativo)', () => {
    const { wrapper } = renderSidebar();
    fireEvent.keyDown(window, { key: '+', ctrlKey: true });
    fireEvent.keyDown(window, { key: '+', metaKey: true });
    fireEvent.keyDown(window, { key: '+', altKey: true });
    expect(wrapper().style.width).toBe('100%');
  });

  it('botões de zoom expõem aria-keyshortcuts e mantêm focus-visible', () => {
    renderSidebar();
    const zoomIn = screen.getByRole('button', { name: /aumentar zoom/i });
    const zoomOut = screen.getByRole('button', { name: /diminuir zoom/i });
    const fit = screen.getByRole('spinbutton', { name: /zoom do preview/i });

    expect(zoomIn.getAttribute('aria-keyshortcuts')).toBe('+');
    expect(zoomOut.getAttribute('aria-keyshortcuts')).toBe('-');
    expect(fit.getAttribute('aria-keyshortcuts')).toBe('0');

    // Focus-visible preservado (classe utilitária ainda presente).
    for (const btn of [zoomIn, zoomOut, fit]) {
      expect(btn.className).toMatch(/focus-visible:ring/);
    }
  });

  it('Tab move o foco entre os controles (não bloqueia navegação do editor)', () => {
    renderSidebar();
    // Sai do estado Fit para que "diminuir zoom" não fique disabled.
    fireEvent.keyDown(window, { key: '+' });

    const zoomOut = screen.getByRole('button', { name: /diminuir zoom/i });
    const fit = screen.getByRole('spinbutton', { name: /zoom do preview/i });
    const zoomIn = screen.getByRole('button', { name: /aumentar zoom/i });

    for (const btn of [zoomOut, fit, zoomIn]) {
      expect(btn).not.toBeDisabled();
      expect(btn.getAttribute('tabIndex')).not.toBe('-1');
      btn.focus();
      expect(document.activeElement).toBe(btn);
    }
  });
});
