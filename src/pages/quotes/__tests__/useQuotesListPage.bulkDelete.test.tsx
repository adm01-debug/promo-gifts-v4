/**
 * useQuotesListPage — bulk delete: cenários de falha de API/DB.
 *
 * Garante:
 *  - Sucesso total: limpa bulkDeleteIds, emite `quotes:bulk-delete-confirmed`,
 *    toast.success com action "Desfazer".
 *  - Falha parcial: limpa bulkDeleteIds + emite confirmed, toast.warning.
 *  - Falha total: PRESERVA bulkDeleteIds, NÃO emite confirmed (seleção visual
 *    permanece), toast.error.
 *  - Cancelar via cancelBulkDelete fecha dialog sem disparar delete.
 *  - Loading state (isBulkDeleting + progress) flutua durante a operação.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

// Mocks devem ser declarados antes do import do hook.
const mockDeleteQuote = vi.fn<(id: string) => Promise<boolean>>();
const mockFetchQuote = vi.fn<(id: string) => Promise<unknown>>();
const mockCreateQuote = vi.fn<(quote: unknown, items: unknown) => Promise<unknown>>();

vi.mock('@/hooks/quotes', async () => {
  const actual = await vi.importActual<typeof import('@/hooks/quotes')>('@/hooks/quotes');
  return {
    ...actual,
    useQuotes: () => ({
      quotes: [
        { id: 'a', quote_number: 'ORC-1', status: 'pending', total: 10, created_at: '2026-01-01' },
        { id: 'b', quote_number: 'ORC-2', status: 'pending', total: 20, created_at: '2026-01-02' },
        { id: 'c', quote_number: 'ORC-3', status: 'pending', total: 30, created_at: '2026-01-03' },
      ],
      isLoading: false,
      error: null,
      deleteQuote: mockDeleteQuote,
      fetchQuote: mockFetchQuote,
      createQuote: mockCreateQuote,
      duplicateQuote: vi.fn(),
      updateQuoteStatus: vi.fn(),
    }),
  };
});

const toastSuccess = vi.fn();
const toastError = vi.fn();
const toastWarning = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    warning: (...a: unknown[]) => toastWarning(...a),
  },
}));

const showUndoToast = vi.fn();
vi.mock('@/utils/undoToast', () => ({
  showUndoToast: (...a: unknown[]) => showUndoToast(...a),
}));

vi.mock('canvas-confetti', () => ({ default: vi.fn() }));

import { useQuotesListPage } from '@/pages/quotes/useQuotesListPage';

function wrapper({ children }: { children: ReactNode }) {
  return <MemoryRouter>{children}</MemoryRouter>;
}

describe('useQuotesListPage — handleBulkDelete', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchQuote.mockResolvedValue({ id: 'snap', quote_number: 'ORC-x', items: [] });
  });

  it('sucesso total: limpa bulkDeleteIds, emite confirmed e mostra toast com Desfazer', async () => {
    mockDeleteQuote.mockResolvedValue(true);
    const events: Event[] = [];
    const listener = (e: Event) => events.push(e);
    window.addEventListener('quotes:bulk-delete-confirmed', listener);

    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    act(() => result.current.setBulkDeleteIds(['a', 'b']));
    expect(result.current.bulkDeleteIds).toEqual(['a', 'b']);

    await act(async () => {
      await result.current.handleBulkDelete();
    });

    expect(mockDeleteQuote).toHaveBeenCalledTimes(2);
    expect(result.current.bulkDeleteIds).toEqual([]);
    expect(result.current.isBulkDeleting).toBe(false);
    expect(events.length).toBe(1);
    expect(showUndoToast).toHaveBeenCalled();
    // showUndoToast recebe { title, onUndo, ... } com botão "Desfazer" elegante
    const opts = showUndoToast.mock.calls[0][0] as { title?: string; onUndo?: () => unknown };
    expect(opts.title).toMatch(/excluí/i);
    expect(opts.onUndo).toBeTypeOf('function');

    window.removeEventListener('quotes:bulk-delete-confirmed', listener);
  });

  it('falha total: PRESERVA bulkDeleteIds, NÃO emite confirmed, dispara toast.error', async () => {
    mockDeleteQuote.mockResolvedValue(false);
    const events: Event[] = [];
    const listener = (e: Event) => events.push(e);
    window.addEventListener('quotes:bulk-delete-confirmed', listener);

    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setBulkDeleteIds(['a', 'b']));

    await act(async () => {
      await result.current.handleBulkDelete();
    });

    expect(result.current.bulkDeleteIds).toEqual(['a', 'b']); // preservado
    expect(events.length).toBe(0); // nenhum confirmed emitido
    expect(toastError).toHaveBeenCalled();
    expect(showUndoToast).not.toHaveBeenCalled();

    window.removeEventListener('quotes:bulk-delete-confirmed', listener);
  });

  it('falha parcial: limpa bulkDeleteIds + emite confirmed + toast.warning', async () => {
    // a: ok, b: falha
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    mockDeleteQuote.mockImplementation(async (id: string) => id === 'a');
    const events: Event[] = [];
    const listener = (e: Event) => events.push(e);
    window.addEventListener('quotes:bulk-delete-confirmed', listener);

    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setBulkDeleteIds(['a', 'b']));

    await act(async () => {
      await result.current.handleBulkDelete();
    });

    expect(result.current.bulkDeleteIds).toEqual([]);
    expect(events.length).toBe(1);
    expect(toastWarning).toHaveBeenCalled();

    window.removeEventListener('quotes:bulk-delete-confirmed', listener);
  });

  // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
  it('cancelBulkDelete fecha dialog SEM chamar deleteQuote', async () => {
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setBulkDeleteIds(['a']));
    act(() => result.current.cancelBulkDelete());
    expect(result.current.bulkDeleteIds).toEqual([]);
    expect(mockDeleteQuote).not.toHaveBeenCalled();
  });

  it('isBulkDeleting fica true durante a operação e false ao terminar', async () => {
    let resolveDelete: ((v: boolean) => void) | null = null;
    mockDeleteQuote.mockImplementation(
      () => new Promise<boolean>((res) => { resolveDelete = res; }),
    );

    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setBulkDeleteIds(['a']));

    let bulkPromise!: Promise<void>;
    await act(async () => {
      bulkPromise = result.current.handleBulkDelete();
      // microtask flush — snapshots/fetch terminam, delete fica pendente
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.isBulkDeleting).toBe(true));
    expect(result.current.bulkDeleteProgress.total).toBe(1);

    await act(async () => {
      resolveDelete?.(true);
      await bulkPromise;
    });

    expect(result.current.isBulkDeleting).toBe(false);
    expect(result.current.bulkDeleteProgress).toEqual({ done: 0, total: 0 });
  });

  it('Desfazer chama createQuote para cada snapshot capturado', async () => {
    mockDeleteQuote.mockResolvedValue(true);
    // eslint-disable-next-line @typescript-eslint/require-await -- assinatura assíncrona intencional (mock/interface Promise)
    mockFetchQuote.mockImplementation(async (id: string) => ({
      id,
      quote_number: `ORC-${id}`,
      items: [{ product_id: 'p1', product_name: 'X', quantity: 1, unit_price: 10 }],
    }));
    mockCreateQuote.mockResolvedValue({ id: 'restored' });

    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setBulkDeleteIds(['a', 'b']));

    await act(async () => {
      await result.current.handleBulkDelete();
    });

    const opts = showUndoToast.mock.calls[0][0] as { onUndo?: () => Promise<void> };
    expect(opts.onUndo).toBeTypeOf('function');

    await act(async () => {
      await opts.onUndo?.();
    });

    expect(mockCreateQuote).toHaveBeenCalledTimes(2);
  });
});
