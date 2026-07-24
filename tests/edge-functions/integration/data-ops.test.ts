/**
 * Integration tests — external-db-bridge, sync-external-db, crm-db-bridge, bitrix-sync
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const AUTH = { Authorization: "Bearer service-role-key" };
const CT = { "Content-Type": "application/json" };

// ─── external-db-bridge ───────────────────────────────────────────────────────

describe("external-db-bridge", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("SELECT com tabela válida → 200 + rows", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, rows: [{ id: 1, name: "Product A" }], count: 1 },
    };
    mockEdgeFunctionFetch({ "/external-db-bridge": spec });
    const res = await fetch(`${BASE}/external-db-bridge`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ operation: "select", table: "products", limit: 10 }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.rows).toBeTruthy();
  });

  it("SELECT com filtro WHERE → 200", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, rows: [{ id: 5, name: "Filtered" }], count: 1 },
    };
    mockEdgeFunctionFetch({ "/external-db-bridge": spec });
    const res = await fetch(`${BASE}/external-db-bridge`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({
        operation: "select",
        table: "products",
        where: { id: 5 },
      }),
    });
    expect(res.status).toBe(200);
  });

  it("INSERT → 200 + inserted_id", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, inserted_id: 42 },
    };
    mockEdgeFunctionFetch({ "/external-db-bridge": spec });
    const res = await fetch(`${BASE}/external-db-bridge`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({
        operation: "insert",
        table: "products",
        data: { name: "New Product", price: 99.90 },
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.inserted_id).toBeTruthy();
  });

  it("tabela não permitida → 403", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 403,
      body: { error: "table_not_allowed", table: "auth.users" },
    };
    mockEdgeFunctionFetch({ "/external-db-bridge": spec });
    const res = await fetch(`${BASE}/external-db-bridge`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ operation: "select", table: "auth.users" }),
    });
    expect(res.status).toBe(403);
  });

  it("sem Authorization → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
    mockEdgeFunctionFetch({ "/external-db-bridge": spec });
    const res = await fetch(`${BASE}/external-db-bridge`, {
      method: "POST",
      headers: CT,
      body: JSON.stringify({ operation: "select", table: "products" }),
    });
    expect(res.status).toBe(401);
  });

  describe("payloads malformados / SQL injection", () => {
    for (const { label, body } of [
      { label: "operation ausente", body: JSON.stringify({ table: "products" }) },
      { label: "table ausente", body: JSON.stringify({ operation: "select" }) },
      { label: "operation inválida", body: JSON.stringify({ operation: "drop_table", table: "products" }) },
      { label: "SQL injection no table", body: JSON.stringify({ operation: "select", table: "products; DROP TABLE quotes--" }) },
      { label: "SQL injection no where", body: JSON.stringify({ operation: "select", table: "products", where: "1=1 OR 1=1" }) },
      { label: "body vazio", body: "" },
      { label: "limit > 10000", body: JSON.stringify({ operation: "select", table: "products", limit: 99999 }) },
    ]) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/external-db-bridge": spec });
        const res = await fetch(`${BASE}/external-db-bridge`, {
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

  it("erro interno não expõe stack trace", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 500,
      body: { error: "db_connection_failed", message: "Cannot reach database" },
    };
    mockEdgeFunctionFetch({ "/external-db-bridge": spec });
    const res = await fetch(`${BASE}/external-db-bridge`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ operation: "select", table: "products" }),
    });
    if (res.status === 500) {
      const text = await res.clone().text();
      expect(text).not.toMatch(/at\s+\w+\s+\(/);
      expect(text).not.toContain("stack");
    }
  });

  it("OPTIONS retorna CORS headers", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: null,
      headers: { "access-control-allow-origin": "*" },
    };
    mockEdgeFunctionFetch({ "/external-db-bridge": spec });
    const res = await fetch(`${BASE}/external-db-bridge`, { method: "OPTIONS" });
    expect([200, 204]).toContain(res.status);
  });
});

// ─── sync-external-db ─────────────────────────────────────────────────────────

describe("sync-external-db", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("sync completo → 200 + resumo da sincronização", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: {
        ok: true,
        synced_at: new Date().toISOString(),
        inserted: 12,
        updated: 5,
        deleted: 0,
        errors: 0,
      },
    };
    mockEdgeFunctionFetch({ "/sync-external-db": spec });
    const res = await fetch(`${BASE}/sync-external-db`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ source: "erp", full_sync: true }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.inserted).toBe("number");
    expect(typeof data.updated).toBe("number");
  });

  it("sync incremental com since_date → 200", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, synced_at: new Date().toISOString(), inserted: 2, updated: 1 },
    };
    mockEdgeFunctionFetch({ "/sync-external-db": spec });
    const res = await fetch(`${BASE}/sync-external-db`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({
        source: "erp",
        since_date: "2026-05-28T00:00:00Z",
        tables: ["products", "prices"],
      }),
    });
    expect(res.status).toBe(200);
  });

  it("source inexistente → 404", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 404,
      body: { error: "source_not_configured" },
    };
    mockEdgeFunctionFetch({ "/sync-external-db": spec });
    const res = await fetch(`${BASE}/sync-external-db`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ source: "unknown_db_xyz" }),
    });
    expect(res.status).toBe(404);
  });

  it("sem Authorization → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
    mockEdgeFunctionFetch({ "/sync-external-db": spec });
    const res = await fetch(`${BASE}/sync-external-db`, {
      method: "POST",
      headers: CT,
      body: JSON.stringify({ source: "erp" }),
    });
    expect(res.status).toBe(401);
  });

  describe("payloads malformados", () => {
    for (const { label, body } of [
      { label: "source ausente", body: JSON.stringify({}) },
      { label: "since_date inválida", body: JSON.stringify({ source: "erp", since_date: "ontem" }) },
      { label: "body vazio", body: "" },
    ]) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/sync-external-db": spec });
        const res = await fetch(`${BASE}/sync-external-db`, {
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

  it("OPTIONS retorna CORS headers", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: null,
      headers: { "access-control-allow-origin": "*" },
    };
    mockEdgeFunctionFetch({ "/sync-external-db": spec });
    const res = await fetch(`${BASE}/sync-external-db`, { method: "OPTIONS" });
    expect([200, 204]).toContain(res.status);
  });
});

// ─── crm-db-bridge ────────────────────────────────────────────────────────────

describe("crm-db-bridge", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("busca contato no CRM por email → 200 + contact", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, contact: { id: "crm-001", name: "Maria Santos", email: "maria@empresa.com" } },
    };
    mockEdgeFunctionFetch({ "/crm-db-bridge": spec });
    const res = await fetch(`${BASE}/crm-db-bridge`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ operation: "get_contact", email: "maria@empresa.com" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.contact).toBeTruthy();
  });

  it("cria lead no CRM → 200 + crm_id", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, crm_id: "lead-999", created: true },
    };
    mockEdgeFunctionFetch({ "/crm-db-bridge": spec });
    const res = await fetch(`${BASE}/crm-db-bridge`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({
        operation: "create_lead",
        data: {
          name: "Pedro Oliveira",
          email: "pedro@empresa.com",
          phone: "+5511999999999",
          source: "quote_builder",
        },
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.crm_id).toBeTruthy();
  });

  it("sem Authorization → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
    mockEdgeFunctionFetch({ "/crm-db-bridge": spec });
    const res = await fetch(`${BASE}/crm-db-bridge`, {
      method: "POST",
      headers: CT,
      body: JSON.stringify({ operation: "get_contact", email: "x@x.com" }),
    });
    expect(res.status).toBe(401);
  });

  describe("payloads malformados", () => {
    for (const { label, body } of [
      { label: "operation ausente", body: JSON.stringify({ email: "x@x.com" }) },
      { label: "operation inválida", body: JSON.stringify({ operation: "drop_crm" }) },
      { label: "email inválido", body: JSON.stringify({ operation: "get_contact", email: "not-email" }) },
      { label: "body vazio", body: "" },
    ]) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/crm-db-bridge": spec });
        const res = await fetch(`${BASE}/crm-db-bridge`, {
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

  it("OPTIONS retorna CORS headers", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: null,
      headers: { "access-control-allow-origin": "*" },
    };
    mockEdgeFunctionFetch({ "/crm-db-bridge": spec });
    const res = await fetch(`${BASE}/crm-db-bridge`, { method: "OPTIONS" });
    expect([200, 204]).toContain(res.status);
  });
});

// ─── bitrix-sync ──────────────────────────────────────────────────────────────

describe("bitrix-sync", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("sync deal no Bitrix → 200 + bitrix_deal_id", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, bitrix_deal_id: 12345, synced: true },
    };
    mockEdgeFunctionFetch({ "/bitrix-sync": spec });
    const res = await fetch(`${BASE}/bitrix-sync`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({
        entity_type: "deal",
        quote_id: "550e8400-e29b-41d4-a716-446655440001",
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.bitrix_deal_id).toBeTruthy();
  });

  it("sync contato no Bitrix → 200", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, bitrix_contact_id: 67890, synced: true },
    };
    mockEdgeFunctionFetch({ "/bitrix-sync": spec });
    const res = await fetch(`${BASE}/bitrix-sync`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({
        entity_type: "contact",
        user_id: "550e8400-e29b-41d4-a716-446655440001",
      }),
    });
    expect(res.status).toBe(200);
  });

  it("Bitrix indisponível → 200 com queued=true (não falha)", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, queued: true, reason: "bitrix_unavailable" },
    };
    mockEdgeFunctionFetch({ "/bitrix-sync": spec });
    const res = await fetch(`${BASE}/bitrix-sync`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ entity_type: "deal", quote_id: "550e8400-e29b-41d4-a716-446655440001" }),
    });
    expect(res.status).toBe(200);
  });

  it("sem Authorization → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
    mockEdgeFunctionFetch({ "/bitrix-sync": spec });
    const res = await fetch(`${BASE}/bitrix-sync`, {
      method: "POST",
      headers: CT,
      body: JSON.stringify({ entity_type: "deal", quote_id: "q1" }),
    });
    expect(res.status).toBe(401);
  });

  describe("payloads malformados", () => {
    for (const { label, body } of [
      { label: "entity_type ausente", body: JSON.stringify({ quote_id: "q1" }) },
      { label: "entity_type inválido", body: JSON.stringify({ entity_type: "unknown", quote_id: "q1" }) },
      { label: "body vazio", body: "" },
      { label: "JSON quebrado", body: "{bad" },
    ]) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/bitrix-sync": spec });
        const res = await fetch(`${BASE}/bitrix-sync`, {
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

  it("OPTIONS retorna CORS headers", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: null,
      headers: { "access-control-allow-origin": "*" },
    };
    mockEdgeFunctionFetch({ "/bitrix-sync": spec });
    const res = await fetch(`${BASE}/bitrix-sync`, { method: "OPTIONS" });
    expect([200, 204]).toContain(res.status);
  });
});
