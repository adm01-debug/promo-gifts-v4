// Testes de integração para quote-sync-promo-champions.
// - Valida cálculo HMAC-SHA256 do body
// - Valida headers enviados ao Champions (x-webhook-event, x-webhook-signature, x-correlation-key)
// - Valida body no formato { event, correlation_key, payload }
// - Valida formato da resposta ao frontend { ok, correlation_key, champions_status, champions_response }
// - Cobre 401 (sem Authorization), 400 (Zod), 405 (método), 503 (secret ausente)

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SECRET = "test-secret-super-long-do-not-use-in-prod-1234567890";
const CHAMPIONS_URL =
  "https://rapjswienfhkobhlamxb.supabase.co/functions/v1/receive-quote-sync";

// Env vars necessárias precisam existir ANTES do import do módulo sob teste.
Deno.env.set("SUPABASE_URL", "https://fake-project.supabase.co");
Deno.env.set("SUPABASE_ANON_KEY", "fake-anon-key");
Deno.env.set("PROMO_CHAMPIONS_WEBHOOK_SECRET", SECRET);

const mod = await import("./index.ts");
const { handler, hmacSha256Hex } = mod as {
  handler: (req: Request) => Promise<Response>;
  hmacSha256Hex: (s: string, m: string) => Promise<string>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Cria um JWT HS256 estruturalmente válido (assinatura não é verificada nos mocks). */
function makeFakeJwt(sub = "00000000-0000-0000-0000-000000000001"): string {
  const b64url = (obj: unknown) =>
    btoa(JSON.stringify(obj)).replace(/=+$/, "").replace(/\+/g, "-").replace(/\//g, "_");
  const header = b64url({ alg: "HS256", typ: "JWT" });
  const payload = b64url({
    sub,
    role: "authenticated",
    iss: "https://fake-project.supabase.co/auth/v1",
    exp: Math.floor(Date.now() / 1000) + 3600,
  });
  return `${header}.${payload}.fake-signature`;
}

interface CapturedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: string;
}

/**
 * Substitui globalThis.fetch por um stub que:
 * - responde 200 para chamadas ao endpoint Supabase auth (getClaims)
 * - captura e responde championsResponse para o CHAMPIONS_URL
 */
function installFetchStub(championsResponse: {
  status: number;
  body: unknown;
}): { captured: CapturedRequest[]; restore: () => void } {
  const captured: CapturedRequest[] = [];
  const original = globalThis.fetch;

  globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : "GET");
    const headers: Record<string, string> = {};
    const rawHeaders = init?.headers ?? (input instanceof Request ? input.headers : undefined);
    if (rawHeaders) {
      new Headers(rawHeaders).forEach((v, k) => (headers[k.toLowerCase()] = v));
    }
    const body =
      typeof init?.body === "string"
        ? init.body
        : init?.body
        ? String(init.body)
        : "";

    if (url.startsWith(CHAMPIONS_URL)) {
      captured.push({ url, method, headers, body });
      return new Response(JSON.stringify(championsResponse.body), {
        status: championsResponse.status,
        headers: { "content-type": "application/json" },
      });
    }

    // Supabase auth endpoints (getClaims → /auth/v1/user ou /auth/v1/.well-known/jwks.json)
    if (url.includes("/auth/v1/")) {
      if (url.includes("jwks")) {
        return new Response(JSON.stringify({ keys: [] }), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      return new Response(
        JSON.stringify({ id: "00000000-0000-0000-0000-000000000001", role: "authenticated" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "unexpected_url", url }), { status: 500 });
  }) as typeof fetch;

  return {
    captured,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function baseBody() {
  return {
    quote_id: "11111111-2222-3333-4444-555555555555",
    quote_number: "ORC-2026-0001",
    status: "sent",
    client_id: "client-1",
    client_name: "ACME Ltda",
    total: 1234.56,
    updated_at: "2026-07-06T12:00:00.000Z",
    seller_email: "vendedor@exemplo.com",
  };
}

function buildRequest(body: unknown, opts: { auth?: string; method?: string } = {}) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (opts.auth !== undefined) headers.Authorization = opts.auth;
  return new Request("http://localhost/quote-sync-promo-champions", {
    method: opts.method ?? "POST",
    headers,
    body: typeof body === "string" ? body : JSON.stringify(body),
  });
}

// ─── Testes ──────────────────────────────────────────────────────────────

Deno.test("hmacSha256Hex: assinatura estável e determinística", async () => {
  const sig1 = await hmacSha256Hex("k", "hello");
  const sig2 = await hmacSha256Hex("k", "hello");
  assertEquals(sig1, sig2);
  // Valor conhecido (RFC 4231 vetor derivado):
  assertEquals(sig1.length, 64); // 32 bytes em hex
  assert(/^[0-9a-f]{64}$/.test(sig1));
});

Deno.test("OPTIONS: responde 204/200 sem body com CORS", async () => {
  const res = await handler(new Request("http://localhost/x", { method: "OPTIONS" }));
  assert(res.status === 200 || res.status === 204);
  assert(res.headers.get("access-control-allow-origin") !== null);
});

Deno.test("GET: retorna 405 method_not_allowed", async () => {
  const res = await handler(new Request("http://localhost/x", { method: "GET" }));
  assertEquals(res.status, 405);
  const j = await res.json();
  assertEquals(j.error, "method_not_allowed");
});

Deno.test("POST sem Authorization: 401 Unauthorized", async () => {
  const res = await handler(buildRequest(baseBody()));
  assertEquals(res.status, 401);
  const j = await res.json();
  assertEquals(j.error, "Unauthorized");
});

Deno.test("POST com body invalido: 400 invalid_body", async () => {
  const stub = installFetchStub({ status: 200, body: { ok: true } });
  try {
    const res = await handler(
      buildRequest({ quote_id: "nao-uuid" }, { auth: `Bearer ${makeFakeJwt()}` }),
    );
    assertEquals(res.status, 400);
    const j = await res.json();
    assertEquals(j.error, "invalid_body");
    assert(j.details);
  } finally {
    stub.restore();
  }
});

Deno.test("POST sem PROMO_CHAMPIONS_WEBHOOK_SECRET: 503 service_misconfigured", async () => {
  const stub = installFetchStub({ status: 200, body: { ok: true } });
  const prev = Deno.env.get("PROMO_CHAMPIONS_WEBHOOK_SECRET");
  Deno.env.delete("PROMO_CHAMPIONS_WEBHOOK_SECRET");
  try {
    const res = await handler(
      buildRequest(baseBody(), { auth: `Bearer ${makeFakeJwt()}` }),
    );
    assertEquals(res.status, 503);
    const j = await res.json();
    assertEquals(j.error, "service_misconfigured");
    assertStringIncludes(j.hint, "PROMO_CHAMPIONS_WEBHOOK_SECRET");
  } finally {
    if (prev) Deno.env.set("PROMO_CHAMPIONS_WEBHOOK_SECRET", prev);
    stub.restore();
  }
});

Deno.test("happy path: envia headers/body corretos e devolve resposta ao frontend", async () => {
  const championsResp = { ok: true, received: true, dedupe: "new" };
  const stub = installFetchStub({ status: 200, body: championsResp });
  try {
    const input = baseBody();
    const res = await handler(
      buildRequest(input, { auth: `Bearer ${makeFakeJwt()}` }),
    );

    // 1) chamada ao Champions foi feita exatamente 1x
    assertEquals(stub.captured.length, 1);
    const call = stub.captured[0];

    // 2) URL e method
    assertEquals(call.url, CHAMPIONS_URL);
    assertEquals(call.method, "POST");

    // 3) Headers obrigatorios presentes
    assertEquals(call.headers["content-type"], "application/json");
    assertEquals(call.headers["x-webhook-event"], "quote.sent");
    const expectedCorrelation = `quote:${input.quote_id}:sent:${input.updated_at}`;
    assertEquals(call.headers["x-correlation-key"], expectedCorrelation);

    // 4) Assinatura HMAC valida sobre o body cru enviado
    const sigHeader = call.headers["x-webhook-signature"];
    assert(sigHeader?.startsWith("sha256="), `x-webhook-signature invalida: ${sigHeader}`);
    const providedHex = sigHeader.slice("sha256=".length);
    const expectedHex = await hmacSha256Hex(SECRET, call.body);
    assertEquals(providedHex, expectedHex, "HMAC divergente do body enviado");

    // 5) Body no formato canonico { event, correlation_key, payload }
    const sent = JSON.parse(call.body);
    assertEquals(sent.event, "quote.sent");
    assertEquals(sent.correlation_key, expectedCorrelation);
    assertEquals(sent.payload.quote_id, input.quote_id);
    assertEquals(sent.payload.quote_number, input.quote_number);
    assertEquals(sent.payload.total, input.total);
    assertEquals(sent.payload.seller_email, input.seller_email);

    // 6) Resposta ao frontend
    assertEquals(res.status, 200);
    const j = await res.json();
    assertEquals(j.ok, true);
    assertEquals(j.correlation_key, expectedCorrelation);
    assertEquals(j.champions_status, 200);
    assertEquals(j.champions_response, championsResp);
  } finally {
    stub.restore();
  }
});

Deno.test("Champions responde 401: propaga status e error=champions_failed", async () => {
  const stub = installFetchStub({
    status: 401,
    body: { error: "invalid_signature" },
  });
  try {
    const res = await handler(
      buildRequest(baseBody(), { auth: `Bearer ${makeFakeJwt()}` }),
    );
    assertEquals(res.status, 401);
    const j = await res.json();
    assertEquals(j.ok, false);
    assertEquals(j.error, "champions_failed");
    assertEquals(j.champions_status, 401);
    assertStringIncludes(j.details, "invalid_signature");
  } finally {
    stub.restore();
  }
});

Deno.test("updated_at ausente: correlation_key usa timestamp gerado", async () => {
  const stub = installFetchStub({ status: 200, body: { ok: true } });
  try {
    const input = { ...baseBody(), updated_at: null };
    const res = await handler(
      buildRequest(input, { auth: `Bearer ${makeFakeJwt()}` }),
    );
    assertEquals(res.status, 200);
    const call = stub.captured[0];
    const key = call.headers["x-correlation-key"];
    assert(
      key.startsWith(`quote:${input.quote_id}:sent:`) && key.length > `quote:${input.quote_id}:sent:`.length,
      `correlation_key nao caiu no fallback ISO: ${key}`,
    );
    // deve ser ISO parseavel
    const iso = key.split(":sent:")[1];
    assert(!Number.isNaN(Date.parse(iso)), `timestamp fallback nao e ISO valido: ${iso}`);
  } finally {
    stub.restore();
  }
});
