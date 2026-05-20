import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: () =>
        Promise.resolve({
          data: { session: { access_token: "test-token" } },
        }),
    },
  },
}));

vi.mock("sonner", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

import { useAIRecommendations } from "@/hooks/intelligence/useAIRecommendations";

describe("useAIRecommendations", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-key");
  });

  afterEach(() => {
    // Garante que qualquer teste que tenha ativado fake timers volta ao normal
    vi.useRealTimers();
  });

  const mockClient = { name: "Acme Corp", industry: "Tecnologia" };
  const mockProducts = [
    { id: "1", name: "Caneta", category: "Escritório" },
    { id: "2", name: "Mochila", category: "Bags" },
  ];

  const mockResult = {
    recommendations: [{ productId: "1", score: 0.95, reason: "Ideal para tech" }],
    insights: "Cliente tech prefere itens premium",
  };

  it("returns recommendations on success", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    const { result } = renderHook(() => useAIRecommendations());

    await act(async () => {
      await result.current.fetchRecommendations(mockClient, mockProducts);
    });

    expect(result.current.recommendations).toHaveLength(1);
    expect(result.current.recommendations[0].productId).toBe("1");
    expect(result.current.insights).toContain("tech");
    expect(result.current.error).toBeNull();
  });

  it("uses cache on repeated identical requests", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    const { result } = renderHook(() => useAIRecommendations());

    await act(async () => {
      await result.current.fetchRecommendations(mockClient, mockProducts);
    });
    await act(async () => {
      await result.current.fetchRecommendations(mockClient, mockProducts);
    });

    // fetch should only be called once (second call uses cache)
    expect(global.fetch).toHaveBeenCalledTimes(1);
    expect(result.current.recommendations).toHaveLength(1);
  });

  it("handles 429 rate limit without retry", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 429, text: () => Promise.resolve("") });

    const { result } = renderHook(() => useAIRecommendations());

    await act(async () => {
      await result.current.fetchRecommendations(mockClient, mockProducts);
    });

    expect(result.current.error).toContain("Limite");
    expect(result.current.data).toBeNull();
    // Should not retry on 429
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("handles 402 credits exhausted", async () => {
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 402, text: () => Promise.resolve("") });

    const { result } = renderHook(() => useAIRecommendations());

    await act(async () => {
      await result.current.fetchRecommendations(mockClient, mockProducts);
    });

    expect(result.current.error).toContain("Créditos");
  });

  it("validates empty client name", async () => {
    const { result } = renderHook(() => useAIRecommendations());

    await act(async () => {
      await result.current.fetchRecommendations({ name: "" }, mockProducts);
    });

    expect(result.current.error).toContain("obrigatório");
  });

  it("validates empty products list", async () => {
    const { result } = renderHook(() => useAIRecommendations());

    await act(async () => {
      await result.current.fetchRecommendations(mockClient, []);
    });

    expect(result.current.error).toContain("produto");
  });

  it("resets state and aborts correctly", async () => {
    // Fake timers para pular backoffs do retry path em 500
    vi.useFakeTimers({ shouldAdvanceTime: true });
    global.fetch = vi.fn().mockResolvedValue({ ok: false, status: 500, text: () => Promise.resolve("err") });

    const { result } = renderHook(() => useAIRecommendations());

    await act(async () => {
      const promise = result.current.fetchRecommendations(mockClient, mockProducts);
      await vi.advanceTimersByTimeAsync(2_000);
      await promise;
    });

    expect(result.current.error).not.toBeNull();

    act(() => result.current.reset());

    expect(result.current.error).toBeNull();
    expect(result.current.data).toBeNull();
  });

  it("clearCache forces new fetch", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockResult),
    });

    const { result } = renderHook(() => useAIRecommendations());

    await act(async () => {
      await result.current.fetchRecommendations(mockClient, mockProducts);
    });

    act(() => result.current.clearCache());

    await act(async () => {
      await result.current.fetchRecommendations(mockClient, mockProducts);
    });

    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  it("retries up to 3 times on 5xx errors", async () => {
    // Fake timers SOMENTE neste teste para pular os backoffs exponenciais (500ms + 1000ms)
    vi.useFakeTimers({ shouldAdvanceTime: true });
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 503,
      text: () => Promise.resolve("Service Unavailable"),
    });

    const { result } = renderHook(() => useAIRecommendations());

    await act(async () => {
      const promise = result.current.fetchRecommendations(mockClient, mockProducts);
      // Avança 2s para cobrir os dois backoffs sem esperar tempo real
      await vi.advanceTimersByTimeAsync(2_000);
      await promise;
    });

    // 1 initial + 2 retries = 3 total
    expect(global.fetch).toHaveBeenCalledTimes(3);
    expect(result.current.error).toContain("503");
  });

  it("handles unauthenticated user", async () => {
    // Override the supabase mock for this test
    const supabaseModule = await import("@/integrations/supabase/client");
    vi.spyOn(supabaseModule.supabase.auth, "getSession").mockResolvedValueOnce({
      data: { session: null },
      error: null,
    } as any);

    const { result } = renderHook(() => useAIRecommendations());

    await act(async () => {
      await result.current.fetchRecommendations(mockClient, mockProducts);
    });

    expect(result.current.error).toContain("autenticado");
  });

  it("handles network failure gracefully", async () => {
    // Fake timers para pular os backoffs do retry path em TypeError
    vi.useFakeTimers({ shouldAdvanceTime: true });
    global.fetch = vi.fn().mockRejectedValue(new TypeError("Failed to fetch"));

    const { result } = renderHook(() => useAIRecommendations());

    await act(async () => {
      const promise = result.current.fetchRecommendations(mockClient, mockProducts);
      await vi.advanceTimersByTimeAsync(2_000);
      await promise;
    });

    expect(result.current.error).toBeTruthy();
    expect(result.current.data).toBeNull();
  });
});
