/**
 * Acessibilidade dos controles de zoom do PreviewSidebar.
 *
 * Contratos verificados:
 *  - O trio de controles é agrupado com `role="group"` e `aria-label`.
 *  - Cada botão tem nome acessível único e `aria-keyshortcuts`.
 *  - Ícones internos são `aria-hidden` (não poluem o accessible name).
 *  - O indicador de porcentagem funciona como `role="spinbutton"` com
 *    `aria-valuemin`, `aria-valuemax`, `aria-valuenow` e `aria-valuetext`
 *    atualizados a cada mudança de zoom.
 *  - `aria-controls` liga os botões +/- ao indicador (mesmo `id`).
 *  - No estado limite, o botão fica `disabled` e continua exposto.
 *  - `axe-core` reporta zero violações no grupo.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { axe } from 'jest-axe';
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

function buildMagazine(count = 6): Magazine {
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
    viewCount: 0,
    publishedAt: null,
    archivedAt: null,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function renderSidebar() {
  const magazine = buildMagazine();
  const pages = paginateMagazine(magazine);
  return render(
    <PreviewSidebar
      magazine={magazine}
      pages={pages}
      activeIdx={0}
      onSelect={() => {}}
      onOpenAll={() => {}}
      highlightedItemId={null}
    />,
  );
}

describe('PreviewSidebar — a11y dos controles de zoom', () => {
  it('agrupa os controles com role="group" e aria-label', () => {
    renderSidebar();
    const group = screen.getByRole('group', { name: /controles de zoom do preview/i });
    expect(group).toBeInTheDocument();
    // O grupo contém os três controles principais.
    expect(group.querySelectorAll('button').length).toBeGreaterThanOrEqual(3);
  });

  it('cada botão tem nome acessível único e aria-keyshortcuts', () => {
    renderSidebar();
    const zoomOut = screen.getByRole('button', { name: /diminuir zoom/i });
    const zoomIn = screen.getByRole('button', { name: /aumentar zoom/i });
    const spin = screen.getByRole('spinbutton');

    expect(zoomOut.getAttribute('aria-keyshortcuts')).toBe('-');
    expect(zoomIn.getAttribute('aria-keyshortcuts')).toBe('+');
    expect(spin.getAttribute('aria-keyshortcuts')).toBe('0');

    // Ícones dentro dos botões devem ser aria-hidden.
    for (const btn of [zoomOut, zoomIn]) {
      const svg = btn.querySelector('svg');
      expect(svg).not.toBeNull();
      expect(svg!.getAttribute('aria-hidden')).toBe('true');
    }
  });

  it('spinbutton expõe aria-valuemin/max/now/text corretos no estado inicial', () => {
    renderSidebar();
    const spin = screen.getByRole('spinbutton');
    expect(spin.getAttribute('aria-valuemin')).toBe('100');
    expect(spin.getAttribute('aria-valuemax')).toBe('300');
    expect(spin.getAttribute('aria-valuenow')).toBe('100');
    expect(spin.getAttribute('aria-valuetext')).toBe('Ajustar à largura');
  });

  it('aria-valuenow/text acompanham as mudanças de zoom (+ → +, − e reset)', async () => {
    const user = userEvent.setup();
    renderSidebar();
    const spin = screen.getByRole('spinbutton');
    const zoomIn = screen.getByRole('button', { name: /aumentar zoom/i });
    const zoomOut = screen.getByRole('button', { name: /diminuir zoom/i });

    await user.click(zoomIn);
    expect(spin.getAttribute('aria-valuenow')).toBe('150');
    expect(spin.getAttribute('aria-valuetext')).toBe('150 por cento');

    await user.click(zoomIn);
    expect(spin.getAttribute('aria-valuenow')).toBe('200');

    await user.click(zoomIn);
    expect(spin.getAttribute('aria-valuenow')).toBe('300');
    expect(spin.getAttribute('aria-valuetext')).toBe('300 por cento');

    await user.click(zoomOut);
    expect(spin.getAttribute('aria-valuenow')).toBe('200');

    // Atalho de teclado "0" também sincroniza o spinbutton.
    fireEvent.keyDown(window, { key: '0' });
    expect(spin.getAttribute('aria-valuenow')).toBe('100');
    expect(spin.getAttribute('aria-valuetext')).toBe('Ajustar à largura');
  });

  it('aria-controls dos botões +/− aponta para o id do spinbutton', () => {
    renderSidebar();
    const spin = screen.getByRole('spinbutton');
    const id = spin.getAttribute('id');
    expect(id).toBeTruthy();

    const zoomOut = screen.getByRole('button', { name: /diminuir zoom/i });
    const zoomIn = screen.getByRole('button', { name: /aumentar zoom/i });
    expect(zoomOut.getAttribute('aria-controls')).toBe(id);
    expect(zoomIn.getAttribute('aria-controls')).toBe(id);
  });

  it('nos extremos, os botões ficam disabled mas seguem expostos ao AT', async () => {
    const user = userEvent.setup();
    renderSidebar();
    const zoomIn = screen.getByRole('button', { name: /aumentar zoom/i });
    const zoomOut = screen.getByRole('button', { name: /diminuir zoom/i });

    // Fit → diminuir está disabled, aumentar habilitado.
    expect(zoomOut).toBeDisabled();
    expect(zoomOut).toHaveAccessibleName(/diminuir zoom/i);
    expect(zoomIn).not.toBeDisabled();

    // Vai ao teto → aumentar fica disabled.
    await user.click(zoomIn);
    await user.click(zoomIn);
    await user.click(zoomIn);
    expect(zoomIn).toBeDisabled();
    expect(zoomIn).toHaveAccessibleName(/aumentar zoom/i);
  });

  it('axe-core não reporta violações no bloco de controles de zoom', async () => {
    const { container } = renderSidebar();
    const group = container.querySelector('[role="group"][aria-label*="zoom" i]');
    expect(group).not.toBeNull();
    const results = await axe(group as Element);
    expect(results.violations).toEqual([]);
  });
});
