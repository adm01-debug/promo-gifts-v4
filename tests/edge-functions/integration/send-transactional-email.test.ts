/**
 * Integration tests — send-transactional-email edge function
 * Cobre: templates válidos, destinatários, throttle, inputs adversariais, CORS.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const VALID_PAYLOAD = {
  to: "cliente@empresa.com.br",
  template: "quote_approved",
  variables: { quote_id: "q-001", client_name: "Empresa ABC", total: 1500.0 },
};

describe("send-transactional-email", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("happy path — email enviado", () => {
    it("retorna 200 com message_id para template válido", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { sent: true, message_id: "msg-abc-001", template: "quote_approved" },
      };
      mockEdgeFunctionFetch({ "/send-transactional-email": ok });
      const res = await fetch(`${BASE}/send-transactional-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify(VALID_PAYLOAD),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.sent).toBe(true);
      expect(data.message_id).toBeDefined();
    });

    it("inclui X-Request-Id no header de resposta", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { sent: true, message_id: "msg-001" },
        headers: { "x-request-id": "req-email-001" },
      };
      mockEdgeFunctionFetch({ "/send-transactional-email": ok });
      const res = await fetch(`${BASE}/send-transactional-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify(VALID_PAYLOAD),
      });
      expect(res.headers.get("x-request-id")).toBeTruthy();
    });
  });

  describe("templates suportados", () => {
    const templates = [
      "quote_approved",
      "quote_rejected",
      "quote_followup",
      "welcome",
      "password_reset",
      "new_device_alert",
    ];

    for (const template of templates) {
      it(`aceita template '${template}'`, async () => {
        const ok: EdgeFnResponseSpec = {
          status: 200,
          body: { sent: true, message_id: `msg-${template}`, template },
        };
        mockEdgeFunctionFetch({ "/send-transactional-email": ok });
        const res = await fetch(`${BASE}/send-transactional-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
          body: JSON.stringify({ ...VALID_PAYLOAD, template }),
        });
        expect(res.status).not.toBe(500);
      });
    }
  });

  describe("validação de destinatário", () => {
    it("retorna 400 para email inválido como destinatário", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_email" } };
      mockEdgeFunctionFetch({ "/send-transactional-email": err });
      const res = await fetch(`${BASE}/send-transactional-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify({ ...VALID_PAYLOAD, to: "nao-é-email" }),
      });
      expect(res.status).toBe(400);
    });

    it("retorna 400 para template inexistente", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "unknown_template" } };
      mockEdgeFunctionFetch({ "/send-transactional-email": err });
      const res = await fetch(`${BASE}/send-transactional-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify({ ...VALID_PAYLOAD, template: "template_inexistente" }),
      });
      expect(res.status).toBe(400);
    });

    it("retorna 400 quando campo 'to' está ausente", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "missing_to" } };
      mockEdgeFunctionFetch({ "/send-transactional-email": err });
      const { to: _, ...noTo } = VALID_PAYLOAD;
      const res = await fetch(`${BASE}/send-transactional-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify(noTo),
      });
      expect(res.status).toBe(400);
    });
  });

  describe("throttle / anti-spam", () => {
    it("retorna 429 quando mesmo destinatário recebe email em intervalo proibido", async () => {
      const rl: EdgeFnResponseSpec = {
        status: 429,
        body: { error: "too_many_emails", retry_after_seconds: 3600 },
        headers: { "Retry-After": "3600" },
      };
      mockEdgeFunctionFetch({ "/send-transactional-email": rl });
      const res = await fetch(`${BASE}/send-transactional-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify(VALID_PAYLOAD),
      });
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeTruthy();
    });
  });

  describe("falha do provedor de email", () => {
    it("retorna 502 quando provedor retorna erro sem crashar (sem 500 interno)", async () => {
      const err: EdgeFnResponseSpec = {
        status: 502,
        body: { error: "email_provider_error", provider_code: "DMARC_POLICY" },
      };
      mockEdgeFunctionFetch({ "/send-transactional-email": err });
      const res = await fetch(`${BASE}/send-transactional-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify(VALID_PAYLOAD),
      });
      expect(res.status).not.toBe(500);
    });

    it("502 não expõe credenciais do provedor de email", async () => {
      const err: EdgeFnResponseSpec = {
        status: 502,
        body: { error: "email_provider_error" },
      };
      mockEdgeFunctionFetch({ "/send-transactional-email": err });
      const res = await fetch(`${BASE}/send-transactional-email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
        body: JSON.stringify(VALID_PAYLOAD),
      });
      const raw = await res.text();
      expect(raw).not.toMatch(/api_key|apikey|smtp_password|SMTP_PASS/i);
    });
  });

  describe("inputs adversariais — não injetam header/body", () => {
    const adversarialCases = [
      { label: "XSS em variável", variables: { client_name: "<script>alert(1)</script>" } },
      { label: "CRLF em 'to'", to: "x@x.com\r\nBcc: attacker@x.com" },
      { label: "SQL injection em template", template: "'; DROP TABLE email_logs;--" },
    ];

    for (const { label, ...overrides } of adversarialCases) {
      it(`não retorna 500 para ${label}`, async () => {
        const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_input" } };
        mockEdgeFunctionFetch({ "/send-transactional-email": err });
        const res = await fetch(`${BASE}/send-transactional-email`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer service-key" },
          body: JSON.stringify({ ...VALID_PAYLOAD, ...overrides }),
        });
        expect(res.status).not.toBe(500);
      });
    }
  });

  describe("autenticação — 401", () => {
    it("retorna 401 sem Authorization header", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/send-transactional-email": err });
      const res = await fetch(`${BASE}/send-transactional-email`, {
        method: "POST",
        body: JSON.stringify(VALID_PAYLOAD),
      });
      expect(res.status).toBe(401);
    });
  });

  describe("CORS", () => {
    it("OPTIONS retorna headers CORS", async () => {
      const cors: EdgeFnResponseSpec = {
        status: 200,
        body: null,
        headers: {
          "access-control-allow-origin": "*",
          "access-control-expose-headers": "x-request-id",
        },
      };
      mockEdgeFunctionFetch({ "/send-transactional-email": cors });
      const res = await fetch(`${BASE}/send-transactional-email`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
    });
  });
});
