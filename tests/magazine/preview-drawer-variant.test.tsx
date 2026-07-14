/**
 * Meta 10/10 — cobertura da variante `drawer` do PreviewSidebar.
 *
 * A variante `drawer` é o que é montado dentro do `<SheetContent>` em telas
 * < xl. Os invariantes de acessibilidade e de rings devem valer também lá,
 * porém alguns wrappers estruturais (sticky, borda, padding) mudam para se
 * ajustar ao painel deslizante. Este arquivo garante:
 *
 *  - Preview renderiza com role/aria corretos idênticos ao sidebar.
 *  - Spinbutton de zoom e atalhos `+/-/0` continuam funcionando.
 *  - Roving tabindex + Arrow/Home/End funcionam na drawer.
 *  - Ring collision invariant preserved.
 *  - Live region presente e reativa.
 *  - Card externo perde `sticky top-4` e ganha `border-0 shadow-none` (contrato
 *    visual: preencher o painel sem descolar do header).
 */

import { describe, it, expect, vi } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { renderPreview, ringsOf } from './helpers';

vi.mock('@/pages/magazine/components/MagazinePageRenderer', () => ({
  MagazinePageRenderer: ({ page }: { page: { index: number } }) => (
    <div data-testid={`page-renderer-${page.index}`}>page-{page.index}</div>
  ),
}));

describe('PreviewSidebar variant="drawer" — paridade de acessibilidade', () => {
  it('grupo de zoom, spinbutton e listbox estão presentes', () => {
    renderPreview({ variant: 'drawer' });
    expect(
      screen.getByRole('group', { name: /controles de zoom do preview/i }),
    ).toBeInTheDocument();
    expect(screen.getByRole('spinbutton', { name: /zoom do preview/i })).toBeInTheDocument();
    expect(screen.getByRole('listbox', { name: /miniaturas de páginas/i })).toBeInTheDocument();
  });

  it('atalhos globais de zoom continuam funcionando na drawer', () => {
    renderPreview({ variant: 'drawer' });
    const spin = screen.getByRole('spinbutton');
    fireEvent.keyDown(window, { key: '+' });
    expect(spin.getAttribute('aria-valuenow')).toBe('150');
    fireEvent.keyDown(window, { key: '0' });
    expect(spin.getAttribute('aria-valuenow')).toBe('100');
  });

  it('roving tabindex e Arrow/Home/End funcionam na drawer', () => {
    renderPreview({ variant: 'drawer', activeIdx: 0, count: 6 });
    const list = screen.getByRole('listbox');
    fireEvent.keyDown(list, { key: 'ArrowRight' });
    expect(list.getAttribute('aria-activedescendant')).toBe('magazine-thumb-1');
    fireEvent.keyDown(list, { key: 'End' });
    const opts = screen.getAllByRole('option');
    expect(list.getAttribute('aria-activedescendant')).toBe(
      `magazine-thumb-${opts.length - 1}`,
    );
    fireEvent.keyDown(list, { key: 'Home' });
    expect(list.getAttribute('aria-activedescendant')).toBe('magazine-thumb-0');
  });

  it('invariante de rings preservado na drawer (todas as combinações)', () => {
    const { pages, magazine } = renderPreview({ variant: 'drawer' });
    const activePageIdx = pages.findIndex((p) => p.items.length > 0);
    const outsideItem = magazine.items.find(
      (it) => pages.findIndex((p) => p.items.some((x) => x.id === it.id)) !== activePageIdx,
    );

    // sem highlight
    const thumbs1 = screen.getAllByRole('option');
    thumbs1.forEach((b, i) => {
      const r = ringsOf(b);
      expect(r.primary && r.amber).toBe(false);
      if (i === 0) expect(r.primary).toBe(true);
    });

    // com highlight fora da ativa — precisa haver <=1 âmbar e nunca colisão
    if (outsideItem) {
      const { unmount } = renderPreview({
        variant: 'drawer',
        highlightedItemId: outsideItem.id,
      });
      const thumbs2 = screen.getAllByRole('option');
      const amberCount = thumbs2.filter((b) => ringsOf(b).amber).length;
      expect(amberCount).toBeLessThanOrEqual(1);
      thumbs2.forEach((b) => {
        const r = ringsOf(b);
        expect(r.primary && r.amber).toBe(false);
      });
      unmount();
    }
  });

  it('live region existe, é sr-only e reflete a página ativa', () => {
    renderPreview({ variant: 'drawer', activeIdx: 2 });
    const live = screen.getByTestId('preview-live-region');
    expect(live.className).toMatch(/\bsr-only\b/);
    expect(live.textContent).toMatch(/^Página 3 de/);
  });

  it('Card externo perde sticky/borda/shadow (contrato visual da drawer)', () => {
    const { container } = renderPreview({ variant: 'drawer' });
    // O Card é o primeiro filho do container.
    const card = container.firstElementChild as HTMLElement;
    const tokens = card.className.split(/\s+/);
    expect(tokens).not.toContain('sticky');
    expect(tokens).toContain('border-0');
    expect(tokens).toContain('shadow-none');
  });

  it('sidebar (default) mantém sticky (regressão da paridade inversa)', () => {
    const { container } = renderPreview({ variant: 'sidebar' });
    const card = container.firstElementChild as HTMLElement;
    const tokens = card.className.split(/\s+/);
    expect(tokens).toContain('sticky');
    expect(tokens).not.toContain('border-0');
  });
});
