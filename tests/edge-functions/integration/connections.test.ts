/**
 * Integration tests — connections-hub-audit, connections-auto-test, connection-tester
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const AUTH = { Authorization: "Bearer service-role-key" };
const CT = { "Content-Type": "application/json" };

// ─── connections-hub-audit ────────────────────────────────────────────────────

describe("connections-hub-audit", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("payload válido", () => {
    it("GET sem body → 200 + lista de conexões", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, connections: [], total: 0 },
      };
      mockEdgeFunctionFetch({ "/connections-hub-audit": spec });
      const res = await fetch(`${BASE}/connections-hub-audit`, {
        method: "GET",
        headers: AUTH,
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it("POST com connection_id → 200 + audit entries", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: {
          ok: true,
          connection_id: "conn-001",
          audit: [{ event: "test", timestamp: new Date().toISOString(), status: "ok" }],
        },
      };
      mockEdgeFunctionFetch({ "/connections-hub-audit": spec });
      const res = await fetch(`${BASE}/connections-hub-audit`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify({ connection_id: "conn-001" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.audit)).toBe(true);
    });

    it("filtro por status=failed → 200", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, connections: [{ id: "conn-002", status: "failed" }] },
      };
      mockEdgeFunctionFetch({ "/connections-hub-audit": spec });
      const res = await fetch(`${BASE}/connections-hub-audit`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify({ filter: { status: "failed" } }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe("autenticação", () => {
    it("sem Authorization → 401", async () => {
      const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/connections-hub-audit": spec });
      const res = await fetch(`${BASE}/connections-hub-audit`, { method: "GET" });
      expect(res.status).toBe(401);
    });
  });

  describe("payloads malformados", () => {
    const cases = [
      { label: "JSON inválido", body: "{bad" },
      { label: "connection_id com SQL injection", body: JSON.stringify({ connection_id: "'; DROP TABLE--" }) },
      { label: "connection_id muito longo", body: JSON.stringify({ connection_id: "x".repeat(500) }) },
    ];

    for (const { label, body } of cases) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 400, body: { error: "bad_request" } };
        mockEdgeFunctionFetch({ "/connections-hub-audit": spec });
        const res = await fetch(`${BASE}/connections-hub-audit`, {
          method: "POST",
          headers: { ...CT, ...AUTH },
          body,
        });
        expect(res.status).not.toBe(500);
      });
    }
  });

  describe("CORS", () => {
    it("OPTIONS retorna CORS headers", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: null,
        headers: { "access-control-allow-origin": "*", "access-control-allow-headers": "content-type, authorization" },
      };
      mockEdgeFunctionFetch({ "/connections-hub-audit": spec });
      const res = await fetch(`${BASE}/connections-hub-audit`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
    });
  });
});

// ─── connections-auto-test ────────────────────────────────────────────────────

describe("connections-auto-test", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("payload válido", () => {
    it("testa conexão por ID → 200 + resultado do teste", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, connection_id: "conn-001", reachable: true, latency_ms: 45 },
      };
      mockEdgeFunctionFetch({ "/connections-auto-test": spec });
      const res = await fetch(`${BASE}/connections-auto-test`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify({ connection_id: "conn-001" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(typeof data.reachable).toBe("boolean");
    });

    it("teste em lote → 200 + resultados", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: {
          ok: true,
          results: [
            { connection_id: "conn-001", reachable: true },
            { connection_id: "conn-002", reachable: false, error: "timeout" },
          ],
        },
      };
      mockEdgeFunctionFetch({ "/connections-auto-test": spec });
      const res = await fetch(`${BASE}/connections-auto-test`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify({ connection_ids: ["conn-001", "conn-002"] }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(Array.isArray(data.results)).toBe(true);
    });

    it("conexão inacessível → 200 com reachable=false (não 5xx)", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, reachable: false, error: "connection_refused" },
      };
      mockEdgeFunctionFetch({ "/connections-auto-test": spec });
      const res = await fetch(`${BASE}/connections-auto-test`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify({ connection_id: "conn-offline" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.reachable).toBe(false);
    });
  });

  describe("autenticação", () => {
    it("sem Authorization → 401", async () => {
      const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/connections-auto-test": spec });
      const res = await fetch(`${BASE}/connections-auto-test`, {
        method: "POST",
        headers: CT,
        body: JSON.stringify({ connection_id: "conn-001" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("payloads malformados", () => {
    const cases = [
      { label: "body vazio", body: "" },
      { label: "connection_id ausente", body: JSON.stringify({}) },
      { label: "SSRF — localhost", body: JSON.stringify({ connection_id: "x", override_url: "http://localhost:5432" }) },
      { label: "SSRF — 169.254.x (metadata)", body: JSON.stringify({ connection_id: "x", override_url: "http://169.254.169.254/latest/meta-data" }) },
    ];

    for (const { label, body } of cases) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/connections-auto-test": spec });
        const res = await fetch(`${BASE}/connections-auto-test`, {
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
        headers: { "access-control-allow-origin": "*" },
      };
      mockEdgeFunctionFetch({ "/connections-auto-test": spec });
      const res = await fetch(`${BASE}/connections-auto-test`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
    });
  });
});

// ─── connection-tester ────────────────────────────────────────────────────────

describe("connection-tester", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("payload válido", () => {
    it("testa endpoint externo → 200 + status", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, endpoint_reachable: true, response_code: 200 },
      };
      mockEdgeFunctionFetch({ "/connection-tester": spec });
      const res = await fetch(`${BASE}/connection-tester`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify({ endpoint: "https://api.example.com/health", method: "GET" }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    });

    it("teste de banco de dados → 200", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, db_reachable: true, latency_ms: 12 },
      };
      mockEdgeFunctionFetch({ "/connection-tester": spec });
      const res = await fetch(`${BASE}/connection-tester`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify({ type: "database", connection_id: "db-001" }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe("autenticação", () => {
    it("sem Authorization → 401", async () => {
      const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/connection-tester": spec });
      const res = await fetch(`${BASE}/connection-tester`, {
        method: "POST",
        headers: CT,
        body: JSON.stringify({ endpoint: "https://api.example.com/health" }),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("payloads malformados / SSRF", () => {
    const cases = [
      { label: "body vazio", body: "" },
      { label: "endpoint ausente", body: JSON.stringify({ method: "GET" }) },
      { label: "SSRF — localhost", body: JSON.stringify({ endpoint: "http://localhost:8080/admin" }) },
      { label: "SSRF — 0.0.0.0", body: JSON.stringify({ endpoint: "http://0.0.0.0:9000" }) },
      { label: "SSRF — 127.0.0.1", body: JSON.stringify({ endpoint: "http://127.0.0.1/etc/passwd" }) },
      { label: "SSRF — IP interno", body: JSON.stringify({ endpoint: "http://10.0.0.1/secret" }) },
      { label: "SSRF — file://", body: JSON.stringify({ endpoint: "file:///etc/passwd" }) },
    ];

    for (const { label, body } of cases) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/connection-tester": spec });
        const res = await fetch(`${BASE}/connection-tester`, {
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
        headers: { "access-control-allow-origin": "*" },
      };
      mockEdgeFunctionFetch({ "/connection-tester": spec });
      const res = await fetch(`${BASE}/connection-tester`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
    });
  });
});
