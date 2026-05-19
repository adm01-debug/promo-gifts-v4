/**
 * useSellerDiscountLimits — fetchMyLimit, fetchAllLimits, setLimit, deleteLimit.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../components/render-helpers";
import { act, waitFor } from "@testing-library/react";
import { renderHookWithProviders } from "./_helpers/render-hook-providers";
import { mockFromOnce, resetSupabaseMocks } from "./_helpers/mock-supabase-builder";
import { useSellerDiscountLimits } from "@/hooks/quotes";
import { toast } from "sonner";

beforeEach(() => {
  resetSupabaseMocks();
  vi.clearAllMocks();
});

describe("useSellerDiscountLimits", () => {
  it("fetchMyLimit popula myLimit com max_discount_percent", async () => {
    mockFromOnce({ data: { max_discount_percent: 15 }, error: null });
    const { result } = renderHookWithProviders(() => useSellerDiscountLimits());
    await waitFor(() => expect(result.current.myLimit).toBe(15));
  });

  it("myLimit fica null quando não há registro", async () => {
    mockFromOnce({ data: null, error: null });
    const { result } = renderHookWithProviders(() => useSellerDiscountLimits());
    await waitFor(() => expect(result.current.myLimit).toBeNull());
  });

  it("fetchAllLimits popula limits", async () => {
    mockFromOnce({ data: null, error: null }); // fetchMyLimit inicial
    const { result } = renderHookWithProviders(() => useSellerDiscountLimits());
    await waitFor(() => expect(result.current.myLimit).toBeNull());

    mockFromOnce({
      data: [
        { id: "l1", user_id: "u1", max_discount_percent: 10, set_by: "a", notes: null, created_at: "", updated_at: "" },
      ],
      error: null,
    });
    await act(async () => { await result.current.fetchAllLimits(); });
    expect(result.current.limits).toHaveLength(1);
  });

  it("setLimit retorna true e mostra toast em sucesso", async () => {
    mockFromOnce({ data: null, error: null }); // fetchMyLimit inicial
    const { result } = renderHookWithProviders(() => useSellerDiscountLimits());
    await waitFor(() => expect(result.current.myLimit).toBeNull());

    mockFromOnce({ data: null, error: null });
    let ok = false;
    await act(async () => { ok = await result.current.setLimit("u1", 20, "obs"); });
    expect(ok).toBe(true);
    expect(toast.success).toHaveBeenCalled();
  });

  it("setLimit retorna false em erro", async () => {
    mockFromOnce({ data: null, error: null });
    const { result } = renderHookWithProviders(() => useSellerDiscountLimits());
    await waitFor(() => expect(result.current.myLimit).toBeNull());

    mockFromOnce({ data: null, error: { message: "bad" } });
    let ok = true;
    await act(async () => { ok = await result.current.setLimit("u1", 20); });
    expect(ok).toBe(false);
    expect(toast.error).toHaveBeenCalled();
  });

  it("deleteLimit retorna true em sucesso", async () => {
    mockFromOnce({ data: null, error: null });
    const { result } = renderHookWithProviders(() => useSellerDiscountLimits());
    await waitFor(() => expect(result.current.myLimit).toBeNull());

    mockFromOnce({ data: null, error: null });
    let ok = false;
    await act(async () => { ok = await result.current.deleteLimit("l1"); });
    expect(ok).toBe(true);
  });
});
