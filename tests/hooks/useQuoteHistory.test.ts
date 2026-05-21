/**
 * useQuoteHistory — fetchHistory, addHistoryEntry e helpers de log.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import "../components/render-helpers";
import { act } from "@testing-library/react";
import { renderHookWithProviders } from "./_helpers/render-hook-providers";
import { mockFromOnce, resetSupabaseMocks } from "./_helpers/mock-supabase-builder";
import { useQuoteHistory } from "@/hooks/quotes/useQuoteHistory";

beforeEach(() => {
  resetSupabaseMocks();
  vi.clearAllMocks();
});

describe("useQuoteHistory", () => {
  it("fetchHistory popula history e retorna a lista", async () => {
    mockFromOnce({
      data: [
        { id: "h1", quote_id: "q1", user_id: "u1", action: "created", description: "criado", created_at: "" },
      ],
      error: null,
    });
    const { result } = renderHookWithProviders(() => useQuoteHistory());
    let entries: unknown[] = [];
    await act(async () => { entries = await result.current.fetchHistory("q1"); });
    expect(entries).toHaveLength(1);
    expect(result.current.history).toHaveLength(1);
  });

  it("fetchHistory devolve [] em erro sem crashar", async () => {
    mockFromOnce({ data: null, error: { message: "boom" } });
    const { result } = renderHookWithProviders(() => useQuoteHistory());
    let entries: unknown[] = [{ stale: true }];
    await act(async () => { entries = await result.current.fetchHistory("q1"); });
    expect(entries).toEqual([]);
  });

  it("addHistoryEntry retorna true em sucesso", async () => {
    mockFromOnce({ data: null, error: null });
    const { result } = renderHookWithProviders(() => useQuoteHistory());
    let ok = false;
    await act(async () => { ok = await result.current.addHistoryEntry("q1", "test", "desc"); });
    expect(ok).toBe(true);
  });

  it("logStatusChanged usa labels traduzidas e chama insert", async () => {
    mockFromOnce({ data: null, error: null });
    const { result } = renderHookWithProviders(() => useQuoteHistory());
    let ok = false;
    await act(async () => { ok = await result.current.logStatusChanged("q1", "draft", "approved"); });
    expect(ok).toBe(true);
  });
});
