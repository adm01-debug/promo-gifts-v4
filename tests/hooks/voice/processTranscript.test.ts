import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase before importing the module
vi.mock("@/integrations/supabase/client", () => {
  return {
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
    supabase: {
      auth: {
        getSession: () =>
          Promise.resolve({
            data: { session: { access_token: "test-token-123" } },
          }),
      },
    },
    SUPABASE_URL: "https://test.supabase.co",
    SUPABASE_PUBLISHABLE_KEY: "test-anon-key",
  };
});

// Must import after mocks are set up
import { processVoiceTranscript } from "@/hooks/voice/processTranscript";

describe("processVoiceTranscript", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    // Set env vars
    vi.stubEnv("VITE_SUPABASE_URL", "https://test.supabase.co");
    vi.stubEnv("VITE_SUPABASE_PUBLISHABLE_KEY", "test-anon-key");
  });

  it("returns structured action from successful API response", async () => {
    const mockAction = {
      action: "search",
      response: "Buscando mochilas azuis",
      data: { query: "mochilas azuis", filters: { color: "azul" } },
    };

    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(mockAction),
    });

    const result = await processVoiceTranscript("mostra mochilas azuis");
    expect(result.action).toBe("search");
    expect(result.response).toBe("Buscando mochilas azuis");
    expect(result.data?.filters?.color).toBe("azul");
  });

  it("sends correct headers with auth token", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({ action: "answer", response: "ok", data: {} }),
    });

    await processVoiceTranscript("teste");

    expect(global.fetch).toHaveBeenCalledWith(
      expect.stringContaining("/functions/v1/voice-agent"),
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({
          "Content-Type": "application/json",
          Authorization: "Bearer test-token-123",
        }),
        body: JSON.stringify({ transcript: "teste" }),
      })
    );
  });

  it("throws on non-ok response", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
      text: () => Promise.resolve("Internal Server Error"),
    });

    await expect(processVoiceTranscript("teste")).rejects.toThrow(
      "AI processing failed: 500"
    );
  });

  it("validates action and provides fallback for missing fields", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ unexpected: "data" }),
    });

    const result = await processVoiceTranscript("teste");
    expect(result.action).toBe("answer");
    expect(result.response).toContain("Desculpe");
  });

  it("throws timeout error on abort", async () => {
    // Usa fake timers para não esperar os 15s reais do AbortController interno.
    vi.useFakeTimers();
    global.fetch = vi.fn().mockImplementation((_url, opts) => {
      return new Promise((_resolve, reject) => {
        opts?.signal?.addEventListener("abort", () => {
          const err = new DOMException("The operation was aborted.", "AbortError");
          reject(err);
        });
      });
    });

    const promise = processVoiceTranscript("teste");
    // Captura imediatamente para evitar unhandled rejection
    const assertion = expect(promise).rejects.toThrow();
    await vi.advanceTimersByTimeAsync(15_000);
    await assertion;
    vi.useRealTimers();
  });
});
