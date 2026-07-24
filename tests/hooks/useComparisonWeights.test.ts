/**
 * useComparisonWeights — defaults, persistência localStorage.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import "../components/render-helpers";
import { act, waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "./_helpers/render-hook-providers";
import {
  useComparisonWeights,
  DEFAULT_WEIGHTS,
  mapWeightsToScore,
  mapScoreToWeights,
} from "@/hooks/comparison/useComparisonWeights";
import { supabase } from "@/integrations/supabase/client";

beforeEach(() => {
  localStorage.clear();
  vi.clearAllMocks();
  (supabase.auth.getUser as ReturnType<typeof vi.fn>).mockResolvedValue({ data: { user: null }, error: null });
});

describe("useComparisonWeights", () => {
  it("usa DEFAULT_WEIGHTS quando localStorage vazio", async () => {
    const { result } = renderHookWithProviders(() => useComparisonWeights());
    expect(result.current.weights).toEqual(DEFAULT_WEIGHTS);
    await waitFor(() => expect(result.current.loading).toBe(false));
  });

  it("hidrata do localStorage quando disponível", () => {
    localStorage.setItem("comparison-weights", JSON.stringify({ ...DEFAULT_WEIGHTS, price: 99 }));
    const { result } = renderHookWithProviders(() => useComparisonWeights());
    expect(result.current.weights.price).toBe(99);
  });

  it("setWeights atualiza estado e localStorage", async () => {
    const { result } = renderHookWithProviders(() => useComparisonWeights());
    await waitFor(() => expect(result.current.loading).toBe(false));
    const next = { ...DEFAULT_WEIGHTS, price: 50 };
    await act(async () => { await result.current.setWeights(next); });
    expect(result.current.weights.price).toBe(50);
    expect(JSON.parse(localStorage.getItem("comparison-weights")!).price).toBe(50);
  });

  it("reset volta para os defaults", async () => {
    localStorage.setItem("comparison-weights", JSON.stringify({ ...DEFAULT_WEIGHTS, price: 1 }));
    const { result } = renderHookWithProviders(() => useComparisonWeights());
    await waitFor(() => expect(result.current.loading).toBe(false));
    await act(async () => { await result.current.reset(); });
    expect(result.current.weights).toEqual(DEFAULT_WEIGHTS);
  });

  it("sobrevive a localStorage corrompido", () => {
    localStorage.setItem("comparison-weights", "{not-json");
    const { result } = renderHookWithProviders(() => useComparisonWeights());
    expect(result.current.weights).toEqual(DEFAULT_WEIGHTS);
  });

  it("mapWeightsToScore traduz o shape persistido para o shape do score", () => {
    expect(mapWeightsToScore({ price: 30, stock: 25, minQty: 5, colors: 15, verified: 10, leadTime: 15 }))
      .toEqual({ price: 30, stock: 25, minQuantity: 5, colorVariety: 15, verifiedSupplier: 10, leadTime: 15 });
  });

  it("mapScoreToWeights é o inverso de mapWeightsToScore (round-trip)", () => {
    const persisted = { ...DEFAULT_WEIGHTS, price: 40, colors: 5 };
    expect(mapScoreToWeights(mapWeightsToScore(persisted))).toEqual(persisted);
  });
});
