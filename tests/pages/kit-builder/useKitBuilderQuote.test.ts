/**
 * Testes — useKitBuilderQuote
 *
 * Garante que o hook envia `seller_id = user.id` no INSERT em `quotes`
 * quando o usuário cria um orçamento a partir do Kit Builder. Também
 * verifica que sem usuário autenticado nenhuma mutação é disparada.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { createSupabaseMock } from "../../helpers/supabase-mock";
import type { KitState } from "@/hooks/useKitBuilder";

vi.mock("@/lib/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("react-router-dom", () => ({ useNavigate: () => vi.fn() }));
vi.mock("@/lib/kit-builder", () => ({
  calculateTotalKitPrice: () => ({
    boxPrice: 150,
    itemsPrice: 100,
    personalizationPrice: 0,
    subtotal: 250,
    total: 250,
    unitPrice: 250,
  }),
}));

const USER_ID = "vendedor-uuid-7";

const KIT_STATE: KitState = {
  isValid: true,
  kitType: "premium",
  name: "Kit teste",
  identity: { color: "#fff", icon: "star", tag: "PROMO" },
  box: {
    id: "box-1",
    name: "Caixa A",
    sku: "BOX-A",
    imageUrl: null,
    price: 50,
    internalWidth: 30,
    internalHeight: 20,
    internalDepth: 10,
  } as KitState["box"],
  items: [
    { id: "item-1", name: "Caneta", sku: "PEN", imageUrl: null, price: 10, quantity: 5, isOptional: false, selectedColor: null } as KitState["items"][number],
  ],
  personalization: { box: { enabled: false }, items: {} } as KitState["personalization"],
  volumeUsagePercent: 80,
} as KitState;

describe("useKitBuilderQuote — payloads", () => {
  let mock: ReturnType<typeof createSupabaseMock>;

  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.doUnmock("@/integrations/supabase/client");
    vi.doUnmock("@/contexts/AuthContext");
    vi.clearAllMocks();
  });

  async function loadHook(opts: { user: { id: string } | null }) {
    mock = createSupabaseMock({
      insertReturn: (table, payload) => {
        if (table === "quotes") return { id: "new-quote-id", quote_number: "ORC-001" };
        if (table === "quote_items") {
          const arr = payload as Array<Record<string, unknown>>;
          return arr.map((p, i) => ({ id: `qi-${i}`, product_id: p.product_id }));
        }
        return { id: `mock-${table}` };
      },
    });
    vi.doMock("@/integrations/supabase/client", () => ({ supabase: mock.client }));
    vi.doMock("@/contexts/AuthContext", () => ({ useAuth: () => ({ user: opts.user }) }));
    const mod = await import("@/pages/kit-builder/useKitBuilderQuote");
    return mod.useKitBuilderQuote;
  }

  it("inclui seller_id = user.id no INSERT em quotes", async () => {
    const useHook = await loadHook({ user: { id: USER_ID } });
    const { result } = renderHook(() => useHook());

    await act(async () => {
      await result.current.handleAddToQuote(KIT_STATE, 3);
    });

    const quoteIns = mock.calls.insert.find((c) => c.table === "quotes");
    expect(quoteIns).toBeDefined();
    expect(quoteIns!.payload).toMatchObject({
      seller_id: USER_ID,
      status: "draft",
      subtotal: 250,
      total: 250,
    });
    expect((quoteIns!.payload as { seller_id: string }).seller_id).toBe(USER_ID);
  });

  it("não dispara mutações quando usuário não está autenticado", async () => {
    const useHook = await loadHook({ user: null });
    const { result } = renderHook(() => useHook());

    await act(async () => {
      await result.current.handleAddToQuote(KIT_STATE, 1);
    });

    expect(mock.calls.insert).toHaveLength(0);
    expect(mock.calls.update).toHaveLength(0);
    expect(mock.calls.delete).toHaveLength(0);
  });

  it("quote_items são inseridos ligados ao quote criado (sem seller_id direto)", async () => {
    const useHook = await loadHook({ user: { id: USER_ID } });
    const { result } = renderHook(() => useHook());

    await act(async () => {
      await result.current.handleAddToQuote(KIT_STATE, 2);
    });

    const itemsIns = mock.calls.insert.find((c) => c.table === "quote_items");
    expect(itemsIns).toBeDefined();
    const arr = itemsIns!.payload as Array<Record<string, unknown>>;
    // todos os items apontam ao quote criado
    for (const it of arr) {
      expect(it.quote_id).toBe("new-quote-id");
      // seller_id é herdado por FK no banco — não deve estar no item
      expect(it).not.toHaveProperty("seller_id");
    }
  });
});
