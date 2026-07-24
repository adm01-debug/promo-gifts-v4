/**
 * Regressão de layout da QuotesListPage (rodada de header consolidado).
 * Garante que título, busca, ordenação e CTA convivem no mesmo bloco,
 * e que data-testids críticos para E2E permanecem expostos.
 */
import type { useQuotesListPage as _useQuotesListPage } from '@/pages/quotes/useQuotesListPage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

type HookReturn = ReturnType<typeof _useQuotesListPage>;

const baseHook = {
  navigate: vi.fn(),
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
  isDeleting: false,
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

let hookValue: HookReturn = baseHook;

vi.mock('@/pages/quotes/useQuotesListPage', async () => {
  const actual = await vi.importActual('@/pages/quotes/useQuotesListPage');
  return { ...actual, useQuotesListPage: () => hookValue };
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
  hookValue = baseHook;
});

describe('QuotesListPage — header consolidado', () => {
  it('renderiza título, input de busca e botão Novo Orçamento', () => {
    renderPage();
    expect(screen.getByTestId('page-title-orcamentos')).toBeInTheDocument();
    expect(screen.getByTestId('quote-new-button')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/Buscar por número, cliente ou empresa/i),
    ).toBeInTheDocument();
  });

  it('expõe aria-label acessível no input de busca', () => {
    renderPage();
    expect(screen.getByLabelText('Buscar orçamentos')).toBeInTheDocument();
  });

  it('título, busca e CTA estão no mesmo container ancestral (mesma linha)', () => {
    renderPage();
    const title = screen.getByTestId('page-title-orcamentos');
    const cta = screen.getByTestId('quote-new-button');
    const search = screen.getByLabelText('Buscar orçamentos');

    // Sobe até achar um ancestral comum que contenha os três.
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
    const ctaA = ancestors(cta);
    const searchA = ancestors(search);
    const commonWithCta = ctaA.find((a) => titleA.has(a));
    const commonWithSearch = searchA.find((a) => titleA.has(a));
    expect(commonWithCta).toBeTruthy();
    expect(commonWithSearch).toBeTruthy();
    // O ancestral comum deve ser o MESMO container (header consolidado).
    expect(commonWithCta).toBe(commonWithSearch);
    expect(commonWithCta?.className).toMatch(/flex/);
  });

  it('exibe banner pending-only quando onlyPendingStatuses=true', () => {
    hookValue = { ...baseHook, onlyPendingStatuses: true } as HookReturn;
    renderPage();
    expect(screen.getByTestId('quotes-only-pending-banner')).toBeInTheDocument();
  });

  it('NÃO exibe banner pending-only quando false', () => {
    renderPage();
    expect(screen.queryByTestId('quotes-only-pending-banner')).toBeNull();
  });

  it('regressão: não renderiza vestígios de KPIs/Funnel', () => {
    renderPage();
    expect(screen.queryByText(/funil de conversão/i)).toBeNull();
    expect(screen.queryByText(/ticket médio/i)).toBeNull();
  });
});
