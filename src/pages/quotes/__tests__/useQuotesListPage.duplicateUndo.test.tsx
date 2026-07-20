/**
 * useQuotesListPage.handleDuplicateWithUndo — paridade com handleDelete.
 *
 * Cobre:
 *  1) Duplicação com sucesso → `showUndoToast` com título "Orçamento duplicado"
 *     e duration 8000. Retorna o novo Quote.
 *  2) `duplicateQuote` retorna null → `toast.error`, sem `showUndoToast`.
 *  3) `onUndo` chama `deleteQuote(newId)` e emite `toast.success` "Duplicação
 *     desfeita." quando o delete responde `true`.
 *  4) `onUndo` com `deleteQuote` retornando `false` → `toast.error` sem
 *     duplicar toasts.
 *  5) Invariante: `toast.success` de sucesso do duplicate NÃO é emitido pelo
 *     hook (só quando o undo é acionado com sucesso).
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import type { ReactNode } from 'react';

const mockDuplicate = vi.fn<(id: string) => Promise<unknown>>();
const mockDelete = vi.fn<(id: string) => Promise<boolean>>();
const mockFetch = vi.fn<(id: string) => Promise<unknown>>();
const mockCreate = vi.fn();

vi.mock('@/hooks/quotes', async () => {
  const actual = await vi.importActual('@/hooks/quotes');
  return {
    ...actual,
    useQuotes: () => ({
      quotes: [],
      isLoading: false,
      error: null,
      deleteQuote: mockDelete,
      duplicateQuote: mockDuplicate,
      fetchQuote: mockFetch,
      createQuote: mockCreate,
      updateQuoteStatus: vi.fn(),
    }),
  };
});

const toastSuccess = vi.fn();
const toastError = vi.fn();
vi.mock('sonner', () => ({
  toast: {
    success: (...a: unknown[]) => toastSuccess(...a),
    error: (...a: unknown[]) => toastError(...a),
    warning: vi.fn(),
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

describe('useQuotesListPage — handleDuplicateWithUndo', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockDuplicate.mockResolvedValue({ id: 'new-1', quote_number: 'ORC-NEW' });
    mockDelete.mockResolvedValue(true);
  });

  it('sucesso: showUndoToast com título "Orçamento duplicado", duration 8000, sem toast.success extra', async () => {
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    let ret: unknown = null;
    await act(async () => {
      ret = await result.current.handleDuplicateWithUndo('q1');
    });

    expect(mockDuplicate).toHaveBeenCalledWith('q1');
    expect((ret as { id: string }).id).toBe('new-1');

    expect(showUndoToast).toHaveBeenCalledTimes(1);
    const opts = showUndoToast.mock.calls[0][0] as {
      title: string;
      duration: number;
      onUndo: () => Promise<void>;
    };
    expect(opts.title).toBe('Orçamento duplicado');
    expect(opts.duration).toBe(8000);
    expect(opts.onUndo).toBeTypeOf('function');

    // NÃO existe toast.success de sucesso do duplicate — só o undo.
    expect(toastSuccess).not.toHaveBeenCalled();
    expect(toastError).not.toHaveBeenCalled();
  });

  it('duplicateQuote retorna null → toast.error, sem showUndoToast', async () => {
    mockDuplicate.mockResolvedValueOnce(null);
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    await act(async () => {
      const r = await result.current.handleDuplicateWithUndo('q1');
      expect(r).toBeNull();
    });

    expect(toastError).toHaveBeenCalledWith('Não foi possível duplicar o orçamento.');
    expect(showUndoToast).not.toHaveBeenCalled();
  });

  it('duplicateQuote lança → toast.error, sem showUndoToast', async () => {
    mockDuplicate.mockRejectedValueOnce(new Error('boom'));
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    await act(async () => {
      const r = await result.current.handleDuplicateWithUndo('q1');
      expect(r).toBeNull();
    });

    expect(toastError).toHaveBeenCalledWith('Não foi possível duplicar o orçamento.');
    expect(showUndoToast).not.toHaveBeenCalled();
  });

  it('onUndo: chama deleteQuote(newId) e toast.success "Duplicação desfeita."', async () => {
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    await act(async () => {
      await result.current.handleDuplicateWithUndo('q1');
    });

    const opts = showUndoToast.mock.calls[0][0] as { onUndo: () => Promise<void> };
    await act(async () => {
      await opts.onUndo();
    });

    expect(mockDelete).toHaveBeenCalledWith('new-1');
    expect(toastSuccess).toHaveBeenCalledWith('Duplicação desfeita.');
  });

  it('onUndo: deleteQuote retorna false → toast.error', async () => {
    mockDelete.mockResolvedValueOnce(false);
    const { result } = renderHook(() => useQuotesListPage(), { wrapper });

    await act(async () => {
      await result.current.handleDuplicateWithUndo('q1');
    });
    const opts = showUndoToast.mock.calls[0][0] as { onUndo: () => Promise<void> };
    await act(async () => {
      await opts.onUndo();
    });

    expect(toastError).toHaveBeenCalledWith('Não foi possível desfazer a duplicação.');
    expect(toastSuccess).not.toHaveBeenCalled();
  });
});
