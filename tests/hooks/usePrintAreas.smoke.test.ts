/**
 * Smoke para usePrintAreas — garante que rows PT (área com `codigo`/`area_code`)
 * passam pelo adapter e geram PrintAreaWithTechniques válidos.
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

import { renderHookWithProviders } from "./_helpers/render-hook-providers";
import { supabase } from "@/integrations/supabase/client";
import { usePrintAreas } from "@/hooks/simulation/usePrintAreas";
import { PRINT_AREA_ROW_PT, TABELA_PRECO_ROW_PT } from "../fixtures/personalization-payloads";

beforeEach(() => {
  vi.clearAllMocks();
});

describe("usePrintAreas (smoke)", () => {
  it("retorna [] quando productId é null", async () => {
    const { result, unmount } = renderHookWithProviders(() => usePrintAreas(null));
    await new Promise((r) => setTimeout(r, 30));
    expect(result.current.data).toBeUndefined();
    unmount();
  });

  it("adapta print_area_techniques + lookup de técnicas", async () => {
    const invoke = supabase.functions.invoke as unknown as ReturnType<typeof vi.fn>;
    invoke.mockImplementation((_fn, opts: { body?: { table?: string } } = {}) => {
      const table = opts.body?.table;
      if (table === "print_area_techniques") {
        return Promise.resolve({
          data: { success: true, data: { records: [PRINT_AREA_ROW_PT] } },
          error: null,
        });
      }
      if (table === "tabela_preco_gravacao_oficial") {
        return Promise.resolve({
          data: { success: true, data: { records: [TABELA_PRECO_ROW_PT] } },
          error: null,
        });
      }
      return Promise.resolve({ data: { success: true, data: { records: [] } }, error: null });
    });

    const { result } = renderHookWithProviders(() => usePrintAreas("prod-1"));
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    const areas = result.current.data ?? [];
    expect(areas).toHaveLength(1);
    expect(areas[0].area_code).toBe("FRENTE");
    expect(areas[0].max_width).toBe(5);
    expect(areas[0].max_height).toBe(8);
    expect(areas[0].techniques).toHaveLength(1);
    expect(areas[0].techniques[0].nome).toBe("Fiber Laser");
  });
});
