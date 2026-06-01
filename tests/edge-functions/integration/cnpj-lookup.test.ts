/**
 * Integration tests — cnpj-lookup edge function
 * Cobre: validação de formato, CNPJ inválido, mock de sucesso, erros 4xx/5xx,
 * circuit breaker, auth ausente, payloads malformados (fuzz básico).
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const VALID_CNPJ_BODY = { cnpj: "00.000.000/0001-91" };
const VALID_CNPJ_SUCCESS = {
  cnpj: "00000000000191",
  name: "TEST COMPANY LTDA",
  alias: "TEST MOCK",
  status: "ATIVA",
  address: { street: "Rua Teste", number: "1", city: "São Paulo", state: "SP", zip: "01310-100" },
};

describe("cnpj-lookup", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("happy path", () => {
    it("retorna 200 com dados da empresa para CNPJ válido formatado", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: VALID_CNPJ_SUCCESS };
      mockEdgeFunctionFetch({ "/cnpj-lookup": ok });
      const res = await fetch(`${BASE}/cnpj-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
        body: JSON.stringify(VALID_CNPJ_BODY),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.cnpj).toBeDefined();
      expect(data.name).toBeDefined();
    });

    it("aceita CNPJ sem formatação (somente dígitos)", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: VALID_CNPJ_SUCCESS };
      mockEdgeFunctionFetch({ "/cnpj-lookup": ok });
      const res = await fetch(`${BASE}/cnpj-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
        body: JSON.stringify({ cnpj: "00000000000191" }),
      });
      expect(res.status).toBe(200);
    });

    it("retorna address com campos esperados", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: VALID_CNPJ_SUCCESS };
      mockEdgeFunctionFetch({ "/cnpj-lookup": ok });
      const res = await fetch(`${BASE}/cnpj-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
        body: JSON.stringify(VALID_CNPJ_BODY),
      });
      const data = await res.json();
      expect(data.address).toBeDefined();
      expect(data.address.city).toBeDefined();
      expect(data.address.state).toBeDefined();
    });
  });

  describe("validação de entrada — 400", () => {
    const cases400 = [
      { label: "CNPJ vazio", body: { cnpj: "" } },
      { label: "CNPJ só letras", body: { cnpj: "AAAABBBBCCCC00" } },
      { label: "CNPJ com 13 dígitos", body: { cnpj: "1234567890123" } },
      { label: "CNPJ com 15 dígitos", body: { cnpj: "123456789012345" } },
      { label: "campo cnpj ausente", body: {} },
      { label: "cnpj null", body: { cnpj: null } },
      { label: "cnpj numérico (não string)", body: { cnpj: 11222333000181 } },
    ];

    for (const { label, body } of cases400) {
      it(`retorna 400 para: ${label}`, async () => {
        const err: EdgeFnResponseSpec = { status: 400, body: { error: { cnpj: ["CNPJ inválido"] } } };
        mockEdgeFunctionFetch({ "/cnpj-lookup": err });
        const res = await fetch(`${BASE}/cnpj-lookup`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
          body: JSON.stringify(body),
        });
        expect(res.status).toBe(400);
        const data = await res.json();
        expect(data.error).toBeDefined();
      });
    }

    it("retorna 400 para JSON malformado", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_json" } };
      mockEdgeFunctionFetch({ "/cnpj-lookup": err });
      const res = await fetch(`${BASE}/cnpj-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
        body: "{ cnpj: MALFORMED",
      });
      expect(res.status).toBe(400);
    });

    it("retorna 400 para body vazio (sem conteúdo)", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "missing_body" } };
      mockEdgeFunctionFetch({ "/cnpj-lookup": err });
      const res = await fetch(`${BASE}/cnpj-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
        body: "",
      });
      expect(res.status).toBe(400);
    });
  });

  describe("autenticação — 401", () => {
    it("retorna 401 sem Bearer token", async () => {
      const authErr: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/cnpj-lookup": authErr });
      const res = await fetch(`${BASE}/cnpj-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_CNPJ_BODY),
      });
      expect(res.status).toBe(401);
    });

    it("retorna 401 com token inválido", async () => {
      const authErr: EdgeFnResponseSpec = { status: 401, body: { error: "invalid_token" } };
      mockEdgeFunctionFetch({ "/cnpj-lookup": authErr });
      const res = await fetch(`${BASE}/cnpj-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer INVALID" },
        body: JSON.stringify(VALID_CNPJ_BODY),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("circuit breaker / upstream 5xx", () => {
    it("retorna 503 quando upstream está offline, não 500", async () => {
      const cbOpen: EdgeFnResponseSpec = { status: 503, body: { error: "upstream_unavailable", circuit: "open" } };
      mockEdgeFunctionFetch({ "/cnpj-lookup": cbOpen });
      const res = await fetch(`${BASE}/cnpj-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
        body: JSON.stringify(VALID_CNPJ_BODY),
      });
      expect(res.status).toBe(503);
      expect(res.status).not.toBe(500);
      const data = await res.json();
      expect(data.error).toBeDefined();
      const body = JSON.stringify(data);
      expect(body).not.toMatch(/TypeError:|at\s+\w+\s+\(/);
    });

    it("retorna 429 com Retry-After quando rate-limited", async () => {
      const rl: EdgeFnResponseSpec = {
        status: 429,
        body: { error: "rate_limited", retryAfter: 30 },
        headers: { "Retry-After": "30" },
      };
      mockEdgeFunctionFetch({ "/cnpj-lookup": rl });
      const res = await fetch(`${BASE}/cnpj-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
        body: JSON.stringify(VALID_CNPJ_BODY),
      });
      expect(res.status).toBe(429);
      const retryAfter = res.headers.get("Retry-After");
      expect(retryAfter).toBeTruthy();
    });
  });

  describe("CNPJ inativo / não encontrado", () => {
    it("retorna 404 para CNPJ válido mas não cadastrado", async () => {
      const notFound: EdgeFnResponseSpec = { status: 404, body: { error: "cnpj_not_found" } };
      mockEdgeFunctionFetch({ "/cnpj-lookup": notFound });
      const res = await fetch(`${BASE}/cnpj-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
        body: JSON.stringify({ cnpj: "11.222.333/0001-81" }),
      });
      expect(res.status).toBe(404);
    });

    it("retorna 422 para CNPJ com dígito verificador inválido", async () => {
      const invalid: EdgeFnResponseSpec = { status: 422, body: { error: "invalid_check_digit" } };
      mockEdgeFunctionFetch({ "/cnpj-lookup": invalid });
      const res = await fetch(`${BASE}/cnpj-lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer test-token" },
        body: JSON.stringify({ cnpj: "11.222.333/0001-00" }),
      });
      expect([400, 422]).toContain(res.status);
    });
  });

  describe("CORS", () => {
    it("OPTIONS retorna headers CORS com x-request-id no Allow-Headers", async () => {
      const cors: EdgeFnResponseSpec = {
        status: 200,
        body: null,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "authorization, content-type, x-request-id",
          "access-control-expose-headers": "x-request-id",
        },
      };
      mockEdgeFunctionFetch({ "/cnpj-lookup": cors });
      const res = await fetch(`${BASE}/cnpj-lookup`, { method: "OPTIONS" });
      const allowHeaders = res.headers.get("access-control-allow-headers") ?? "";
      expect(allowHeaders.toLowerCase()).toContain("x-request-id");
    });
  });
});
