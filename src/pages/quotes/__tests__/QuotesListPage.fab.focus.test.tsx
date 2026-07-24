/**
 * FAB "Novo Orçamento" — ordem de foco e tooltip por teclado.
 *
 * Complementa `QuotesListPage.fab.test.tsx` cobrindo:
 *  - o FAB é alcançável via Tab a partir do começo do documento
 *  - tooltip aparece ao receber foco via teclado
 *  - tooltip desmonta ao perder foco (Tab para fora)
 *  - Shift+Tab devolve o foco ao FAB
 *
 * Radix Tooltip exige polyfills mínimos de PointerEvent / hasPointerCapture
 * para funcionar em jsdom — aplicados apenas neste suíte.
 */
import { describe, it, expect, vi, beforeAll, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router-dom';

const navigateMock = vi.fn();

import type { useQuotesListPage as UseQuotesListPageFn } from '@/pages/quotes/useQuotesListPage';
type HookReturn = ReturnType<UseQuotesListPageFn>;

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

vi.mock('@/pages/quotes/useQuotesListPage', async () => {
  const actual = await vi.importActual('@/pages/quotes/useQuotesListPage');
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

beforeAll(() => {
  // Radix UI Tooltip toca métodos de PointerEvent que jsdom não expõe.
  if (typeof window.PointerEvent === 'undefined') {
    // @ts-expect-error — polyfill mínimo só para Radix se contentar em testes.
    window.PointerEvent = class extends Event {};
  }
  if (!Element.prototype.hasPointerCapture) {
    Element.prototype.hasPointerCapture = () => false;
  }
  if (!Element.prototype.releasePointerCapture) {
    Element.prototype.releasePointerCapture = () => undefined;
  }
  if (!Element.prototype.setPointerCapture) {
    Element.prototype.setPointerCapture = () => undefined;
  }
  if (!Element.prototype.scrollIntoView) {
    Element.prototype.scrollIntoView = () => undefined;
  }
});

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

describe('QuotesListPage — FAB foco por teclado', () => {
  it('FAB é alcançável via Tab em um número razoável de passos', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderPage();
    const fab = screen.getByTestId('quote-new-button');

    // Foca o body como ponto inicial determinístico.
    (document.body as HTMLElement).focus();

    let steps = 0;
    const MAX_STEPS = 25; // header tem ~4 elementos focáveis antes do FAB
    while (document.activeElement !== fab && steps < MAX_STEPS) {
      await user.tab();
      steps += 1;
    }
    expect(document.activeElement).toBe(fab);
    expect(steps).toBeLessThanOrEqual(MAX_STEPS);
  });

  it('tooltip aparece ao receber foco via teclado e some ao perder', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderPage();
    const fab = screen.getByTestId('quote-new-button') as HTMLButtonElement;

    fab.focus();
    expect(document.activeElement).toBe(fab);

    const tooltip = await screen.findByRole('tooltip', {}, { timeout: 2_000 });
    expect(tooltip).toHaveTextContent(/Criar novo orçamento em segundos/i);

    // Move o foco para fora — tooltip deve desmontar.
    await user.tab();
    expect(document.activeElement).not.toBe(fab);
    await waitFor(
      () => {
        expect(screen.queryByRole('tooltip')).toBeNull();
      },
      { timeout: 2_000 },
    );
  });

  it('Shift+Tab devolve o foco ao FAB após sair', async () => {
    const user = userEvent.setup({ pointerEventsCheck: 0 });
    renderPage();
    const fab = screen.getByTestId('quote-new-button') as HTMLButtonElement;

    fab.focus();
    await user.tab(); // sai do FAB
    expect(document.activeElement).not.toBe(fab);

    await user.tab({ shift: true });
    expect(document.activeElement).toBe(fab);
  });
});
