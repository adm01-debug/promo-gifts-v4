/**
 * Smoke + funcional mínimo para useTecnicasList.
 *
 * Garante:
 *  - Hook monta sem crash (mesmo com bridge vazio).
 *  - Rows PT antigas continuam mapeadas via adapter (campos `codigo` E `code`
 *    presentes na resposta canônica) e o resultado é convertido em
 *    TecnicaUnificada usável pelos consumidores.
 */
import { describe, expect, it, vi, beforeEach } from "vitest";
import { waitFor } from "@testing-library/react";

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

import { renderHookWithProviders } from "../_helpers/render-hook-providers";
import { dbInvoke } from "@/lib/db/postgrest";
import { useTecnicasList } from "@/hooks/tecnicas/useTecnicasList";
import { TECNICA_ROW_PT, TECNICA_ROW_EN, TECNICA_ROW_HYBRID } from "../../fixtures/personalization-payloads";

const mockedDbInvoke = dbInvoke as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  vi.clearAllMocks();
});

function mockBridgeRecords(records: unknown[]) {
  mockedDbInvoke.mockResolvedValue({ records, count: records.length });
}

describe("useTecnicasList (smoke)", () => {
  it("monta sem crashar com bridge vazio", async () => {
    mockBridgeRecords([]);
    const { result, unmount } = renderHookWithProviders(() => useTecnicasList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toEqual([]);
    unmount();
  });

  it("converte rows PT/EN/híbrido em TecnicaUnificada", async () => {
    mockBridgeRecords([TECNICA_ROW_PT, TECNICA_ROW_EN, TECNICA_ROW_HYBRID]);
    const { result } = renderHookWithProviders(() => useTecnicasList());
    await waitFor(() => expect(result.current.isLoading).toBe(false));

    const tecnicas = result.current.data ?? [];
    expect(tecnicas).toHaveLength(3);

    const pt = tecnicas.find((t) => t.id === "t-pt-1")!;
    expect(pt.codigo).toBe("LASER");
    expect(pt.nome).toBe("Fiber Laser");
    expect(pt.custoSetup).toBe(50);

    const en = tecnicas.find((t) => t.id === "t-en-1")!;
    expect(en.codigo).toBe("SERIG");
    expect(en.nome).toBe("Serigrafia");
    expect(en.custoSetup).toBe(80);
    expect(en.precoPorCor).toBe(true);
    expect(en.maxCores).toBe(4);

    const hyb = tecnicas.find((t) => t.id === "t-hyb-1")!;
    expect(hyb.codigo).toBe("UV");
    expect(hyb.nome).toBe("UV Digital");
    expect(hyb.custoSetup).toBe(90);
  });

  it("aplica filtro apenasAtivas", async () => {
    mockBridgeRecords([
      { ...TECNICA_ROW_PT, ativo: true },
      { ...TECNICA_ROW_EN, active: false },
    ]);
    const { result } = renderHookWithProviders(() =>
      useTecnicasList({ apenasAtivas: true }),
    );
    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].id).toBe("t-pt-1");
  });
});
