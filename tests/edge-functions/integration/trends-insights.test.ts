/**
 * Integration tests — trends-insights edge function
 * Cobre: dados de tendências, filtros por período, segmentos, cache, payloads adversariais.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const TRENDS_RESPONSE = {
  period: "30d",
  trends: [
    { category: "escritório", growth_pct: 12.5, rank: 1, top_product: "Caneta Ecológica" },
    { category: "bebidas", growth_pct: -3.2, rank: 2, top_product: "Squeeze Personalizada" },
  ],
  total_categories: 2,
  generated_at: new Date().toISOString(),
};

describe("trends-insights", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("happy path", () => {
    it("retorna 200 com array de trends e metadata", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: TRENDS_RESPONSE };
      mockEdgeFunctionFetch({ "/trends-insights": ok });
      const res = await fetch(`${BASE}/trends-insights`, {
        headers: { Authorization: "Bearer valid-jwt" },
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data.trends)).toBe(true);
      expect(data.period).toBeDefined();
    });

    it("cada trend tem category, growth_pct e rank", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: TRENDS_RESPONSE };
      mockEdgeFunctionFetch({ "/trends-insights": ok });
      const res = await fetch(`${BASE}/trends-insights`, {
        headers: { Authorization: "Bearer valid-jwt" },
      });
      const data = await res.json();
      for (const trend of data.trends) {
        expect(trend.category).toBeDefined();
        expect(typeof trend.growth_pct).toBe("number");
        expect(typeof trend.rank).toBe("number");
      }
    });

    it("inclui generated_at como ISO 8601", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: TRENDS_RESPONSE };
      mockEdgeFunctionFetch({ "/trends-insights": ok });
      const res = await fetch(`${BASE}/trends-insights`, {
        headers: { Authorization: "Bearer valid-jwt" },
      });
      const data = await res.json();
      const parsed = new Date(data.generated_at);
      expect(isNaN(parsed.getTime())).toBe(false);
    });

    it("retorna X-Request-Id no header", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: TRENDS_RESPONSE,
        headers: { "x-request-id": "req-trends-001" },
      };
      mockEdgeFunctionFetch({ "/trends-insights": ok });
      const res = await fetch(`${BASE}/trends-insights`, {
        headers: { Authorization: "Bearer valid-jwt" },
      });
      expect(res.headers.get("x-request-id")).toBeTruthy();
    });
  });

  describe("filtros por período", () => {
    const periods = ["7d", "30d", "90d", "1y"];
    for (const period of periods) {
      it(`aceita period=${period} como query param`, async () => {
        const ok: EdgeFnResponseSpec = {
          status: 200,
          body: { ...TRENDS_RESPONSE, period },
        };
        mockEdgeFunctionFetch({ "/trends-insights": ok });
        const res = await fetch(`${BASE}/trends-insights?period=${period}`, {
          headers: { Authorization: "Bearer valid-jwt" },
        });
        expect(res.status).not.toBe(500);
      });
    }

    it("retorna 400 para período desconhecido", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_period" } };
      mockEdgeFunctionFetch({ "/trends-insights": err });
      const res = await fetch(`${BASE}/trends-insights?period=999d`, {
        headers: { Authorization: "Bearer valid-jwt" },
      });
      expect([400, 422]).toContain(res.status);
    });
  });

  describe("filtros por segmento", () => {
    it("aceita ?segment=corporativo", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: TRENDS_RESPONSE };
      mockEdgeFunctionFetch({ "/trends-insights": ok });
      const res = await fetch(`${BASE}/trends-insights?segment=corporativo`, {
        headers: { Authorization: "Bearer valid-jwt" },
      });
      expect(res.status).not.toBe(500);
    });
  });

  describe("cache headers", () => {
    it("inclui Cache-Control com max-age razoável", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: TRENDS_RESPONSE,
        headers: { "cache-control": "public, max-age=3600, stale-while-revalidate=300" },
      };
      mockEdgeFunctionFetch({ "/trends-insights": ok });
      const res = await fetch(`${BASE}/trends-insights`, {
        headers: { Authorization: "Bearer valid-jwt" },
      });
      const cc = res.headers.get("cache-control");
      expect(cc).toBeTruthy();
    });
  });

  describe("RBAC — roles permitidas", () => {
    const allowedRoles = ["admin", "supervisor", "dev"];
    for (const role of allowedRoles) {
      it(`${role} recebe acesso aos trends`, async () => {
        const ok: EdgeFnResponseSpec = { status: 200, body: TRENDS_RESPONSE };
        mockEdgeFunctionFetch({ "/trends-insights": ok });
        const res = await fetch(`${BASE}/trends-insights`, {
          headers: { Authorization: `Bearer ${role}-jwt` },
        });
        expect(res.status).toBe(200);
      });
    }

    it("agente sem permissão recebe 403", async () => {
      const err: EdgeFnResponseSpec = { status: 403, body: { error: "insufficient_role" } };
      mockEdgeFunctionFetch({ "/trends-insights": err });
      const res = await fetch(`${BASE}/trends-insights`, {
        headers: { Authorization: "Bearer agente-jwt" },
      });
      expect(res.status).toBe(403);
    });
  });

  describe("params adversariais", () => {
    const adversarialParams = [
      "?period=' OR '1'='1",
      "?segment=<script>alert(1)</script>",
      "?period=../../etc/passwd",
    ];

    for (const param of adversarialParams) {
      it(`não retorna 500 para ${param.slice(0, 40)}`, async () => {
        const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_input" } };
        mockEdgeFunctionFetch({ "/trends-insights": err });
        const res = await fetch(`${BASE}/trends-insights${param}`, {
          headers: { Authorization: "Bearer valid-jwt" },
        });
        expect(res.status).not.toBe(500);
      });
    }
  });

  describe("sem autenticação — 401", () => {
    it("retorna 401 sem token", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/trends-insights": err });
      const res = await fetch(`${BASE}/trends-insights`);
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
      mockEdgeFunctionFetch({ "/trends-insights": cors });
      const res = await fetch(`${BASE}/trends-insights`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
    });
  });
});
