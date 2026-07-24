/**
 * Testes — useDebounce, useDebouncedCallback, useThrottle, useSearchAsYouType
 *
 * Utility hooks usados em ~20 outros hooks do catálogo.
 * Cobre três bug fixes históricos:
 *   BUG-09: useThrottle leading-edge correto (não era debounce disfarçado)
 *   BUG-24: onSearch via ref em useSearchAsYouType (ref estável nas deps)
 *
 * Invariantes:
 *   useDebounce: retorna valor inicial, atualiza após delay, cancela no cleanup
 *   useDebouncedCallback: debounce de chamadas, cleanup no unmount
 *   useThrottle BUG-09: emite imediatamente no leading-edge, trailing após lock
 *   useSearchAsYouType BUG-24: onSearch via ref (não recria effect)
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { useDebounce, useDebouncedCallback, useThrottle, useSearchAsYouType } from '../useDebounce';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

// ── useDebounce ───────────────────────────────────────────────────────────────
describe('useDebounce', () => {
  it('retorna valor inicial imediatamente', () => {
    const { result } = renderHook(() => useDebounce('inicial', 300));
    expect(result.current).toBe('inicial');
  });

  it('nao atualiza antes do delay', () => {
    const { result, rerender } = renderHook(({ val }: { val: string }) => useDebounce(val, 300), {
      initialProps: { val: 'a' },
    });
    rerender({ val: 'b' });
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(result.current).toBe('a'); // ainda não atualizou
  });

  it('atualiza após o delay completo', () => {
    const { result, rerender } = renderHook(({ val }: { val: string }) => useDebounce(val, 300), {
      initialProps: { val: 'a' },
    });
    rerender({ val: 'b' });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current).toBe('b');
  });

  it('reinicia timer quando valor muda antes do delay', () => {
    const { result, rerender } = renderHook(({ val }: { val: string }) => useDebounce(val, 300), {
      initialProps: { val: 'a' },
    });
    rerender({ val: 'b' });
    act(() => {
      vi.advanceTimersByTime(200);
    }); // 200ms de 300ms
    rerender({ val: 'c' }); // muda antes de completar
    act(() => {
      vi.advanceTimersByTime(300);
    }); // completa 300ms desde 'c'
    expect(result.current).toBe('c'); // emite 'c', não 'b'
  });

  it('cancela timer ao desmontar (sem state update em unmounted)', () => {
    const { result, rerender, unmount } = renderHook(
      ({ val }: { val: string }) => useDebounce(val, 300),
      { initialProps: { val: 'a' } },
    );
    rerender({ val: 'b' });
    unmount();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    // Não deve lançar warning de state update em unmounted component
    expect(result.current).toBe('a'); // valor antes do unmount
  });
});

// ── useDebouncedCallback ──────────────────────────────────────────────────────
describe('useDebouncedCallback', () => {
  it('nao chama callback imediatamente', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(cb, 300));
    act(() => {
      result.current('arg1');
    });
    expect(cb).not.toHaveBeenCalled();
  });

  it('chama callback apos delay', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(cb, 300));
    act(() => {
      result.current('arg1');
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(cb).toHaveBeenCalledWith('arg1');
  });

  it('cancela chamadas anteriores (last-call wins)', () => {
    const cb = vi.fn();
    const { result } = renderHook(() => useDebouncedCallback(cb, 300));
    act(() => {
      result.current('a');
      result.current('b');
      result.current('c');
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb).toHaveBeenCalledWith('c');
  });

  it('cancela timer pendente ao desmontar', () => {
    const cb = vi.fn();
    const { result, unmount } = renderHook(() => useDebouncedCallback(cb, 300));
    act(() => {
      result.current('x');
    });
    unmount();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(cb).not.toHaveBeenCalled();
  });
});

// ── useThrottle (BUG-09) ──────────────────────────────────────────────────────
describe('useThrottle — BUG-09 leading-edge correto', () => {
  it('emite valor inicial imediatamente (leading-edge)', () => {
    const { result } = renderHook(() => useThrottle('a', 300));
    expect(result.current).toBe('a');
  });

  it('BUG-09: primeira mudanca emite IMEDIATAMENTE (nao debounce)', () => {
    const { result, rerender } = renderHook(({ val }: { val: string }) => useThrottle(val, 500), {
      initialProps: { val: 'a' },
    });
    // O mount inicial consome o slot de leading-edge; avançar o timer libera o lock.
    act(() => {
      vi.advanceTimersByTime(500);
    });
    // Agora a próxima mudança dispara imediatamente (leading-edge), não após 500ms
    act(() => {
      rerender({ val: 'b' });
    });
    expect(result.current).toBe('b'); // emitido imediatamente
  });

  it('durante o lock: trailing update apos o periodo', () => {
    const { result, rerender } = renderHook(({ val }: { val: string }) => useThrottle(val, 300), {
      initialProps: { val: 'a' },
    });
    act(() => {
      rerender({ val: 'b' });
    }); // leading: emite 'b'
    act(() => {
      rerender({ val: 'c' });
    }); // durante lock: bufferiza 'c'
    act(() => {
      rerender({ val: 'd' });
    }); // durante lock: bufferiza 'd' (overwrite)
    act(() => {
      vi.advanceTimersByTime(300);
    }); // trailing: emite 'd'
    expect(result.current).toBe('d'); // ultimo valor bufferizado
  });
});

// ── useSearchAsYouType (BUG-24) ───────────────────────────────────────────────
describe('useSearchAsYouType — BUG-24 onSearch via ref', () => {
  it('retorna query vazia inicialmente', () => {
    const onSearch = vi.fn();
    const { result } = renderHook(() => useSearchAsYouType(onSearch));
    expect(result.current.query).toBe('');
    expect(result.current.isSearching).toBe(false);
  });

  it('chama onSearch apos debounce quando query >= minLength', () => {
    const onSearch = vi.fn();
    const { result } = renderHook(() =>
      useSearchAsYouType(onSearch, { debounceMs: 300, minLength: 2 }),
    );
    act(() => {
      result.current.setQuery('ca');
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onSearch).toHaveBeenCalledWith('ca');
  });

  it('nao chama onSearch quando query < minLength (default 2)', () => {
    const onSearch = vi.fn();
    const { result } = renderHook(() => useSearchAsYouType(onSearch));
    act(() => {
      result.current.setQuery('a');
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onSearch).not.toHaveBeenCalledWith('a');
  });

  it('clear() reseta query e chama onSearch("")', () => {
    const onSearch = vi.fn();
    const { result } = renderHook(() => useSearchAsYouType(onSearch));
    act(() => {
      result.current.setQuery('caneta');
    });
    act(() => {
      result.current.clear();
    });
    expect(result.current.query).toBe('');
    expect(onSearch).toHaveBeenCalledWith('');
  });

  it('BUG-24: mudar onSearch entre renders nao re-dispara effect', () => {
    let callCount = 0;
    const { result, rerender } = renderHook(
      ({ cb }: { cb: (q: string) => void }) => useSearchAsYouType(cb, { debounceMs: 100 }),
      {
        initialProps: {
          cb: () => {
            callCount++;
          },
        },
      },
    );
    act(() => {
      result.current.setQuery('abc');
    });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    const countAfterFirst = callCount;

    // Trocar callback — NÃO deve re-disparar onSearch
    rerender({
      cb: () => {
        callCount += 100;
      },
    }); // nova ref do callback
    expect(callCount).toBe(countAfterFirst); // sem chamada extra
  });
});
