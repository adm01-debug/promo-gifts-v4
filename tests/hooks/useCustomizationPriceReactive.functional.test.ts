/**
 * Testes funcionais de useCustomizationPriceReactive — debounce + guards.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHookWithProviders } from "./_helpers/render-hook-providers";
import { useCustomizationPriceReactive } from "@/hooks/simulation/useCustomizationPrice";
import { PRICE_PAYLOAD_PT_V6 } from "../fixtures/personalization-payloads";

vi.mock("@/lib/external-rpc", () => ({
  invokeExternalRpc: vi.fn(),
}));

import { invokeExternalRpc } from "@/lib/external-rpc";
const mockedRpc = invokeExternalRpc as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  vi.useFakeTimers();
  mockedRpc.mockResolvedValue(PRICE_PAYLOAD_PT_V6);
});

afterEach(() => {
  vi.useRealTimers();
});

describe("useCustomizationPriceReactive", () => {
  it("não chama RPC quando techniqueId é null", async () => {
    renderHookWithProviders(() => useCustomizationPriceReactive(null, 100));
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("não chama RPC quando usaDimensao=true mas faltam dimensões", async () => {
    renderHookWithProviders(() =>
      useCustomizationPriceReactive("tech-1", 100, 1, null, null, true),
    );
    await act(async () => {
      vi.advanceTimersByTime(600);
    });
    expect(mockedRpc).not.toHaveBeenCalled();
  });

  it("debounce de 500ms — múltiplas mudanças disparam só 1 chamada", async () => {
    const { rerender } = renderHookWithProviders<
      ReturnType<typeof useCustomizationPriceReactive>,
      { numCores: number }
    >(({ numCores }) => useCustomizationPriceReactive("tech-1", 100, numCores), {
      initialProps: { numCores: 1 },
    });

    // 3 mudanças rápidas dentro do janela de debounce
    rerender({ numCores: 2 });
    rerender({ numCores: 3 });

    // Antes do timeout — nenhuma chamada
    await act(async () => {
      vi.advanceTimersByTime(400);
    });
    expect(mockedRpc).not.toHaveBeenCalled();

    // Depois do timeout — exatamente 1 chamada com último valor
    await act(async () => {
      vi.advanceTimersByTime(200);
      // flush microtasks da Promise interna
      await Promise.resolve();
    });
    expect(mockedRpc).toHaveBeenCalledTimes(1);
    expect(mockedRpc.mock.calls[0][1].p_num_cores).toBe(3);
  });

  it("envia dimensões quando usaDimensao=true e ambas presentes", async () => {
    renderHookWithProviders(() =>
      useCustomizationPriceReactive("tech-1", 100, 1, 5, 8, true),
    );
    await act(async () => {
      vi.advanceTimersByTime(600);
      await Promise.resolve();
    });
    expect(mockedRpc).toHaveBeenCalledTimes(1);
    const params = mockedRpc.mock.calls[0][1];
    expect(params.p_largura_cm).toBe(5);
    expect(params.p_altura_cm).toBe(8);
  });
});
