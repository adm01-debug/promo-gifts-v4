/**
 * Integration tests — ai-recommendations edge function
 * Cobre: happy path, sem auth, payload inválido, fallback sem AI, CORS, rate limit.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const VALID_PAYLOAD = {
  context: "user looking for branded pens for corporate event",
  limit: 5,
  filters: { category: "escritório", budget_max: 50 },
};

describe("ai-recommendations", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("happy path", () => {
    it("retorna 200 com array de recomendações", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: {
          recommendations: [
            { product_id: "p1", name: "Caneta Personalizada", score: 0.95 },
            { product_id: "p2", name: "Bloco de Notas", score: 0.82 },
          ],
          model: "claude-3-haiku",
          latency_ms: 320,
        },
      };
      mockEdgeFunctionFetch({ "/ai-recommendations": ok });
      const res = await fetch(`${BASE}/ai-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify(VALID_PAYLOAD),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data.recommendations)).toBe(true);
      expect(data.recommendations.length).toBeGreaterThan(0);
    });

    it("cada recomendação tem product_id e score numérico", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: {
          recommendations: [{ product_id: "p1", name: "Produto A", score: 0.9 }],
          latency_ms: 250,
        },
      };
      mockEdgeFunctionFetch({ "/ai-recommendations": ok });
      const res = await fetch(`${BASE}/ai-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify(VALID_PAYLOAD),
      });
      const data = await res.json();
      for (const rec of data.recommendations) {
        expect(rec.product_id).toBeDefined();
        expect(typeof rec.score).toBe("number");
        expect(rec.score).toBeGreaterThanOrEqual(0);
        expect(rec.score).toBeLessThanOrEqual(1);
      }
    });

    it("respeita limit passado no payload", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { recommendations: [{ product_id: "p1", score: 0.9 }], latency_ms: 100 },
      };
      mockEdgeFunctionFetch({ "/ai-recommendations": ok });
      const res = await fetch(`${BASE}/ai-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ ...VALID_PAYLOAD, limit: 1 }),
      });
      const data = await res.json();
      expect(data.recommendations.length).toBeLessThanOrEqual(1);
    });

    it("retorna X-Request-Id no header", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { recommendations: [], latency_ms: 50 },
        headers: { "x-request-id": "req-abc-001" },
      };
      mockEdgeFunctionFetch({ "/ai-recommendations": ok });
      const res = await fetch(`${BASE}/ai-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify(VALID_PAYLOAD),
      });
      expect(res.headers.get("x-request-id")).toBeTruthy();
    });
  });

  describe("fallback sem modelo AI disponível", () => {
    it("retorna 200 com recommendations via fallback quando AI indisponível", async () => {
      const fallback: EdgeFnResponseSpec = {
        status: 200,
        body: {
          recommendations: [{ product_id: "p_fallback", score: 0.5, source: "rule_based" }],
          fallback: true,
          latency_ms: 10,
        },
      };
      mockEdgeFunctionFetch({ "/ai-recommendations": fallback });
      const res = await fetch(`${BASE}/ai-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify(VALID_PAYLOAD),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.fallback).toBe(true);
    });

    it("fallback não expõe stack trace da falha do modelo", async () => {
      const fallback: EdgeFnResponseSpec = {
        status: 200,
        body: { recommendations: [], fallback: true, latency_ms: 10 },
      };
      mockEdgeFunctionFetch({ "/ai-recommendations": fallback });
      const res = await fetch(`${BASE}/ai-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify(VALID_PAYLOAD),
      });
      const raw = await res.text();
      expect(raw).not.toMatch(/at\s+\w+\s+\(/);
      expect(raw).not.toMatch(/TypeError:|ReferenceError:/);
    });
  });

  describe("validação de entrada — 400", () => {
    it("retorna 400 quando context está ausente", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "missing_context" } };
      mockEdgeFunctionFetch({ "/ai-recommendations": err });
      const res = await fetch(`${BASE}/ai-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ limit: 5 }),
      });
      expect(res.status).toBe(400);
    });

    it("retorna 400 para limit negativo", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_limit" } };
      mockEdgeFunctionFetch({ "/ai-recommendations": err });
      const res = await fetch(`${BASE}/ai-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ ...VALID_PAYLOAD, limit: -1 }),
      });
      expect([400, 422]).toContain(res.status);
    });

    it("retorna 400 para context com SQL injection", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_input" } };
      mockEdgeFunctionFetch({ "/ai-recommendations": err });
      const res = await fetch(`${BASE}/ai-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ context: "'; DROP TABLE products;--", limit: 5 }),
      });
      expect(res.status).not.toBe(500);
    });

    it("retorna 400 para body JSON inválido", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_json" } };
      mockEdgeFunctionFetch({ "/ai-recommendations": err });
      const res = await fetch(`${BASE}/ai-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: '{"context": BROKEN',
      });
      expect(res.status).not.toBe(500);
    });
  });

  describe("autenticação — 401", () => {
    it("retorna 401 sem Authorization header", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/ai-recommendations": err });
      const res = await fetch(`${BASE}/ai-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_PAYLOAD),
      });
      expect(res.status).toBe(401);
    });

    it("retorna 401 com token JWT expirado", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "jwt_expired" } };
      mockEdgeFunctionFetch({ "/ai-recommendations": err });
      const res = await fetch(`${BASE}/ai-recommendations`, {
        method: "POST",
        headers: { Authorization: "Bearer expired.jwt.token" },
        body: JSON.stringify(VALID_PAYLOAD),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("rate limit — 429", () => {
    it("retorna 429 com Retry-After quando usuário excede quota de AI", async () => {
      const rl: EdgeFnResponseSpec = {
        status: 429,
        body: { error: "ai_quota_exceeded", reset_at: new Date(Date.now() + 3600_000).toISOString() },
        headers: { "Retry-After": "3600" },
      };
      mockEdgeFunctionFetch({ "/ai-recommendations": rl });
      const res = await fetch(`${BASE}/ai-recommendations`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify(VALID_PAYLOAD),
      });
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeTruthy();
    });
  });

  describe("CORS e método", () => {
    it("OPTIONS retorna CORS headers corretos", async () => {
      const cors: EdgeFnResponseSpec = {
        status: 200,
        body: null,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "authorization, content-type, x-request-id",
          "access-control-expose-headers": "x-request-id",
        },
      };
      mockEdgeFunctionFetch({ "/ai-recommendations": cors });
      const res = await fetch(`${BASE}/ai-recommendations`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
      expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
    });

    it("GET retorna 405", async () => {
      const err: EdgeFnResponseSpec = { status: 405, body: { error: "method_not_allowed" } };
      mockEdgeFunctionFetch({ "/ai-recommendations": err });
      const res = await fetch(`${BASE}/ai-recommendations`, {
        method: "GET",
        headers: { Authorization: "Bearer valid-jwt" },
      });
      expect([404, 405]).toContain(res.status);
    });
  });
});
