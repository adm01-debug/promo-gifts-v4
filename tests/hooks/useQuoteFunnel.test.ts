/**
 * useQuoteFunnel — função pura de cálculo do funil.
 */
import { describe, it, expect } from "vitest";
import { renderHook } from "@testing-library/react";
import { useQuoteFunnel } from "@/hooks/quotes";
import type { Quote } from "@/hooks/quotes";

const mkQuote = (overrides: Partial<Quote>): Quote =>
  ({ id: Math.random().toString(36), status: "draft", created_at: "2025-01-01", updated_at: "2025-01-02", ...overrides }) as Quote;

describe("useQuoteFunnel", () => {
  it("retorna 5 estágios", () => {
    const { result } = renderHook(() => useQuoteFunnel([], {}));
    expect(result.current.stages).toHaveLength(5);
    expect(result.current.stages.map(s => s.id)).toEqual(["draft", "sent", "viewed", "approved", "converted"]);
  });

  it("contagem cumulativa: aprovado conta em sent/viewed", () => {
    const quotes: Quote[] = [
      mkQuote({ id: "1", status: "draft" }),
      mkQuote({ id: "2", status: "sent" }),
      mkQuote({ id: "3", status: "approved" }),
      mkQuote({ id: "4", status: "converted" }),
    ];
    const { result } = renderHook(() => useQuoteFunnel(quotes, {}));
    const stages = result.current.stages;
    expect(stages.find(s => s.id === "draft")!.count).toBe(4); // total
    expect(stages.find(s => s.id === "sent")!.count).toBe(3); // sent+approved+converted
    expect(stages.find(s => s.id === "approved")!.count).toBe(2);
    expect(stages.find(s => s.id === "converted")!.count).toBe(1);
  });

  it("rateFromPrev=null para draft, % para demais", () => {
    const quotes: Quote[] = [mkQuote({ status: "sent" }), mkQuote({ status: "draft" })];
    const { result } = renderHook(() => useQuoteFunnel(quotes, {}));
    expect(result.current.stages[0].rateFromPrev).toBeNull();
    expect(result.current.stages[1].rateFromPrev).toBe(50);
  });

  it("avgCycleDays = null sem fechados", () => {
    const { result } = renderHook(() => useQuoteFunnel([mkQuote({ status: "draft" })], {}));
    expect(result.current.avgCycleDays).toBeNull();
  });

  it("avgCycleDays calculado para approved/converted", () => {
    const quotes: Quote[] = [
      mkQuote({ status: "approved", created_at: "2025-01-01", updated_at: "2025-01-04" }),
      mkQuote({ status: "converted", created_at: "2025-01-01", updated_at: "2025-01-03" }),
    ];
    const { result } = renderHook(() => useQuoteFunnel(quotes, {}));
    expect(result.current.avgCycleDays).toBeCloseTo(2.5, 1);
  });

  it("viewed conta apenas com viewedMap", () => {
    const quotes: Quote[] = [
      mkQuote({ id: "q1", status: "sent" }),
      mkQuote({ id: "q2", status: "sent" }),
    ];
    const { result } = renderHook(() => useQuoteFunnel(quotes, { q1: { viewedAt: "2025-01-02" } }));
    expect(result.current.stages.find(s => s.id === "viewed")!.count).toBe(1);
  });
});
