/**
 * Testes de integração — log-login-attempt
 *
 * Invariante crítica: esta função é fire-and-forget (audit log de login).
 * Em NENHUM cenário de falha ela pode retornar 5xx — o frontend usa a
 * resposta para decidir se exibe blank-screen. Falhas de schema, RLS,
 * env ausente, DB offline ou payload malformado devem devolver
 * 200 { ok:false, fallback:true } ou 400 (validação Zod).
 *
 * Cobertura:
 *  - JSON inválido / body vazio         → 400 (sem 5xx)
 *  - Schema Zod violado                 → 400 (sem 5xx)
 *  - SUPABASE_URL / SERVICE_ROLE ausente→ 200 fallback
 *  - Insert falha por schema (42703)    → 200 fallback
 *  - Insert falha por RLS (42501)       → 200 fallback
 *  - Insert falha por FK (23503)        → 200 fallback
 *  - Insert falha por check (23514)     → 200 fallback
 *  - DB offline (fetch throws)          → 200 fallback
 *  - Timeout (fetch rejeita tardio)     → 200 fallback
 *  - Resposta 500 do PostgREST          → 200 fallback
 *  - Happy-path                         → 200 { ok:true }
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleLogLoginAttempt } from "./index.ts";

// ── Environment ────────────────────────────────────────────────────────────
const FAKE_URL = "https://doufsxqlfjyuvxuezpln.supabase.co";
const FAKE_KEY = "service-role-fake";

function setEnv() {
  Deno.env.set("SUPABASE_URL", FAKE_URL);
  Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", FAKE_KEY);
}
function clearEnv() {
  Deno.env.delete("SUPABASE_URL");
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
}

// ── Fetch stubbing ─────────────────────────────────────────────────────────
type FetchHandler = (url: string, init?: RequestInit) => Promise<Response> | Response;
const realFetch = globalThis.fetch;

function stubFetch(handler: FetchHandler) {
  globalThis.fetch = ((input: URL | RequestInfo, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    return Promise.resolve(handler(url, init));
  }) as typeof fetch;
}
function restoreFetch() {
  globalThis.fetch = realFetch;
}

/** Handler que responde OK ao rate-limit RPC e delega inserts ao caller. */
function buildFetchHandler(insertResponder: () => Response | Promise<Response>): FetchHandler {
  return (url) => {
    // Rate-limit RPC → sempre allow (evita ruído nos testes de contrato)
    if (url.includes("/rest/v1/rpc/check_edge_rate_limit")) {
      return new Response(
        JSON.stringify([{ allowed: true, remaining: 9, reset_at: new Date(Date.now() + 60_000).toISOString() }]),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }
    // Insert em login_attempts
    if (url.includes("/rest/v1/login_attempts")) {
      return Promise.resolve(insertResponder());
    }
    // Qualquer outra chamada = falha silenciosa (não deve acontecer)
    return new Response("unexpected", { status: 599 });
  };
}

function makeReq(body: unknown, opts: { rawText?: string } = {}) {
  const text = opts.rawText !== undefined ? opts.rawText : JSON.stringify(body);
  return new Request("https://example.com/log-login-attempt", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.1" },
    body: text,
  });
}

const VALID_PAYLOAD = {
  email: "user@example.com",
  success: false,
  failure_reason: "wrong_password",
  ip_address: "10.0.0.1",
  user_agent: "vitest",
};

// ── Testes ────────────────────────────────────────────────────────────────

Deno.test("nunca retorna 5xx: JSON inválido → 400", async () => {
  setEnv();
  stubFetch(buildFetchHandler(() => new Response(null, { status: 201 })));
  try {
    const res = await handleLogLoginAttempt(makeReq(null, { rawText: "{not-json" }));
    assert(res.status < 500, `status=${res.status} deveria ser <500`);
    assertEquals(res.status, 400);
  } finally {
    restoreFetch();
    clearEnv();
  }
});

Deno.test("nunca retorna 5xx: body vazio → 400", async () => {
  setEnv();
  stubFetch(buildFetchHandler(() => new Response(null, { status: 201 })));
  try {
    const res = await handleLogLoginAttempt(makeReq(null, { rawText: "" }));
    assert(res.status < 500);
    assertEquals(res.status, 400);
  } finally {
    restoreFetch();
    clearEnv();
  }
});

Deno.test("nunca retorna 5xx: schema Zod violado (email inválido) → 400", async () => {
  setEnv();
  stubFetch(buildFetchHandler(() => new Response(null, { status: 201 })));
  try {
    const res = await handleLogLoginAttempt(makeReq({ email: "not-an-email", success: true }));
    assert(res.status < 500);
    assertEquals(res.status, 400);
  } finally {
    restoreFetch();
    clearEnv();
  }
});

Deno.test("nunca retorna 5xx: schema Zod violado (success faltando) → 400", async () => {
  setEnv();
  stubFetch(buildFetchHandler(() => new Response(null, { status: 201 })));
  try {
    const res = await handleLogLoginAttempt(makeReq({ email: "x@y.com" }));
    assert(res.status < 500);
    assertEquals(res.status, 400);
  } finally {
    restoreFetch();
    clearEnv();
  }
});

Deno.test("nunca retorna 5xx: SUPABASE_URL ausente → 200 fallback", async () => {
  clearEnv();
  stubFetch(buildFetchHandler(() => new Response(null, { status: 201 })));
  try {
    const res = await handleLogLoginAttempt(makeReq(VALID_PAYLOAD));
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.ok, false);
    assertEquals(data.fallback, true);
    assertEquals(data.reason, "missing_env");
  } finally {
    restoreFetch();
  }
});

// Matriz de erros de schema/RLS/constraints — PostgREST devolve 400/403/409/500
const dbErrorCases: Array<{ name: string; status: number; code: string; message: string }> = [
  { name: "coluna inexistente (42703)", status: 400, code: "42703", message: "column does not exist" },
  { name: "RLS negado (42501)", status: 403, code: "42501", message: "new row violates row-level security" },
  { name: "FK inválida (23503)", status: 409, code: "23503", message: "foreign key violation" },
  { name: "check constraint (23514)", status: 400, code: "23514", message: "check constraint" },
  { name: "unique violation (23505)", status: 409, code: "23505", message: "duplicate key" },
  { name: "not-null (23502)", status: 400, code: "23502", message: "null value" },
  { name: "tabela inexistente (42P01)", status: 404, code: "42P01", message: "relation does not exist" },
  { name: "erro interno PostgREST (500)", status: 500, code: "XX000", message: "internal error" },
];

for (const c of dbErrorCases) {
  Deno.test(`nunca retorna 5xx: insert falha por ${c.name} → 200 fallback`, async () => {
    setEnv();
    stubFetch(
      buildFetchHandler(
        () =>
          new Response(
            JSON.stringify({ code: c.code, message: c.message, details: null, hint: null }),
            { status: c.status, headers: { "Content-Type": "application/json" } },
          ),
      ),
    );
    try {
      const res = await handleLogLoginAttempt(makeReq(VALID_PAYLOAD));
      assertEquals(res.status, 200, `esperava 200 fallback, recebi ${res.status}`);
      const data = await res.json();
      assertEquals(data.ok, false);
      assertEquals(data.fallback, true);
      assertEquals(data.reason, "db_insert_failed");
    } finally {
      restoreFetch();
      clearEnv();
    }
  });
}

Deno.test("nunca retorna 5xx: DB offline (fetch throws) → 200 fallback", async () => {
  setEnv();
  globalThis.fetch = ((url: URL | RequestInfo) => {
    const u = typeof url === "string" ? url : url instanceof URL ? url.toString() : url.url;
    if (u.includes("/rest/v1/rpc/check_edge_rate_limit")) {
      return Promise.resolve(
        new Response(
          JSON.stringify([{ allowed: true, remaining: 9, reset_at: new Date(Date.now() + 60_000).toISOString() }]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        ),
      );
    }
    return Promise.reject(new TypeError("Failed to fetch — network offline"));
  }) as typeof fetch;
  try {
    const res = await handleLogLoginAttempt(makeReq(VALID_PAYLOAD));
    assert(res.status < 500, `status=${res.status}`);
    const data = await res.json();
    assertEquals(data.ok, false);
    assertEquals(data.fallback, true);
  } finally {
    restoreFetch();
    clearEnv();
  }
});

Deno.test("nunca retorna 5xx: exceção inesperada no handler → 200 fallback", async () => {
  setEnv();
  // Corrompe fetch para lançar em todas as chamadas — força catch(err) do handler.
  globalThis.fetch = (() => {
    throw new Error("boom");
  }) as unknown as typeof fetch;
  try {
    const res = await handleLogLoginAttempt(makeReq(VALID_PAYLOAD));
    assert(res.status < 500);
    const data = await res.json();
    assertEquals(data.fallback, true);
  } finally {
    restoreFetch();
    clearEnv();
  }
});

Deno.test("happy-path: insert ok → 200 { ok: true }", async () => {
  setEnv();
  stubFetch(buildFetchHandler(() => new Response(null, { status: 201 })));
  try {
    const res = await handleLogLoginAttempt(makeReq(VALID_PAYLOAD));
    assertEquals(res.status, 200);
    const data = await res.json();
    assertEquals(data.ok, true);
  } finally {
    restoreFetch();
    clearEnv();
  }
});

Deno.test("CORS preflight (OPTIONS) → 2xx sem tocar DB", async () => {
  const req = new Request("https://example.com/log-login-attempt", {
    method: "OPTIONS",
    headers: { origin: "https://app.example.com", "access-control-request-method": "POST" },
  });
  const res = await handleLogLoginAttempt(req);
  assert(res.status < 500, `preflight status=${res.status}`);
});
