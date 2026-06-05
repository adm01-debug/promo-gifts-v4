/**
 * Integração: useTecnicasList → useCustomizationPriceCalculator.
 *
 * Garante que o shape canônico produzido pelos adapters de row é compatível
 * com o shape esperado pelos hooks de preço — sem `console.error`.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act, waitFor } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

vi.mock("@/lib/db/postgrest", () => ({
  dbInvoke: vi.fn(),
}));

vi.mock("@/lib/external-rpc", () => ({
  invokeExternalRpc: vi.fn(),
}));

import { renderHookWithProviders } from "../hooks/_helpers/render-hook-providers";
import { dbInvoke } from "@/lib/db/postgrest";
import { useTecnicasList } from "@/hooks/tecnicas/useTecnicasList";
import { useCustomizationPriceCalculator } from "@/hooks/simulation/useCustomizationPrice";
import {
  TECNICA_ROW_PT,
  TECNICA_ROW_EN,
  PRICE_PAYLOAD_PT_V6,
} from "../fixtures/personalization-payloads";

import { invokeExternalRpc } from "@/lib/external-rpc";
const mockedRpc = invokeExternalRpc as unknown as ReturnType<typeof vi.fn>;
const mockedDbInvoke = dbInvoke as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("Integração técnicas → cálculo de preço", () => {
  it("carrega técnicas mistas e calcula preço para cada uma sem erros", async () => {
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => undefined);

    mockedDbInvoke.mockResolvedValue({
      records: [TECNICA_ROW_PT, TECNICA_ROW_EN],
      count: 2,
    });
    mockedRpc.mockResolvedValue(PRICE_PAYLOAD_PT_V6);

    // 1) Lista técnicas
    const list = renderHookWithProviders(() => useTecnicasList());
    await waitFor(() => expect(list.result.current.isLoading).toBe(false));
    const tecnicas = list.result.current.data ?? [];
    expect(tecnicas.length).toBe(2);

    // 2) Calcula preço para cada técnica usando seu id
    const calc = renderHookWithProviders(() => useCustomizationPriceCalculator());

    for (const t of tecnicas) {
      let res: unknown = null;
      await act(async () => {
        res = await calc.result.current.calculatePrice({
          areaId: t.id,
          quantidade: 50,
          numCores: 1,
        });
      });
      expect(res).not.toBeNull();
      expect((res as { success: boolean }).success).toBe(true);
      expect((res as { total_cobrado: number }).total_cobrado).toBeGreaterThan(0);
    }

    expect(mockedRpc).toHaveBeenCalledTimes(2);
    // Nenhum console.error inesperado durante o fluxo
    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
