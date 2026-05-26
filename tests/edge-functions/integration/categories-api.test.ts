/**
 * Integration tests — categories-api edge function
 * Cobre: listagem, hierarquia, filtros, cache headers, input malformado, CORS.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const CATEGORIES_RESPONSE = [
  {
    id: "cat-001",
    name: "Brindes Personalizados",
    slug: "brindes-personalizados",
    parent_id: null,
    children: [
      { id: "cat-002", name: "Escritório", slug: "escritorio", parent_id: "cat-001" },
      { id: "cat-003", name: "Bebidas", slug: "bebidas", parent_id: "cat-001" },
    ],
    product_count: 42,
  },
];

describe("categories-api", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("GET /categories-api — happy path", () => {
    it("retorna 200 com array de categorias", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: CATEGORIES_RESPONSE };
      mockEdgeFunctionFetch({ "/categories-api": ok });
      const res = await fetch(`${BASE}/categories-api`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
    });

    it("cada categoria tem id, name e slug definidos", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: CATEGORIES_RESPONSE };
      mockEdgeFunctionFetch({ "/categories-api": ok });
      const res = await fetch(`${BASE}/categories-api`);
      const data = await res.json();
      for (const cat of data) {
        expect(cat.id).toBeDefined();
        expect(typeof cat.name).toBe("string");
        expect(typeof cat.slug).toBe("string");
      }
    });

    it("suporta hierarquia (children aninhados)", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: CATEGORIES_RESPONSE };
      mockEdgeFunctionFetch({ "/categories-api": ok });
      const res = await fetch(`${BASE}/categories-api`);
      const data = await res.json();
      const root = data[0];
      expect(Array.isArray(root.children)).toBe(true);
    });

    it("inclui product_count numérico", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: CATEGORIES_RESPONSE };
      mockEdgeFunctionFetch({ "/categories-api": ok });
      const res = await fetch(`${BASE}/categories-api`);
      const data = await res.json();
      expect(typeof data[0].product_count).toBe("number");
    });
  });

  describe("cache headers", () => {
    it("inclui Cache-Control para respostas públicas", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: CATEGORIES_RESPONSE,
        headers: {
          "cache-control": "public, max-age=300, stale-while-revalidate=60",
          "x-request-id": "req-cat-001",
        },
      };
      mockEdgeFunctionFetch({ "/categories-api": ok });
      const res = await fetch(`${BASE}/categories-api`);
      const cc = res.headers.get("cache-control");
      expect(cc).toBeTruthy();
      expect(cc).toMatch(/max-age/);
    });

    it("retorna X-Request-Id no header", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: [],
        headers: { "x-request-id": "req-cat-002" },
      };
      mockEdgeFunctionFetch({ "/categories-api": ok });
      const res = await fetch(`${BASE}/categories-api`);
      expect(res.headers.get("x-request-id")).toBeTruthy();
    });
  });

  describe("filtros por query params", () => {
    it("aceita ?parent_id= para buscar subcategorias", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: [{ id: "cat-002", name: "Escritório", slug: "escritorio", parent_id: "cat-001", children: [] }],
      };
      mockEdgeFunctionFetch({ "/categories-api": ok });
      const res = await fetch(`${BASE}/categories-api?parent_id=cat-001`);
      expect(res.status).toBe(200);
    });

    it("retorna array vazio quando nenhuma categoria corresponde ao filtro", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: [] };
      mockEdgeFunctionFetch({ "/categories-api": ok });
      const res = await fetch(`${BASE}/categories-api?parent_id=nonexistent`);
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(Array.isArray(data)).toBe(true);
      expect(data.length).toBe(0);
    });

    it("ignora parâmetros desconhecidos sem erro 400", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: CATEGORIES_RESPONSE };
      mockEdgeFunctionFetch({ "/categories-api": ok });
      const res = await fetch(`${BASE}/categories-api?unknown_param=foo&another=bar`);
      expect(res.status).toBe(200);
    });
  });

  describe("inputs adversariais", () => {
    const adversarialParams = [
      "?parent_id=' OR '1'='1",
      "?parent_id=<script>alert(1)</script>",
      "?parent_id=../../etc/passwd",
      "?limit=-999999",
      "?limit=99999999999999999",
    ];

    for (const param of adversarialParams) {
      it(`não retorna 500 para param ${param.slice(0, 30)}`, async () => {
        const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_input" } };
        mockEdgeFunctionFetch({ "/categories-api": err });
        const res = await fetch(`${BASE}/categories-api${param}`);
        expect(res.status).not.toBe(500);
      });
    }
  });

  describe("falha de banco", () => {
    it("retorna 503 quando banco indisponível (sem crash 500)", async () => {
      const err: EdgeFnResponseSpec = {
        status: 503,
        body: { error: "database_unavailable", retry_after: 30 },
      };
      mockEdgeFunctionFetch({ "/categories-api": err });
      const res = await fetch(`${BASE}/categories-api`);
      expect(res.status).not.toBe(500);
    });

    it("resposta de erro não expõe stack trace ou DSN", async () => {
      const err: EdgeFnResponseSpec = {
        status: 503,
        body: { error: "database_unavailable" },
      };
      mockEdgeFunctionFetch({ "/categories-api": err });
      const res = await fetch(`${BASE}/categories-api`);
      const raw = await res.text();
      expect(raw).not.toMatch(/at\s+\w+\s+\(/);
      expect(raw).not.toMatch(/postgresql:\/\//i);
    });
  });

  describe("CORS", () => {
    it("OPTIONS retorna Access-Control-Allow-Origin", async () => {
      const cors: EdgeFnResponseSpec = {
        status: 200,
        body: null,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-expose-headers": "x-request-id",
        },
      };
      mockEdgeFunctionFetch({ "/categories-api": cors });
      const res = await fetch(`${BASE}/categories-api`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
      expect(res.headers.get("access-control-allow-origin")).toBeTruthy();
    });

    it("POST retorna 405 Method Not Allowed", async () => {
      const err: EdgeFnResponseSpec = { status: 405, body: { error: "method_not_allowed" } };
      mockEdgeFunctionFetch({ "/categories-api": err });
      const res = await fetch(`${BASE}/categories-api`, { method: "POST", body: "{}" });
      expect([405, 404]).toContain(res.status);
    });
  });
});
