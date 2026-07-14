/**
 * Meta 10/10 — Melhorias combinadas #1, #2, #3.
 *
 * #1 Roving tabindex e navegação por setas nas thumbnails:
 *   - Container `role="listbox"` com `aria-activedescendant`.
 *   - Cada thumb `role="option"` + `aria-selected` + tabIndex -1 exceto na
 *     "focada" (default = ativa).
 *   - ←/→ passo de 1; ↑/↓ passo de N colunas; Home/End nas pontas; Enter/Space
 *     seleciona; foco DOM segue.
 *
 * #2 Live region para leitor de tela:
 *   - Um único elemento `role="status" aria-live="polite" aria-atomic="true"`
 *     ("preview-live-region"), texto derivado de {activeIdx, pageLabel, zoom}.
 *   - Empty state também é `role="status"`.
 *
 * #3 Motion preference respeitada nas thumbs:
 *   - Classes de transição usam `motion-safe:transition` (Tailwind ignora sob
 *     `prefers-reduced-motion: reduce`). Verificado como contrato de classe.
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

function renderSidebar(props?: { activeIdx?: number; onSelect?: (idx: number) => void }) {
  const magazine = buildMagazine(8);
  const pages = paginateMagazine(magazine);
  return {
    pages,
    ...render(
      <PreviewSidebar
        magazine={magazine}
        pages={pages}
        activeIdx={props?.activeIdx ?? 0}
        onSelect={props?.onSelect ?? (() => {})}
        onOpenAll={() => {}}
        highlightedItemId={null}
      />,
    ),
  };
}

function thumbs(): HTMLButtonElement[] {
  return screen.getAllByRole('option') as HTMLButtonElement[];
}

describe('Roving tabindex + navegação por setas nas thumbnails', () => {
  it('grid é role="listbox" com aria-activedescendant apontando para a thumb ativa', () => {
    renderSidebar({ activeIdx: 2 });
    const list = screen.getByRole('listbox', { name: /miniaturas de páginas/i });
    expect(list.getAttribute('aria-activedescendant')).toBe('magazine-thumb-2');
  });

  it('exatamente uma thumb tem tabIndex=0 (a focada); demais têm -1', () => {
    renderSidebar({ activeIdx: 3 });
    const inTab = thumbs().filter((t) => t.tabIndex === 0);
    const outTab = thumbs().filter((t) => t.tabIndex === -1);
    expect(inTab).toHaveLength(1);
    expect(outTab.length).toBe(thumbs().length - 1);
    expect(inTab[0]!.id).toBe('magazine-thumb-3');
  });

  it('cada thumb tem role="option" e aria-selected reflete a ativa', () => {
    renderSidebar({ activeIdx: 1 });
    thumbs().forEach((t, idx) => {
      expect(t.getAttribute('role')).toBe('option');
      expect(t.getAttribute('aria-selected')).toBe(idx === 1 ? 'true' : 'false');
    });
  });

  it('ArrowRight / ArrowLeft movem foco por 1', () => {
    renderSidebar({ activeIdx: 0 });
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(list.getAttribute('aria-activedescendant')).toBe('magazine-thumb-1');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(list.getAttribute('aria-activedescendant')).toBe('magazine-thumb-2');
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(list.getAttribute('aria-activedescendant')).toBe('magazine-thumb-1');
  });

  it('ArrowDown / ArrowUp movem foco por N colunas (2 em telas < sm)', () => {
    // jsdom por padrão: matchMedia('(min-width: 640px)').matches = false → 2 cols.
    renderSidebar({ activeIdx: 0 });
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowDown' });
    expect(list.getAttribute('aria-activedescendant')).toBe('magazine-thumb-2');
    fireEvent.keyDown(list, { key: 'ArrowUp' });
    expect(list.getAttribute('aria-activedescendant')).toBe('magazine-thumb-0');
  });

  it('Home e End vão às pontas; clamping nos extremos', () => {
    const { pages } = renderSidebar({ activeIdx: 3 });
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'Home' });
    expect(list.getAttribute('aria-activedescendant')).toBe('magazine-thumb-0');

    // ArrowLeft na thumb 0 permanece em 0.
    fireEvent.keyDown(list, { key: 'ArrowLeft' });
    expect(list.getAttribute('aria-activedescendant')).toBe('magazine-thumb-0');

    fireEvent.keyDown(list, { key: 'End' });
    expect(list.getAttribute('aria-activedescendant')).toBe(`magazine-thumb-${pages.length - 1}`);

    // ArrowRight na última permanece.
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(list.getAttribute('aria-activedescendant')).toBe(`magazine-thumb-${pages.length - 1}`);
  });

  it('Enter e Space selecionam a thumb focada (chamam onSelect)', () => {
    const onSelect = vi.fn();
    renderSidebar({ activeIdx: 0, onSelect });
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    fireEvent.keyDown(list, { key: 'Enter' });
    expect(onSelect).toHaveBeenLastCalledWith(2);

    fireEvent.keyDown(list, { key: 'ArrowRight' });
    fireEvent.keyDown(list, { key: ' ' });
    expect(onSelect).toHaveBeenLastCalledWith(3);
  });

  it('não sequestra teclas fora do listbox (ex.: Tab, letras)', () => {
    renderSidebar({ activeIdx: 0 });
    const list = screen.getByRole('listbox');
    const e = fireEvent.keyDown(list, { key: 'Tab' });
    // fireEvent devolve true quando o handler NÃO chamou preventDefault.
    expect(e).toBe(true);
    fireEvent.keyDown(list, { key: 'a' });
    expect(list.getAttribute('aria-activedescendant')).toBe('magazine-thumb-0');
  });
});

describe('Live region — SR anuncia página ativa + zoom (PT-BR)', () => {
  it('publica página ativa e zoom Fit no estado inicial', () => {
    renderSidebar({ activeIdx: 0 });
    const live = screen.getByTestId('preview-live-region');
    expect(live.getAttribute('role')).toBe('status');
    expect(live.getAttribute('aria-live')).toBe('polite');
    expect(live.getAttribute('aria-atomic')).toBe('true');
    expect(live.textContent).toMatch(/^Página 1 de \d+:/);
    expect(live.textContent).toMatch(/Zoom Fit\.$/);
  });

  it('atualiza a mensagem quando o zoom muda via atalho', () => {
    renderSidebar({ activeIdx: 0 });
    const live = screen.getByTestId('preview-live-region');
    fireEvent.keyDown(window, { key: '+' });
    expect(live.textContent).toMatch(/Zoom 150%\.$/);
    fireEvent.keyDown(window, { key: '+' });
    expect(live.textContent).toMatch(/Zoom 200%\.$/);
    fireEvent.keyDown(window, { key: '0' });
    expect(live.textContent).toMatch(/Zoom Fit\.$/);
  });

  it('reflete a página ativa recebida via prop', () => {
    renderSidebar({ activeIdx: 3 });
    const live = screen.getByTestId('preview-live-region');
    expect(live.textContent).toMatch(/^Página 4 de \d+:/);
  });

  it('live region é visualmente oculto (sr-only) mas presente no DOM', () => {
    renderSidebar();
    const live = screen.getByTestId('preview-live-region');
    expect(live.className).toMatch(/\bsr-only\b/);
  });
});

describe('prefers-reduced-motion — thumbs usam motion-safe', () => {
  it('classes de transição das thumbs são prefixadas com motion-safe:', () => {
    renderSidebar();
    for (const t of thumbs()) {
      // Tailwind: motion-safe:transition só aplica quando o usuário NÃO
      // pediu reduced motion. A ausência do `transition` cru é o contrato.
      const tokens = t.className.split(/\s+/);
      expect(tokens).not.toContain('transition');
      expect(tokens.some((c) => c.startsWith('motion-safe:transition'))).toBe(true);
    }
  });
});
