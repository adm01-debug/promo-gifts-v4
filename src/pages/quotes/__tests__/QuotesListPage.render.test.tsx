/**
 * Testes de renderização da QuotesListPage.
 * Regressão chave: garantir que nenhum vestígio do bloco KPI/Funil voltou.
 */
import type { useQuotesListPage as _useQuotesListPage } from '@/pages/quotes/useQuotesListPage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

type HookReturn = ReturnType<typeof _useQuotesListPage>;

const baseHook: HookReturn = {
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
  return {
    ...actual,
    useQuotesListPage: () => hookValue,
  };
});

// Stubs de componentes pesados para evitar dependências de rede / canvas
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
  hookValue = { ...baseHook };
});

describe('QuotesListPage — estados básicos', () => {
  it('renderiza skeleton quando isLoading=true', () => {
    hookValue = { ...baseHook, isLoading: true };
    renderPage();
    expect(screen.getByTestId('stub-skeleton')).toBeInTheDocument();
  });

  it('renderiza banner de erro quando há error', () => {
    hookValue = { ...baseHook, error: 'falha xpto' };
    renderPage();
    expect(screen.getByText(/Módulo de orçamentos indisponível/i)).toBeInTheDocument();
    expect(screen.getByText('falha xpto')).toBeInTheDocument();
  });

  it('renderiza EmptyState quando lista vazia', () => {
    hookValue = { ...baseHook, filteredQuotes: [], quotes: [] };
    renderPage();
    expect(screen.getByTestId('stub-empty')).toBeInTheDocument();
  });
});

describe('QuotesListPage — banner somente-pending', () => {
  it('mostra banner quando onlyPendingStatuses=true', () => {
    hookValue = { ...baseHook, onlyPendingStatuses: true };
    renderPage();
    expect(screen.getByTestId('quotes-only-pending-banner')).toBeInTheDocument();
    expect(screen.getByText(/status Pendente/i)).toBeInTheDocument();
  });

  it('NÃO mostra banner quando onlyPendingStatuses=false', () => {
    hookValue = { ...baseHook, onlyPendingStatuses: false };
    renderPage();
    expect(screen.queryByTestId('quotes-only-pending-banner')).not.toBeInTheDocument();
  });
});

describe('QuotesListPage — header e botão Novo Orçamento', () => {
  it('preserva data-testid="quote-new-button" (contrato E2E 04ck)', () => {
    renderPage();
    expect(screen.getByTestId('quote-new-button')).toBeInTheDocument();
  });

  it('mostra contagem de orçamentos no header', () => {
    hookValue = {
      ...baseHook,
      filteredQuotes: [
        { id: 'a' },
        { id: 'b' },
        { id: 'c' },
      ] as unknown as HookReturn['filteredQuotes'],
    };
    renderPage();
    expect(screen.getByText(/orçamento\(s\) encontrado\(s\)/i)).toBeInTheDocument();
    expect(screen.getByText('3')).toBeInTheDocument();
  });
});

describe('QuotesListPage — regressão: bloco KPI/Funil removido', () => {
  const FORBIDDEN = [
    /Total em Aberto/i,
    /Funil de Vendas/i,
    /Aprovados/i,
    /Conversão/i,
    /Conversão entre etapas/i,
  ];

  it.each(FORBIDDEN.map((re) => [re]))('não renderiza %s', (re) => {
    hookValue = {
      ...baseHook,
      filteredQuotes: [{ id: 'x' }] as unknown as HookReturn['filteredQuotes'],
    };
    renderPage();
    expect(screen.queryByText(re)).not.toBeInTheDocument();
  });
});
