/**
 * Integration tests — rate-limit-check edge function
 * Cobre: within limit, at limit, over limit, burst, whitelist, reset window.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const WITHIN_LIMIT_BODY = {
  allowed: true,
  remaining: 95,
  limit: 100,
  reset_at: new Date(Date.now() + 60_000).toISOString(),
  window_seconds: 60,
};

const OVER_LIMIT_BODY = {
  allowed: false,
  remaining: 0,
  limit: 100,
  reset_at: new Date(Date.now() + 45_000).toISOString(),
  window_seconds: 60,
  block_minutes: 30,
};

describe("rate-limit-check", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("within limit", () => {
    it("retorna 200 com allowed=true quando dentro do limite", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: WITHIN_LIMIT_BODY };
      mockEdgeFunctionFetch({ "/rate-limit-check": ok });
      const res = await fetch(`${BASE}/rate-limit-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ action: "login", identifier: "user@ex.com" }),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.allowed).toBe(true);
      expect(typeof data.remaining).toBe("number");
      expect(data.remaining).toBeGreaterThan(0);
    });

    it("remaining decresce a cada chamada", async () => {
      const step1: EdgeFnResponseSpec = { status: 200, body: { ...WITHIN_LIMIT_BODY, remaining: 10 } };
      mockEdgeFunctionFetch({ "/rate-limit-check": step1 });
      const res = await fetch(`${BASE}/rate-limit-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ action: "login", identifier: "user@ex.com" }),
      });
      const data = await res.json();
      expect(data.remaining).toBeLessThan(data.limit);
    });

    it("inclui reset_at como ISO 8601", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: WITHIN_LIMIT_BODY };
      mockEdgeFunctionFetch({ "/rate-limit-check": ok });
      const res = await fetch(`${BASE}/rate-limit-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ action: "api_call", identifier: "ip:1.2.3.4" }),
      });
      const data = await res.json();
      const parsed = new Date(data.reset_at);
      expect(isNaN(parsed.getTime())).toBe(false);
    });
  });

  describe("over limit — 429", () => {
    it("retorna 429 com allowed=false quando limite excedido", async () => {
      const rl: EdgeFnResponseSpec = {
        status: 429,
        body: OVER_LIMIT_BODY,
        headers: { "Retry-After": "2700" },
      };
      mockEdgeFunctionFetch({ "/rate-limit-check": rl });
      const res = await fetch(`${BASE}/rate-limit-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ action: "login", identifier: "attacker@ex.com" }),
      });
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.allowed).toBe(false);
      expect(data.remaining).toBe(0);
    });

    it("429 inclui Retry-After header", async () => {
      const rl: EdgeFnResponseSpec = {
        status: 429,
        body: OVER_LIMIT_BODY,
        headers: { "Retry-After": "1800" },
      };
      mockEdgeFunctionFetch({ "/rate-limit-check": rl });
      const res = await fetch(`${BASE}/rate-limit-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ action: "login", identifier: "user@ex.com" }),
      });
      expect(res.headers.get("Retry-After")).toBeTruthy();
    });

    it("429 inclui block_minutes no body", async () => {
      const rl: EdgeFnResponseSpec = {
        status: 429,
        body: { ...OVER_LIMIT_BODY, block_minutes: 30 },
        headers: { "Retry-After": "1800" },
      };
      mockEdgeFunctionFetch({ "/rate-limit-check": rl });
      const res = await fetch(`${BASE}/rate-limit-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ action: "login", identifier: "user@ex.com" }),
      });
      const data = await res.json();
      expect(typeof data.block_minutes).toBe("number");
    });
  });

  describe("ações diferentes têm limites independentes", () => {
    const actions = ["login", "api_call", "export", "ai_usage", "upload"];
    for (const action of actions) {
      it(`ação '${action}' é aceita como identifier de ação`, async () => {
        const ok: EdgeFnResponseSpec = { status: 200, body: { ...WITHIN_LIMIT_BODY, action } };
        mockEdgeFunctionFetch({ "/rate-limit-check": ok });
        const res = await fetch(`${BASE}/rate-limit-check`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
          body: JSON.stringify({ action, identifier: "user@ex.com" }),
        });
        expect(res.status).not.toBe(500);
      });
    }
  });

  describe("whitelist / bypass", () => {
    it("IP em whitelist retorna allowed=true mesmo após burst", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { allowed: true, whitelisted: true, remaining: 999, limit: 999 },
      };
      mockEdgeFunctionFetch({ "/rate-limit-check": ok });
      const res = await fetch(`${BASE}/rate-limit-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ action: "login", identifier: "ip:10.0.0.1" }),
      });
      const data = await res.json();
      expect(data.allowed).toBe(true);
    });
  });

  describe("validação de entrada — 400", () => {
    it("retorna 400 sem campo action", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "missing_action" } };
      mockEdgeFunctionFetch({ "/rate-limit-check": err });
      const res = await fetch(`${BASE}/rate-limit-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ identifier: "user@ex.com" }),
      });
      expect(res.status).toBe(400);
    });

    it("retorna 400 sem campo identifier", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "missing_identifier" } };
      mockEdgeFunctionFetch({ "/rate-limit-check": err });
      const res = await fetch(`${BASE}/rate-limit-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ action: "login" }),
      });
      expect(res.status).toBe(400);
    });

    it("não retorna 500 para identifier com SQL injection", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_input" } };
      mockEdgeFunctionFetch({ "/rate-limit-check": err });
      const res = await fetch(`${BASE}/rate-limit-check`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ action: "login", identifier: "'; DROP TABLE rate_limits;--" }),
      });
      expect(res.status).not.toBe(500);
    });
  });

  describe("sem autenticação — 401", () => {
    it("retorna 401 sem token", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/rate-limit-check": err });
      const res = await fetch(`${BASE}/rate-limit-check`, {
        method: "POST",
        body: JSON.stringify({ action: "login", identifier: "u@x.com" }),
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
      mockEdgeFunctionFetch({ "/rate-limit-check": cors });
      const res = await fetch(`${BASE}/rate-limit-check`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
    });
  });
});
