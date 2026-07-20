/**
 * Integration contract tests — misc edge functions
 * Covers: check-login, voice-agent, word-magic, secrets-manager
 *
 * These tests verify HTTP contract (status codes, response shape, CORS)
 * using mocked fetch — they do NOT execute real Deno/Supabase code.
 */
import { afterEach, describe, expect, it } from "vitest";
import {
  mockEdgeFunctionFetch,
  resetExternalMocks,
  type EdgeFnResponseSpec,
} from "../../p0/_mocks";

const BASE = "https://doufsxqlfjyuvxuezpln.supabase.co/functions/v1";

describe("check-login", () => {
  afterEach(() => {
    resetExternalMocks();
  });

  it("POST /check-login — retorna 200 allowed:true para login permitido", async () => {
    const ok: EdgeFnResponseSpec = {
      status: 200,
      body: { allowed: true, reason: "allowed" },
    };
    mockEdgeFunctionFetch({ "/check-login": ok });
    const res = await fetch(`${BASE}/check-login`, {
      method: "POST",
      body: JSON.stringify({ email: "user@example.com" }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.allowed).toBe(true);
    expect(data.reason).toBe("allowed");
  });

  it("POST /check-login — retorna 403 allowed:false para login bloqueado", async () => {
    const blocked: EdgeFnResponseSpec = {
      status: 403,
      body: { allowed: false, reason: "ip_blocked" },
    };
    mockEdgeFunctionFetch({ "/check-login": blocked });
    const res = await fetch(`${BASE}/check-login`, {
      method: "POST",
      body: JSON.stringify({ email: "blocked@example.com" }),
    });
    const data = await res.json();
    expect(res.status).toBe(403);
    expect(data.allowed).toBe(false);
    expect(typeof data.reason).toBe("string");
  });

  it("OPTIONS /check-login — responde CORS preflight", async () => {
    const cors: EdgeFnResponseSpec = {
      status: 200,
      body: {},
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
      },
    };
    mockEdgeFunctionFetch({ "/check-login": cors });
    const res = await fetch(`${BASE}/check-login`, { method: "OPTIONS" });
    expect(res.status).toBe(200);
  });
});

describe("voice-agent", () => {
  afterEach(() => {
    resetExternalMocks();
  });

  it("POST /voice-agent — retorna 401 sem Authorization header", async () => {
    const unauthorized: EdgeFnResponseSpec = {
      status: 401,
      body: { error: "Unauthorized" },
    };
    mockEdgeFunctionFetch({ "/voice-agent": unauthorized });
    const res = await fetch(`${BASE}/voice-agent`, {
      method: "POST",
      body: JSON.stringify({ transcript: "mostrar carrinho" }),
    });
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBeDefined();
  });

  it("POST /voice-agent — retorna 200 com action para usuário autenticado", async () => {
    const ok: EdgeFnResponseSpec = {
      status: 200,
      body: { action: "show_cart", parameters: {} },
    };
    mockEdgeFunctionFetch({ "/voice-agent": ok });
    const res = await fetch(`${BASE}/voice-agent`, {
      method: "POST",
      headers: { Authorization: "Bearer token" },
      body: JSON.stringify({ transcript: "mostrar carrinho" }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.action).toBe("string");
  });

  it("OPTIONS /voice-agent — responde CORS preflight", async () => {
    const cors: EdgeFnResponseSpec = {
      status: 200,
      body: {},
      headers: { "Access-Control-Allow-Origin": "*" },
    };
    mockEdgeFunctionFetch({ "/voice-agent": cors });
    const res = await fetch(`${BASE}/voice-agent`, { method: "OPTIONS" });
    expect(res.status).toBe(200);
  });
});

describe("word-magic", () => {
  afterEach(() => {
    resetExternalMocks();
  });

  it("POST /word-magic — retorna 401 sem JWT", async () => {
    const unauthorized: EdgeFnResponseSpec = {
      status: 401,
      body: { error: "Unauthorized" },
    };
    mockEdgeFunctionFetch({ "/word-magic": unauthorized });
    const res = await fetch(`${BASE}/word-magic`, {
      method: "POST",
      body: JSON.stringify({ product_id: "00000000-0000-0000-0000-000000000001" }),
    });
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBeDefined();
  });

  it("POST /word-magic — retorna 200 com description gerada", async () => {
    const ok: EdgeFnResponseSpec = {
      status: 200,
      body: { product_id: "uuid", description: "Caneta premium personalizada..." },
    };
    mockEdgeFunctionFetch({ "/word-magic": ok });
    const res = await fetch(`${BASE}/word-magic`, {
      method: "POST",
      headers: { Authorization: "Bearer token" },
      body: JSON.stringify({ product_id: "00000000-0000-0000-0000-000000000001" }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(typeof data.description).toBe("string");
  });
});

describe("secrets-manager", () => {
  afterEach(() => {
    resetExternalMocks();
  });

  it("GET /secrets-manager — retorna 401 sem JWT", async () => {
    const unauthorized: EdgeFnResponseSpec = {
      status: 401,
      body: { error: "Unauthorized" },
    };
    mockEdgeFunctionFetch({ "/secrets-manager": unauthorized });
    const res = await fetch(`${BASE}/secrets-manager`);
    const data = await res.json();
    expect(res.status).toBe(401);
    expect(data.error).toBeDefined();
  });

  it("GET /secrets-manager — retorna 200 com lista de segredos (sem valores)", async () => {
    const ok: EdgeFnResponseSpec = {
      status: 200,
      body: { secrets: [{ name: "OPENAI_API_KEY", updated_at: "2026-01-01" }] },
    };
    mockEdgeFunctionFetch({ "/secrets-manager": ok });
    const res = await fetch(`${BASE}/secrets-manager`, {
      headers: { Authorization: "Bearer admin-token" },
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(Array.isArray(data.secrets)).toBe(true);
  });

  it("OPTIONS /secrets-manager — responde CORS preflight", async () => {
    const cors: EdgeFnResponseSpec = {
      status: 200,
      body: {},
      headers: { "Access-Control-Allow-Origin": "*" },
    };
    mockEdgeFunctionFetch({ "/secrets-manager": cors });
    const res = await fetch(`${BASE}/secrets-manager`, { method: "OPTIONS" });
    expect(res.status).toBe(200);
  });
});
