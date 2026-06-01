/**
 * Smoke para usePrintAreas — garante que rows PT (área com `codigo`/`area_code`)
 * passam pelo adapter e geram PrintAreaWithTechniques válidos.
 *
 * FIX: BUG-14 migrou o hook de supabase.functions.invoke (bridge externo) para
 * supabase.from() (PostgREST nativo). O mock foi atualizado para refletir isso.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";

// Chainable builder factory — retorna o mesmo objeto para cada método de cadeia,
// resolvendo `.then()` com o payload configurado.
function makeBuilder(resolvedValue: { data: unknown[]; error: null }) {
  const builder: Record<string, unknown> = {};
  const chainMethods = [
    "select", "eq", "neq", "gt", "gte", "lt", "lte",
    "in", "is", "or", "filter", "order", "limit", "range",
  ];
  for (const m of chainMethods) {
    builder[m] = vi.fn().mockReturnValue(builder);
  }
  builder.single = vi.fn().mockResolvedValue(resolvedValue);
  builder.then = vi.fn((onFulfilled?: (v: typeof resolvedValue) => unknown) =>
    Promise.resolve(resolvedValue).then(onFulfilled),
  );
  return builder;
}

vi.mock("@/integrations/supabase/client", () => {
  // from() retorna builder diferente por tabela — controlado por fromImpl abaixo.
  const fromImpl = vi.fn();

  return {
    supabase: {
      from: fromImpl,
      functions: { invoke: vi.fn() },
      auth: {
        getSession: vi.fn().mockResolvedValue({ data: { session: null }, error: null }),
        onAuthStateChange: vi.fn().mockReturnValue({
          data: { subscription: { unsubscribe: vi.fn() } },
        }),
      },
    },
  };
});

import { renderHookWithProviders } from "./_helpers/render-hook-providers";
import { supabase } from "@/integrations/supabase/client";
import { usePrintAreas } from "@/hooks/simulation/usePrintAreas";
import { PRINT_AREA_ROW_PT, TABELA_PRECO_ROW_PT } from "../fixtures/personalization-payloads";

const mockedFrom = supabase.from as unknown as ReturnType<typeof vi.fn>;

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
    // BUG-14: hook agora usa supabase.from() (PostgREST), não functions.invoke.
    mockedFrom.mockImplementation((table: string) => {
      if (table === "print_area_techniques") {
        return makeBuilder({ data: [PRINT_AREA_ROW_PT], error: null });
      }
      if (table === "tabela_preco_gravacao_oficial") {
        return makeBuilder({ data: [TABELA_PRECO_ROW_PT], error: null });
      }
      return makeBuilder({ data: [], error: null });
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
