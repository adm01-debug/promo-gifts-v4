/**
 * Testes funcionais de useCustomizationPriceCalculator.
 *
 * Mocka invokeExternalRpc para validar:
 *  - Happy path PT canônico.
 *  - Happy path EN (validador detecta drift, mas hook continua funcional).
 *  - Error path (success: false).
 *  - Sem dimensão → params RPC não enviam p_largura_cm/p_altura_cm.
 *  - Validador incrementa contractMismatches quando required falta.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { act } from "@testing-library/react";
import { renderHookWithProviders } from "./_helpers/render-hook-providers";
import { useCustomizationPriceCalculator } from "@/hooks/simulation/useCustomizationPrice";
import {
  PRICE_PAYLOAD_PT_V6,
  PRICE_PAYLOAD_EN_FUTURE,
} from "../fixtures/personalization-payloads";
import {
  __resetSchemaStatsForTests,
  getContractMismatches,
} from "@/lib/personalization/adapters";

vi.mock("@/lib/external-rpc", () => ({
  invokeExternalRpc: vi.fn(),
}));

import { invokeExternalRpc } from "@/lib/external-rpc";

const mockedRpc = invokeExternalRpc as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
  __resetSchemaStatsForTests();
});

describe("useCustomizationPriceCalculator", () => {
  it("happy path PT — resolve com payload canônico", async () => {
    mockedRpc.mockResolvedValue(PRICE_PAYLOAD_PT_V6);
    const { result } = renderHookWithProviders(() => useCustomizationPriceCalculator());

    let res: unknown = null;
    await act(async () => {
      res = await result.current.calculatePrice({
        areaId: "tech-1",
        quantidade: 100,
        numCores: 1,
      });
    });

    expect(res).not.toBeNull();
    expect((res as typeof PRICE_PAYLOAD_PT_V6).success).toBe(true);
    expect((res as typeof PRICE_PAYLOAD_PT_V6).preco_unitario).toBe(3.5);
    expect(result.current.error).toBeNull();
    expect(result.current.loading).toBe(false);

    // Params enviados — sem dimensões
    const callArgs = mockedRpc.mock.calls[0];
    expect(callArgs[0]).toBe("fn_get_customization_price");
    expect(callArgs[1]).toEqual({
      p_area_id: "tech-1",
      p_quantidade: 100,
      p_num_cores: 1,
    });
    expect(callArgs[1].p_largura_cm).toBeUndefined();
    expect(callArgs[1].p_altura_cm).toBeUndefined();
  });

  it("happy path EN — validador detecta missing mas hook continua funcional", async () => {
    mockedRpc.mockResolvedValue(PRICE_PAYLOAD_EN_FUTURE);
    const { result } = renderHookWithProviders(() => useCustomizationPriceCalculator());

    let res: unknown = null;
    await act(async () => {
      res = await result.current.calculatePrice({
        areaId: "tech-1",
        quantidade: 100,
        numCores: 1,
      });
    });

    // Aliases EN são reconhecidos pelo aliasMap → ok: true (sem mismatches)
    expect(res).not.toBeNull();
    expect((res as { success: boolean }).success).toBe(true);
    const mismatches = getContractMismatches();
    expect(mismatches["fn_get_customization_price"] ?? 0).toBe(0);
  });

  it("error path — RPC retorna success:false", async () => {
    mockedRpc.mockResolvedValue({ success: false, error: "no table" });
    const { result } = renderHookWithProviders(() => useCustomizationPriceCalculator());

    let res: unknown = "init";
    await act(async () => {
      res = await result.current.calculatePrice({
        areaId: "tech-x",
        quantidade: 50,
      });
    });

    expect(res).toBeNull();
    expect(result.current.error).toBe("no table");
    expect(result.current.loading).toBe(false);
  });

  it("envia dimensões quando informadas", async () => {
    mockedRpc.mockResolvedValue(PRICE_PAYLOAD_PT_V6);
    const { result } = renderHookWithProviders(() => useCustomizationPriceCalculator());

    await act(async () => {
      await result.current.calculatePrice({
        areaId: "tech-1",
        quantidade: 100,
        numCores: 2,
        larguraCm: 5,
        alturaCm: 8,
      });
    });

    const params = mockedRpc.mock.calls[0][1];
    expect(params.p_largura_cm).toBe(5);
    expect(params.p_altura_cm).toBe(8);
    expect(params.p_num_cores).toBe(2);
  });

  it("validador incrementa contractMismatches quando required falta", async () => {
    // Payload válido em formato mas sem 'tabela' (campo required)
    mockedRpc.mockResolvedValue({
      success: true,
      nome_tabela: 'X',
      grupo_tecnica: 'X',
      quantidade: 10,
      num_cores: 1,
      preco_unitario: 1,
      valor_gravacao: 10,
      setup_total: 0,
      total_cobrado: 10,
      faixa: { qtd_min: 1, qtd_max: 99 },
      detalhes: { cobra_por_cor: false, max_cores: 1 },
    });

    const { result } = renderHookWithProviders(() => useCustomizationPriceCalculator());
    await act(async () => {
      await result.current.calculatePrice({ areaId: "x", quantidade: 10 });
    });

    const mismatches = getContractMismatches();
    expect(mismatches["fn_get_customization_price"] ?? 0).toBeGreaterThan(0);
  });

  it("propaga erro quando RPC throw", async () => {
    mockedRpc.mockRejectedValue(new Error("network"));
    const { result } = renderHookWithProviders(() => useCustomizationPriceCalculator());

    let res: unknown = "init";
    await act(async () => {
      res = await result.current.calculatePrice({ areaId: "x", quantidade: 10 });
    });

    expect(res).toBeNull();
    expect(result.current.error).toBe("network");
  });
});
