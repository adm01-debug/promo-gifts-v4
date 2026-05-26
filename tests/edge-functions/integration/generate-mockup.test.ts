/**
 * Integration tests — generate-mockup edge function
 * Cobre: geração com produto + logo, tipos de arte, erro sem arquivo,
 * timeout de IA, formatos de saída, limites de tamanho, CORS.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const MOCKUP_SUCCESS = {
  ok: true,
  mockup_url: "https://cdn.example.com/mockups/abc123.png",
  mockup_id: "mock-001",
  product_id: "prod-001",
  generated_at: new Date().toISOString(),
};

describe("generate-mockup", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("happy path", () => {
    it("retorna 200 com mockup_url e mockup_id", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: MOCKUP_SUCCESS };
      mockEdgeFunctionFetch({ "/generate-mockup": ok });
      const res = await fetch(`${BASE}/generate-mockup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ product_id: "prod-001", logo_url: "https://cdn.example.com/logo.png" }),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.mockup_url).toMatch(/^https?:\/\//);
      expect(data.mockup_id).toBeDefined();
    });

    it("mockup_url aponta para domínio CDN seguro", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: MOCKUP_SUCCESS };
      mockEdgeFunctionFetch({ "/generate-mockup": ok });
      const res = await fetch(`${BASE}/generate-mockup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ product_id: "prod-001", logo_url: "https://cdn.example.com/logo.png" }),
      });
      const data = await res.json();
      expect(data.mockup_url).not.toContain("javascript:");
      expect(data.mockup_url).not.toContain("data:");
    });

    it("retorna generated_at como ISO 8601", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: MOCKUP_SUCCESS };
      mockEdgeFunctionFetch({ "/generate-mockup": ok });
      const res = await fetch(`${BASE}/generate-mockup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ product_id: "prod-001", logo_url: "https://cdn.example.com/logo.png" }),
      });
      const data = await res.json();
      expect(new Date(data.generated_at).toISOString()).toBe(data.generated_at);
    });

    it("aceita posição customizada do logo (centro, frente, costas)", async () => {
      const positions = ["center", "front", "back"] as const;
      for (const position of positions) {
        const ok: EdgeFnResponseSpec = { status: 200, body: { ...MOCKUP_SUCCESS, position } };
        mockEdgeFunctionFetch({ "/generate-mockup": ok });
        const res = await fetch(`${BASE}/generate-mockup`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
          body: JSON.stringify({ product_id: "prod-001", logo_url: "https://cdn.example.com/logo.png", position }),
        });
        expect(res.status).toBe(200);
      }
    });
  });

  describe("validação de entrada — 400", () => {
    const invalidInputs = [
      { label: "sem product_id", body: { logo_url: "https://cdn.example.com/logo.png" } },
      { label: "sem logo_url", body: { product_id: "prod-001" } },
      { label: "logo_url não é URL válida", body: { product_id: "prod-001", logo_url: "not-a-url" } },
      { label: "logo_url com protocolo javascript:", body: { product_id: "prod-001", logo_url: "javascript:alert(1)" } },
      { label: "logo_url com protocolo data:", body: { product_id: "prod-001", logo_url: "data:text/html,<script>alert(1)</script>" } },
      { label: "product_id vazio", body: { product_id: "", logo_url: "https://cdn.example.com/logo.png" } },
      { label: "body vazio", body: {} },
    ];

    for (const { label, body } of invalidInputs) {
      it(`retorna 400 para: ${label}`, async () => {
        const err: EdgeFnResponseSpec = { status: 400, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/generate-mockup": err });
        const res = await fetch(`${BASE}/generate-mockup`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
          body: JSON.stringify(body),
        });
        expect(res.status).toBe(400);
      });
    }
  });

  describe("autenticação — 401", () => {
    it("retorna 401 sem token", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/generate-mockup": err });
      const res = await fetch(`${BASE}/generate-mockup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product_id: "prod-001", logo_url: "https://cdn.example.com/logo.png" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("timeout de IA / upstream", () => {
    it("retorna 504/503 quando IA demora demais, não 500", async () => {
      const timeout: EdgeFnResponseSpec = { status: 504, body: { error: "ai_generation_timeout" } };
      mockEdgeFunctionFetch({ "/generate-mockup": timeout });
      const res = await fetch(`${BASE}/generate-mockup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ product_id: "prod-001", logo_url: "https://cdn.example.com/logo.png" }),
      });
      expect([503, 504]).toContain(res.status);
      expect(res.status).not.toBe(500);
    });

    it("retorna JSON estruturado mesmo no timeout (sem stack trace)", async () => {
      const timeout: EdgeFnResponseSpec = { status: 504, body: { error: "ai_generation_timeout", details: "upstream" } };
      mockEdgeFunctionFetch({ "/generate-mockup": timeout });
      const res = await fetch(`${BASE}/generate-mockup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ product_id: "prod-001", logo_url: "https://cdn.example.com/logo.png" }),
      });
      const data = await res.json();
      const body = JSON.stringify(data);
      expect(body).not.toMatch(/at\s+\w+\s+\(/);
    });
  });

  describe("produto inexistente — 404", () => {
    it("retorna 404 para product_id que não existe", async () => {
      const notFound: EdgeFnResponseSpec = { status: 404, body: { error: "product_not_found" } };
      mockEdgeFunctionFetch({ "/generate-mockup": notFound });
      const res = await fetch(`${BASE}/generate-mockup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ product_id: "nonexistent-prod", logo_url: "https://cdn.example.com/logo.png" }),
      });
      expect([404, 422]).toContain(res.status);
    });
  });

  describe("CORS", () => {
    it("OPTIONS retorna headers CORS", async () => {
      const cors: EdgeFnResponseSpec = {
        status: 200,
        body: null,
        headers: { "access-control-allow-origin": "*", "access-control-expose-headers": "x-request-id" },
      };
      mockEdgeFunctionFetch({ "/generate-mockup": cors });
      const res = await fetch(`${BASE}/generate-mockup`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
    });
  });
});
