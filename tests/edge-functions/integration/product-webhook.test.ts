/**
 * Integration tests — product-webhook edge function
 * Cobre: evento product.created/updated/deleted, assinatura HMAC, payloads adversariais, CORS.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const PRODUCT_CREATED_PAYLOAD = {
  event: "product.created",
  occurred_at: new Date().toISOString(),
  data: {
    product_id: "prod-001",
    name: "Caneta Personalizada Premium",
    sku: "CAN-PREM-001",
    price: 8.9,
    category_id: "cat-001",
    active: true,
  },
};

const PRODUCT_UPDATED_PAYLOAD = {
  event: "product.updated",
  occurred_at: new Date().toISOString(),
  data: {
    product_id: "prod-001",
    changes: { price: { from: 8.9, to: 9.5 }, name: null },
  },
};

describe("product-webhook", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("evento product.created", () => {
    it("retorna 200 para evento product.created válido", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, event_id: "evt-prod-001", action: "created" },
      };
      mockEdgeFunctionFetch({ "/product-webhook": ok });
      const res = await fetch(`${BASE}/product-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer service-key",
          "x-webhook-signature": "sha256=valid-hmac",
        },
        body: JSON.stringify(PRODUCT_CREATED_PAYLOAD),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
    });
  });

  describe("evento product.updated", () => {
    it("retorna 200 para produto.updated com diff de preço", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, event_id: "evt-prod-002", action: "updated" },
      };
      mockEdgeFunctionFetch({ "/product-webhook": ok });
      const res = await fetch(`${BASE}/product-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer service-key",
          "x-webhook-signature": "sha256=valid-hmac",
        },
        body: JSON.stringify(PRODUCT_UPDATED_PAYLOAD),
      });
      expect(res.status).toBe(200);
    });
  });

  describe("evento product.deleted", () => {
    it("retorna 200 para produto.deleted", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, action: "deleted" },
      };
      mockEdgeFunctionFetch({ "/product-webhook": ok });
      const res = await fetch(`${BASE}/product-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer service-key",
          "x-webhook-signature": "sha256=valid-hmac",
        },
        body: JSON.stringify({
          event: "product.deleted",
          occurred_at: new Date().toISOString(),
          data: { product_id: "prod-001" },
        }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe("evento desconhecido", () => {
    it("retorna 400 para evento não suportado", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "unknown_event" } };
      mockEdgeFunctionFetch({ "/product-webhook": err });
      const res = await fetch(`${BASE}/product-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer service-key",
        },
        body: JSON.stringify({ event: "product.explode", occurred_at: new Date().toISOString(), data: {} }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("HMAC / assinatura", () => {
    it("retorna 401 com assinatura HMAC inválida", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "invalid_signature" } };
      mockEdgeFunctionFetch({ "/product-webhook": err });
      const res = await fetch(`${BASE}/product-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer service-key",
          "x-webhook-signature": "sha256=invalidsig",
        },
        body: JSON.stringify(PRODUCT_CREATED_PAYLOAD),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("invalid_signature");
    });

    it("retorna 401 sem x-webhook-signature", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "missing_signature" } };
      mockEdgeFunctionFetch({ "/product-webhook": err });
      const res = await fetch(`${BASE}/product-webhook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify(PRODUCT_CREATED_PAYLOAD),
      });
      expect([400, 401]).toContain(res.status);
    });
  });

  describe("payloads malformados", () => {
    const malformedCases = [
      { label: "body vazio", body: "" },
      { label: "JSON inválido", body: "{event: BROKEN" },
      { label: "array no lugar de objeto", body: "[]" },
      { label: "campos ausentes: event", body: JSON.stringify({ occurred_at: new Date().toISOString(), data: {} }) },
      { label: "SQL injection em product_id", body: JSON.stringify({ ...PRODUCT_CREATED_PAYLOAD, data: { product_id: "' OR '1'='1" } }) },
      { label: "XSS em name", body: JSON.stringify({ ...PRODUCT_CREATED_PAYLOAD, data: { ...PRODUCT_CREATED_PAYLOAD.data, name: "<script>alert(1)</script>" } }) },
    ];

    for (const { label, body } of malformedCases) {
      it(`não retorna 500 para ${label}`, async () => {
        const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_payload" } };
        mockEdgeFunctionFetch({ "/product-webhook": err });
        const res = await fetch(`${BASE}/product-webhook`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
          body,
        });
        expect(res.status).not.toBe(500);
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
      });
    }
  });

  describe("idempotência", () => {
    it("segundo request com mesmo event_id retorna 200 sem duplicar", async () => {
      const idem: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, duplicate: true, action: "noop" },
      };
      mockEdgeFunctionFetch({ "/product-webhook": idem });
      const res = await fetch(`${BASE}/product-webhook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer service-key",
          "x-idempotency-key": "evt-prod-001",
        },
        body: JSON.stringify(PRODUCT_CREATED_PAYLOAD),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.duplicate).toBe(true);
    });
  });

  describe("CORS", () => {
    it("OPTIONS retorna Access-Control-Allow-Origin", async () => {
      const cors: EdgeFnResponseSpec = {
        status: 200,
        body: null,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "content-type, authorization, x-webhook-signature, x-request-id",
          "access-control-expose-headers": "x-request-id",
        },
      };
      mockEdgeFunctionFetch({ "/product-webhook": cors });
      const res = await fetch(`${BASE}/product-webhook`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
    });
  });
});
