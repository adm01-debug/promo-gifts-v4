/**
 * useComparisonWeights — defaults, persistência localStorage.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import "../components/render-helpers";
import { act, waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "./_helpers/render-hook-providers";
import { useComparisonWeights, DEFAULT_WEIGHTS } from "@/hooks/comparison/useComparisonWeights";
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
});
