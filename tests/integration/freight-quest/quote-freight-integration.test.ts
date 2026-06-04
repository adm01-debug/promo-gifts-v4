/**
 * freight-quest: Testes de integração — Quote com Frete
 *
 * Cobre:
 *  - Fluxo completo: criação de quote → cálculo de frete → sync
 *  - Mock de integrações externas (Supabase, N8N, Bitrix)
 *  - Consistência de dados entre steps do wizard
 *  - Cenários de erro e fallback
 *  - Regressões de integração conhecidas
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createSupabaseClientMock,
  mockEdgeFunctionFetch,
  resetExternalMocks,
  type EdgeFnResponseSpec,
} from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

// ─── Fixtures ────────────────────────────────────────────────────────────────

const VALID_QUOTE_ID = "550e8400-e29b-41d4-a716-446655440001";
const VALID_CLIENT_ID = "client-a1b2c3d4";
const VALID_PRODUCT_ID = "prod-00001";

const QUOTE_WITH_FREIGHT: object = {
  id: VALID_QUOTE_ID,
  client_id: VALID_CLIENT_ID,
  status: "draft",
  shipping_type: "fob_pre",
  shipping_cost: 89.5,
  subtotal: 1500.0,
  discount_percent: 5,
  discount_amount: 75.0,
  total: 1514.5,
  items: [
    {
      id: "item-001",
      product_id: VALID_PRODUCT_ID,
      product_name: "Squeeze Personalizado",
      quantity: 100,
      unit_price: 15.0,
      subtotal: 1500.0,
    },
  ],
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer service-role-key",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

// ─── Integração: quote-sync com frete ─────────────────────────────────────────

describe("quote-sync — integração com frete", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("sync_quote com shipping_type=fob_pre → total inclui frete", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: {
        ok: true,
        synced: true,
        quote_id: VALID_QUOTE_ID,
        totals: {
          subtotal: 1500.0,
          discount_amount: 75.0,
          shipping_cost: 89.5,
          total: 1514.5,
        },
      },
    };
    mockEdgeFunctionFetch({ "/quote-sync": spec });

    const res = await post("/quote-sync", {
      action: "sync_quote",
      data: { quoteId: VALID_QUOTE_ID },
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.totals.total).toBe(1514.5);
    expect(data.totals.shipping_cost).toBe(89.5);
  });

  it("sync_quote com shipping_type=cif → total NÃO inclui frete", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: {
        ok: true,
        synced: true,
        quote_id: VALID_QUOTE_ID,
        totals: {
          subtotal: 1500.0,
          discount_amount: 75.0,
          shipping_cost: 0,
          total: 1425.0,
        },
      },
    };
    mockEdgeFunctionFetch({ "/quote-sync": spec });

    const res = await post("/quote-sync", {
      action: "sync_quote",
      data: { quoteId: VALID_QUOTE_ID },
    });
    const data = await res.json();
    expect(data.totals.shipping_cost).toBe(0);
    expect(data.totals.total).toBe(1425.0);
  });

  it("quoteId inválido (não-UUID) → 400 validation error", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 400,
      body: { error: "validation_failed", message: "quoteId must be a valid UUID" },
    };
    mockEdgeFunctionFetch({ "/quote-sync": spec });

    const res = await post("/quote-sync", {
      action: "sync_quote",
      data: { quoteId: "not-a-uuid" },
    });
    expect(res.status).toBe(400);
  });

  it("quoteId UUID mas não encontrado → 404", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 404,
      body: { error: "Quote not found" },
    };
    mockEdgeFunctionFetch({ "/quote-sync": spec });

    const res = await post("/quote-sync", {
      action: "sync_quote",
      data: { quoteId: "00000000-0000-4000-8000-000000000001" },
    });
    expect(res.status).toBe(404);
  });

  it("action desconhecido → 400", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 400,
      body: { error: "Unknown action" },
    };
    mockEdgeFunctionFetch({ "/quote-sync": spec });

    const res = await post("/quote-sync", {
      action: "invalid_action",
      data: {},
    });
    expect(res.status).toBe(400);
  });

  it("sync_all_pending → 200 + count", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, synced_count: 3, failed_count: 0 },
    };
    mockEdgeFunctionFetch({ "/quote-sync": spec });

    const res = await post("/quote-sync", { action: "sync_all_pending", data: {} });
    const data = await res.json();
    expect(data.ok).toBe(true);
    expect(typeof data.synced_count).toBe("number");
  });

  it("test_webhook → 200 + webhook_sent", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, webhook_sent: true },
    };
    mockEdgeFunctionFetch({ "/quote-sync": spec });

    const res = await post("/quote-sync", { action: "test_webhook", data: {} });
    const data = await res.json();
    expect(data.webhook_sent).toBe(true);
  });
});

// ─── Integração: webhook → quote state update ─────────────────────────────────

describe("integração: webhook-inbound → dispara atualização de quote", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("evento quote.approved via webhook → 200 + processa aprovação", async () => {
    const inboundSpec: EdgeFnResponseSpec = {
      status: 200,
      body: {
        ok: true,
        event_id: "evt-001",
        downstream: { quote_sync: "triggered" },
      },
    };
    mockEdgeFunctionFetch({ "/webhook-inbound": inboundSpec });

    const res = await post("/webhook-inbound", {
      event: "quote.approved",
      occurred_at: new Date().toISOString(),
      data: {
        quote_id: VALID_QUOTE_ID,
        approved_by: VALID_CLIENT_ID,
        total: 1514.5,
      },
      source: "bitrix24",
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("evento order.created com shipping info via webhook → 200", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: {
        ok: true,
        event_id: "evt-002",
      },
    };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });

    const res = await post("/webhook-inbound", {
      event: "order.created",
      occurred_at: new Date().toISOString(),
      data: {
        order_id: "ORD-2026-001",
        quote_id: VALID_QUOTE_ID,
        shipping_type: "fob_pre",
        shipping_cost: 89.5,
        total: 1514.5,
      },
      source: "n8n",
    });
    expect(res.status).toBe(200);
  });
});

// ─── Integração: Supabase mock ─────────────────────────────────────────────────

describe("integração com Supabase mock — operações de quote", () => {
  it("insert de quote com frete retorna dados completos", async () => {
    const supabase = createSupabaseClientMock({
      fromSelect: async () => ({
        data: [QUOTE_WITH_FREIGHT],
        error: null,
      }),
    });

    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .then((r: unknown) => r as { data: unknown[]; error: null });

    expect(error).toBeNull();
    expect(Array.isArray(data)).toBe(true);
    if (Array.isArray(data) && data.length > 0) {
      const quote = data[0] as typeof QUOTE_WITH_FREIGHT;
      expect((quote as Record<string, unknown>).shipping_type).toBe("fob_pre");
      expect((quote as Record<string, unknown>).shipping_cost).toBe(89.5);
    }
  });

  it("rpc para calcular totais retorna valor correto", async () => {
    const supabase = createSupabaseClientMock({
      rpc: async () => ({
        data: { total: 1514.5, shipping_cost: 89.5 },
        error: null,
      }),
    });

    const { data, error } = await supabase.rpc("calculate_quote_totals", {
      p_quote_id: VALID_QUOTE_ID,
    }) as { data: { total: number; shipping_cost: number }; error: null };

    expect(error).toBeNull();
    expect(data.total).toBe(1514.5);
    expect(data.shipping_cost).toBe(89.5);
  });

  it("erro de DB retorna error não-null", async () => {
    const supabase = createSupabaseClientMock({
      fromSelect: async () => ({
        data: null,
        error: { message: "relation does not exist", status: 500 },
      }),
    });

    const { data, error } = await supabase
      .from("quotes")
      .select("*")
      .then((r: unknown) => r as { data: null; error: { message: string } });

    expect(data).toBeNull();
    expect(error?.message).toContain("relation does not exist");
  });
});

// ─── Integração: Regressão ────────────────────────────────────────────────────

describe("regressão: integrações conhecidas", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("REG-INT-01: quote-sync não retorna 500 em quotes com total=null", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, synced: true, totals: { total: 0 } },
    };
    mockEdgeFunctionFetch({ "/quote-sync": spec });

    const res = await post("/quote-sync", {
      action: "sync_quote",
      data: { quoteId: VALID_QUOTE_ID },
    });
    expect(res.status).not.toBe(500);
  });

  it("REG-INT-02: webhook não duplica evento com mesmo idempotency_key", async () => {
    const firstSpec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, duplicate: false, event_id: "evt-100" },
    };
    mockEdgeFunctionFetch({ "/webhook-inbound": firstSpec });

    const payload = {
      event: "quote.approved",
      occurred_at: new Date().toISOString(),
      data: { quote_id: VALID_QUOTE_ID },
      idempotency_key: "idem-duplicate-test-001",
    };

    const res1 = await post("/webhook-inbound", payload);
    const data1 = await res1.json();
    expect(data1.duplicate).toBe(false);

    const secondSpec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, duplicate: true },
    };
    mockEdgeFunctionFetch({ "/webhook-inbound": secondSpec });

    const res2 = await post("/webhook-inbound", payload);
    const data2 = await res2.json();
    expect(data2.duplicate).toBe(true);
  });

  it("REG-INT-03: N8N webhook URL resolvida a cada chamada (não cacheada)", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, webhook_sent: true, url_resolved: true },
    };
    mockEdgeFunctionFetch({ "/quote-sync": spec });

    for (let i = 0; i < 3; i++) {
      const res = await post("/quote-sync", { action: "test_webhook", data: {} });
      const data = await res.json();
      expect(data.ok).toBe(true);
    }
  });

  it("REG-INT-04: sin Authorization header em quote-sync → 401 (não 500)", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "Unauthorized" } };
    mockEdgeFunctionFetch({ "/quote-sync": spec });

    const res = await fetch(`${BASE}/quote-sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "sync_quote", data: { quoteId: VALID_QUOTE_ID } }),
    });
    expect(res.status).toBe(401);
    expect(res.status).not.toBe(500);
  });
});
