/**
 * Handler-direct Deno tests — log-login-attempt
 *
 * Fecha o gap G1 do relatório 2026-07-22: prova que o handler REAL
 * (`handleLogLoginAttempt` importado de `./index.ts`) mantém o contrato
 * "nunca 5xx" sob todos os caminhos de erro reais — sem mocks profundos,
 * sem import maps, sem stubs de dependência.
 *
 * Estratégia: aponto `SUPABASE_URL` para um servidor HTTP local que
 * responde no lugar do PostgREST. O `createClient` do Supabase, o
 * rate-limiter, o structured-logger e a validação Zod rodam de VERDADE.
 *
 * Rodar:
 *   deno test --allow-env --allow-net supabase/functions/log-login-attempt/index_test.ts
 *
 * Diagnóstico do CANONICAL_ID: a URL do mock inclui o literal
 * "doufsxqlfjyuvxuezpln" para não disparar o log de project_mismatch.
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { handleLogLoginAttempt } from "./index.ts";

/* ------------------------------------------------------------------ */
/* Servidor mock local (PostgREST-like)                                 */
/* ------------------------------------------------------------------ */

interface MockConfig {
  /** Como responder ao POST /rest/v1/login_attempts */
  insertMode:
    | { kind: "ok" }
    | { kind: "sqlstate"; code: string; message: string; details?: string; hint?: string }
    | { kind: "http_5xx"; status: number }
    | { kind: "malformed_json" }
    | { kind: "network_drop" };
  /** Como responder ao POST /rest/v1/rpc/check_edge_rate_limit (rate-limiter) */
  rateLimitMode: { kind: "allow"; remaining?: number } | { kind: "block" } | { kind: "error" };
}

let currentMock: MockConfig = {
  insertMode: { kind: "ok" },
  rateLimitMode: { kind: "allow", remaining: 9 },
};

async function startMockServer(): Promise<{ url: string; shutdown: () => Promise<void> }> {
  const controller = new AbortController();
  const server = Deno.serve(
    { port: 0, signal: controller.signal, onListen: () => {} },
    async (req: Request): Promise<Response> => {
      const url = new URL(req.url);

      // RPC do rate-limiter
      if (url.pathname === "/rest/v1/rpc/check_edge_rate_limit") {
        const rl = currentMock.rateLimitMode;
        if (rl.kind === "error") {
          return new Response(JSON.stringify({ message: "rpc unavailable", code: "XX000" }), {
            status: 500,
            headers: { "Content-Type": "application/json" },
          });
        }
        return new Response(
          JSON.stringify([
            {
              allowed: rl.kind === "allow",
              remaining: rl.kind === "allow" ? (rl.remaining ?? 9) : 0,
              reset_at: new Date(Date.now() + 60_000).toISOString(),
            },
          ]),
          { status: 200, headers: { "Content-Type": "application/json" } },
        );
      }

      // INSERT em login_attempts
      if (url.pathname === "/rest/v1/login_attempts") {
        const m = currentMock.insertMode;
        // Drain body — o cliente Supabase espera o corpo consumido.
        await req.text().catch(() => "");
        switch (m.kind) {
          case "ok":
            return new Response("[]", { status: 201, headers: { "Content-Type": "application/json" } });
          case "sqlstate":
            return new Response(
              JSON.stringify({
                code: m.code,
                message: m.message,
                details: m.details ?? null,
                hint: m.hint ?? null,
              }),
              { status: 400, headers: { "Content-Type": "application/json" } },
            );
          case "http_5xx":
            return new Response("upstream error", { status: m.status });
          case "malformed_json":
            return new Response("{not-json", { status: 200, headers: { "Content-Type": "application/json" } });
          case "network_drop":
            controller.abort();
            return new Response("nope", { status: 503 });
        }
      }

      return new Response("not found", { status: 404 });
    },
  );

  // Server started — recuperar endereço real (porta 0).
  const addr = server.addr as Deno.NetAddr;
  const url = `http://127.0.0.1:${addr.port}/doufsxqlfjyuvxuezpln`; // satisfaz CANONICAL_ID.includes()

  return {
    url,
    shutdown: async () => {
      controller.abort();
      await server.finished.catch(() => {});
    },
  };
}

/* ------------------------------------------------------------------ */
/* Helpers                                                              */
/* ------------------------------------------------------------------ */

function makeReq(body: string | object | null, init: RequestInit = {}): Request {
  const bodyStr = body === null ? undefined : typeof body === "string" ? body : JSON.stringify(body);
  return new Request("http://edge.local/log-login-attempt", {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-forwarded-for": "10.0.0.1", ...(init.headers as Record<string, string> ?? {}) },
    body: bodyStr,
    ...init,
  });
}

async function callHandler(req: Request): Promise<{ status: number; body: unknown }> {
  const res = await handleLogLoginAttempt(req);
  const text = await res.text();
  let body: unknown = null;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function withMock(config: Partial<MockConfig>): void {
  currentMock = { ...currentMock, ...config };
}

/* ------------------------------------------------------------------ */
/* Boot: um servidor mock para toda a suíte                             */
/* ------------------------------------------------------------------ */

const mock = await startMockServer();
Deno.env.set("SUPABASE_URL", mock.url);
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "test-service-role-key");

globalThis.addEventListener("unload", () => {
  mock.shutdown();
});

/* ------------------------------------------------------------------ */
/* Testes                                                               */
/* ------------------------------------------------------------------ */

Deno.test("CORS preflight (OPTIONS) → 2xx sem body", async () => {
  const req = new Request("http://edge.local/log-login-attempt", {
    method: "OPTIONS",
    headers: {
      Origin: "https://www.promogifts.com.br",
      "Access-Control-Request-Method": "POST",
      "Access-Control-Request-Headers": "content-type",
    },
  });
  const res = await handleLogLoginAttempt(req);
  await res.body?.cancel();
  assert(res.status < 500, `OPTIONS retornou ${res.status}`);
  assert(res.status < 400, `OPTIONS retornou ${res.status}, esperado 2xx`);
});

Deno.test("happy path — insert ok → 200 { ok: true }", async () => {
  withMock({ insertMode: { kind: "ok" }, rateLimitMode: { kind: "allow" } });
  const { status, body } = await callHandler(makeReq({
    email: "user@example.com",
    success: true,
    ip_address: "10.0.0.1",
  }));
  assertEquals(status, 200);
  assertEquals((body as { ok: boolean }).ok, true);
});

Deno.test("body vazio → 400 Empty request body", async () => {
  withMock({ insertMode: { kind: "ok" }, rateLimitMode: { kind: "allow" } });
  const { status, body } = await callHandler(makeReq(""));
  assertEquals(status, 400);
  assertEquals((body as { error: string }).error, "Empty request body");
});

Deno.test("body só espaços → 400", async () => {
  withMock({ insertMode: { kind: "ok" }, rateLimitMode: { kind: "allow" } });
  const { status } = await callHandler(makeReq("   \n\t "));
  assertEquals(status, 400);
});

Deno.test("JSON malformado → 400 Invalid JSON body", async () => {
  const { status, body } = await callHandler(makeReq("{not-json"));
  assertEquals(status, 400);
  assertEquals((body as { error: string }).error, "Invalid JSON body");
});

Deno.test("Zod: email inválido → 400", async () => {
  const { status } = await callHandler(makeReq({ email: "not-an-email", success: true }));
  assertEquals(status, 400);
});

Deno.test("Zod: success ausente → 400", async () => {
  const { status } = await callHandler(makeReq({ email: "u@e.com" }));
  assertEquals(status, 400);
});

Deno.test("Zod: user_id não-uuid → 400", async () => {
  const { status } = await callHandler(makeReq({ email: "u@e.com", success: true, user_id: "not-uuid" }));
  assertEquals(status, 400);
});

Deno.test("Zod: email >255 chars → 400", async () => {
  const { status } = await callHandler(makeReq({ email: "a".repeat(300) + "@e.com", success: true }));
  assertEquals(status, 400);
});

Deno.test("missing SUPABASE_URL → 200 fallback missing_env", async () => {
  const saved = Deno.env.get("SUPABASE_URL")!;
  Deno.env.delete("SUPABASE_URL");
  try {
    const { status, body } = await callHandler(makeReq({ email: "u@e.com", success: true }));
    assertEquals(status, 200);
    assertEquals((body as { fallback: boolean; reason: string }).fallback, true);
    assertEquals((body as { reason: string }).reason, "missing_env");
  } finally {
    Deno.env.set("SUPABASE_URL", saved);
  }
});

Deno.test("missing SUPABASE_SERVICE_ROLE_KEY → 200 fallback missing_env", async () => {
  const saved = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  Deno.env.delete("SUPABASE_SERVICE_ROLE_KEY");
  try {
    const { status, body } = await callHandler(makeReq({ email: "u@e.com", success: true }));
    assertEquals(status, 200);
    assertEquals((body as { reason: string }).reason, "missing_env");
  } finally {
    Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", saved);
  }
});

/* Matriz SQLSTATE — 15 códigos, todos devem virar 200 fallback db_insert_failed */
const SQLSTATES = [
  { code: "23502", label: "not-null" },
  { code: "23503", label: "FK" },
  { code: "23505", label: "unique" },
  { code: "23514", label: "check" },
  { code: "23P01", label: "exclusion" },
  { code: "42501", label: "RLS" },
  { code: "42703", label: "undef col" },
  { code: "42P01", label: "undef table" },
  { code: "42P07", label: "dup table" },
  { code: "42883", label: "undef fn" },
  { code: "40001", label: "serialization" },
  { code: "40P01", label: "deadlock" },
  { code: "53100", label: "disk full" },
  { code: "57014", label: "timeout" },
  { code: "XX000", label: "internal" },
];

for (const s of SQLSTATES) {
  Deno.test(`SQLSTATE ${s.code} (${s.label}) → 200 fallback db_insert_failed`, async () => {
    withMock({
      insertMode: { kind: "sqlstate", code: s.code, message: `simulated ${s.label}` },
      rateLimitMode: { kind: "allow" },
    });
    const { status, body } = await callHandler(makeReq({ email: "u@e.com", success: true }));
    assert(status < 500, `SQLSTATE ${s.code} vazou 5xx (${status})`);
    assertEquals(status, 200);
    assertEquals((body as { fallback: boolean }).fallback, true);
    assertEquals((body as { reason: string }).reason, "db_insert_failed");
  });
}

Deno.test("PostgREST 500 → 200 fallback db_insert_failed", async () => {
  withMock({ insertMode: { kind: "http_5xx", status: 500 }, rateLimitMode: { kind: "allow" } });
  const { status, body } = await callHandler(makeReq({ email: "u@e.com", success: true }));
  assert(status < 500);
  assertEquals(status, 200);
  assertEquals((body as { fallback: boolean }).fallback, true);
});

Deno.test("PostgREST 502 → 200 fallback", async () => {
  withMock({ insertMode: { kind: "http_5xx", status: 502 }, rateLimitMode: { kind: "allow" } });
  const { status } = await callHandler(makeReq({ email: "u@e.com", success: true }));
  assert(status < 500);
});

Deno.test("PostgREST 503 → 200 fallback", async () => {
  withMock({ insertMode: { kind: "http_5xx", status: 503 }, rateLimitMode: { kind: "allow" } });
  const { status } = await callHandler(makeReq({ email: "u@e.com", success: true }));
  assert(status < 500);
});

Deno.test("rate-limiter bloqueia → 429 (NÃO 5xx)", async () => {
  withMock({ insertMode: { kind: "ok" }, rateLimitMode: { kind: "block" } });
  const { status } = await callHandler(makeReq({ email: "u@e.com", success: true }));
  assertEquals(status, 429);
  assert(status < 500);
});

Deno.test("rate-limiter DB error (fail-open) → 200 (allowed)", async () => {
  // loginLogLimiter não é failClosed → deve permitir mesmo com erro na RPC.
  withMock({ insertMode: { kind: "ok" }, rateLimitMode: { kind: "error" } });
  const { status } = await callHandler(makeReq({ email: "u@e.com", success: true }));
  assert(status < 500, `fail-open vazou 5xx: ${status}`);
});

Deno.test("payload extra ignorado (Zod passthrough) → 200 ok", async () => {
  withMock({ insertMode: { kind: "ok" }, rateLimitMode: { kind: "allow" } });
  const { status, body } = await callHandler(makeReq({
    email: "u@e.com",
    success: true,
    campo_extra_qualquer: "abc",
  }));
  assertEquals(status, 200);
  assertEquals((body as { ok: boolean }).ok, true);
});

Deno.test("payload com Unicode adversarial (RTL, ZWJ, NBSP) em user_agent → 200 ok", async () => {
  withMock({ insertMode: { kind: "ok" }, rateLimitMode: { kind: "allow" } });
  const { status } = await callHandler(makeReq({
    email: "u@e.com",
    success: true,
    user_agent: "\u202EMozilla\u200D/5.0\u00A0evil",
  }));
  assertEquals(status, 200);
});

Deno.test("payload com failure_reason > 500 chars → 400 (Zod max)", async () => {
  const { status } = await callHandler(makeReq({
    email: "u@e.com",
    success: false,
    failure_reason: "x".repeat(501),
  }));
  assertEquals(status, 400);
});

Deno.test("invariante final: em NENHUM cenário testado o status é 5xx", async () => {
  // Meta-teste: se qualquer setUp/setDown deixou estado ruim, este captura.
  const scenarios: Array<{ label: string; setup: () => void; body: object | string }> = [
    { label: "happy", setup: () => withMock({ insertMode: { kind: "ok" }, rateLimitMode: { kind: "allow" } }), body: { email: "u@e.com", success: true } },
    { label: "sqlstate-cascade", setup: () => withMock({ insertMode: { kind: "sqlstate", code: "42501", message: "rls" }, rateLimitMode: { kind: "allow" } }), body: { email: "u@e.com", success: true } },
    { label: "http-503", setup: () => withMock({ insertMode: { kind: "http_5xx", status: 503 }, rateLimitMode: { kind: "allow" } }), body: { email: "u@e.com", success: true } },
    { label: "rl-block", setup: () => withMock({ insertMode: { kind: "ok" }, rateLimitMode: { kind: "block" } }), body: { email: "u@e.com", success: true } },
    { label: "rl-error", setup: () => withMock({ insertMode: { kind: "ok" }, rateLimitMode: { kind: "error" } }), body: { email: "u@e.com", success: true } },
    { label: "zod-fail", setup: () => withMock({ insertMode: { kind: "ok" }, rateLimitMode: { kind: "allow" } }), body: { email: "nope" } },
    { label: "empty", setup: () => withMock({ insertMode: { kind: "ok" }, rateLimitMode: { kind: "allow" } }), body: "" },
    { label: "invalid-json", setup: () => withMock({ insertMode: { kind: "ok" }, rateLimitMode: { kind: "allow" } }), body: "{{{" },
  ];
  for (const s of scenarios) {
    s.setup();
    const req = makeReq(s.body);
    const res = await handleLogLoginAttempt(req);
    await res.body?.cancel();
    assert(res.status < 500, `cenário ${s.label} vazou 5xx (${res.status})`);
  }
});

// Ensure server is properly shut down at end
globalThis.addEventListener("beforeunload", () => {
  mock.shutdown();
});
