/**
 * Smoke + funcional mínimo para useProductCustomizationOptions.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    functions: { invoke: vi.fn() },
    auth: {
      getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
    },
  },
}));

// invokeExternalRpc usa supabase.functions.invoke por baixo, então precisamos
// mockar diretamente o módulo external-rpc para o useProductCustomizationOptions
vi.mock("@/lib/external-rpc", () => ({
  invokeExternalRpc: vi.fn(),
}));

import { renderHookWithProviders } from "./_helpers/render-hook-providers";
import { invokeExternalRpc } from "@/lib/external-rpc";
import { useProductCustomizationOptions } from "@/hooks/productsCustomizationOptions";
import { OPTIONS_PAYLOAD_PT } from "../fixtures/personalization-payloads";

const mockedRpc = invokeExternalRpc as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("useProductCustomizationOptions (smoke)", () => {
  it("não chama RPC quando productId é null", async () => {
    const { result, unmount } = renderHookWithProviders(() =>
      useProductCustomizationOptions(null),
    );
    // Query desabilitada → nunca dispara fetch
    await new Promise((r) => setTimeout(r, 30));
    expect(mockedRpc).not.toHaveBeenCalled();
    expect(result.current.data).toBeUndefined();
    unmount();
  });

  it("adapta payload PT canônico em estrutura normalizada", async () => {
    mockedRpc.mockResolvedValue(OPTIONS_PAYLOAD_PT);

    const { result } = renderHookWithProviders(() =>
      useProductCustomizationOptions("prod-1"),
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    const data = result.current.data!;
    expect(data.product_id).toBe("prod-1");
    expect(data.locations).toHaveLength(2);
    expect(data.locations[0].location_code).toBe("FRENTE");
    expect(data.locations[0].options).toHaveLength(2);
    expect(data.locations[0].options[0].technique_id).toBe("tech-1");
    expect(data.locations[0].options[0].cobra_por_cor).toBe(false);
    expect(data.locations[0].options[1].usa_dimensao).toBe(true);
    expect(data.locations[1].options[0].grupo_tecnica).toBe("UV");
  });
});
