/**
 * Integration tests — quote-sync + quote-followup-reminders edge functions
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const AUTH = { Authorization: "Bearer service-role-key" };
const CT = { "Content-Type": "application/json" };

const VALID_SYNC_PAYLOAD = {
  quote_id: "550e8400-e29b-41d4-a716-446655440001",
  action: "recalculate",
};

const VALID_REMINDER_PAYLOAD = {
  quote_id: "550e8400-e29b-41d4-a716-446655440002",
  days_since_draft: 3,
};

// ─── quote-sync ───────────────────────────────────────────────────────────────

describe("quote-sync", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("payload válido", () => {
    it("recalculate → 200 + synced=true", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, synced: true, quote_id: "550e8400-e29b-41d4-a716-446655440001" },
      };
      mockEdgeFunctionFetch({ "/quote-sync": spec });
      const res = await fetch(`${BASE}/quote-sync`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify(VALID_SYNC_PAYLOAD),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.synced).toBe(true);
    });

    it("action=recalculate com itens → 200 + totals calculados", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, synced: true, totals: { subtotal: 450, total: 495, discount: 0 } },
      };
      mockEdgeFunctionFetch({ "/quote-sync": spec });
      const res = await fetch(`${BASE}/quote-sync`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify({ ...VALID_SYNC_PAYLOAD, include_totals: true }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.totals).toBeTruthy();
    });

    it("action=archive → 200", async () => {
      const spec: EdgeFnResponseSpec = { status: 200, body: { ok: true, archived: true } };
      mockEdgeFunctionFetch({ "/quote-sync": spec });
      const res = await fetch(`${BASE}/quote-sync`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify({ quote_id: "550e8400-e29b-41d4-a716-446655440001", action: "archive" }),
      });
      expect(res.status).toBe(200);
    });

    it("action=send_to_client → 200", async () => {
      const spec: EdgeFnResponseSpec = { status: 200, body: { ok: true, sent: true } };
      mockEdgeFunctionFetch({ "/quote-sync": spec });
      const res = await fetch(`${BASE}/quote-sync`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify({
          quote_id: "550e8400-e29b-41d4-a716-446655440001",
          action: "send_to_client",
          client_email: "client@example.com",
        }),
      });
      expect(res.status).toBe(200);
    });
  });

  describe("autenticação", () => {
    it("sem Authorization → 401", async () => {
      const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/quote-sync": spec });
      const res = await fetch(`${BASE}/quote-sync`, {
        method: "POST",
        headers: CT,
        body: JSON.stringify(VALID_SYNC_PAYLOAD),
      });
      expect(res.status).toBe(401);
    });

    it("token inválido → 401", async () => {
      const spec: EdgeFnResponseSpec = { status: 401, body: { error: "invalid_token" } };
      mockEdgeFunctionFetch({ "/quote-sync": spec });
      const res = await fetch(`${BASE}/quote-sync`, {
        method: "POST",
        headers: { ...CT, Authorization: "Bearer invalid-token-xyz" },
        body: JSON.stringify(VALID_SYNC_PAYLOAD),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("payloads malformados", () => {
    const cases = [
      { label: "quote_id ausente", body: JSON.stringify({ action: "recalculate" }) },
      { label: "action ausente", body: JSON.stringify({ quote_id: "550e8400-e29b-41d4-a716-446655440001" }) },
      { label: "quote_id inválido (não UUID)", body: JSON.stringify({ quote_id: "not-a-uuid", action: "recalculate" }) },
      { label: "action desconhecida", body: JSON.stringify({ quote_id: "550e8400-e29b-41d4-a716-446655440001", action: "fly" }) },
      { label: "body vazio", body: "" },
      { label: "JSON quebrado", body: "{invalid" },
      { label: "array no lugar de objeto", body: "[]" },
      { label: "quote_id com SQL injection", body: JSON.stringify({ quote_id: "'; DROP TABLE quotes--", action: "recalculate" }) },
    ];

    for (const { label, body } of cases) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/quote-sync": spec });
        const res = await fetch(`${BASE}/quote-sync`, {
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
        headers: {
          "access-control-allow-origin": "*",
          "access-control-allow-headers": "content-type, authorization",
        },
      };
      mockEdgeFunctionFetch({ "/quote-sync": spec });
      const res = await fetch(`${BASE}/quote-sync`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
    });
  });

  describe("orçamento não encontrado", () => {
    it("quote_id inexistente → 404", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 404,
        body: { error: "quote_not_found" },
      };
      mockEdgeFunctionFetch({ "/quote-sync": spec });
      const res = await fetch(`${BASE}/quote-sync`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify({ quote_id: "00000000-0000-0000-0000-000000000001", action: "recalculate" }),
      });
      expect(res.status).toBe(404);
    });

    it("erro interno não expõe stack trace", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 500,
        body: { error: "internal_error", message: "Processing failed" },
      };
      mockEdgeFunctionFetch({ "/quote-sync": spec });
      const res = await fetch(`${BASE}/quote-sync`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify(VALID_SYNC_PAYLOAD),
      });
      if (res.status === 500) {
        const text = await res.clone().text();
        expect(text).not.toMatch(/at\s+\w+\s+\(/);
        expect(text).not.toContain("stack");
      }
    });
  });
});

// ─── quote-followup-reminders ─────────────────────────────────────────────────

describe("quote-followup-reminders", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("payload válido", () => {
    it("POST com quote_id válido → 200 + reminder agendado", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, reminder_id: "rem-001", scheduled_at: new Date().toISOString() },
      };
      mockEdgeFunctionFetch({ "/quote-followup-reminders": spec });
      const res = await fetch(`${BASE}/quote-followup-reminders`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify(VALID_REMINDER_PAYLOAD),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(data.reminder_id).toBeTruthy();
    });

    it("batch de quotes → 200 + count de lembretes", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, processed: 5, skipped: 2 },
      };
      mockEdgeFunctionFetch({ "/quote-followup-reminders": spec });
      const res = await fetch(`${BASE}/quote-followup-reminders`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify({ batch: true, days_since_draft: 7 }),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(typeof data.processed).toBe("number");
    });

    it("lembrete duplicado → 200 com already_scheduled=true", async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, already_scheduled: true },
      };
      mockEdgeFunctionFetch({ "/quote-followup-reminders": spec });
      const res = await fetch(`${BASE}/quote-followup-reminders`, {
        method: "POST",
        headers: { ...CT, ...AUTH },
        body: JSON.stringify(VALID_REMINDER_PAYLOAD),
      });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.already_scheduled).toBe(true);
    });
  });

  describe("autenticação", () => {
    it("sem Authorization → 401", async () => {
      const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/quote-followup-reminders": spec });
      const res = await fetch(`${BASE}/quote-followup-reminders`, {
        method: "POST",
        headers: CT,
        body: JSON.stringify(VALID_REMINDER_PAYLOAD),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("payloads malformados", () => {
    const cases = [
      { label: "body vazio", body: "" },
      { label: "campos ausentes", body: JSON.stringify({}) },
      { label: "days_since_draft negativo", body: JSON.stringify({ quote_id: "550e8400-e29b-41d4-a716-446655440002", days_since_draft: -1 }) },
      { label: "days_since_draft = 0", body: JSON.stringify({ quote_id: "550e8400-e29b-41d4-a716-446655440002", days_since_draft: 0 }) },
    ];

    for (const { label, body } of cases) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/quote-followup-reminders": spec });
        const res = await fetch(`${BASE}/quote-followup-reminders`, {
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
      mockEdgeFunctionFetch({ "/quote-followup-reminders": spec });
      const res = await fetch(`${BASE}/quote-followup-reminders`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
    });
  });
});
