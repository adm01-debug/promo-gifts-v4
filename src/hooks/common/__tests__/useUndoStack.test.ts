/**
 * Testes — useUndoStack
 *
 * Pilha global de ações desfazíveis (MAX_STACK=10, TTL=30s) + Ctrl+Z listener.
 *
 * Invariantes:
 *   - push: adiciona entrada à pilha
 *   - popAndUndo: executa undo() da entrada mais recente
 *   - popAndUndo: retorna false quando pilha vazia
 *   - TTL: descarta entradas expiradas (>30s)
 *   - MAX_STACK=10: limita a 10 entradas
 *   - clear: esvazia a pilha
 *   - Ctrl+Z: chama popAndUndo (Ctrl+Z em input é ignorado)
 *   - cleanup: remove listener ao desmontar
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useUndoStack } from '../useUndoStack';

vi.mock('@/lib/logger', () => ({
  logger: { warn: vi.fn(), log: vi.fn(), error: vi.fn() },
}));

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

describe('useUndoStack', () => {
  it('popAndUndo retorna false quando pilha vazia', async () => {
    const { result } = renderHook(() => useUndoStack());
    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.popAndUndo();
    });
    expect(ok).toBe(false);
  });

  it('push + popAndUndo: executa undo() da entrada mais recente', async () => {
    const undo = vi.fn();
    const { result } = renderHook(() => useUndoStack());

    act(() => {
      result.current.push({ id: 'e1', label: 'Ação A', undo });
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.popAndUndo();
    });

    expect(ok).toBe(true);
    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('LIFO: executa a entrada mais recente primeiro', async () => {
    const order: string[] = [];
    const { result } = renderHook(() => useUndoStack());

    act(() => {
      result.current.push({
        id: 'e1',
        label: 'A',
        undo: () => {
          order.push('A');
        },
      });
      result.current.push({
        id: 'e2',
        label: 'B',
        undo: () => {
          order.push('B');
        },
      });
    });

    await act(async () => {
      await result.current.popAndUndo();
    });
    expect(order).toEqual(['B']); // B é o mais recente
  });

  it('TTL: descarta entradas com mais de 30s', async () => {
    const undo = vi.fn();
    const { result } = renderHook(() => useUndoStack());

    act(() => {
      result.current.push({ id: 'old', label: 'Antiga', undo });
    });
    act(() => {
      vi.advanceTimersByTime(31_000);
    }); // 31s depois → expirado

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.popAndUndo();
    });

    expect(ok).toBe(false); // TTL expirado → descartado
    expect(undo).not.toHaveBeenCalled();
  });

  it('MAX_STACK=10: limita a 10 entradas', () => {
    const { result } = renderHook(() => useUndoStack());

    act(() => {
      for (let i = 0; i < 15; i++) {
        result.current.push({ id: `e${i}`, label: `A${i}`, undo: vi.fn() });
      }
    });

    // Deve ter executado apenas 10 undos (as 10 mais recentes)
    let count = 0;
    const run = async () => {
      while (true) {
        let ok = false;
        await act(async () => {
          ok = await result.current.popAndUndo();
        });
        if (!ok) break;
        count++;
      }
    };

    return run().then(() => {
      expect(count).toBe(10);
    });
  });

  it('clear: esvazia a pilha completamente', async () => {
    const undo = vi.fn();
    const { result } = renderHook(() => useUndoStack());

    act(() => {
      result.current.push({ id: '1', label: 'A', undo });
      result.current.push({ id: '2', label: 'B', undo });
      result.current.clear();
    });

    let ok: boolean | undefined;
    await act(async () => {
      ok = await result.current.popAndUndo();
    });
    expect(ok).toBe(false);
    expect(undo).not.toHaveBeenCalled();
  });

  it('Ctrl+Z: chama popAndUndo', async () => {
    const undo = vi.fn();
    const { result } = renderHook(() => useUndoStack());
    act(() => {
      result.current.push({ id: '1', label: 'A', undo });
    });

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { ctrlKey: true, key: 'z', bubbles: true }),
      );
    });

    // popAndUndo() é async; flush microtasks para garantir que undo() foi chamado
    await act(async () => {});

    expect(undo).toHaveBeenCalledTimes(1);
  });

  it('cleanup: remove listener ao desmontar', async () => {
    const undo = vi.fn();
    const { result, unmount } = renderHook(() => useUndoStack());
    act(() => {
      result.current.push({ id: '1', label: 'A', undo });
    });

    unmount();

    act(() => {
      window.dispatchEvent(
        new KeyboardEvent('keydown', { ctrlKey: true, key: 'z', bubbles: true }),
      );
    });

    // flush microtasks — listener removido, undo não deve ter sido chamado
    await act(async () => {});

    expect(undo).not.toHaveBeenCalled();
  });
});
