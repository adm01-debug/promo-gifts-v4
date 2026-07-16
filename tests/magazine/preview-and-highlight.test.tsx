/**
 * Onda 1 — testes de interação do preview do editor Magazine.
 *
 * Cobre:
 *  - Zoom do PreviewSidebar (Fit → 150% → 200% → 300%) com wrapper width dinâmico
 *  - Botão Fit reseta zoom para 1x
 *  - Botões diminuir/aumentar desabilitam nos extremos
 *  - Highlight bidirecional LayoutStep ↔ miniaturas do preview:
 *    ao passar hover em um item do LayoutStep, a página correspondente ganha
 *    ring âmbar; ao sair, o ring some.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useState } from 'react';
import { PreviewSidebar } from '@/pages/magazine/components/PreviewSidebar';
import { LayoutStep } from '@/pages/magazine/components/steps/LayoutStep';
import { paginateMagazine } from '@/pages/magazine/pagination';
import type { Magazine, MagazineItem } from '@/types/magazine';
import { DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';

// MagazinePageRenderer é pesado (fontes, medidas, ResizeObserver) e não é o
// objeto do teste. Mock leve devolvendo um marcador com o índice da página.
vi.mock('@/pages/magazine/components/MagazinePageRenderer', () => ({
  MagazinePageRenderer: ({ page }: { page: { index: number } }) => (
    <div data-testid={`page-renderer-${page.index}`}>page-{page.index}</div>
  ),
}));

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
    // Template com poucos produtos por página garante multiplas páginas.
    templateId: 'catalog-grid',
    branding: { ...DEFAULT_BRANDING },
    content: { ...DEFAULT_MAGAZINE_CONTENT },
    items,
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

describe('PreviewSidebar — zoom/fit', () => {
  const magazine = buildMagazine(6);
  const pages = paginateMagazine(magazine);

  const renderSidebar = (highlightedItemId?: string | null) =>
    render(
      <PreviewSidebar
        magazine={magazine}
        pages={pages}
        activeIdx={0}
        onSelect={() => {}}
        onOpenAll={() => {}}
        highlightedItemId={highlightedItemId ?? null}
      />,
    );

  const getWrapper = (container: HTMLElement) => {
    // Wrapper do renderer principal recebe `width: N%`.
    const nodes = container.querySelectorAll<HTMLElement>('[style*="width"]');
    const withPct = Array.from(nodes).find((el) => /%/.test(el.style.width));
    return withPct!;
  };

  it('inicia em Fit (100% de largura, botão exibe "Fit")', () => {
    const { container } = renderSidebar();
    expect(screen.getByRole('spinbutton', { name: /zoom do preview/i })).toHaveTextContent('Fit');
    expect(getWrapper(container).style.width).toBe('100%');
  });

  it('aumenta zoom em passos (Fit → 150% → 200% → 300%) e desabilita ao chegar no máximo', async () => {
    const user = userEvent.setup();
    const { container } = renderSidebar();
    const zoomIn = screen.getByRole('button', { name: /aumentar zoom/i });
    const zoomOut = screen.getByRole('button', { name: /diminuir zoom/i });

    // Fit → primeiro passo
    expect(zoomOut).toBeDisabled();
    await user.click(zoomIn);
    expect(getWrapper(container).style.width).toBe('150%');
    expect(screen.getByRole('spinbutton', { name: /zoom do preview/i })).toHaveTextContent('150%');
    expect(zoomOut).not.toBeDisabled();

    await user.click(zoomIn);
    expect(getWrapper(container).style.width).toBe('200%');

    await user.click(zoomIn);
    expect(getWrapper(container).style.width).toBe('300%');
    expect(zoomIn).toBeDisabled();
  });

  it('botão Fit (label da porcentagem) reseta zoom para 100%', async () => {
    const user = userEvent.setup();
    const { container } = renderSidebar();
    const zoomIn = screen.getByRole('button', { name: /aumentar zoom/i });

    await user.click(zoomIn);
    await user.click(zoomIn);
    expect(getWrapper(container).style.width).toBe('200%');

    await user.click(screen.getByRole('spinbutton', { name: /zoom do preview/i }));
    expect(getWrapper(container).style.width).toBe('100%');
    expect(screen.getByRole('spinbutton', { name: /zoom do preview/i })).toHaveTextContent('Fit');
  });

  it('marca a miniatura da página que contém o item destacado com ring âmbar', () => {
    // Escolhe um item que NÃO está na página ativa (idx 0) para conseguir
    // observar o highlight sem colidir com o ring de "página ativa".
    const targetItem = magazine.items[magazine.items.length - 1];
    const targetPageIdx = pages.findIndex((p) => p.items.some((it) => it.id === targetItem.id));
    expect(targetPageIdx).toBeGreaterThan(0);

    const { container } = renderSidebar(targetItem.id);
    const thumbs = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Ir para página"]',
    );
    expect(thumbs.length).toBe(pages.length);
    expect(thumbs[targetPageIdx].className).toMatch(/ring-amber-500/);
    // Página ativa (0) segue com ring primary e SEM ring âmbar.
    expect(thumbs[0].className).toMatch(/ring-primary/);
    expect(thumbs[0].className).not.toMatch(/ring-amber-500/);
  });
});

describe('Highlight bidirecional LayoutStep ↔ PreviewSidebar', () => {
  // Wrapper controlado espelhando o comportamento do MagazineEditorPage.
  function Harness() {
    const magazine = buildMagazine(6);
    const pages = paginateMagazine(magazine);
    const [highlightedItemId, setHighlightedItemId] = useState<string | null>(null);
    return (
      <div>
        <div data-testid="current-highlight">{highlightedItemId ?? ''}</div>
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
          activeIdx={0}
          onSelect={() => {}}
          onOpenAll={() => {}}
          highlightedItemId={highlightedItemId}
        />
      </div>
    );
  }

  it('hover num item do LayoutStep destaca a página correspondente no preview e limpa ao sair', () => {
    const { container } = render(<Harness />);

    const items = screen.getAllByRole('listitem').filter((el) =>
      (el.getAttribute('aria-label') ?? '').startsWith('Produto '),
    ) as HTMLLIElement[];
    expect(items.length).toBe(6);

    // Item 6 (index 5) — última posição do LayoutStep, provavelmente em página > 0.
    const target = items[items.length - 1];
    const targetId = target.getAttribute('data-item-id')!;
    fireEvent.mouseEnter(target);

    // Estado propaga: highlight visível no marcador de teste.
    expect(screen.getByTestId('current-highlight').textContent).toBe(targetId);

    // Ao menos uma miniatura do preview ganha o ring âmbar.
    const thumbs = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Ir para página"]',
    );
    const withAmber = Array.from(thumbs).filter((b) => /ring-amber-500/.test(b.className));
    expect(withAmber.length).toBe(1);

    // Item destacado também expõe aria-current="true".
    expect(target.getAttribute('aria-current')).toBe('true');

    // Mouse leave → highlight limpo em ambos os lados.
    fireEvent.mouseLeave(target);
    const cleared = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Ir para página"]',
    );
    const stillAmber = Array.from(cleared).filter((b) => /ring-amber-500/.test(b.className));
    expect(stillAmber.length).toBe(0);
    expect(screen.getByTestId('current-highlight').textContent).toBe('');
  });

  it('foco por teclado num item do LayoutStep também dispara o highlight (focus/blur)', () => {
    const { container } = render(<Harness />);
    const items = screen.getAllByRole('listitem').filter((el) =>
      (el.getAttribute('aria-label') ?? '').startsWith('Produto '),
    ) as HTMLLIElement[];
    const target = items[3];

    fireEvent.focus(target);
    const thumbs = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Ir para página"]',
    );
    expect(Array.from(thumbs).some((b) => /ring-amber-500/.test(b.className))).toBe(true);

    fireEvent.blur(target);
    const cleared = container.querySelectorAll<HTMLButtonElement>(
      'button[aria-label^="Ir para página"]',
    );
    expect(Array.from(cleared).some((b) => /ring-amber-500/.test(b.className))).toBe(false);
  });
});
