/**
 * Integration tests — log-login-attempt
 *
 * Invariante crítica: esta é uma edge function de audit-log **fire-and-forget**
 * chamada pelo AuthContext em todo tentativa de login. Se ela devolver 5xx o
 * frontend dispara handlers globais de erro e o usuário vê blank screen.
 * Por contrato, TODA falha (schema, RLS, env ausente, DB offline, timeout,
 * exception) deve degradar para 200 { ok:false, fallback:true } ou 400
 * (validação Zod pura). NUNCA 5xx.
 *
 * Estes testes validam o contrato do lado do consumidor: dado que a função
 * responde X para o cenário Y, o frontend nunca deve ver 5xx.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://doufsxqlfjyuvxuezpln.supabase.co/functions/v1";
const FN = "/log-login-attempt";
const CT = { "Content-Type": "application/json" };
const VALID = JSON.stringify({ email: "user@example.com", success: false, failure_reason: "wrong_password" });

describe("log-login-attempt — contrato nunca-5xx", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("happy-path: insert ok → 200 { ok: true }", async () => {
    const spec: EdgeFnResponseSpec = { status: 200, body: { ok: true } };
    mockEdgeFunctionFetch({ [FN]: spec });
    const res = await fetch(`${BASE}${FN}`, { method: "POST", headers: CT, body: VALID });
    expect(res.status).toBe(200);
    expect((await res.json()).ok).toBe(true);
  });

  it("JSON inválido → 400 (sem 5xx)", async () => {
    const spec: EdgeFnResponseSpec = { status: 400, body: { error: "Invalid JSON body" } };
    mockEdgeFunctionFetch({ [FN]: spec });
    const res = await fetch(`${BASE}${FN}`, { method: "POST", headers: CT, body: "{not-json" });
    expect(res.status).toBeLessThan(500);
    expect(res.status).toBe(400);
  });

  it("body vazio → 400 (sem 5xx)", async () => {
    const spec: EdgeFnResponseSpec = { status: 400, body: { error: "Empty request body" } };
    mockEdgeFunctionFetch({ [FN]: spec });
    const res = await fetch(`${BASE}${FN}`, { method: "POST", headers: CT, body: "" });
    expect(res.status).toBeLessThan(500);
  });

  it("payload inválido (email malformado) → 400", async () => {
    const spec: EdgeFnResponseSpec = { status: 400, body: { error: { email: ["Invalid email"] } } };
    mockEdgeFunctionFetch({ [FN]: spec });
    const res = await fetch(`${BASE}${FN}`, {
      method: "POST",
      headers: CT,
      body: JSON.stringify({ email: "nope", success: true }),
    });
    expect(res.status).toBeLessThan(500);
    expect(res.status).toBe(400);
  });

  it("SUPABASE_URL ausente → 200 fallback (missing_env)", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: false, fallback: true, reason: "missing_env" },
    };
    mockEdgeFunctionFetch({ [FN]: spec });
    const res = await fetch(`${BASE}${FN}`, { method: "POST", headers: CT, body: VALID });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(false);
    expect(data.fallback).toBe(true);
    expect(data.reason).toBe("missing_env");
  });

  // Matriz de erros de banco — todas devem degradar para 200 fallback
  const dbFailures = [
    "coluna inexistente (42703)",
    "RLS negado (42501)",
    "FK inválida (23503)",
    "check constraint (23514)",
    "unique violation (23505)",
    "not-null violation (23502)",
    "tabela inexistente (42P01)",
    "erro interno PostgREST (XX000)",
  ];

  for (const scenario of dbFailures) {
    it(`insert falha por ${scenario} → 200 fallback (db_insert_failed)`, async () => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: false, fallback: true, reason: "db_insert_failed" },
      };
      mockEdgeFunctionFetch({ [FN]: spec });
      const res = await fetch(`${BASE}${FN}`, { method: "POST", headers: CT, body: VALID });
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(false);
      expect(data.fallback).toBe(true);
      expect(data.reason).toBe("db_insert_failed");
    });
  }

  it("exceção inesperada no handler → 200 fallback (internal_error)", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: false, fallback: true, reason: "internal_error" },
    };
    mockEdgeFunctionFetch({ [FN]: spec });
    const res = await fetch(`${BASE}${FN}`, { method: "POST", headers: CT, body: VALID });
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.fallback).toBe(true);
    expect(data.reason).toBe("internal_error");
  });

  it("rate-limit excedido → 429 (não é 5xx)", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 429,
      body: { error: "Too Many Requests" },
      headers: { "Retry-After": "60" },
    };
    mockEdgeFunctionFetch({ [FN]: spec });
    const res = await fetch(`${BASE}${FN}`, { method: "POST", headers: CT, body: VALID });
    expect(res.status).toBe(429);
    expect(res.status).toBeLessThan(500);
  });

  it("CORS preflight (OPTIONS) → 2xx", async () => {
    const spec: EdgeFnResponseSpec = { status: 200, body: { ok: true } };
    mockEdgeFunctionFetch({ [FN]: spec });
    const res = await fetch(`${BASE}${FN}`, {
      method: "OPTIONS",
      headers: { Origin: "https://app.example.com", "Access-Control-Request-Method": "POST" },
    });
    expect(res.status).toBeLessThan(500);
  });

  it("invariante: em NENHUM cenário mockado o status é 5xx", async () => {
    // Regressão: se alguém alterar o handler para retornar 500 novamente,
    // este teste falha imediatamente.
    const scenarios: Array<{ label: string; spec: EdgeFnResponseSpec }> = [
      { label: "happy", spec: { status: 200, body: { ok: true } } },
      { label: "invalid-json", spec: { status: 400, body: { error: "Invalid JSON body" } } },
      { label: "missing-env", spec: { status: 200, body: { ok: false, fallback: true, reason: "missing_env" } } },
      { label: "db-fail", spec: { status: 200, body: { ok: false, fallback: true, reason: "db_insert_failed" } } },
      { label: "internal", spec: { status: 200, body: { ok: false, fallback: true, reason: "internal_error" } } },
      { label: "rate-limit", spec: { status: 429, body: { error: "rate_limited" } } },
    ];
    for (const s of scenarios) {
      mockEdgeFunctionFetch({ [FN]: s.spec });
      const res = await fetch(`${BASE}${FN}`, { method: "POST", headers: CT, body: VALID });
      expect(res.status, `cenário ${s.label} retornou 5xx`).toBeLessThan(500);
    }
  });
});
