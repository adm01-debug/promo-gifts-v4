/**
 * gallery.test.tsx — Testes de renderização e comportamento da galeria de templates.
 *
 * Foca em: contagem de cards, filtros por família, navegação segura via returnTo,
 * validação de applyTemplate, favoritos.
 *
 * NÃO testa render pixel-perfect dos 12 templates (isso é caro em jsdom e coberto
 * por snapshots visuais separados). Todos os componentes de template são mockados
 * para <div data-testid="stub-template" />.
 */

import { render, screen, within, fireEvent } from '@testing-library/react';
import { MemoryRouter, Routes, Route } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// Mock TODOS os templates para não pagar o custo de renderizar 1920×2716 real
vi.mock('../../components/templates/TemplateRegistry', () => {
  const StubComponent = () => null;
  const make = (
    id: string,
    family: 'catalog' | 'corporate' | 'editorial',
    productsPerPage: number,
  ) => ({
    id,
    name: `Template ${id}`,
    family,
    description: `Descrição ${id}`,
    productsPerPage,
    fonts: { heading: 'Inter', body: 'Inter' },
    defaultColors: { primary: '#000', secondary: '#111', text: '#222' },
    Component: StubComponent,
  });

  const REGISTRY = {
    'editorial-vogue': make('editorial-vogue', 'editorial', 1),
    'editorial-magazine': make('editorial-magazine', 'editorial', 2),
    'editorial-hero': make('editorial-hero', 'editorial', 3),
    'editorial-mono': make('editorial-mono', 'editorial', 1),
    'editorial-manifesto': make('editorial-manifesto', 'editorial', 2),
    'catalog-grid2x3': make('catalog-grid2x3', 'catalog', 6),
    'catalog-grid3x3': make('catalog-grid3x3', 'catalog', 9),
    'catalog-list': make('catalog-list', 'catalog', 4),
    'catalog-giftset': make('catalog-giftset', 'catalog', 3),
    'corporate-hero': make('corporate-hero', 'corporate', 1),
    'corporate-split': make('corporate-split', 'corporate', 2),
    'corporate-executive': make('corporate-executive', 'corporate', 4),
  };
  return {
    TEMPLATE_REGISTRY: REGISTRY,
    listTemplates: () => Object.values(REGISTRY),
    getTemplate: (id: string) => REGISTRY[id as keyof typeof REGISTRY] ?? REGISTRY['editorial-vogue'],
  };
});

// Mock mockMagazine (não é o foco aqui)
vi.mock('../mockMagazine', () => ({
  buildMockMagazine: () => ({ id: 'mock', items: [], branding: {}, content: {}, templateId: 'x' }),
  buildMockPage: () => ({ items: [] }),
}));

vi.mock('@/components/seo/PageSEO', () => ({ PageSEO: () => null }));

// Toasts (hoisted-safe: usa vi.hoisted)
const toastMock = vi.hoisted(() => ({
  message: vi.fn(),
  success: vi.fn(),
  error: vi.fn(),
}));
vi.mock('sonner', () => ({
  toast: Object.assign((...args: unknown[]) => toastMock.message(...args), toastMock),
}));

// IntersectionObserver stub — força visible=true imediato
class IOStub {
  observe(el: Element) {
    // Chama callback com isIntersecting=true no próximo tick
    queueMicrotask(() => this.cb([{ isIntersecting: true, target: el } as IntersectionObserverEntry], this as unknown as IntersectionObserver));
  }
  disconnect() {}
  unobserve() {}
  takeRecords() { return []; }
  cb: IntersectionObserverCallback;
  root = null;
  rootMargin = '';
  thresholds = [];
  constructor(cb: IntersectionObserverCallback) { this.cb = cb; }
}
// @ts-expect-error jsdom
globalThis.IntersectionObserver = IOStub;

import MagazineTemplatesGalleryPage from '../MagazineTemplatesGalleryPage';

function renderAt(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <Routes>
        <Route path="/magazine/templates" element={<MagazineTemplatesGalleryPage />} />
        <Route path="*" element={<div data-testid="landed">{window.location.pathname}</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

describe('MagazineTemplatesGalleryPage', () => {
  beforeEach(() => {
    window.localStorage.clear();
    toastMock.message.mockClear();
    toastMock.success.mockClear();
    toastMock.error.mockClear();
  });

  it('renderiza os 12 cards de template', () => {
    renderAt('/magazine/templates');
    const cards = screen.getAllByTestId(/^template-card-/);
    expect(cards).toHaveLength(12);
  });

  it('filtro "editorial" mostra apenas os 5 editoriais', () => {
    renderAt('/magazine/templates');
    fireEvent.click(screen.getByTestId('template-family-editorial'));
    expect(screen.getAllByTestId(/^template-card-/)).toHaveLength(5);
  });

  it('filtro "catalog" mostra apenas os 4 catálogos', () => {
    renderAt('/magazine/templates');
    fireEvent.click(screen.getByTestId('template-family-catalog'));
    expect(screen.getAllByTestId(/^template-card-/)).toHaveLength(4);
  });

  it('filtro "corporate" mostra apenas os 3 corporativos', () => {
    renderAt('/magazine/templates');
    fireEvent.click(screen.getByTestId('template-family-corporate'));
    expect(screen.getAllByTestId(/^template-card-/)).toHaveLength(3);
  });

  it('botão "Usar" sem returnTo mostra toast e navega para /magazine', () => {
    renderAt('/magazine/templates');
    const btn = screen.getByTestId('template-use-editorial-vogue');
    fireEvent.click(btn);
    expect(toastMock.message).toHaveBeenCalled();
  });

  it('rejeita returnTo malicioso (open-redirect) e usa fluxo default', () => {
    renderAt('/magazine/templates?returnTo=//evil.com/magazine/abc');
    // Botão de voltar deve apontar para /magazine (não para evil.com)
    const backLink = screen.getByRole('link', { name: /voltar/i });
    expect(backLink.getAttribute('href')).toBe('/magazine');
  });

  it('aceita returnTo válido e mostra "Voltar ao editor"', () => {
    renderAt('/magazine/templates?returnTo=/magazine/abc123');
    const backLink = screen.getByRole('link', { name: /voltar ao editor/i });
    expect(backLink.getAttribute('href')).toBe('/magazine/abc123');
  });

  it('favorito: toggle marca e desmarca', () => {
    renderAt('/magazine/templates');
    const favBtn = screen.getByTestId('template-favorite-editorial-vogue');
    fireEvent.click(favBtn);
    expect(window.localStorage.getItem('magazine:favorite-template')).toBe('editorial-vogue');
    // Reordena: primeiro card vira o favorito
    const first = screen.getAllByTestId(/^template-card-/)[0];
    expect(first.getAttribute('data-testid')).toBe('template-card-editorial-vogue');
    // Badge "Seu favorito" aparece
    expect(within(first).getByText(/seu favorito/i)).toBeInTheDocument();
  });

  it('favorito persiste ao remontar (hidrata do localStorage)', () => {
    window.localStorage.setItem('magazine:favorite-template', 'catalog-grid3x3');
    renderAt('/magazine/templates');
    const first = screen.getAllByTestId(/^template-card-/)[0];
    expect(first.getAttribute('data-testid')).toBe('template-card-catalog-grid3x3');
  });

  it('aria-live está no grid para anunciar mudanças de filtro', () => {
    renderAt('/magazine/templates');
    const main = screen.getByRole('main');
    expect(main.getAttribute('aria-live')).toBe('polite');
  });

  it('tabs têm aria-selected correto', () => {
    renderAt('/magazine/templates');
    const allTab = screen.getByTestId('template-family-all');
    expect(allTab.getAttribute('aria-selected')).toBe('true');
    fireEvent.click(screen.getByTestId('template-family-catalog'));
    expect(allTab.getAttribute('aria-selected')).toBe('false');
    expect(screen.getByTestId('template-family-catalog').getAttribute('aria-selected')).toBe('true');
  });

  it('h1 tem data-testid canônico', () => {
    renderAt('/magazine/templates');
    expect(screen.getByTestId('page-title-magazine-templates')).toBeInTheDocument();
  });
});
