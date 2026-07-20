/**
 * useQuotesListPage — exclusão INDIVIDUAL (handleDelete).
 *
 * Cobre:
 *  1) Sucesso normal: snapshot capturado, deleteQuote ok, showUndoToast com
 *     título "Orçamento excluído" e onUndo funcional.
 *  2) onUndo chama createQuote com campos gerados removidos (id, created_at,
 *     updated_at, quote_number) e reusa os items do snapshot.
 *  3) deleteQuote falha → toast.error, sem showUndoToast, sem createQuote.
 *  4) fetchQuote falha → delete ainda ocorre, toast.success simples, sem
 *     showUndoToast (undo indisponível).
 *  5) isDeleting: true durante a operação, false ao terminar; reentrada
 *     (handleDelete disparado 2x) é ignorada — só um deleteQuote executa.
 *  6) Stress: 300 exclusões sequenciais com desfechos mistos (undo antes/
 *     depois; sucesso/falha de restore) NÃO produz duplicatas nem chamadas
 *     extras — createQuote é invocado exatamente uma vez por undo executado.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const mockDeleteQuote = vi.fn<(id: string) => Promise<boolean>>();
const mockFetchQuote = vi.fn<(id: string) => Promise<unknown>>();
const mockCreateQuote = vi.fn<(quote: unknown, items: unknown) => Promise<unknown>>();

vi.mock('@/hooks/quotes', async () => {
  const actual = await vi.importActual('@/hooks/quotes');
  return {
    ...actual,
    useQuotes: () => ({
      quotes: [
        { id: 'q1', quote_number: 'ORC-1', status: 'pending', total: 10, created_at: '2026-01-01' },
        { id: 'q2', quote_number: 'ORC-2', status: 'pending', total: 20, created_at: '2026-01-02' },
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

const SNAPSHOT = {
  id: 'q1',
  quote_number: 'ORC-1',
  status: 'pending',
  total: 10,
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
  items: [{ product_id: 'p1', product_name: 'Caneta', quantity: 2, unit_price: 5 }],
};

describe('useQuotesListPage — handleDelete (individual)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFetchQuote.mockResolvedValue(SNAPSHOT);
    mockDeleteQuote.mockResolvedValue(true);
    mockCreateQuote.mockResolvedValue({ id: 'restored' });
  });

  it('sucesso: mostra showUndoToast com título "Orçamento excluído" e duration 8000', async () => {
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    act(() => result.current.setDeleteConfirmId('q1'));
    await act(async () => {
      await result.current.handleDelete();
    });

    expect(mockFetchQuote).toHaveBeenCalledWith('q1');
    expect(mockDeleteQuote).toHaveBeenCalledWith('q1');
    expect(result.current.deleteConfirmId).toBeNull();

    expect(showUndoToast).toHaveBeenCalledTimes(1);
    const opts = showUndoToast.mock.calls[0][0] as {
      title: string;
      duration: number;
      onUndo: () => Promise<void>;
    };
    expect(opts.title).toBe('Orçamento excluído');
    expect(opts.duration).toBe(8000);
    expect(opts.onUndo).toBeTypeOf('function');
    expect(toastError).not.toHaveBeenCalled();
  });

  it('onUndo: chama createQuote SEM id/created_at/updated_at/quote_number e com items do snapshot', async () => {
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setDeleteConfirmId('q1'));
    await act(async () => {
      await result.current.handleDelete();
    });

    const opts = showUndoToast.mock.calls[0][0] as { onUndo: () => Promise<void> };
    await act(async () => {
      await opts.onUndo();
    });

    expect(mockCreateQuote).toHaveBeenCalledTimes(1);
    const [restQuote, items] = mockCreateQuote.mock.calls[0];
    const rest = restQuote as Record<string, unknown>;
    expect(rest.id).toBeUndefined();
    expect(rest.created_at).toBeUndefined();
    expect(rest.updated_at).toBeUndefined();
    expect(rest.quote_number).toBeUndefined();
    expect(rest.status).toBe('pending');
    expect(items).toEqual(SNAPSHOT.items);
    expect(toastSuccess).toHaveBeenCalledWith('Orçamento restaurado.');
  });

  it('onUndo: se createQuote retorna null → toast.error e nenhum duplicado', async () => {
    mockCreateQuote.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setDeleteConfirmId('q1'));
    await act(async () => {
      await result.current.handleDelete();
    });
    const opts = showUndoToast.mock.calls[0][0] as { onUndo: () => Promise<void> };
    await act(async () => {
      await opts.onUndo();
    });
    expect(toastError).toHaveBeenCalledWith('Não foi possível restaurar o orçamento.');
    expect(mockCreateQuote).toHaveBeenCalledTimes(1);
  });

  it('deleteQuote falha: toast.error, sem showUndoToast, sem createQuote', async () => {
    mockDeleteQuote.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setDeleteConfirmId('q1'));
    await act(async () => {
      await result.current.handleDelete();
    });
    expect(toastError).toHaveBeenCalledWith(
      'Não foi possível excluir o orçamento. Tente novamente.',
    );
    expect(showUndoToast).not.toHaveBeenCalled();
    expect(mockCreateQuote).not.toHaveBeenCalled();
    expect(result.current.deleteConfirmId).toBeNull();
  });

  it('fetchQuote falha: delete ocorre, toast.success simples, sem showUndoToast', async () => {
    mockFetchQuote.mockRejectedValueOnce(new Error('network'));
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setDeleteConfirmId('q1'));
    await act(async () => {
      await result.current.handleDelete();
    });
    expect(mockDeleteQuote).toHaveBeenCalledWith('q1');
    expect(toastSuccess).toHaveBeenCalledWith('Orçamento excluído.');
    expect(showUndoToast).not.toHaveBeenCalled();
  });

  it('fetchQuote retorna null (não lança): delete ocorre, toast.success, sem undo', async () => {
    mockFetchQuote.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setDeleteConfirmId('q1'));
    await act(async () => {
      await result.current.handleDelete();
    });
    expect(toastSuccess).toHaveBeenCalledWith('Orçamento excluído.');
    expect(showUndoToast).not.toHaveBeenCalled();
  });

  it('isDeleting: true durante deleteQuote, false ao final', async () => {
    let resolveDelete: ((v: boolean) => void) | null = null;
    mockDeleteQuote.mockImplementationOnce(
      () =>
        new Promise<boolean>((res) => {
          resolveDelete = res;
        }),
    );
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setDeleteConfirmId('q1'));

    let p!: Promise<void>;
    await act(async () => {
      p = result.current.handleDelete();
      await Promise.resolve();
      await Promise.resolve();
    });

    await waitFor(() => expect(result.current.isDeleting).toBe(true));

    await act(async () => {
      resolveDelete?.(true);
      await p;
    });
    expect(result.current.isDeleting).toBe(false);
  });

  it('reentrada: 2 chamadas simultâneas → deleteQuote executa APENAS uma vez', async () => {
    let resolveDelete: ((v: boolean) => void) | null = null;
    mockDeleteQuote.mockImplementationOnce(
      () =>
        new Promise<boolean>((res) => {
          resolveDelete = res;
        }),
    );
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });
    act(() => result.current.setDeleteConfirmId('q1'));

    let p1!: Promise<void>;
    let p2!: Promise<void>;
    await act(async () => {
      p1 = result.current.handleDelete();
      // segunda chamada durante isDeleting=true
      await Promise.resolve();
      p2 = result.current.handleDelete();
    });

    await act(async () => {
      resolveDelete?.(true);
      await Promise.all([p1, p2]);
    });

    expect(mockDeleteQuote).toHaveBeenCalledTimes(1);
    expect(showUndoToast).toHaveBeenCalledTimes(1);
  });

  it('stress: 300 exclusões com desfechos mistos — sem duplicatas, contagens exatas', async () => {
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    const N = 300;
    let expectedDeletes = 0;
    let expectedUndoToasts = 0;
    let expectedCreateCalls = 0;
    let expectedSuccessRestore = 0;
    let expectedErrorRestore = 0;

    for (let i = 0; i < N; i++) {
      const scenario = i % 5;
      // reset spies por iteração é caro — mantemos acumulado e conferimos no fim
      // ajustamos mocks pontualmente:
      if (scenario === 0) {
        // sucesso + undo com createQuote OK
        mockFetchQuote.mockResolvedValueOnce({ ...SNAPSHOT, id: `x${i}` });
        mockDeleteQuote.mockResolvedValueOnce(true);
        mockCreateQuote.mockResolvedValueOnce({ id: `r${i}` });
        expectedDeletes++;
        expectedUndoToasts++;
        expectedCreateCalls++;
        expectedSuccessRestore++;
      } else if (scenario === 1) {
        // sucesso + undo com createQuote FALHA
        mockFetchQuote.mockResolvedValueOnce({ ...SNAPSHOT, id: `x${i}` });
        mockDeleteQuote.mockResolvedValueOnce(true);
        mockCreateQuote.mockResolvedValueOnce(null);
        expectedDeletes++;
        expectedUndoToasts++;
        expectedCreateCalls++;
        expectedErrorRestore++;
      } else if (scenario === 2) {
        // sucesso SEM invocar undo (contador expira sem clique)
        mockFetchQuote.mockResolvedValueOnce({ ...SNAPSHOT, id: `x${i}` });
        mockDeleteQuote.mockResolvedValueOnce(true);
        expectedDeletes++;
        expectedUndoToasts++;
        // sem createQuote
      } else if (scenario === 3) {
        // deleteQuote falha
        mockFetchQuote.mockResolvedValueOnce({ ...SNAPSHOT, id: `x${i}` });
        mockDeleteQuote.mockResolvedValueOnce(false);
        expectedDeletes++;
        // sem undoToast, sem createQuote
      } else {
        // fetchQuote falha, delete ok — sem undo
        mockFetchQuote.mockRejectedValueOnce(new Error('net'));
        mockDeleteQuote.mockResolvedValueOnce(true);
        expectedDeletes++;
        // sem undoToast, sem createQuote
      }

      act(() => result.current.setDeleteConfirmId(`x${i}`));
      // eslint-disable-next-line no-await-in-loop
      await act(async () => {
        await result.current.handleDelete();
      });

      if (scenario === 0 || scenario === 1) {
        const call = showUndoToast.mock.calls[showUndoToast.mock.calls.length - 1];
        const opts = call[0] as { onUndo: () => Promise<void> };
        // eslint-disable-next-line no-await-in-loop
        await act(async () => {
          await opts.onUndo();
        });
      }
    }

    expect(mockDeleteQuote).toHaveBeenCalledTimes(expectedDeletes);
    expect(showUndoToast).toHaveBeenCalledTimes(expectedUndoToasts);
    expect(mockCreateQuote).toHaveBeenCalledTimes(expectedCreateCalls);

    // Contagens dos toasts de restauração
    const successRestoreCount = toastSuccess.mock.calls.filter(
      (c) => c[0] === 'Orçamento restaurado.',
    ).length;
    const errorRestoreCount = toastError.mock.calls.filter(
      (c) => c[0] === 'Não foi possível restaurar o orçamento.',
    ).length;
    expect(successRestoreCount).toBe(expectedSuccessRestore);
    expect(errorRestoreCount).toBe(expectedErrorRestore);

    // Estado limpo ao final
    expect(result.current.isDeleting).toBe(false);
    expect(result.current.deleteConfirmId).toBeNull();
  });
});
