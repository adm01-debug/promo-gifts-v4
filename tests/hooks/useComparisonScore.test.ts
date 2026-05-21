/**
 * useComparisonScore — score ponderado, ranking e isWinner.
 */
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useComparisonScore, DEFAULT_SCORE_WEIGHTS } from "@/hooks/comparison/useComparisonScore";

const mk = (over: Record<string, unknown>) => ({
  id: "p" + Math.random(),
  price: 100,
  stock: 50,
  minQuantity: 10,
  colors: [],
  stockStatus: "in-stock",
  supplier: { verified: false },
  ...over,
});

describe("useComparisonScore", () => {
  it("retorna [] para lista vazia", () => {
    const { result } = renderHook(() => useComparisonScore([]));
    expect(result.current).toEqual([]);
  });

  it("produto mais barato com mais estoque vence", () => {
    const products = [
      mk({ id: "a", price: 200, stock: 10 }),
      mk({ id: "b", price: 50, stock: 100, supplier: { verified: true } }),
    ];
    const { result } = renderHook(() => useComparisonScore(products));
    const winner = result.current.find(s => s.isWinner)!;
    expect(winner.productId).toBe("b");
    expect(winner.rank).toBe(1);
  });

  it("score total entre 0 e 100", () => {
    const products = [mk({ id: "a", price: 100 }), mk({ id: "b", price: 200 })];
    const { result } = renderHook(() => useComparisonScore(products));
    for (const s of result.current) {
      expect(s.total).toBeGreaterThanOrEqual(0);
      expect(s.total).toBeLessThanOrEqual(100);
    }
  });

  it("breakdown contém todas as chaves de pesos", () => {
    const { result } = renderHook(() => useComparisonScore([mk({}), mk({ id: "b" })]));
    const keys = Object.keys(result.current[0].breakdown);
    expect(keys.sort()).toEqual(Object.keys(DEFAULT_SCORE_WEIGHTS).sort());
  });

  it("ranks são únicos e contínuos", () => {
    const products = [mk({ id: "a", price: 50 }), mk({ id: "b", price: 100 }), mk({ id: "c", price: 150 })];
    const { result } = renderHook(() => useComparisonScore(products));
    const ranks = result.current.map(s => s.rank).sort();
    expect(ranks).toEqual([1, 2, 3]);
  });
});
