/**
 * FAB "Novo Orçamento" — regressão de UI/A11y.
 *
 * Garante que o CTA do header é um botão circular (ícone-only) com:
 *  - aria-label acessível
 *  - tap target ≥ 44px (h-11/w-11)
 *  - sem texto "Novo Orçamento" visível
 *  - tooltip comercial acionado por hover E por foco de teclado
 *  - click dispara navegação para /orcamentos/novo
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();

type HookReturn = ReturnType<
  typeof import('@/pages/quotes/useQuotesListPage').useQuotesListPage
>;

const baseHook = {
  navigate: navigateMock,
  quotes: [],
  isLoading: false,
  error: null,
  searchTerm: '',
  setSearchTerm: vi.fn(),
  statusFilter: 'all',
  setStatusFilter: vi.fn(),
  sortBy: 'newest',
  setSortBy: vi.fn(),
  deleteConfirmId: null,
  setDeleteConfirmId: vi.fn(),
  bulkDeleteIds: [],
  setBulkDeleteIds: vi.fn(),
  filteredQuotes: [],
  onlyPendingStatuses: false,
  handleDelete: vi.fn(),
  handleBulkDelete: vi.fn(),
  handleClearFilters: vi.fn(),
  handleMarkApproved: vi.fn(),
  duplicateQuote: vi.fn(),
  updateQuoteStatus: vi.fn(),
} as unknown as HookReturn;

vi.mock('@/pages/quotes/useQuotesListPage', async () => {
  const actual = await vi.importActual<
    typeof import('@/pages/quotes/useQuotesListPage')
  >('@/pages/quotes/useQuotesListPage');
  return { ...actual, useQuotesListPage: () => baseHook };
});

vi.mock('@/components/quotes/QuotesConfigurableList', () => ({
  QuotesConfigurableList: () => <div data-testid="stub-list" />,
}));
vi.mock('@/components/quotes/QuotesStatusChips', () => ({
  QuotesStatusChips: () => <div data-testid="stub-chips" />,
}));
vi.mock('@/components/layout/SkeletonLoaders', () => ({
  QuotesSkeleton: () => <div data-testid="stub-skeleton" />,
}));
vi.mock('@/components/common/EmptyState', () => ({
  EmptyState: ({ title }: { title: string }) => <div data-testid="stub-empty">{title}</div>,
}));
vi.mock('@/components/common/MicroInteractions', () => ({
  FadeInView: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  AnimatedCounter: ({ value }: { value: number }) => <span>{value}</span>,
}));
vi.mock('@/components/seo/PageSEO', () => ({ PageSEO: () => null }));
vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import QuotesListPage from '@/pages/quotes/QuotesListPage';

function renderPage() {
  return render(
    <MemoryRouter>
      <QuotesListPage />
    </MemoryRouter>,
  );
}

beforeEach(() => {
  navigateMock.mockClear();
});

describe('QuotesListPage — FAB "Novo Orçamento"', () => {
  it('renderiza FAB circular com aria-label e sem texto visível', () => {
    renderPage();
    const fab = screen.getByTestId('quote-new-button');
    expect(fab).toHaveAttribute('aria-label', 'Novo orçamento');
    expect(fab.className).toMatch(/rounded-full/);
    expect(fab.className).toMatch(/h-11/);
    expect(fab.className).toMatch(/w-11/);
    expect(fab.textContent?.trim()).toBe('');
  });

  it('expõe foco visível por teclado (focus-visible ring)', () => {
    renderPage();
    const fab = screen.getByTestId('quote-new-button');
    expect(fab.className).toMatch(/focus-visible:ring/);
  });

  it('tooltip comercial aparece no hover', async () => {
    const user = userEvent.setup();
    renderPage();
    const fab = screen.getByTestId('quote-new-button');
    await user.hover(fab);
    await waitFor(() => {
      expect(
        screen.getByText(/Criar novo orçamento em segundos/i),
      ).toBeInTheDocument();
    });
  });

  it('tooltip também aparece via foco de teclado (a11y)', async () => {
    const user = userEvent.setup();
    renderPage();
    const fab = screen.getByTestId('quote-new-button');
    fab.focus();
    // Radix Tooltip abre no focus
    await waitFor(() => {
      expect(
        screen.getByText(/Criar novo orçamento em segundos/i),
      ).toBeInTheDocument();
    });
    // sanity: o foco está mesmo no FAB
    expect(document.activeElement).toBe(fab);
    void user; // keep import used; navegação via Tab depende de ordem do DOM
  });

  it('click dispara navegação para /orcamentos/novo', async () => {
    const user = userEvent.setup();
    renderPage();
    await user.click(screen.getByTestId('quote-new-button'));
    expect(navigateMock).toHaveBeenCalledWith('/orcamentos/novo');
  });

  it('FAB e título estão no mesmo container de header (mesma linha)', () => {
    renderPage();
    const title = screen.getByTestId('page-title-orcamentos');
    const fab = screen.getByTestId('quote-new-button');

    function ancestors(el: HTMLElement): HTMLElement[] {
      const out: HTMLElement[] = [];
      let cur: HTMLElement | null = el;
      while (cur) {
        out.push(cur);
        cur = cur.parentElement;
      }
      return out;
    }
    const titleA = new Set(ancestors(title));
    const common = ancestors(fab).find((a) => titleA.has(a));
    expect(common).toBeTruthy();
    expect(common?.className).toMatch(/flex/);
  });
});
