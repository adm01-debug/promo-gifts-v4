/**
 * QuotesListPage — confirmação de exclusão desabilitada durante deleteQuote.
 *
 * Cobre:
 *  1) Quando `isDeleting=true` (via hook), o ConfirmDialog recebe `loading=true`
 *     e o botão de confirmar tem `disabled`.
 *  2) O botão de cancelar também fica `disabled` (proteção contra fechar o
 *     dialog durante a operação — perda de feedback).
 *  3) O spinner `[testId]-loading` aparece.
 *  4) Múltiplos cliques no botão de confirmar NÃO disparam `handleDelete`
 *     adicionais (o browser bloqueia clique em botão desabilitado).
 */
import type { useQuotesListPage as _useQuotesListPage } from '@/pages/quotes/useQuotesListPage';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

type HookReturn = ReturnType<typeof _useQuotesListPage>;

const handleDelete = vi.fn();

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
  // Dialog aberto (quote id qualquer) + isDeleting=true → botão desabilitado
  deleteConfirmId: 'q1',
  isDeleting: true,
  setDeleteConfirmId: vi.fn(),
  bulkDeleteIds: [],
  setBulkDeleteIds: vi.fn(),
  filteredQuotes: [],
  onlyPendingStatuses: false,
  handleDelete,
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

describe('QuotesListPage — ConfirmDialog disabled durante isDeleting', () => {
  beforeEach(() => {
    hookValue = { ...baseHook, isDeleting: true, deleteConfirmId: 'q1' } as HookReturn;
    handleDelete.mockClear();
  });

  it('quando isDeleting=true: botão confirmar fica disabled e loading spinner aparece', () => {
    renderPage();
    const confirmBtn = screen.getByTestId('quote-list-delete-dialog-yes');
    const cancelBtn = screen.getByTestId('quote-list-delete-dialog-no');
    expect(confirmBtn).toBeDisabled();
    expect(cancelBtn).toBeDisabled();
    expect(screen.getByTestId('quote-list-delete-dialog-loading')).toBeInTheDocument();
  });

  it('múltiplos cliques no botão desabilitado NÃO disparam handleDelete', () => {
    renderPage();
    const confirmBtn = screen.getByTestId('quote-list-delete-dialog-yes');
    // 10 cliques rápidos durante isDeleting=true
    for (let i = 0; i < 10; i++) fireEvent.click(confirmBtn);
    expect(handleDelete).not.toHaveBeenCalled();
  });

  it('quando isDeleting=false: botão confirmar fica habilitado', () => {
    hookValue = {
      ...baseHook,
      isDeleting: false,
      deleteConfirmId: 'q1',
    } as HookReturn;
    renderPage();
    const confirmBtn = screen.getByTestId('quote-list-delete-dialog-yes');
    expect(confirmBtn).not.toBeDisabled();
    expect(screen.queryByTestId('quote-list-delete-dialog-loading')).not.toBeInTheDocument();
    fireEvent.click(confirmBtn);
    expect(handleDelete).toHaveBeenCalledTimes(1);
  });
});
