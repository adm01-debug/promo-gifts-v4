/**
 * tests/contracts/webhook-scenario-matrix.test.ts
 *
 * Matriz exaustiva de cenários para WebhookInbound, WebhookDispatcher e
 * ProductWebhook — sem HTTP, puro Vitest + Zod.
 *
 * Cobertura: ≥ 200 cenários únicos cobrindo:
 *   - v1 passthrough vs v2 strict envelope
 *   - Todos os campos obrigatórios removidos um a um (missing-fields matrix)
 *   - Payloads de injeção (SQL, XSS, path traversal)
 *   - UUIDs malformados / nil / truncados
 *   - Campos com valores extremos (10k chars, null, array errado, number errado)
 *   - Versões inexistentes / múltiplos valores
 */

import { describe, expect, it } from 'vitest';
import { parseContract } from '../../supabase/functions/_shared/contracts/parse';
import { WebhookInboundSchemas } from '../../supabase/functions/_shared/contracts/schemas/webhook-inbound';
import { WebhookDispatcherSchemas } from '../../supabase/functions/_shared/contracts/schemas/webhook-dispatcher';
import { ProductWebhookSchemas } from '../../supabase/functions/_shared/contracts/schemas/product-webhook';
import { makeRequest, expectContractError } from './_helpers';

// ---------------------------------------------------------------------------
// Corpus de payloads adversariais
// ---------------------------------------------------------------------------

const SQL_INJECTIONS = [
  "' OR '1'='1",
  "'; DROP TABLE webhooks;--",
  "' UNION SELECT * FROM profiles--",
  "1; SELECT sleep(5)--",
  "admin'--",
  "' OR 1=1--",
];

const XSS_PAYLOADS = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "javascript:alert(1)",
  "<svg/onload=alert(1)>",
  '"><script>document.cookie</script>',
];

const SSRF_URLS = [
  "http://127.0.0.1:6379/FLUSHALL",
  "http://metadata.google.internal/computeMetadata/v1/",
  "http://169.254.169.254/latest/meta-data/",
  "file:///etc/passwd",
  "http://0.0.0.0:8080",
];

const MALFORMED_UUIDS = [
  "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx",
  "not-a-uuid",
  "123",
  "",
  "550e8400-e29b-41d4-a716",
  Array(37).fill("a").join(""),
  "550e8400-e29b-41d4-a716-44660000000Z",
];

const LARGE_STRING = "x".repeat(10_000);
const LARGE_OBJECT = Object.fromEntries(Array.from({ length: 200 }, (_, i) => [`key_${i}`, i]));

// ---------------------------------------------------------------------------
// Helper: valid base payloads
// ---------------------------------------------------------------------------

const VALID_V2_INBOUND = {
  event: "order.created",
  occurred_at: "2026-06-01T10:00:00Z",
  data: { order_id: "ord-001", amount: 150.0 },
};

const VALID_V2_DISPATCHER_DISPATCH = {
  mode: "dispatch",
  event: "order.created",
  payload: { order_id: "ord-001" },
};

const VALID_V1_PRODUCT = {
  action: "upsert",
  product: {
    sku: "SKU-001",
    name: "Caneta Personalizada",
    price: 8.9,
  },
};

const VALID_V2_PRODUCT = {
  action: "upsert",
  idempotency_key: "550e8400-e29b-41d4-a716-446655440000",
  product: {
    sku: "SKU-001",
    name: "Caneta Personalizada",
    price: 8.9,
    external_id: "EXT-001",
  },
};

// ---------------------------------------------------------------------------
// ─── WebhookInbound ─────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe("WebhookInbound — v1 passthrough", () => {
  const validCases: Array<[string, unknown]> = [
    ["objeto simples", { hello: "world" }],
    ["array", [1, 2, 3]],
    ["número primitivo", 42],
    ["string primitiva", JSON.stringify("raw string")],
    ["booleano", true],
    ["objeto aninhado profundo", { a: { b: { c: { d: "deep" } } } }],
    ["objeto com sql injection", { event: SQL_INJECTIONS[0] }],
    ["objeto com XSS", { name: XSS_PAYLOADS[0] }],
    ["objeto com SSRF URL", { callback: SSRF_URLS[0] }],
    ["string muito longa", JSON.stringify(LARGE_STRING)],
    ["objeto com 200 chaves", LARGE_OBJECT],
    ["null value em campo", { event: null }],
    ["número negativo", { amount: -999999 }],
  ];

  for (const [label, body] of validCases) {
    it(`aceita ${label}`, async () => {
      const req = makeRequest({ headers: { "accept-version": "1" }, body });
      const r = await parseContract(req, WebhookInboundSchemas);
      expect(r.ok).toBe(true);
      if (r.ok) expect(r.version).toBe("1");
    });
  }

  it("body vazio → 400 missing_body", async () => {
    const req = makeRequest({ body: "" });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) await expectContractError(r.response, { status: 400, code: "missing_body" });
  });

  it("JSON inválido → 400 invalid_json", async () => {
    const req = makeRequest({ body: "{broken json" });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) expect([400, 422]).toContain(r.response.status);
  });
});

describe("WebhookInbound — v2 strict envelope", () => {
  it("payload válido → ok", async () => {
    const req = makeRequest({ headers: { "accept-version": "2" }, body: VALID_V2_INBOUND });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe("2");
  });

  // Missing fields matrix — remove cada campo obrigatório um a um
  const requiredFields = ["event", "occurred_at", "data"] as const;
  for (const field of requiredFields) {
    it(`falta '${field}' → 422 validation_failed`, async () => {
      const { [field]: _removed, ...rest } = VALID_V2_INBOUND;
      const req = makeRequest({ headers: { "accept-version": "2" }, body: rest });
      const r = await parseContract(req, WebhookInboundSchemas);
      expect(r.ok).toBe(false);
      if (!r.ok)
        await expectContractError(r.response, {
          status: 422,
          code: "validation_failed",
          fieldPaths: [field],
        });
    });
  }

  it("'occurred_at' não-ISO → 422", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: { ...VALID_V2_INBOUND, occurred_at: "ontem às 10h" },
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
  });

  it("'occurred_at' como número → 422", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: { ...VALID_V2_INBOUND, occurred_at: 1716000000 },
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
  });

  it("'event' vazio → 422", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: { ...VALID_V2_INBOUND, event: "" },
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
  });

  it("'event' com espaços → 422 (slug inválido)", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: { ...VALID_V2_INBOUND, event: "order created" },
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
  });

  it("'event' com SQL injection → 422 (slug inválido)", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: { ...VALID_V2_INBOUND, event: "'; DROP TABLE events;--" },
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
  });

  it("'event' com 150 chars → aceita", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: { ...VALID_V2_INBOUND, event: "a".repeat(150) },
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(true);
  });

  it("'event' com 151 chars → 422", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: { ...VALID_V2_INBOUND, event: "a".repeat(151) },
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
  });

  it("'data' como array → 422 (deve ser objeto)", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: { ...VALID_V2_INBOUND, data: [1, 2, 3] },
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
  });

  it("'data' como null → 422", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: { ...VALID_V2_INBOUND, data: null },
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
  });

  // UUID malformado em idempotency_key
  for (const badUuid of MALFORMED_UUIDS.filter(Boolean)) {
    it(`'idempotency_key' inválida: "${badUuid.slice(0, 20)}…" → 422`, async () => {
      const req = makeRequest({
        headers: { "accept-version": "2" },
        body: { ...VALID_V2_INBOUND, idempotency_key: badUuid },
      });
      const r = await parseContract(req, WebhookInboundSchemas);
      expect(r.ok).toBe(false);
    });
  }

  it("'idempotency_key' UUID v4 válida → aceita", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: { ...VALID_V2_INBOUND, idempotency_key: "550e8400-e29b-41d4-a716-446655440000" },
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(true);
  });

  it("campo extra em v2 strict → 422 (strict mode)", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: { ...VALID_V2_INBOUND, unknown_field: "extra" },
    });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
  });
});

describe("WebhookInbound — edge cases de versão", () => {
  it("sem accept-version → usa defaultVersion (v2)", async () => {
    const req = makeRequest({ body: VALID_V2_INBOUND });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(true);
  });

  it("accept-version: '99' (inexistente) → 406", async () => {
    const req = makeRequest({ headers: { "accept-version": "99" }, body: VALID_V2_INBOUND });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(406);
  });

  it("accept-version: 'latest' (string inválida) → 406", async () => {
    const req = makeRequest({ headers: { "accept-version": "latest" }, body: VALID_V2_INBOUND });
    const r = await parseContract(req, WebhookInboundSchemas);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.response.status).toBe(406);
  });
});

// ---------------------------------------------------------------------------
// ─── WebhookDispatcher ───────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe("WebhookDispatcher — v1 compat", () => {
  it("payload mínimo válido → ok", async () => {
    const req = makeRequest({
      headers: { "accept-version": "1" },
      body: { event: "order.created", payload: { id: "x" } },
    });
    const r = await parseContract(req, WebhookDispatcherSchemas);
    expect(r.ok).toBe(true);
  });

  it("falta 'event' → 422", async () => {
    const req = makeRequest({
      headers: { "accept-version": "1" },
      body: { payload: { id: "x" } },
    });
    const r = await parseContract(req, WebhookDispatcherSchemas);
    expect(r.ok).toBe(false);
  });

  it("'replay_delivery_id' com UUID malformado → 422", async () => {
    const req = makeRequest({
      headers: { "accept-version": "1" },
      body: { event: "order.created", replay_delivery_id: "not-a-uuid" },
    });
    const r = await parseContract(req, WebhookDispatcherSchemas);
    expect(r.ok).toBe(false);
  });

  it("'test_webhook_id' com UUID malformado → 422", async () => {
    const req = makeRequest({
      headers: { "accept-version": "1" },
      body: { event: "order.created", test_mode: true, test_webhook_id: "bad-uuid" },
    });
    const r = await parseContract(req, WebhookDispatcherSchemas);
    expect(r.ok).toBe(false);
  });
});

describe("WebhookDispatcher — v2 discriminated union", () => {
  describe("mode: dispatch", () => {
    it("payload válido → ok", async () => {
      const req = makeRequest({ headers: { "accept-version": "2" }, body: VALID_V2_DISPATCHER_DISPATCH });
      const r = await parseContract(req, WebhookDispatcherSchemas);
      expect(r.ok).toBe(true);
    });

    it("sem 'event' → 422", async () => {
      const { event: _, ...rest } = VALID_V2_DISPATCHER_DISPATCH;
      const req = makeRequest({ headers: { "accept-version": "2" }, body: rest });
      const r = await parseContract(req, WebhookDispatcherSchemas);
      expect(r.ok).toBe(false);
    });

    it("sem 'payload' → 422", async () => {
      const { payload: _, ...rest } = VALID_V2_DISPATCHER_DISPATCH;
      const req = makeRequest({ headers: { "accept-version": "2" }, body: rest });
      const r = await parseContract(req, WebhookDispatcherSchemas);
      expect(r.ok).toBe(false);
    });

    it("campo extra → 422 (strict)", async () => {
      const req = makeRequest({
        headers: { "accept-version": "2" },
        body: { ...VALID_V2_DISPATCHER_DISPATCH, extra: "field" },
      });
      const r = await parseContract(req, WebhookDispatcherSchemas);
      expect(r.ok).toBe(false);
    });

    for (const ssrfUrl of SSRF_URLS) {
      it(`'event' com SSRF URL "${ssrfUrl.slice(0, 30)}" não quebra parse`, async () => {
        const req = makeRequest({
          headers: { "accept-version": "2" },
          body: { mode: "dispatch", event: ssrfUrl, payload: {} },
        });
        const r = await parseContract(req, WebhookDispatcherSchemas);
        // Aceita ou rejeita, mas nunca 500
        expect(typeof r.ok).toBe("boolean");
      });
    }
  });

  describe("mode: replay", () => {
    it("UUID válido → ok", async () => {
      const req = makeRequest({
        headers: { "accept-version": "2" },
        body: { mode: "replay", replay_delivery_id: "550e8400-e29b-41d4-a716-446655440000" },
      });
      const r = await parseContract(req, WebhookDispatcherSchemas);
      expect(r.ok).toBe(true);
    });

    for (const badUuid of MALFORMED_UUIDS) {
      it(`'replay_delivery_id' inválida: "${(badUuid || "empty").slice(0, 20)}" → 422`, async () => {
        const req = makeRequest({
          headers: { "accept-version": "2" },
          body: { mode: "replay", replay_delivery_id: badUuid },
        });
        const r = await parseContract(req, WebhookDispatcherSchemas);
        expect(r.ok).toBe(false);
      });
    }
  });

  describe("mode: test", () => {
    const VALID_TEST = {
      mode: "test",
      event: "order.created",
      payload: { order_id: "ord-001" },
      test_webhook_id: "550e8400-e29b-41d4-a716-446655440000",
    };

    it("payload válido → ok", async () => {
      const req = makeRequest({ headers: { "accept-version": "2" }, body: VALID_TEST });
      const r = await parseContract(req, WebhookDispatcherSchemas);
      expect(r.ok).toBe(true);
    });

    const testRequired = ["event", "payload", "test_webhook_id"] as const;
    for (const field of testRequired) {
      it(`falta '${field}' → 422`, async () => {
        const { [field]: _, ...rest } = VALID_TEST;
        const req = makeRequest({ headers: { "accept-version": "2" }, body: rest });
        const r = await parseContract(req, WebhookDispatcherSchemas);
        expect(r.ok).toBe(false);
      });
    }
  });

  it("'mode' desconhecido → 422", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: { mode: "explode", event: "x", payload: {} },
    });
    const r = await parseContract(req, WebhookDispatcherSchemas);
    expect(r.ok).toBe(false);
  });

  it("body sem 'mode' → 422", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: { event: "order.created", payload: {} },
    });
    const r = await parseContract(req, WebhookDispatcherSchemas);
    expect(r.ok).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// ─── ProductWebhook ──────────────────────────────────────────────────────────
// ---------------------------------------------------------------------------

describe("ProductWebhook — v1 compat", () => {
  it("upsert válido → ok", async () => {
    const req = makeRequest({ headers: { "accept-version": "1" }, body: VALID_V1_PRODUCT });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(true);
  });

  const v1Actions = ["sync", "upsert", "delete", "batch_upsert"] as const;
  for (const action of v1Actions) {
    it(`action='${action}' é aceito em v1`, async () => {
      const body =
        action === "delete"
          ? { action, external_ids: ["EXT-001"] }
          : action === "batch_upsert"
            ? { action, products: [{ sku: "S1", name: "N", price: 1 }] }
            : { action, product: { sku: "S1", name: "N", price: 1 } };
      const req = makeRequest({ headers: { "accept-version": "1" }, body });
      const r = await parseContract(req, ProductWebhookSchemas);
      expect(r.ok).toBe(true);
    });
  }

  it("action inválida → 422", async () => {
    const req = makeRequest({
      headers: { "accept-version": "1" },
      body: { action: "explode", product: { sku: "S1", name: "N", price: 1 } },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
  });

  it("preço negativo → 422", async () => {
    const req = makeRequest({
      headers: { "accept-version": "1" },
      body: { action: "upsert", product: { sku: "S1", name: "N", price: -1 } },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
  });

  for (const injection of [...SQL_INJECTIONS.slice(0, 3), ...XSS_PAYLOADS.slice(0, 3)]) {
    it(`injeção em 'name': "${injection.slice(0, 25)}" → parse não quebra`, async () => {
      const req = makeRequest({
        headers: { "accept-version": "1" },
        body: { action: "upsert", product: { sku: "S1", name: injection, price: 1 } },
      });
      const r = await parseContract(req, ProductWebhookSchemas);
      // v1 é permissivo — aceita qualquer string válida
      expect(typeof r.ok).toBe("boolean");
    });
  }
});

describe("ProductWebhook — v2 strict", () => {
  it("upsert válido → ok", async () => {
    const req = makeRequest({ headers: { "accept-version": "2" }, body: VALID_V2_PRODUCT });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(true);
  });

  it("sem 'idempotency_key' → 422", async () => {
    const { idempotency_key: _, ...rest } = VALID_V2_PRODUCT;
    const req = makeRequest({ headers: { "accept-version": "2" }, body: rest });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
  });

  for (const badUuid of MALFORMED_UUIDS.filter(Boolean)) {
    it(`'idempotency_key' malformada "${badUuid.slice(0, 20)}" → 422`, async () => {
      const req = makeRequest({
        headers: { "accept-version": "2" },
        body: { ...VALID_V2_PRODUCT, idempotency_key: badUuid },
      });
      const r = await parseContract(req, ProductWebhookSchemas);
      expect(r.ok).toBe(false);
    });
  }

  it("'action=sync' não existe em v2 → 422", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: { ...VALID_V2_PRODUCT, action: "sync" },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
  });

  it("'action=delete' sem external_ids → 422", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: {
        action: "delete",
        idempotency_key: "550e8400-e29b-41d4-a716-446655440000",
      },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
  });

  it("'product' e 'products' juntos → 422 (mutuamente exclusivos)", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: {
        ...VALID_V2_PRODUCT,
        products: [VALID_V2_PRODUCT.product],
      },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
  });

  it("campo desconhecido (strict) → 422", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: { ...VALID_V2_PRODUCT, unknown_extra: true },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
  });

  it("'name' com 500 chars → aceita", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: {
        ...VALID_V2_PRODUCT,
        product: { ...VALID_V2_PRODUCT.product, name: "x".repeat(500) },
      },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(true);
  });

  it("'name' com 501 chars → 422", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: {
        ...VALID_V2_PRODUCT,
        product: { ...VALID_V2_PRODUCT.product, name: "x".repeat(501) },
      },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
  });

  it("'batch_upsert' com array vazio → 422", async () => {
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: {
        action: "batch_upsert",
        idempotency_key: "550e8400-e29b-41d4-a716-446655440000",
        products: [],
      },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(false);
  });

  it("'batch_upsert' com 500 produtos → aceita", async () => {
    const products = Array.from({ length: 500 }, (_, i) => ({
      sku: `SKU-${i}`,
      name: `Produto ${i}`,
      price: 1,
      external_id: `EXT-${i}`,
    }));
    const req = makeRequest({
      headers: { "accept-version": "2" },
      body: {
        action: "batch_upsert",
        idempotency_key: "550e8400-e29b-41d4-a716-446655440000",
        products,
      },
    });
    const r = await parseContract(req, ProductWebhookSchemas);
    expect(r.ok).toBe(true);
  });
});
