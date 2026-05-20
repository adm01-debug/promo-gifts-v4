/**
 * useDebouncedFilters — propaga mudanças com debounce, mas valor inicial é imediato.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useDebouncedFilters } from "@/hooks/common/useDebouncedFilters";

beforeEach(() => { vi.useFakeTimers(); });
afterEach(() => { vi.useRealTimers(); });

describe("useDebouncedFilters", () => {
  it("retorna o valor inicial sem delay", () => {
    const { result } = renderHook(() => useDebouncedFilters("a"));
    expect(result.current).toBe("a");
  });

  it("aplica debounce em mudanças subsequentes", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedFilters(v, 200), { initialProps: { v: "a" } });
    rerender({ v: "b" });
    expect(result.current).toBe("a"); // ainda não propagou
    act(() => { vi.advanceTimersByTime(199); });
    expect(result.current).toBe("a");
    act(() => { vi.advanceTimersByTime(2); });
    expect(result.current).toBe("b");
  });

  it("cancela debounce anterior em mudanças rápidas", () => {
    const { result, rerender } = renderHook(({ v }) => useDebouncedFilters(v, 100), { initialProps: { v: 1 } });
    rerender({ v: 2 });
    act(() => { vi.advanceTimersByTime(50); });
    rerender({ v: 3 });
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe(1);
    act(() => { vi.advanceTimersByTime(50); });
    expect(result.current).toBe(3);
  });
});
