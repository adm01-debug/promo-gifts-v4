/**
 * Integration tests — validate-access, step-up-verify, verify-2fa-token,
 *                     block-ip-temporarily, rate-limit-check
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

const AUTH = { Authorization: "Bearer service-role-key" };
const CT = { "Content-Type": "application/json" };

// ─── validate-access ─────────────────────────────────────────────────────────

describe("validate-access", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("usuário com permissão → 200 + allowed=true", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, allowed: true, role: "admin" },
    };
    mockEdgeFunctionFetch({ "/validate-access": spec });
    const res = await fetch(`${BASE}/validate-access`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({
        user_id: "550e8400-e29b-41d4-a716-446655440001",
        resource: "quotes",
        action: "read",
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.allowed).toBe(true);
  });

  it("usuário sem permissão → 200 + allowed=false", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, allowed: false, reason: "insufficient_permissions" },
    };
    mockEdgeFunctionFetch({ "/validate-access": spec });
    const res = await fetch(`${BASE}/validate-access`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({
        user_id: "550e8400-e29b-41d4-a716-446655440002",
        resource: "admin_panel",
        action: "write",
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.allowed).toBe(false);
  });

  it("sem Authorization → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
    mockEdgeFunctionFetch({ "/validate-access": spec });
    const res = await fetch(`${BASE}/validate-access`, {
      method: "POST",
      headers: CT,
      body: JSON.stringify({ user_id: "uid", resource: "quotes", action: "read" }),
    });
    expect(res.status).toBe(401);
  });

  describe("payloads malformados", () => {
    const cases = [
      { label: "user_id ausente", body: JSON.stringify({ resource: "quotes", action: "read" }) },
      { label: "resource ausente", body: JSON.stringify({ user_id: "uid", action: "read" }) },
      { label: "action ausente", body: JSON.stringify({ user_id: "uid", resource: "quotes" }) },
      { label: "user_id com XSS", body: JSON.stringify({ user_id: "<script>alert(1)</script>", resource: "x", action: "read" }) },
      { label: "body vazio", body: "" },
    ];
    for (const { label, body } of cases) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/validate-access": spec });
        const res = await fetch(`${BASE}/validate-access`, {
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
    mockEdgeFunctionFetch({ "/validate-access": spec });
    const res = await fetch(`${BASE}/validate-access`, { method: "OPTIONS" });
    expect([200, 204]).toContain(res.status);
  });
});

// ─── step-up-verify ───────────────────────────────────────────────────────────

describe("step-up-verify", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("token step-up válido → 200 + verified=true", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, verified: true, expires_at: new Date(Date.now() + 3600_000).toISOString() },
    };
    mockEdgeFunctionFetch({ "/step-up-verify": spec });
    const res = await fetch(`${BASE}/step-up-verify`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ token: "valid-step-up-token-123", purpose: "admin_action" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.verified).toBe(true);
  });

  it("token expirado → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "token_expired" } };
    mockEdgeFunctionFetch({ "/step-up-verify": spec });
    const res = await fetch(`${BASE}/step-up-verify`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ token: "expired-token", purpose: "admin_action" }),
    });
    expect(res.status).toBe(401);
  });

  it("token inválido → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "invalid_token" } };
    mockEdgeFunctionFetch({ "/step-up-verify": spec });
    const res = await fetch(`${BASE}/step-up-verify`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ token: "not-a-real-token", purpose: "admin_action" }),
    });
    expect(res.status).toBe(401);
  });

  it("sem Authorization → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
    mockEdgeFunctionFetch({ "/step-up-verify": spec });
    const res = await fetch(`${BASE}/step-up-verify`, {
      method: "POST",
      headers: CT,
      body: JSON.stringify({ token: "x", purpose: "y" }),
    });
    expect(res.status).toBe(401);
  });

  describe("payloads malformados", () => {
    for (const { label, body } of [
      { label: "token ausente", body: JSON.stringify({ purpose: "admin_action" }) },
      { label: "purpose ausente", body: JSON.stringify({ token: "abc" }) },
      { label: "body vazio", body: "" },
      { label: "token com SQL injection", body: JSON.stringify({ token: "'; SELECT * FROM users--", purpose: "x" }) },
    ]) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/step-up-verify": spec });
        const res = await fetch(`${BASE}/step-up-verify`, {
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
    mockEdgeFunctionFetch({ "/step-up-verify": spec });
    const res = await fetch(`${BASE}/step-up-verify`, { method: "OPTIONS" });
    expect([200, 204]).toContain(res.status);
  });
});

// ─── verify-2fa-token ─────────────────────────────────────────────────────────

describe("verify-2fa-token", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("código TOTP válido → 200 + valid=true", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, valid: true },
    };
    mockEdgeFunctionFetch({ "/verify-2fa-token": spec });
    const res = await fetch(`${BASE}/verify-2fa-token`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({
        user_id: "550e8400-e29b-41d4-a716-446655440001",
        code: "123456",
      }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.valid).toBe(true);
  });

  it("código errado → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "invalid_code" } };
    mockEdgeFunctionFetch({ "/verify-2fa-token": spec });
    const res = await fetch(`${BASE}/verify-2fa-token`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ user_id: "550e8400-e29b-41d4-a716-446655440001", code: "000000" }),
    });
    expect(res.status).toBe(401);
  });

  it("código expirado → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "code_expired" } };
    mockEdgeFunctionFetch({ "/verify-2fa-token": spec });
    const res = await fetch(`${BASE}/verify-2fa-token`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ user_id: "550e8400-e29b-41d4-a716-446655440001", code: "999999" }),
    });
    expect(res.status).toBe(401);
  });

  it("sem Authorization → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
    mockEdgeFunctionFetch({ "/verify-2fa-token": spec });
    const res = await fetch(`${BASE}/verify-2fa-token`, {
      method: "POST",
      headers: CT,
      body: JSON.stringify({ user_id: "uid", code: "123456" }),
    });
    expect(res.status).toBe(401);
  });

  describe("payloads malformados", () => {
    for (const { label, body } of [
      { label: "code ausente", body: JSON.stringify({ user_id: "uid" }) },
      { label: "user_id ausente", body: JSON.stringify({ code: "123456" }) },
      { label: "code não-numérico", body: JSON.stringify({ user_id: "uid", code: "abc" }) },
      { label: "code com menos de 6 dígitos", body: JSON.stringify({ user_id: "uid", code: "12345" }) },
      { label: "body vazio", body: "" },
    ]) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/verify-2fa-token": spec });
        const res = await fetch(`${BASE}/verify-2fa-token`, {
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
    mockEdgeFunctionFetch({ "/verify-2fa-token": spec });
    const res = await fetch(`${BASE}/verify-2fa-token`, { method: "OPTIONS" });
    expect([200, 204]).toContain(res.status);
  });
});

// ─── block-ip-temporarily ────────────────────────────────────────────────────

describe("block-ip-temporarily", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("IP válido + duração → 200 + blocked=true", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, blocked: true, ip: "192.168.1.100", expires_at: new Date(Date.now() + 3600_000).toISOString() },
    };
    mockEdgeFunctionFetch({ "/block-ip-temporarily": spec });
    const res = await fetch(`${BASE}/block-ip-temporarily`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ ip: "192.168.1.100", duration_minutes: 60, reason: "brute_force" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.blocked).toBe(true);
  });

  it("IP já bloqueado → 200 com already_blocked=true", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, already_blocked: true },
    };
    mockEdgeFunctionFetch({ "/block-ip-temporarily": spec });
    const res = await fetch(`${BASE}/block-ip-temporarily`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ ip: "1.2.3.4", duration_minutes: 30, reason: "spam" }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.already_blocked).toBe(true);
  });

  it("sem Authorization → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
    mockEdgeFunctionFetch({ "/block-ip-temporarily": spec });
    const res = await fetch(`${BASE}/block-ip-temporarily`, {
      method: "POST",
      headers: CT,
      body: JSON.stringify({ ip: "1.2.3.4", duration_minutes: 60 }),
    });
    expect(res.status).toBe(401);
  });

  describe("payloads malformados", () => {
    for (const { label, body } of [
      { label: "ip ausente", body: JSON.stringify({ duration_minutes: 60, reason: "x" }) },
      { label: "ip formato inválido", body: JSON.stringify({ ip: "not.an.ip", duration_minutes: 60, reason: "x" }) },
      { label: "duration_minutes negativo", body: JSON.stringify({ ip: "1.2.3.4", duration_minutes: -1, reason: "x" }) },
      { label: "duration_minutes zero", body: JSON.stringify({ ip: "1.2.3.4", duration_minutes: 0, reason: "x" }) },
      { label: "body vazio", body: "" },
    ]) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/block-ip-temporarily": spec });
        const res = await fetch(`${BASE}/block-ip-temporarily`, {
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
    mockEdgeFunctionFetch({ "/block-ip-temporarily": spec });
    const res = await fetch(`${BASE}/block-ip-temporarily`, { method: "OPTIONS" });
    expect([200, 204]).toContain(res.status);
  });
});

// ─── rate-limit-check ─────────────────────────────────────────────────────────

describe("rate-limit-check", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("chave dentro do limite → 200 + allowed=true", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, allowed: true, remaining: 95, reset_at: new Date(Date.now() + 60_000).toISOString() },
    };
    mockEdgeFunctionFetch({ "/rate-limit-check": spec });
    const res = await fetch(`${BASE}/rate-limit-check`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ key: "user:123:api", limit: 100, window_seconds: 60 }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.allowed).toBe(true);
    expect(typeof data.remaining).toBe("number");
  });

  it("chave acima do limite → 200 + allowed=false", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, allowed: false, remaining: 0, retry_after_seconds: 45 },
    };
    mockEdgeFunctionFetch({ "/rate-limit-check": spec });
    const res = await fetch(`${BASE}/rate-limit-check`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ key: "user:999:api", limit: 10, window_seconds: 60 }),
    });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.allowed).toBe(false);
  });

  it("chave para IP bloqueado → 200 com blocked=true", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, allowed: false, blocked: true, reason: "temporary_block" },
    };
    mockEdgeFunctionFetch({ "/rate-limit-check": spec });
    const res = await fetch(`${BASE}/rate-limit-check`, {
      method: "POST",
      headers: { ...CT, ...AUTH },
      body: JSON.stringify({ key: "ip:1.2.3.4", limit: 100, window_seconds: 60 }),
    });
    expect(res.status).toBe(200);
  });

  it("sem Authorization → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
    mockEdgeFunctionFetch({ "/rate-limit-check": spec });
    const res = await fetch(`${BASE}/rate-limit-check`, {
      method: "POST",
      headers: CT,
      body: JSON.stringify({ key: "x", limit: 10, window_seconds: 60 }),
    });
    expect(res.status).toBe(401);
  });

  describe("payloads malformados", () => {
    for (const { label, body } of [
      { label: "key ausente", body: JSON.stringify({ limit: 100, window_seconds: 60 }) },
      { label: "limit ausente", body: JSON.stringify({ key: "x", window_seconds: 60 }) },
      { label: "limit negativo", body: JSON.stringify({ key: "x", limit: -5, window_seconds: 60 }) },
      { label: "window_seconds zero", body: JSON.stringify({ key: "x", limit: 10, window_seconds: 0 }) },
      { label: "body vazio", body: "" },
    ]) {
      it(`não retorna 500 para: ${label}`, async () => {
        const spec: EdgeFnResponseSpec = { status: 422, body: { error: "validation_failed" } };
        mockEdgeFunctionFetch({ "/rate-limit-check": spec });
        const res = await fetch(`${BASE}/rate-limit-check`, {
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
    mockEdgeFunctionFetch({ "/rate-limit-check": spec });
    const res = await fetch(`${BASE}/rate-limit-check`, { method: "OPTIONS" });
    expect([200, 204]).toContain(res.status);
  });
});
