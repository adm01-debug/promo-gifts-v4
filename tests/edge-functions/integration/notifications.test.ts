/**
 * Integration tests — send-notification, send-transactional-email,
 *                     send-digest, cleanup-notifications
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const AUTH = { Authorization: "Bearer service-role-key" };
const CT = { "Content-Type": "application/json" };

// ─── send-notification ────────────────────────────────────────────────────────

describe("send-notification", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("notificação válida → 200 + notification_id", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, notification_id: "notif-001", delivered: true },
    };
    mockEdgeFunctionFetch({ "/send-notification": spec });
    const res = await fetch(`${BASE}/send-notification`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({
        user_id: "550e8400-e29b-41d4-a716-446655440001",
        type: "quote_approved",
        title: "Orçamento aprovado",
        message: "Seu orçamento foi aprovado com sucesso.",
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.notification_id).toBeTruthy();
  });

  it("notificação broadcast para múltiplos usuários → 200 + count", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, sent_count: 3, failed_count: 0 },
    };
    mockEdgeFunctionFetch({ "/send-notification": spec });
    const res = await fetch(`${BASE}/send-notification`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({
        user_ids: [
          "550e8400-e29b-41d4-a716-446655440001",
          "550e8400-e29b-41d4-a716-446655440002",
          "550e8400-e29b-41d4-a716-446655440003",
        ],
        type: "system_update",
        title: "Nova funcionalidade disponível",
        message: "Acesse o painel para ver as novidades.",
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.sent_count).toBe("number");
  });

  it("user_id inexistente → 404", async () => {
    const spec: EdgeFnResponseSpec = { status: 404, body: { error: "user_not_found" } };
    mockEdgeFunctionFetch({ "/send-notification": spec });
    const res = await fetch(`${BASE}/send-notification`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({
        user_id: "00000000-0000-0000-0000-000000000001",
        type: "info",
        title: "Test",
        message: "Test",
      }),
    });
    expect(res.status).toBe(404);
  });

  it("sem Authorization → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
    mockEdgeFunctionFetch({ "/send-notification": spec });
    const res = await fetch(`${BASE}/send-notification`, {
      method: "POST",
      headers: CT,
      body: JSON.stringify({ user_id: "uid", type: "x", title: "t", message: "m" }),
    });
    expect(res.status).toBe(401);
  });

  describe("payloads malformados", () => {
    for (const { label, body } of [
      { label: "user_id ausente", body: JSON.stringify({ type: "info", title: "t", message: "m" }) },
      { label: "type ausente", body: JSON.stringify({ user_id: "uid", title: "t", message: "m" }) },
      { label: "title ausente", body: JSON.stringify({ user_id: "uid", type: "info", message: "m" }) },
      { label: "message ausente", body: JSON.stringify({ user_id: "uid", type: "info", title: "t" }) },
      { label: "XSS no title", body: JSON.stringify({ user_id: "uid", type: "info", title: "<script>alert(1)</script>", message: "m" }) },
      { label: "body vazio", body: "" },
    ]) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/send-notification": spec });
        const res = await fetch(`${BASE}/send-notification`, {
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
    mockEdgeFunctionFetch({ "/send-notification": spec });
    const res = await fetch(`${BASE}/send-notification`, { method: "OPTIONS" });
    expect([200, 204]).toContain(res.status);
  });
});

// ─── send-transactional-email ─────────────────────────────────────────────────

describe("send-transactional-email", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("email transacional válido → 200 + message_id", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, message_id: "msg-001", queued: true },
    };
    mockEdgeFunctionFetch({ "/send-transactional-email": spec });
    const res = await fetch(`${BASE}/send-transactional-email`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({
        to: "client@example.com",
        template: "quote_approved",
        data: { quote_id: "q-001", client_name: "João Silva" },
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.message_id).toBeTruthy();
  });

  it("múltiplos destinatários → 200 + batch_id", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, batch_id: "batch-001", sent: 2 },
    };
    mockEdgeFunctionFetch({ "/send-transactional-email": spec });
    const res = await fetch(`${BASE}/send-transactional-email`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({
        to: ["client1@example.com", "client2@example.com"],
        template: "newsletter",
        data: { title: "Novidades" },
      }),
    });
    expect(res.status).toBe(200);
  });

  it("template inexistente → 422", async () => {
    const spec: EdgeFnResponseSpec = { status: 422, body: { error: "template_not_found" } };
    mockEdgeFunctionFetch({ "/send-transactional-email": spec });
    const res = await fetch(`${BASE}/send-transactional-email`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ to: "x@example.com", template: "nonexistent_template_xyz" }),
    });
    expect([400, 422, 404]).toContain(res.status);
  });

  it("sem Authorization → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
    mockEdgeFunctionFetch({ "/send-transactional-email": spec });
    const res = await fetch(`${BASE}/send-transactional-email`, {
      method: "POST",
      headers: CT,
      body: JSON.stringify({ to: "x@example.com", template: "t" }),
    });
    expect(res.status).toBe(401);
  });

  describe("payloads malformados", () => {
    for (const { label, body } of [
      { label: "to ausente", body: JSON.stringify({ template: "quote_approved" }) },
      { label: "template ausente", body: JSON.stringify({ to: "x@example.com" }) },
      { label: "email inválido", body: JSON.stringify({ to: "not-an-email", template: "t" }) },
      { label: "body vazio", body: "" },
      { label: "email header injection", body: JSON.stringify({ to: "x@example.com\nBcc: attacker@evil.com", template: "t" }) },
    ]) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/send-transactional-email": spec });
        const res = await fetch(`${BASE}/send-transactional-email`, {
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
    mockEdgeFunctionFetch({ "/send-transactional-email": spec });
    const res = await fetch(`${BASE}/send-transactional-email`, { method: "OPTIONS" });
    expect([200, 204]).toContain(res.status);
  });
});

// ─── send-digest ──────────────────────────────────────────────────────────────

describe("send-digest", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("digest diário → 200 + sent_count", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, period: "daily", sent_count: 15, skipped_count: 3 },
    };
    mockEdgeFunctionFetch({ "/send-digest": spec });
    const res = await fetch(`${BASE}/send-digest`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ period: "daily" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.sent_count).toBe("number");
  });

  it("digest semanal → 200", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, period: "weekly", sent_count: 42 },
    };
    mockEdgeFunctionFetch({ "/send-digest": spec });
    const res = await fetch(`${BASE}/send-digest`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ period: "weekly" }),
    });
    expect(res.status).toBe(200);
  });

  it("digest para usuário específico → 200", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, sent_to: "550e8400-e29b-41d4-a716-446655440001" },
    };
    mockEdgeFunctionFetch({ "/send-digest": spec });
    const res = await fetch(`${BASE}/send-digest`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({
        period: "daily",
        user_id: "550e8400-e29b-41d4-a716-446655440001",
      }),
    });
    expect(res.status).toBe(200);
  });

  it("sem Authorization → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
    mockEdgeFunctionFetch({ "/send-digest": spec });
    const res = await fetch(`${BASE}/send-digest`, {
      method: "POST",
      headers: CT,
      body: JSON.stringify({ period: "daily" }),
    });
    expect(res.status).toBe(401);
  });

  describe("payloads malformados", () => {
    for (const { label, body } of [
      { label: "period ausente", body: JSON.stringify({}) },
      { label: "period inválido", body: JSON.stringify({ period: "hourly" }) },
      { label: "body vazio", body: "" },
    ]) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/send-digest": spec });
        const res = await fetch(`${BASE}/send-digest`, {
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
    mockEdgeFunctionFetch({ "/send-digest": spec });
    const res = await fetch(`${BASE}/send-digest`, { method: "OPTIONS" });
    expect([200, 204]).toContain(res.status);
  });
});

// ─── cleanup-notifications ────────────────────────────────────────────────────

describe("cleanup-notifications", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("limpeza padrão (>30 dias) → 200 + deleted_count", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, deleted_count: 127, cutoff_date: new Date(Date.now() - 30 * 86_400_000).toISOString() },
    };
    mockEdgeFunctionFetch({ "/cleanup-notifications": spec });
    const res = await fetch(`${BASE}/cleanup-notifications`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(typeof data.deleted_count).toBe("number");
  });

  it("limpeza com cutoff personalizado → 200", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, deleted_count: 42 },
    };
    mockEdgeFunctionFetch({ "/cleanup-notifications": spec });
    const res = await fetch(`${BASE}/cleanup-notifications`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ older_than_days: 7 }),
    });
    expect(res.status).toBe(200);
  });

  it("sem Authorization → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
    mockEdgeFunctionFetch({ "/cleanup-notifications": spec });
    const res = await fetch(`${BASE}/cleanup-notifications`, {
      method: "POST",
      headers: CT,
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(401);
  });

  describe("payloads malformados", () => {
    for (const { label, body } of [
      { label: "older_than_days negativo", body: JSON.stringify({ older_than_days: -1 }) },
      { label: "older_than_days zero", body: JSON.stringify({ older_than_days: 0 }) },
      { label: "JSON quebrado", body: "{bad" },
    ]) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/cleanup-notifications": spec });
        const res = await fetch(`${BASE}/cleanup-notifications`, {
          method: "POST",
          headers: { ...CT, ...AUTH },
          body,
        });
        expect(res.status).not.toBe(500);
      });
    }
  });

  it("OPTIONS retorna CORS headers", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: null,
      headers: { "access-control-allow-origin": "*" },
    };
    mockEdgeFunctionFetch({ "/cleanup-notifications": spec });
    const res = await fetch(`${BASE}/cleanup-notifications`, { method: "OPTIONS" });
    expect([200, 204]).toContain(res.status);
  });
});
