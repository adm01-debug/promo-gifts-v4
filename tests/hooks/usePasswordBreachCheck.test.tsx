/**
 * usePasswordBreachCheck — testes funcionais
 * Mocks: crypto.subtle.digest e fetch (HIBP API).
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHookWithProviders } from "./_helpers/render-hook-providers";
import { usePasswordBreachCheck } from "@/hooks/auth/usePasswordBreachCheck";

const SHA1_HEX = "5BAA61E4C9B93F3F0682250B6CF8331B7EE68FD8".toUpperCase(); // sha1("password")

beforeEach(() => {
  // Mock crypto.subtle.digest sempre retornando bytes do SHA1 acima
  const bytes = new Uint8Array(SHA1_HEX.match(/.{2}/g)!.map((h) => parseInt(h, 16)));
  vi.stubGlobal("crypto", {
    subtle: {
      digest: vi.fn().mockResolvedValue(bytes.buffer),
    },
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("usePasswordBreachCheck", () => {
  it("retorna isBreached=false e não chama fetch para senha < 8 chars", async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const { result } = renderHookWithProviders(() => usePasswordBreachCheck());
    let breached: boolean = true;
    await act(async () => {
      breached = await result.current.checkPassword("abc");
    });
    expect(breached).toBe(false);
    expect(fetchSpy).not.toHaveBeenCalled();
    expect(result.current.isBreached).toBe(false);
  });

  it("detecta senha vazada quando o suffix bate na resposta", async () => {
    const suffix = SHA1_HEX.substring(5);
    const body = `${suffix}:1234\nDEADBEEF0000:5`;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(body),
    }));

    const { result } = renderHookWithProviders(() => usePasswordBreachCheck());
    let breached: boolean = false;
    await act(async () => {
      breached = await result.current.checkPassword("password123");
    });
    expect(breached).toBe(true);
    expect(result.current.isBreached).toBe(true);
    expect(result.current.count).toBe(1234);
    expect(result.current.error).toBeNull();
  });

  it("não marca como vazada quando suffix não bate", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve("FFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF:9"),
    }));
    const { result } = renderHookWithProviders(() => usePasswordBreachCheck());
    let breached: boolean = true;
    await act(async () => {
      breached = await result.current.checkPassword("longerpass");
    });
    expect(breached).toBe(false);
    expect(result.current.isBreached).toBe(false);
  });

  it("trata erro de rede graciosamente", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false }));
    const { result } = renderHookWithProviders(() => usePasswordBreachCheck());
    await act(async () => {
      await result.current.checkPassword("longerpass");
    });
    expect(result.current.error).toBe("Não foi possível verificar");
    expect(result.current.isBreached).toBe(false);
  });

  it("reset() limpa estado", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true,
      text: () => Promise.resolve(`${SHA1_HEX.substring(5)}:99`),
    }));
    const { result } = renderHookWithProviders(() => usePasswordBreachCheck());
    await act(async () => { await result.current.checkPassword("longerpass"); });
    expect(result.current.isBreached).toBe(true);
    act(() => result.current.reset());
    expect(result.current.isBreached).toBe(false);
    expect(result.current.count).toBeNull();
  });
});
