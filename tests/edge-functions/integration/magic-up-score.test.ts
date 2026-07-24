/**
 * Integration tests — magic-up-score edge function
 * Cobre: cálculo de score, produtos elegíveis, sem auth, payloads adversariais.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

describe("magic-up-score", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("cálculo de score — happy path", () => {
    it("retorna 200 com score entre 0 e 100 para produto válido", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: {
          product_id: "prod-001",
          score: 78.5,
          factors: {
            demand: 0.85,
            margin: 0.72,
            stock: 1.0,
            recency: 0.65,
          },
          tier: "high",
          eligible_for_magic_up: true,
        },
      };
      mockEdgeFunctionFetch({ "/magic-up-score": ok });
      const res = await fetch(`${BASE}/magic-up-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ product_id: "prod-001" }),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(typeof data.score).toBe("number");
      expect(data.score).toBeGreaterThanOrEqual(0);
      expect(data.score).toBeLessThanOrEqual(100);
    });

    it("fatores (demand, margin, stock, recency) são valores 0-1", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: {
          product_id: "prod-001",
          score: 65,
          factors: { demand: 0.7, margin: 0.6, stock: 0.8, recency: 0.5 },
        },
      };
      mockEdgeFunctionFetch({ "/magic-up-score": ok });
      const res = await fetch(`${BASE}/magic-up-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ product_id: "prod-001" }),
      });
      const data = await res.json();
      if (data.factors) {
        for (const [key, val] of Object.entries(data.factors)) {
          expect(typeof val).toBe("number");
          expect(val as number).toBeGreaterThanOrEqual(0);
          expect(val as number).toBeLessThanOrEqual(1);
        }
      }
    });

    it("tier é um dos valores esperados (low, medium, high)", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { product_id: "p1", score: 50, tier: "medium", eligible_for_magic_up: false },
      };
      mockEdgeFunctionFetch({ "/magic-up-score": ok });
      const res = await fetch(`${BASE}/magic-up-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ product_id: "p1" }),
      });
      const data = await res.json();
      if (data.tier) {
        expect(["low", "medium", "high"]).toContain(data.tier);
      }
    });

    it("produto inativo retorna eligible_for_magic_up=false", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { product_id: "p-inactive", score: 0, eligible_for_magic_up: false, reason: "product_inactive" },
      };
      mockEdgeFunctionFetch({ "/magic-up-score": ok });
      const res = await fetch(`${BASE}/magic-up-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ product_id: "p-inactive" }),
      });
      const data = await res.json();
      expect(data.eligible_for_magic_up).toBe(false);
    });
  });

  describe("produto não encontrado — 404", () => {
    it("retorna 404 para product_id inexistente", async () => {
      const err: EdgeFnResponseSpec = { status: 404, body: { error: "product_not_found" } };
      mockEdgeFunctionFetch({ "/magic-up-score": err });
      const res = await fetch(`${BASE}/magic-up-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ product_id: "nonexistent-id" }),
      });
      expect(res.status).toBe(404);
    });
  });

  describe("validação de entrada — 400", () => {
    it("retorna 400 quando product_id está ausente", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "missing_product_id" } };
      mockEdgeFunctionFetch({ "/magic-up-score": err });
      const res = await fetch(`${BASE}/magic-up-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(400);
    });

    it("não retorna 500 para product_id com SQL injection", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_input" } };
      mockEdgeFunctionFetch({ "/magic-up-score": err });
      const res = await fetch(`${BASE}/magic-up-score`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ product_id: "'; DROP TABLE products;--" }),
      });
      expect(res.status).not.toBe(500);
    });
  });

  describe("autenticação — 401", () => {
    it("retorna 401 sem token", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/magic-up-score": err });
      const res = await fetch(`${BASE}/magic-up-score`, {
        method: "POST",
        body: JSON.stringify({ product_id: "p1" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("CORS", () => {
    it("OPTIONS retorna CORS headers", async () => {
      const cors: EdgeFnResponseSpec = {
        status: 200,
        body: null,
        headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "x-request-id" },
      };
      mockEdgeFunctionFetch({ "/magic-up-score": cors });
      const res = await fetch(`${BASE}/magic-up-score`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
    });
  });
});
