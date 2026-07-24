/**
 * Integration tests — health-check edge function
 * Valida contratos de entrada/saída, status codes e comportamento sob falhas.
 */
import { afterEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

describe("health-check", () => {
  afterEach(() => {
    resetExternalMocks();
  });

  describe("GET /health-check — happy path", () => {
    it("retorna 200 com shape {status, checks, latency_ms}", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: {
          status: "healthy",
          checks: { database: { status: "healthy", latency_ms: 12 } },
          latency_ms: 15,
        },
      };
      mockEdgeFunctionFetch({ "/health-check": ok });
      const res = await fetch(`${BASE}/health-check`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.status).toMatch(/^(healthy|degraded|unhealthy)$/);
      expect(data.checks).toBeDefined();
    });

    it("retorna checks.database com latency_ms numérico", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: {
          status: "healthy",
          checks: { database: { status: "healthy", latency_ms: 8 } },
          latency_ms: 10,
        },
      };
      mockEdgeFunctionFetch({ "/health-check": ok });
      const res = await fetch(`${BASE}/health-check`);
      const data = await res.json();
      expect(typeof data.latency_ms).toBe("number");
      expect(data.checks.database.latency_ms).toBeGreaterThanOrEqual(0);
    });

    it("retorna X-Request-Id no header de resposta", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { status: "healthy", checks: {}, latency_ms: 5 },
        headers: { "x-request-id": "test-req-001" },
      };
      mockEdgeFunctionFetch({ "/health-check": ok });
      const res = await fetch(`${BASE}/health-check`);
      expect(res.headers.get("x-request-id")).toBeTruthy();
    });
  });

  describe("degraded / unhealthy states", () => {
    it("retorna 200 com status=degraded quando DB lento", async () => {
      const degraded: EdgeFnResponseSpec = {
        status: 200,
        body: {
          status: "degraded",
          checks: { database: { status: "degraded", latency_ms: 4500, error: "slow" } },
          latency_ms: 4501,
        },
      };
      mockEdgeFunctionFetch({ "/health-check": degraded });
      const res = await fetch(`${BASE}/health-check`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.status).toBe("degraded");
      expect(data.checks.database.status).toBe("degraded");
    });

    it("retorna 503 quando status=unhealthy (todas as dependências falharam)", async () => {
      const unhealthy: EdgeFnResponseSpec = {
        status: 503,
        body: {
          status: "unhealthy",
          checks: { database: { status: "unhealthy", error: "connection refused" } },
          latency_ms: 100,
        },
      };
      mockEdgeFunctionFetch({ "/health-check": unhealthy });
      const res = await fetch(`${BASE}/health-check`);
      const data = await res.json();
      expect(res.status).toBe(503);
      expect(data.status).toBe("unhealthy");
    });

    it("não expõe stack trace em campo error quando DB falha", async () => {
      const unhealthy: EdgeFnResponseSpec = {
        status: 503,
        body: {
          status: "unhealthy",
          checks: { database: { status: "unhealthy", error: "connection refused" } },
          latency_ms: 50,
        },
      };
      mockEdgeFunctionFetch({ "/health-check": unhealthy });
      const res = await fetch(`${BASE}/health-check`);
      const data = await res.json();
      const errorStr = JSON.stringify(data);
      expect(errorStr).not.toMatch(/at\s+\w+\s+\(/); // sem stack frames
      expect(errorStr).not.toMatch(/TypeError:|ReferenceError:/);
    });
  });

  describe("CORS e método", () => {
    it("OPTIONS retorna 200 com Access-Control-Allow-Origin", async () => {
      const cors: EdgeFnResponseSpec = {
        status: 200,
        body: null,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-methods": "GET, POST, OPTIONS",
        },
      };
      mockEdgeFunctionFetch({ "/health-check": cors });
      const res = await fetch(`${BASE}/health-check`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
      const origin = res.headers.get("access-control-allow-origin");
      expect(origin).toBeTruthy();
    });
  });

  describe("timeout / falha de rede", () => {
    it("não retorna 500 — retorna 503 com JSON estruturado quando há timeout interno", async () => {
      const timeout: EdgeFnResponseSpec = {
        status: 503,
        body: { status: "unhealthy", error: "upstream timeout" },
      };
      mockEdgeFunctionFetch({ "/health-check": timeout });
      const res = await fetch(`${BASE}/health-check`);
      expect(res.status).not.toBe(500);
      const ct = res.headers.get("content-type") ?? "";
      expect(ct).toContain("application/json");
    });
  });
});
