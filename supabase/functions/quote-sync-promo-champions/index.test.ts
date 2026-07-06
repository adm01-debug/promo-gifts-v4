// Testes de integração para quote-sync-promo-champions.
// - Valida cálculo HMAC-SHA256 do body
// - Valida headers enviados ao Champions (x-webhook-event, x-webhook-signature, x-correlation-key)
// - Valida body no formato { event, correlation_key, payload }
// - Valida formato da resposta ao frontend { ok, correlation_key, champions_status, champions_response }
// - Cobre 401 (sem Authorization), 400 (Zod), 405 (método), 503 (secret ausente)
// - Cobre ownership check (404 quote_not_found, 403 forbidden)
// - Cobre atualização de status para 'sent' no DB antes do sync

import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";

const SECRET = "test-secret-super-long-do-not-use-in-prod-1234567890";
const CHAMPIONS_URL =
  "https://rapjswienfhkobhlamxb.supabase.co/functions/v1/receive-quote-sync";
const SELLER_ID = "00000000-0000-0000-0000-000000000001";
const OTHER_SELLER_ID = "99999999-9999-9999-9999-999999999999";
const QUOTE_ID = "11111111-2222-3333-4444-555555555555";

// Env vars necessárias precisam existir ANTES do import do módulo sob teste.
Deno.env.set("SUPABASE_URL", "https://fake-project.supabase.co");
Deno.env.set("SUPABASE_ANON_KEY", "fake-anon-key");
Deno.env.set("SUPABASE_SERVICE_ROLE_KEY", "fake-service-role-key");
Deno.env.set("PROMO_CHAMPIONS_WEBHOOK_SECRET", SECRET);

const mod = await import("./index.ts");
const { handler, hmacSha256Hex } = mod as {
  handler: (req: Request) => Promise<Response>;
  hmacSha256Hex: (s: string, m: string) => Promise<string>;
};

// ─── Helpers ─────────────────────────────────────────────────────────────

/** Cria um JWT HS256 estruturalmente válido (assinatura não é verificada nos mocks). */
function makeFakeJwt(sub = SELLER_ID): string {
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

interface QuoteRow {
  id: string;
  quote_number: string | null;
  status: string;
  seller_id: string | null;
  client_id: string | null;
  client_name: string | null;
  client_email: string | null;
  total: number | string | null;
  updated_at: string | null;
  sent_at: string | null;
}

function defaultQuoteRow(overrides: Partial<QuoteRow> = {}): QuoteRow {
  return {
    id: QUOTE_ID,
    quote_number: "ORC-2026-0001",
    status: "pending",
    seller_id: SELLER_ID,
    client_id: null,
    client_name: "ACME Ltda",
    client_email: null,
    total: 1234.56,
    updated_at: "2026-07-06T12:00:00.000Z",
    sent_at: null,
    ...overrides,
  };
}

/**
 * Substitui globalThis.fetch por um stub que:
 * - responde 200 para /auth/v1/* (getClaims)
 * - responde a /rest/v1/quotes (GET SELECT e PATCH UPDATE) usando `quote` fornecido
 *   (null = quote não encontrado)
 * - captura e responde championsResponse para o CHAMPIONS_URL
 */
function installFetchStub(opts: {
  championsResponse: { status: number; body: unknown };
  quote?: QuoteRow | null; // undefined = default, null = not found
}): {
  captured: CapturedRequest[];
  postgrest: CapturedRequest[];
  restore: () => void;
} {
  const captured: CapturedRequest[] = [];
  const postgrest: CapturedRequest[] = [];
  const original = globalThis.fetch;
  const quote = opts.quote === undefined ? defaultQuoteRow() : opts.quote;

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
      return new Response(JSON.stringify(opts.championsResponse.body), {
        status: opts.championsResponse.status,
        headers: { "content-type": "application/json" },
      });
    }

    // PostgREST: quotes SELECT/UPDATE
    if (url.includes("/rest/v1/quotes")) {
      postgrest.push({ url, method, headers, body });
      const acceptsObject = (headers["accept"] ?? "").includes("pgrst.object");
      if (method === "GET" || method === undefined) {
        if (quote === null) {
          // maybeSingle com 0 rows: PostgREST devolve 200 + null (com Accept object)
          return new Response("null", {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        const payload = acceptsObject ? JSON.stringify(quote) : JSON.stringify([quote]);
        return new Response(payload, {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (method === "PATCH") {
        return new Response(null, {
          status: 204,
          headers: { "content-type": "application/json" },
        });
      }
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
        JSON.stringify({ id: SELLER_ID, role: "authenticated" }),
        { status: 200, headers: { "content-type": "application/json" } },
      );
    }

    return new Response(JSON.stringify({ error: "unexpected_url", url }), { status: 500 });
  }) as typeof fetch;

  return {
    captured,
    postgrest,
    restore: () => {
      globalThis.fetch = original;
    },
  };
}

function baseBody() {
  return {
    quote_id: QUOTE_ID,
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
  assertEquals(sig1.length, 64);
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

Deno.test({ name: "POST com body invalido: 400 invalid_body", sanitizeOps: false, sanitizeResources: false }, async () => {
  const stub = installFetchStub({ championsResponse: { status: 200, body: { ok: true } } });
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

Deno.test({ name: "POST sem PROMO_CHAMPIONS_WEBHOOK_SECRET: 503 service_misconfigured", sanitizeOps: false, sanitizeResources: false }, async () => {
  const stub = installFetchStub({ championsResponse: { status: 200, body: { ok: true } } });
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

Deno.test({ name: "quote inexistente: 404 quote_not_found", sanitizeOps: false, sanitizeResources: false }, async () => {
  const stub = installFetchStub({
    championsResponse: { status: 200, body: { ok: true } },
    quote: null,
  });
  try {
    const res = await handler(
      buildRequest(baseBody(), { auth: `Bearer ${makeFakeJwt()}` }),
    );
    assertEquals(res.status, 404);
    const j = await res.json();
    assertEquals(j.error, "quote_not_found");
    // Champions NÃO deve ser chamado quando o quote nao existe
    assertEquals(stub.captured.length, 0);
  } finally {
    stub.restore();
  }
});

Deno.test({ name: "ownership check: 403 quando seller_id do quote != auth.uid", sanitizeOps: false, sanitizeResources: false }, async () => {
  const stub = installFetchStub({
    championsResponse: { status: 200, body: { ok: true } },
    quote: defaultQuoteRow({ seller_id: OTHER_SELLER_ID }),
  });
  try {
    const res = await handler(
      buildRequest(baseBody(), { auth: `Bearer ${makeFakeJwt()}` }),
    );
    assertEquals(res.status, 403);
    const j = await res.json();
    assertEquals(j.error, "forbidden");
    assertEquals(stub.captured.length, 0, "Champions NAO deve ser chamado em 403");
  } finally {
    stub.restore();
  }
});

Deno.test({ name: "happy path: envia headers/body corretos e devolve resposta ao frontend", sanitizeOps: false, sanitizeResources: false }, async () => {
  const championsResp = { ok: true, received: true, dedupe: "new" };
  const stub = installFetchStub({ championsResponse: { status: 200, body: championsResp } });
  try {
    const input = baseBody();
    const res = await handler(
      buildRequest(input, { auth: `Bearer ${makeFakeJwt()}` }),
    );

    // Champions chamado exatamente 1x
    assertEquals(stub.captured.length, 1);
    const call = stub.captured[0];

    assertEquals(call.url, CHAMPIONS_URL);
    assertEquals(call.method, "POST");
    assertEquals(call.headers["content-type"], "application/json");
    assertEquals(call.headers["x-webhook-event"], "quote.sent");
    const expectedCorrelation = `quote:${input.quote_id}:sent:${input.updated_at}`;
    assertEquals(call.headers["x-correlation-key"], expectedCorrelation);

    // HMAC valida sobre o body cru enviado
    const sigHeader = call.headers["x-webhook-signature"];
    assert(sigHeader?.startsWith("sha256="), `x-webhook-signature invalida: ${sigHeader}`);
    const providedHex = sigHeader.slice("sha256=".length);
    const expectedHex = await hmacSha256Hex(SECRET, call.body);
    assertEquals(providedHex, expectedHex, "HMAC divergente do body enviado");

    // Body { event, correlation_key, payload } — status sempre 'sent' no evento
    const sent = JSON.parse(call.body);
    assertEquals(sent.event, "quote.sent");
    assertEquals(sent.correlation_key, expectedCorrelation);
    assertEquals(sent.payload.quote_id, input.quote_id);
    assertEquals(sent.payload.quote_number, input.quote_number);
    assertEquals(sent.payload.status, "sent");
    assertEquals(sent.payload.total, input.total);
    assertEquals(sent.payload.seller_email, input.seller_email);

    // Deve ter feito UPDATE em quotes (status='sent' + sent_at + last_sent_at)
    const patch = stub.postgrest.find((r) => r.method === "PATCH");
    assert(patch, "esperava PATCH em /rest/v1/quotes");
    const patchBody = JSON.parse(patch.body);
    assertEquals(patchBody.status, "sent");
    assert(patchBody.sent_at, "sent_at deve estar no PATCH");
    assert(patchBody.last_sent_at, "last_sent_at deve estar no PATCH");

    // Resposta ao frontend
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

Deno.test({ name: "re-envio (status ja 'sent'): apenas atualiza last_sent_at", sanitizeOps: false, sanitizeResources: false }, async () => {
  const stub = installFetchStub({
    championsResponse: { status: 200, body: { ok: true } },
    quote: defaultQuoteRow({ status: "sent", sent_at: "2026-07-05T00:00:00.000Z" }),
  });
  try {
    const res = await handler(
      buildRequest(baseBody(), { auth: `Bearer ${makeFakeJwt()}` }),
    );
    assertEquals(res.status, 200);
    const patch = stub.postgrest.find((r) => r.method === "PATCH");
    assert(patch, "esperava PATCH em /rest/v1/quotes");
    const patchBody = JSON.parse(patch.body);
    assert(patchBody.last_sent_at, "last_sent_at deve ser atualizado no re-envio");
    assertEquals(patchBody.status, undefined, "status NAO deve ser reescrito no re-envio");
    assertEquals(patchBody.sent_at, undefined, "sent_at NAO deve ser reescrito no re-envio");
  } finally {
    stub.restore();
  }
});

Deno.test({ name: "Champions responde 401: propaga status e error=champions_failed", sanitizeOps: false, sanitizeResources: false }, async () => {
  const stub = installFetchStub({
    championsResponse: { status: 401, body: { error: "invalid_signature" } },
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

Deno.test({ name: "updated_at ausente (DB e body): correlation_key usa quote_id como fallback (deterministico)", sanitizeOps: false, sanitizeResources: false }, async () => {
  const stub = installFetchStub({
    championsResponse: { status: 200, body: { ok: true } },
    quote: defaultQuoteRow({ updated_at: null }),
  });
  try {
    const input = { ...baseBody(), updated_at: null };
    const res = await handler(
      buildRequest(input, { auth: `Bearer ${makeFakeJwt()}` }),
    );
    assertEquals(res.status, 200);
    const call = stub.captured[0];
    const key = call.headers["x-correlation-key"];
    // Fallback deterministico: usa quote_id quando DB e body nao tem updated_at.
    assertEquals(key, `quote:${input.quote_id}:sent:${input.quote_id}`);

    // Segunda chamada com o mesmo input deve produzir a MESMA key.
    const res2 = await handler(
      buildRequest(input, { auth: `Bearer ${makeFakeJwt()}` }),
    );
    assertEquals(res2.status, 200);
    const key2 = stub.captured[1].headers["x-correlation-key"];
    assertEquals(key2, key, "correlation_key deve ser deterministica entre chamadas");
  } finally {
    stub.restore();
  }
});
