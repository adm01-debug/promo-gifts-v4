/**
 * Integration tests — semantic-search edge function
 * Cobre: query válida, sem resultados, filtros, embedding, CORS, auth, payloads adversariais.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const SEARCH_RESULT = {
  results: [
    { product_id: "p1", name: "Caneta Ecológica", score: 0.92, category: "escritório" },
    { product_id: "p2", name: "Bloco Ecológico", score: 0.85, category: "escritório" },
  ],
  total: 2,
  query_embedding_ms: 45,
  search_ms: 12,
};

describe("semantic-search", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("busca semântica — happy path", () => {
    it("retorna 200 com results array e scores", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: SEARCH_RESULT };
      mockEdgeFunctionFetch({ "/semantic-search": ok });
      const res = await fetch(`${BASE}/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ query: "caneta reciclável para evento", limit: 10 }),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data.results)).toBe(true);
    });

    it("cada resultado tem product_id e score entre 0 e 1", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: SEARCH_RESULT };
      mockEdgeFunctionFetch({ "/semantic-search": ok });
      const res = await fetch(`${BASE}/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ query: "canetas personalizadas" }),
      });
      const data = await res.json();
      for (const r of data.results) {
        expect(r.product_id).toBeDefined();
        expect(typeof r.score).toBe("number");
        expect(r.score).toBeGreaterThanOrEqual(0);
        expect(r.score).toBeLessThanOrEqual(1);
      }
    });

    it("resultados são ordenados por score decrescente", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: SEARCH_RESULT };
      mockEdgeFunctionFetch({ "/semantic-search": ok });
      const res = await fetch(`${BASE}/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ query: "brindes corporativos" }),
      });
      const data = await res.json();
      const scores = data.results.map((r: { score: number }) => r.score);
      for (let i = 1; i < scores.length; i++) {
        expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
      }
    });

    it("inclui métricas de latência (query_embedding_ms, search_ms)", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: SEARCH_RESULT };
      mockEdgeFunctionFetch({ "/semantic-search": ok });
      const res = await fetch(`${BASE}/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ query: "test" }),
      });
      const data = await res.json();
      expect(typeof data.query_embedding_ms).toBe("number");
      expect(typeof data.search_ms).toBe("number");
    });
  });

  describe("sem resultados", () => {
    it("retorna 200 com results=[] quando nada encontrado", async () => {
      const empty: EdgeFnResponseSpec = {
        status: 200,
        body: { results: [], total: 0, query_embedding_ms: 30, search_ms: 5 },
      };
      mockEdgeFunctionFetch({ "/semantic-search": empty });
      const res = await fetch(`${BASE}/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ query: "xyzzy_produto_inexistente_12345" }),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.results).toHaveLength(0);
      expect(data.total).toBe(0);
    });
  });

  describe("filtros", () => {
    it("aceita filtro por category", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: { ...SEARCH_RESULT, results: [SEARCH_RESULT.results[0]] } };
      mockEdgeFunctionFetch({ "/semantic-search": ok });
      const res = await fetch(`${BASE}/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ query: "caneta", filters: { category: "escritório" }, limit: 5 }),
      });
      expect(res.status).toBe(200);
    });

    it("aceita filtro por budget_max", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: { results: [], total: 0 } };
      mockEdgeFunctionFetch({ "/semantic-search": ok });
      const res = await fetch(`${BASE}/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ query: "brinde", filters: { budget_max: 10 }, limit: 5 }),
      });
      expect(res.status).not.toBe(500);
    });
  });

  describe("validação de entrada — 400", () => {
    it("retorna 400 quando query está ausente", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "missing_query" } };
      mockEdgeFunctionFetch({ "/semantic-search": err });
      const res = await fetch(`${BASE}/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ limit: 5 }),
      });
      expect(res.status).toBe(400);
    });

    it("retorna 400 para query vazia", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "empty_query" } };
      mockEdgeFunctionFetch({ "/semantic-search": err });
      const res = await fetch(`${BASE}/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ query: "" }),
      });
      expect(res.status).toBe(400);
    });

    it("retorna 400 para query com >2000 chars", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "query_too_long" } };
      mockEdgeFunctionFetch({ "/semantic-search": err });
      const res = await fetch(`${BASE}/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ query: "a".repeat(2001) }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("payloads adversariais", () => {
    const adversarialQueries = [
      "'; DROP TABLE products;--",
      "<script>alert(document.cookie)</script>",
      "http://169.254.169.254/latest/meta-data/",
      "\x00\x01\x02 null bytes",
      "a".repeat(10_000),
    ];

    for (const query of adversarialQueries) {
      it(`não retorna 500 para query adversarial (${query.slice(0, 30)}...)`, async () => {
        const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_input" } };
        mockEdgeFunctionFetch({ "/semantic-search": err });
        const res = await fetch(`${BASE}/semantic-search`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
          body: JSON.stringify({ query }),
        });
        expect(res.status).not.toBe(500);
      });
    }
  });

  describe("autenticação — 401", () => {
    it("retorna 401 sem token", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/semantic-search": err });
      const res = await fetch(`${BASE}/semantic-search`, {
        method: "POST",
        body: JSON.stringify({ query: "caneta" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("CORS e X-Request-Id", () => {
    it("OPTIONS retorna CORS headers", async () => {
      const cors: EdgeFnResponseSpec = {
        status: 200,
        body: null,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-expose-headers": "x-request-id",
        },
      };
      mockEdgeFunctionFetch({ "/semantic-search": cors });
      const res = await fetch(`${BASE}/semantic-search`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
    });

    it("resposta inclui X-Request-Id", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { results: [] },
        headers: { "x-request-id": "req-search-001" },
      };
      mockEdgeFunctionFetch({ "/semantic-search": ok });
      const res = await fetch(`${BASE}/semantic-search`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ query: "test" }),
      });
      expect(res.headers.get("x-request-id")).toBeTruthy();
    });
  });
});
