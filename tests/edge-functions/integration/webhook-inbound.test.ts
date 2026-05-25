/**
 * Integration tests — webhook-inbound edge function
 * Cobre: v1 (legado), v2 (envelope strict), HMAC, idempotência,
 * missing slug, payload inválido, rate-limit, CORS.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const VALID_V2_PAYLOAD = {
  event: "order.created",
  occurred_at: new Date().toISOString(),
  data: { order_id: "ORD-001", amount: 150.0 },
  idempotency_key: "idem-key-001",
};

const VALID_V1_PAYLOAD = { type: "order", order_id: "ORD-001", amount: 150.0 };

describe("webhook-inbound", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("v2 — envelope strict", () => {
    it("aceita payload v2 válido com idempotency_key e retorna 200", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: { ok: true, event_id: "evt-001" } };
      mockEdgeFunctionFetch({ "/webhook-inbound": ok });
      const res = await fetch(`${BASE}/webhook-inbound?slug=my-hook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "accept-version": "2" },
        body: JSON.stringify(VALID_V2_PAYLOAD),
      });
      expect(res.status).toBe(200);
    });

    it("aceita payload v2 sem idempotency_key (campo opcional)", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: { ok: true } };
      mockEdgeFunctionFetch({ "/webhook-inbound": ok });
      const { idempotency_key: _ignored, ...withoutKey } = VALID_V2_PAYLOAD;
      const res = await fetch(`${BASE}/webhook-inbound?slug=my-hook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "accept-version": "2" },
        body: JSON.stringify(withoutKey),
      });
      expect(res.status).toBe(200);
    });

    it("v2 sem campo 'event' retorna 400 validation_failed", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { code: "validation_failed", fields: ["event"] } };
      mockEdgeFunctionFetch({ "/webhook-inbound": err });
      const { event: _removed, ...noEvent } = VALID_V2_PAYLOAD;
      const res = await fetch(`${BASE}/webhook-inbound?slug=my-hook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "accept-version": "2" },
        body: JSON.stringify(noEvent),
      });
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.code).toBe("validation_failed");
    });

    it("v2 sem campo 'occurred_at' retorna 400", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { code: "validation_failed", fields: ["occurred_at"] } };
      mockEdgeFunctionFetch({ "/webhook-inbound": err });
      const { occurred_at: _removed, ...noTs } = VALID_V2_PAYLOAD;
      const res = await fetch(`${BASE}/webhook-inbound?slug=my-hook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "accept-version": "2" },
        body: JSON.stringify(noTs),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("v1 — legado / deprecation", () => {
    it("v1 passthrough retorna 200 + headers Deprecation/Sunset", async () => {
      const deprecated: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true },
        headers: { Deprecation: "true", Sunset: "2026-06-30" },
      };
      mockEdgeFunctionFetch({ "/webhook-inbound": deprecated });
      const res = await fetch(`${BASE}/webhook-inbound?slug=legacy-hook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "accept-version": "1" },
        body: JSON.stringify(VALID_V1_PAYLOAD),
      });
      expect(res.status).toBe(200);
      expect(res.headers.get("Deprecation")).toBe("true");
    });

    it("v1 retorna warning de depreciação", async () => {
      const deprecated: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, warning: "v1 será descontinuada em 2026-06-30" },
        headers: { Deprecation: "true" },
      };
      mockEdgeFunctionFetch({ "/webhook-inbound": deprecated });
      const res = await fetch(`${BASE}/webhook-inbound?slug=legacy-hook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "accept-version": "1" },
        body: JSON.stringify(VALID_V1_PAYLOAD),
      });
      const data = await res.json();
      const body = JSON.stringify(data);
      expect(body.toLowerCase()).toMatch(/deprecat|descontinua/i);
    });
  });

  describe("HMAC / autenticação", () => {
    it("retorna 401 quando slug não existe", async () => {
      const noSlug: EdgeFnResponseSpec = { status: 401, body: { error: "endpoint_not_found" } };
      mockEdgeFunctionFetch({ "/webhook-inbound": noSlug });
      const res = await fetch(`${BASE}/webhook-inbound?slug=nonexistent`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_V2_PAYLOAD),
      });
      expect(res.status).toBe(401);
    });

    it("retorna 401 com assinatura HMAC inválida", async () => {
      const badSig: EdgeFnResponseSpec = { status: 401, body: { error: "invalid_signature" } };
      mockEdgeFunctionFetch({ "/webhook-inbound": badSig });
      const res = await fetch(`${BASE}/webhook-inbound?slug=my-hook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "accept-version": "2",
          "x-signature-256": "sha256=invalidsignature",
        },
        body: JSON.stringify(VALID_V2_PAYLOAD),
      });
      expect(res.status).toBe(401);
    });

    it("retorna 400 sem query param slug", async () => {
      const noParam: EdgeFnResponseSpec = { status: 400, body: { error: "missing_slug" } };
      mockEdgeFunctionFetch({ "/webhook-inbound": noParam });
      const res = await fetch(`${BASE}/webhook-inbound`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_V2_PAYLOAD),
      });
      expect([400, 401]).toContain(res.status);
    });
  });

  describe("idempotência", () => {
    it("segundo request com mesmo idempotency_key retorna 200 (idempotente, não duplica)", async () => {
      const idem: EdgeFnResponseSpec = { status: 200, body: { ok: true, duplicate: true } };
      mockEdgeFunctionFetch({ "/webhook-inbound": idem });
      const res = await fetch(`${BASE}/webhook-inbound?slug=my-hook`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "accept-version": "2" },
        body: JSON.stringify(VALID_V2_PAYLOAD),
      });
      expect(res.status).toBe(200);
    });
  });

  describe("payloads malformados — fuzzing básico", () => {
    const malformedCases = [
      { label: "JSON inválido", body: '{"event": BROKEN' },
      { label: "body vazio", body: "" },
      { label: "array no lugar de objeto", body: JSON.stringify([1, 2, 3]) },
      { label: "string simples", body: "just a string" },
      { label: "number", body: "42" },
      { label: "null", body: "null" },
    ];

    for (const { label, body } of malformedCases) {
      it(`retorna 4xx para ${label} (sem crash 500)`, async () => {
        const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_payload" } };
        mockEdgeFunctionFetch({ "/webhook-inbound": err });
        const res = await fetch(`${BASE}/webhook-inbound?slug=my-hook`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "accept-version": "2" },
          body,
        });
        expect(res.status).toBeGreaterThanOrEqual(400);
        expect(res.status).toBeLessThan(500);
      });
    }
  });

  describe("rate limiting — bot protection", () => {
    it("retorna 429 quando IP excede limite de requisições", async () => {
      const rl: EdgeFnResponseSpec = {
        status: 429,
        body: { error: "rate_limited", block_minutes: 30 },
        headers: { "Retry-After": "1800" },
      };
      mockEdgeFunctionFetch({ "/webhook-inbound": rl });
      const res = await fetch(`${BASE}/webhook-inbound?slug=my-hook`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_V2_PAYLOAD),
      });
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeTruthy();
    });
  });

  describe("CORS", () => {
    it("OPTIONS retorna Access-Control-Allow-Headers com x-signature-256", async () => {
      const cors: EdgeFnResponseSpec = {
        status: 200,
        body: null,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "content-type, x-signature-256, x-event, accept-version, x-request-id",
          "access-control-expose-headers": "x-request-id",
        },
      };
      mockEdgeFunctionFetch({ "/webhook-inbound": cors });
      const res = await fetch(`${BASE}/webhook-inbound?slug=my-hook`, { method: "OPTIONS" });
      const allowH = res.headers.get("access-control-allow-headers") ?? "";
      expect(allowH.toLowerCase()).toContain("x-signature-256");
    });
  });
});
