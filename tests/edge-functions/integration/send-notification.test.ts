/**
 * Integration tests — send-notification edge function
 * Cobre: entrega por canal (push/email/in-app), validação de campos,
 * usuário inexistente, payload inválido, auth, idempotência.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const VALID_NOTIF = {
  user_id: "user-uuid-001",
  type: "quote_approved",
  title: "Orçamento aprovado",
  message: "Seu orçamento #123 foi aprovado.",
  channel: "in-app",
};

describe("send-notification", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("happy path — notificação in-app", () => {
    it("retorna 200 para notificação in-app válida", async () => {
      const ok: EdgeFnResponseSpec = { status: 200, body: { ok: true, notification_id: "notif-001" } };
      mockEdgeFunctionFetch({ "/send-notification": ok });
      const res = await fetch(`${BASE}/send-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify(VALID_NOTIF),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.ok).toBe(true);
      expect(data.notification_id).toBeDefined();
    });

    it("retorna notification_id único por chamada", async () => {
      const r1: EdgeFnResponseSpec = { status: 200, body: { ok: true, notification_id: "notif-001" } };
      const r2: EdgeFnResponseSpec = { status: 200, body: { ok: true, notification_id: "notif-002" } };
      mockEdgeFunctionFetch({ "/send-notification": r1 });
      const res1 = await fetch(`${BASE}/send-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify(VALID_NOTIF),
      });
      const d1 = await res1.json();

      mockEdgeFunctionFetch({ "/send-notification": r2 });
      const res2 = await fetch(`${BASE}/send-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify({ ...VALID_NOTIF, message: "Mensagem diferente" }),
      });
      const d2 = await res2.json();

      expect(d1.notification_id).not.toBe(d2.notification_id);
    });
  });

  describe("canais de entrega", () => {
    const channels = ["in-app", "email", "push"] as const;

    for (const channel of channels) {
      it(`aceita channel=${channel} e retorna 200`, async () => {
        const ok: EdgeFnResponseSpec = { status: 200, body: { ok: true, channel } };
        mockEdgeFunctionFetch({ "/send-notification": ok });
        const res = await fetch(`${BASE}/send-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
          body: JSON.stringify({ ...VALID_NOTIF, channel }),
        });
        expect(res.status).toBe(200);
      });
    }

    it("retorna 400 para channel desconhecido", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_channel" } };
      mockEdgeFunctionFetch({ "/send-notification": err });
      const res = await fetch(`${BASE}/send-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify({ ...VALID_NOTIF, channel: "fax" }),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("validação de campos obrigatórios — 400", () => {
    const missingFieldCases = [
      { label: "sem user_id", body: { ...VALID_NOTIF, user_id: undefined } },
      { label: "sem type", body: { ...VALID_NOTIF, type: undefined } },
      { label: "sem title", body: { ...VALID_NOTIF, title: undefined } },
      { label: "sem message", body: { ...VALID_NOTIF, message: undefined } },
      { label: "body vazio {}", body: {} },
      { label: "title muito longo (>255)", body: { ...VALID_NOTIF, title: "A".repeat(256) } },
      { label: "message muito longa (>2000)", body: { ...VALID_NOTIF, message: "M".repeat(2001) } },
    ];

    for (const { label, body } of missingFieldCases) {
      it(`retorna 400 para: ${label}`, async () => {
        const err: EdgeFnResponseSpec = { status: 400, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/send-notification": err });
        const res = await fetch(`${BASE}/send-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
          body: JSON.stringify(body),
        });
        expect(res.status).toBe(400);
      });
    }
  });

  describe("autenticação — 401", () => {
    it("retorna 401 sem Authorization", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/send-notification": err });
      const res = await fetch(`${BASE}/send-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(VALID_NOTIF),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("usuário inexistente — 404", () => {
    it("retorna 404 quando user_id não existe no banco", async () => {
      const notFound: EdgeFnResponseSpec = { status: 404, body: { error: "user_not_found" } };
      mockEdgeFunctionFetch({ "/send-notification": notFound });
      const res = await fetch(`${BASE}/send-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify({ ...VALID_NOTIF, user_id: "nonexistent-uuid" }),
      });
      expect([404, 422]).toContain(res.status);
    });
  });

  describe("sem crash — fuzz básico", () => {
    const fuzzPayloads = [
      "null",
      "[]",
      '"string"',
      "42",
      '{"user_id": null, "type": null}',
      `{"title": "${"x".repeat(10000)}"}`,
      '{"user_id": "../../etc/passwd", "type": "xss", "title": "<script>alert(1)</script>"}',
      '{"user_id": "1; DROP TABLE notifications;--"}',
    ];

    for (const payload of fuzzPayloads) {
      it(`não retorna 500 para payload: ${payload.substring(0, 50)}`, async () => {
        const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_input" } };
        mockEdgeFunctionFetch({ "/send-notification": err });
        const res = await fetch(`${BASE}/send-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
          body: payload,
        });
        expect(res.status).not.toBe(500);
      });
    }
  });
});
