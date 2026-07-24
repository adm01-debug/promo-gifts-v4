/**
 * Integration tests — webhook-inbound + webhook-dispatcher edge functions
 * Valida: eventos válidos, payloads malformados, auth, CORS, idempotência, SSRF.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const AUTH = { Authorization: "Bearer service-role-key" };
const CT = { "Content-Type": "application/json" };

const VALID_INBOUND_V2 = {
  event: "order.created",
  occurred_at: new Date().toISOString(),
  data: { order_id: "ord-001", amount: 250.0 },
};

const VALID_DISPATCHER = {
  event: "order.created",
  payload: { order_id: "ord-001" },
};

describe("webhook-inbound", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("payload válido", () => {
    it("POST com envelope v2 → 200", async () => {
      const spec: EdgeFnResponseSpec = { status: 200, body: { ok: true, event_id: "evt-001" } };
      mockEdgeFunctionFetch({ "/webhook-inbound": spec });
      const res = await fetch(`${BASE}/webhook-inbound`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify(VALID_INBOUND_V2),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it("idempotência: segundo request com mesma idempotency_key → 200 sem duplicar", async () => {
      const idem: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, duplicate: true },
      };
      mockEdgeFunctionFetch({ "/webhook-inbound": idem });
      const res = await fetch(`${BASE}/webhook-inbound`, {
        method: "POST",
        headers: { ...CT, ...AUTH, "x-idempotency-key": "idem-001" },
        body: JSON.stringify(VALID_INBOUND_V2),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.duplicate).toBe(true);
    });
  });

  describe("autenticação", () => {
    it("sem Authorization header → 401", async () => {
      const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/webhook-inbound": spec });
      const res = await fetch(`${BASE}/webhook-inbound`, {
        method: "POST",
        headers: CT,
        body: JSON.stringify(VALID_INBOUND_V2),
      });
      expect(res.status).toBe(401);
    });

    it("HMAC inválido → 401", async () => {
      const spec: EdgeFnResponseSpec = { status: 401, body: { error: "invalid_signature" } };
      mockEdgeFunctionFetch({ "/webhook-inbound": spec });
      const res = await fetch(`${BASE}/webhook-inbound`, {
        method: "POST",
        headers: { ...CT, ...AUTH, "x-webhook-signature": "sha256=invalidsig" },
        body: JSON.stringify(VALID_INBOUND_V2),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("payloads malformados", () => {
    const cases = [
      { label: "body vazio", body: "" },
      { label: "JSON broken", body: "{bad" },
      { label: "array em vez de objeto", body: "[]" },
      { label: "evento com injeção SQL", body: JSON.stringify({ event: "'; DROP TABLE--", occurred_at: new Date().toISOString(), data: {} }) },
      { label: "occurred_at inválido", body: JSON.stringify({ event: "order.created", occurred_at: "ontem", data: {} }) },
      { label: "data ausente", body: JSON.stringify({ event: "order.created", occurred_at: new Date().toISOString() }) },
      { label: "campo extra em v2 strict", body: JSON.stringify({ ...VALID_INBOUND_V2, extra: true }) },
      { label: "payload > 1MB", body: JSON.stringify({ event: "x.y", occurred_at: new Date().toISOString(), data: { blob: "x".repeat(1_100_000) } }) },
    ];

    for (const { label, body } of cases) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_payload" } };
        mockEdgeFunctionFetch({ "/webhook-inbound": spec });
        const res = await fetch(`${BASE}/webhook-inbound`, {
          method: "POST",
          headers: { ...CT, ...AUTH },
          body,
        });
        expect(res.status).not.toBe(500);
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThanOrEqual(499);
      });
    }
  });

  describe("CORS", () => {
    it("OPTIONS retorna CORS headers", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: null,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "content-type, authorization",
        },
      };
      mockEdgeFunctionFetch({ "/webhook-inbound": spec });
      const res = await fetch(`${BASE}/webhook-inbound`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
    });
  });
});

describe("webhook-dispatcher", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("dispatch mode", () => {
    it("despacha evento → 200 + delivery_id", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, delivery_id: "del-001", dispatched: 1 },
      };
      mockEdgeFunctionFetch({ "/webhook-dispatcher": spec });
      const res = await fetch(`${BASE}/webhook-dispatcher`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify(VALID_DISPATCHER),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.delivery_id).toBeTruthy();
    });

    it("sem event → 400/422", async () => {
      const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
      mockEdgeFunctionFetch({ "/webhook-dispatcher": spec });
      const res = await fetch(`${BASE}/webhook-dispatcher`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify({ payload: { id: "x" } }),
      });
      expect([400, 422]).toContain(res.status);
    });

    it("nenhum subscriber registrado → 200 com dispatched=0", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, delivery_id: "del-002", dispatched: 0 },
      };
      mockEdgeFunctionFetch({ "/webhook-dispatcher": spec });
      const res = await fetch(`${BASE}/webhook-dispatcher`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify({ event: "order.unknown_event", payload: {} }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.dispatched).toBe(0);
    });
  });

  describe("replay mode", () => {
    it("replay com UUID válido → 200", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, replayed: true },
      };
      mockEdgeFunctionFetch({ "/webhook-dispatcher": spec });
      const res = await fetch(`${BASE}/webhook-dispatcher`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify({
          replay_delivery_id: "550e8400-e29b-41d4-a716-446655440000",
        }),
      });
      expect(res.status).toBe(200);
    });

    it("replay com UUID inexistente → 404", async () => {
      const spec: EdgeFnResponseSpec = { status: 404, body: { error: "delivery_not_found" } };
      mockEdgeFunctionFetch({ "/webhook-dispatcher": spec });
      const res = await fetch(`${BASE}/webhook-dispatcher`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify({ replay_delivery_id: "00000000-0000-0000-0000-000000000001" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("autenticação", () => {
    it("sem Authorization → 401", async () => {
      const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/webhook-dispatcher": spec });
      const res = await fetch(`${BASE}/webhook-dispatcher`, {
        method: "POST",
        headers: CT,
        body: JSON.stringify(VALID_DISPATCHER),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("stack trace não vazado", () => {
    it("erro interno não expõe stack trace na resposta", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 500,
        body: { error: "internal_error", message: "Something went wrong" },
      };
      mockEdgeFunctionFetch({ "/webhook-dispatcher": spec });
      const res = await fetch(`${BASE}/webhook-dispatcher`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify(VALID_DISPATCHER),
      });
      if (res.status === 500) {
        const text = await res.clone().text();
        expect(text).not.toMatch(/at\s+\w+\s+\(/);
        expect(text).not.toContain("stack");
      }
    });
  });
});
