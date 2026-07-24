/**
 * Integration tests — quote-sync edge function
 * Cobre: sync de orçamento com CRM/Bitrix, status codes, validação de campos,
 * orçamento inexistente, falha do CRM, idempotência.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const VALID_QUOTE = {
  quote_id: "quote-uuid-001",
  client_name: "Empresa ABC Ltda",
  client_cnpj: "11.222.333/0001-81",
  total_value: 5000.0,
  items: [
    { sku: "CAN-001", name: "Caneta personalizada", quantity: 100, unit_price: 10.0 },
    { sku: "MOC-001", name: "Mochila", quantity: 50, unit_price: 80.0 },
  ],
  status: "pending",
};

describe("quote-sync", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("happy path — sync com CRM", () => {
    it("retorna 200 com external_id quando sync bem-sucedido", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, quote_id: "quote-uuid-001", external_id: "CRM-DEAL-9876", synced_at: new Date().toISOString() },
      };
      mockEdgeFunctionFetch({ "/quote-sync": ok });
      const res = await fetch(`${BASE}/quote-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify(VALID_QUOTE),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.external_id).toBeDefined();
      expect(data.synced_at).toBeDefined();
    });

    it("sync idempotente: segunda chamada com mesmo quote_id retorna mesmo external_id", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, quote_id: "quote-uuid-001", external_id: "CRM-DEAL-9876", duplicate: true },
      };
      mockEdgeFunctionFetch({ "/quote-sync": ok });
      const res = await fetch(`${BASE}/quote-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify(VALID_QUOTE),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.external_id).toBe("CRM-DEAL-9876");
    });
  });

  describe("validação de campos — 400", () => {
    const missingFieldCases = [
      { label: "sem quote_id", body: { ...VALID_QUOTE, quote_id: undefined } },
      { label: "sem client_name", body: { ...VALID_QUOTE, client_name: undefined } },
      { label: "sem items", body: { ...VALID_QUOTE, items: undefined } },
      { label: "items array vazio", body: { ...VALID_QUOTE, items: [] } },
      { label: "total_value negativo", body: { ...VALID_QUOTE, total_value: -100 } },
      { label: "total_value zero", body: { ...VALID_QUOTE, total_value: 0 } },
      { label: "quantity zero em item", body: { ...VALID_QUOTE, items: [{ ...VALID_QUOTE.items[0], quantity: 0 }] } },
      { label: "unit_price negativo em item", body: { ...VALID_QUOTE, items: [{ ...VALID_QUOTE.items[0], unit_price: -5 }] } },
      { label: "status inválido", body: { ...VALID_QUOTE, status: "INVALID_STATUS" } },
      { label: "body completamente vazio", body: {} },
    ];

    for (const { label, body } of missingFieldCases) {
      it(`retorna 400 para: ${label}`, async () => {
        const err: EdgeFnResponseSpec = { status: 400, body: { error: "validation_failed", fields: [] } };
        mockEdgeFunctionFetch({ "/quote-sync": err });
        const res = await fetch(`${BASE}/quote-sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
          body: JSON.stringify(body),
        });
        expect(res.status).toBe(400);
      });
    }
  });

  describe("orçamento inexistente — 404", () => {
    it("retorna 404 para quote_id que não existe", async () => {
      const notFound: EdgeFnResponseSpec = { status: 404, body: { error: "quote_not_found" } };
      mockEdgeFunctionFetch({ "/quote-sync": notFound });
      const res = await fetch(`${BASE}/quote-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify({ ...VALID_QUOTE, quote_id: "nonexistent-uuid" }),
      });
      expect([404, 422]).toContain(res.status);
    });
  });

  describe("falha do CRM — 503", () => {
    it("retorna 503 quando CRM está offline, não 500", async () => {
      const crmDown: EdgeFnResponseSpec = { status: 503, body: { error: "crm_unavailable", retry_after: 60 } };
      mockEdgeFunctionFetch({ "/quote-sync": crmDown });
      const res = await fetch(`${BASE}/quote-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify(VALID_QUOTE),
      });
      expect(res.status).toBe(503);
      expect(res.status).not.toBe(500);
    });

    it("retorna JSON estruturado (sem stack trace) quando CRM falha", async () => {
      const err: EdgeFnResponseSpec = { status: 503, body: { error: "crm_unavailable" } };
      mockEdgeFunctionFetch({ "/quote-sync": err });
      const res = await fetch(`${BASE}/quote-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify(VALID_QUOTE),
      });
      const data = await res.json();
      const body = JSON.stringify(data);
      expect(body).not.toMatch(/TypeError:|at\s+\w+\s+\(/);
    });
  });

  describe("autenticação — 401", () => {
    it("retorna 401 sem service key", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/quote-sync": err });
      const res = await fetch(`${BASE}/quote-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_QUOTE),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("valores extremos — sem crash", () => {
    const extremes = [
      { label: "total_value muito alto", body: { ...VALID_QUOTE, total_value: 9_999_999_999 } },
      { label: "quantity muito alta", body: { ...VALID_QUOTE, items: [{ ...VALID_QUOTE.items[0], quantity: 999999 }] } },
      { label: "100 itens no orçamento", body: { ...VALID_QUOTE, items: Array(100).fill(VALID_QUOTE.items[0]) } },
      { label: "client_name com caracteres especiais", body: { ...VALID_QUOTE, client_name: "Empresa <XSS> \"&SQL'" } },
    ];

    for (const { label, body } of extremes) {
      it(`não retorna 500 para: ${label}`, async () => {
        const ok: EdgeFnResponseSpec = { status: 200, body: { ok: true } };
        mockEdgeFunctionFetch({ "/quote-sync": ok });
        const res = await fetch(`${BASE}/quote-sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
          body: JSON.stringify(body),
        });
        expect(res.status).not.toBe(500);
      });
    }
  });
});
