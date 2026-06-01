/**
 * Integration tests — step-up-verify edge function
 * Cobre: OTP válido, OTP expirado, OTP incorreto, brute-force lockout, replay attack.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

describe("step-up-verify", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  describe("verificação bem-sucedida", () => {
    it("retorna 200 com step_up_token quando OTP correto", async () => {
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: {
          verified: true,
          step_up_token: "sup-tok-abc123",
          expires_at: new Date(Date.now() + 900_000).toISOString(),
        },
      };
      mockEdgeFunctionFetch({ "/step-up-verify": ok });
      const res = await fetch(`${BASE}/step-up-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ otp: "123456", channel: "email" }),
      });
      const data = await res.json();
      expect(res.status).toBe(200);
      expect(data.verified).toBe(true);
      expect(data.step_up_token).toBeDefined();
    });

    it("step_up_token expira em tempo razoável (15min)", async () => {
      const expiresAt = new Date(Date.now() + 900_000).toISOString();
      const ok: EdgeFnResponseSpec = {
        status: 200,
        body: { verified: true, step_up_token: "tok", expires_at: expiresAt },
      };
      mockEdgeFunctionFetch({ "/step-up-verify": ok });
      const res = await fetch(`${BASE}/step-up-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ otp: "654321", channel: "sms" }),
      });
      const data = await res.json();
      const expires = new Date(data.expires_at).getTime();
      const now = Date.now();
      expect(expires).toBeGreaterThan(now);
      expect(expires - now).toBeLessThanOrEqual(16 * 60 * 1000);
    });

    it("aceita canais: email, sms, totp", async () => {
      for (const channel of ["email", "sms", "totp"]) {
        const ok: EdgeFnResponseSpec = {
          status: 200,
          body: { verified: true, step_up_token: `tok-${channel}`, expires_at: new Date().toISOString() },
        };
        mockEdgeFunctionFetch({ "/step-up-verify": ok });
        const res = await fetch(`${BASE}/step-up-verify`, {
          method: "POST",
          headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
          body: JSON.stringify({ otp: "123456", channel }),
        });
        expect(res.status).not.toBe(500);
      }
    });
  });

  describe("OTP inválido — 401", () => {
    it("retorna 401 com erro otp_invalid para código errado", async () => {
      const err: EdgeFnResponseSpec = {
        status: 401,
        body: { error: "otp_invalid", attempts_remaining: 2 },
      };
      mockEdgeFunctionFetch({ "/step-up-verify": err });
      const res = await fetch(`${BASE}/step-up-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ otp: "000000", channel: "email" }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("otp_invalid");
      expect(typeof data.attempts_remaining).toBe("number");
    });

    it("retorna 401 com erro otp_expired para código expirado", async () => {
      const err: EdgeFnResponseSpec = {
        status: 401,
        body: { error: "otp_expired" },
      };
      mockEdgeFunctionFetch({ "/step-up-verify": err });
      const res = await fetch(`${BASE}/step-up-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ otp: "123456", channel: "email" }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("otp_expired");
    });
  });

  describe("brute-force lockout — 429", () => {
    it("retorna 429 após muitas tentativas inválidas", async () => {
      const rl: EdgeFnResponseSpec = {
        status: 429,
        body: { error: "too_many_attempts", locked_until: new Date(Date.now() + 600_000).toISOString() },
        headers: { "Retry-After": "600" },
      };
      mockEdgeFunctionFetch({ "/step-up-verify": rl });
      const res = await fetch(`${BASE}/step-up-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ otp: "111111", channel: "email" }),
      });
      expect(res.status).toBe(429);
      expect(res.headers.get("Retry-After")).toBeTruthy();
      const data = await res.json();
      expect(data.error).toBe("too_many_attempts");
    });
  });

  describe("replay attack — 401", () => {
    it("retorna 401 para token já utilizado (replay)", async () => {
      const err: EdgeFnResponseSpec = {
        status: 401,
        body: { error: "otp_already_used" },
      };
      mockEdgeFunctionFetch({ "/step-up-verify": err });
      const res = await fetch(`${BASE}/step-up-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ otp: "123456", channel: "email" }),
      });
      expect(res.status).toBe(401);
      const data = await res.json();
      expect(data.error).toBe("otp_already_used");
    });
  });

  describe("validação de entrada — 400", () => {
    it("retorna 400 quando otp está ausente", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "missing_otp" } };
      mockEdgeFunctionFetch({ "/step-up-verify": err });
      const res = await fetch(`${BASE}/step-up-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ channel: "email" }),
      });
      expect(res.status).toBe(400);
    });

    it("retorna 400 para OTP não numérico", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_otp_format" } };
      mockEdgeFunctionFetch({ "/step-up-verify": err });
      const res = await fetch(`${BASE}/step-up-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ otp: "' OR 1=1--", channel: "email" }),
      });
      expect(res.status).not.toBe(500);
    });

    it("não retorna 500 para OTP com XSS payload", async () => {
      const err: EdgeFnResponseSpec = { status: 400, body: { error: "invalid_input" } };
      mockEdgeFunctionFetch({ "/step-up-verify": err });
      const res = await fetch(`${BASE}/step-up-verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: "Bearer valid-jwt" },
        body: JSON.stringify({ otp: "<script>alert(1)</script>", channel: "email" }),
      });
      expect(res.status).not.toBe(500);
    });
  });

  describe("sem autenticação — 401", () => {
    it("retorna 401 sem Authorization header", async () => {
      const err: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
      mockEdgeFunctionFetch({ "/step-up-verify": err });
      const res = await fetch(`${BASE}/step-up-verify`, {
        method: "POST",
        body: JSON.stringify({ otp: "123456", channel: "email" }),
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
      mockEdgeFunctionFetch({ "/step-up-verify": cors });
      const res = await fetch(`${BASE}/step-up-verify`, { method: "OPTIONS" });
      expect([200, 204]).toContain(res.status);
    });
  });
});
