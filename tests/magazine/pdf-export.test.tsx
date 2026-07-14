/**
 * Testes de exportação de PDF do módulo Magazine.
 *
 * O "PDF" é gerado abrindo `/magazine/:id/print` em nova aba e usando o
 * diálogo de impressão do navegador. Portanto validamos duas camadas:
 *
 * 1. `PreviewSidebar` — o botão "Ver todas" dispara `onOpenAll` (handler
 *    que abre a rota de impressão) e esse disparo é INDEPENDENTE do estado
 *    de zoom/fit e do item destacado (highlight). Zoom e highlight são
 *    ferramentas de inspeção do editor e NÃO devem vazar para o PDF.
 *
 * 2. `MagazinePrintPage` — renderiza uma página do renderer por página
 *    paginada, invoca `window.print()` no botão "Salvar como PDF" e não
 *    expõe controles de zoom/highlight na página impressa.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { PreviewSidebar } from '@/pages/magazine/components/PreviewSidebar';
import { paginateMagazine } from '@/pages/magazine/pagination';
import MagazinePrintPage from '@/pages/magazine/MagazinePrintPage';
import type { Magazine, MagazineItem } from '@/types/magazine';
import { DEFAULT_BRANDING, DEFAULT_MAGAZINE_CONTENT } from '@/types/magazine';

// Renderer pesado: mock leve devolvendo marcador com índice de página.
vi.mock('@/pages/magazine/components/MagazinePageRenderer', () => ({
  MagazinePageRenderer: ({ page }: { page: { index: number } }) => (
    <div data-testid={`page-renderer-${page.index}`}>page-{page.index}</div>
  ),
}));

// Mock do serviço para MagazinePrintPage.
const getMock = vi.fn();
vi.mock('@/services/magazineService', () => ({
  magazineService: {
    get: (id: string) => getMock(id),
    getPublicByToken: vi.fn(),
  },
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

describe('PreviewSidebar — export PDF ("Ver todas") independe de zoom/highlight', () => {
  const magazine = buildMagazine(6);
  const pages = paginateMagazine(magazine);

  it('clique em "Ver todas" chama onOpenAll uma vez sem argumentos', async () => {
    const user = userEvent.setup();
    const onOpenAll = vi.fn();
    render(
      <PreviewSidebar
        magazine={magazine}
        pages={pages}
        activeIdx={0}
        onSelect={() => {}}
        onOpenAll={onOpenAll}
        highlightedItemId={null}
      />,
    );
    await user.click(screen.getByRole('button', { name: /abrir todas as páginas em nova aba/i }));
    expect(onOpenAll).toHaveBeenCalledTimes(1);
  });

  it('zoom aplicado (300%) não bloqueia nem altera o disparo de export', async () => {
    const user = userEvent.setup();
    const onOpenAll = vi.fn();
    render(
      <PreviewSidebar
        magazine={magazine}
        pages={pages}
        activeIdx={0}
        onSelect={() => {}}
        onOpenAll={onOpenAll}
        highlightedItemId={null}
      />,
    );

    // Sobe zoom até o máximo (Fit → 150 → 200 → 300).
    const zoomIn = screen.getByRole('button', { name: /aumentar zoom/i });
    await user.click(zoomIn);
    await user.click(zoomIn);
    await user.click(zoomIn);
    expect(zoomIn).toBeDisabled();

    await user.click(screen.getByRole('button', { name: /abrir todas as páginas em nova aba/i }));
    expect(onOpenAll).toHaveBeenCalledTimes(1);
  });

  it('item destacado (highlight) não é enviado ao handler de export', async () => {
    const user = userEvent.setup();
    const onOpenAll = vi.fn();
    const target = magazine.items[magazine.items.length - 1];
    render(
      <PreviewSidebar
        magazine={magazine}
        pages={pages}
        activeIdx={0}
        onSelect={() => {}}
        onOpenAll={onOpenAll}
        highlightedItemId={target.id}
      />,
    );

    await user.click(screen.getByRole('button', { name: /abrir todas as páginas em nova aba/i }));

    expect(onOpenAll).toHaveBeenCalledTimes(1);
    // Nenhum argumento — o handler abre a rota /print sem query de highlight.
    expect(onOpenAll.mock.calls[0]).toEqual([]);
  });
});

describe('MagazinePrintPage — export renderiza todas as páginas e ignora estado do preview', () => {
  beforeEach(() => {
    getMock.mockReset();
  });

  const renderPrint = (id = 'mag-1') =>
    render(
      <MemoryRouter initialEntries={[`/magazine/${id}/print`]}>
        <Routes>
          <Route path="/magazine/:id/print" element={<MagazinePrintPage />} />
        </Routes>
      </MemoryRouter>,
    );

  it('renderiza uma instância do renderer por página paginada', async () => {
    const magazine = buildMagazine(6);
    const pages = paginateMagazine(magazine);
    getMock.mockResolvedValueOnce(magazine);

    renderPrint();

    await waitFor(() => {
      expect(screen.getByTestId(`page-renderer-${pages[0].index}`)).toBeInTheDocument();
    });
    for (const p of pages) {
      expect(screen.getByTestId(`page-renderer-${p.index}`)).toBeInTheDocument();
    }
    expect(screen.getAllByTestId(/^page-renderer-/).length).toBe(pages.length);
  });

  it('não expõe controles de zoom/fit nem highlight na página de impressão', async () => {
    const magazine = buildMagazine(4);
    getMock.mockResolvedValueOnce(magazine);

    renderPrint();

    await waitFor(() =>
      expect(screen.getByTestId('magazine-print-btn')).toBeInTheDocument(),
    );

    // Nenhum controle de zoom ou "Ver todas" na rota de impressão.
    expect(screen.queryByRole('button', { name: /aumentar zoom/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /diminuir zoom/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /ajustar à largura/i })).toBeNull();
    expect(screen.queryByRole('button', { name: /abrir todas as páginas em nova aba/i })).toBeNull();
    // Sem ring âmbar (feature de highlight só existe no preview do editor).
    expect(document.querySelector('[class*="ring-amber-500"]')).toBeNull();
  });

  it('botão "Salvar como PDF" invoca window.print()', async () => {
    const magazine = buildMagazine(3);
    getMock.mockResolvedValueOnce(magazine);
    const printSpy = vi.spyOn(window, 'print').mockImplementation(() => {});

    renderPrint();

    const user = userEvent.setup();
    const btn = await screen.findByTestId('magazine-print-btn');
    await user.click(btn);

    expect(printSpy).toHaveBeenCalledTimes(1);
    printSpy.mockRestore();
  });

  it('estado inicial "não encontrada" quando o serviço devolve null', async () => {
    getMock.mockResolvedValueOnce(null);
    renderPrint('inexistente');
    await waitFor(() =>
      expect(screen.getByText(/Revista não encontrada/i)).toBeInTheDocument(),
    );
    // Também não há renderer nem botão de impressão.
    expect(screen.queryAllByTestId(/^page-renderer-/).length).toBe(0);
    expect(screen.queryByTestId('magazine-print-btn')).toBeNull();
  });
});
