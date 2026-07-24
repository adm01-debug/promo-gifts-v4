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
const { handler, hmacSha256Hex, normalizeTs } = mod as {
  handler: (req: Request) => Promise<Response>;
  hmacSha256Hex: (s: string, m: string) => Promise<string>;
  normalizeTs: (ts: string | null | undefined) => string | null;
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
interface RateLimitRow {
  request_count: number;
  window_start: string;
  blocked_until: string | null;
}

function installFetchStub(opts: {
  championsResponse: { status: number; body: unknown };
  quote?: QuoteRow | null; // undefined = default, null = not found
  rateLimitStore?: Map<string, RateLimitRow>;
}): {
  captured: CapturedRequest[];
  postgrest: CapturedRequest[];
  rateLimitStore: Map<string, RateLimitRow>;
  restore: () => void;
} {
  const captured: CapturedRequest[] = [];
  const postgrest: CapturedRequest[] = [];
  const original = globalThis.fetch;
  const quote = opts.quote === undefined ? defaultQuoteRow() : opts.quote;
  const rateLimitStore = opts.rateLimitStore ?? new Map<string, RateLimitRow>();

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

    // PostgREST: request_rate_limits (SELECT / UPSERT via POST / UPDATE via PATCH)
    if (url.includes("/rest/v1/request_rate_limits")) {
      postgrest.push({ url, method, headers, body });
      const u = new URL(url);
      const idFilter = (u.searchParams.get("identifier") ?? "").replace(/^eq\./, "");
      const epFilter = (u.searchParams.get("endpoint") ?? "").replace(/^eq\./, "");
      const key = `${idFilter}::${epFilter}`;

      if (method === "GET" || method === undefined) {
        const acceptsObject = (headers["accept"] ?? "").includes("pgrst.object");
        const row = rateLimitStore.get(key);
        if (!row) {
          return new Response(acceptsObject ? "null" : "[]", {
            status: 200,
            headers: { "content-type": "application/json" },
          });
        }
        const payload = { id: "rl-" + key, ...row };
        return new Response(
          acceptsObject ? JSON.stringify(payload) : JSON.stringify([payload]),
          { status: 200, headers: { "content-type": "application/json" } },
        );
      }
      if (method === "POST") {
        // UPSERT (onConflict identifier,endpoint)
        try {
          const parsed = JSON.parse(body);
          const rows = Array.isArray(parsed) ? parsed : [parsed];
          for (const r of rows) {
            rateLimitStore.set(`${r.identifier}::${r.endpoint}`, {
              request_count: r.request_count,
              window_start: r.window_start,
              blocked_until: r.blocked_until ?? null,
            });
          }
        } catch { /* ignore */ }
        return new Response("", { status: 201, headers: { "content-type": "application/json" } });
      }
      if (method === "PATCH") {
        try {
          const parsed = JSON.parse(body);
          const existing = rateLimitStore.get(key);
          if (existing) {
            rateLimitStore.set(key, {
              request_count: parsed.request_count ?? existing.request_count,
              window_start: existing.window_start,
              blocked_until: parsed.blocked_until === undefined ? existing.blocked_until : parsed.blocked_until,
            });
          }
        } catch { /* ignore */ }
        return new Response(null, { status: 204, headers: { "content-type": "application/json" } });
      }
    }

    // PostgREST: quotes SELECT/UPDATE
    if (url.includes("/rest/v1/quotes")) {
      postgrest.push({ url, method, headers, body });
      const acceptsObject = (headers["accept"] ?? "").includes("pgrst.object");
      if (method === "GET" || method === undefined) {
        if (quote === null) {
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
        return new Response(null, { status: 204, headers: { "content-type": "application/json" } });
      }
    }

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
    rateLimitStore,
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

// ─── normalizeTs: variantes equivalentes de timestamptz colapsam ────────
Deno.test("normalizeTs: variantes do mesmo instante colapsam no ISO canônico", () => {
  // Todas estas representações apontam para o mesmo instante UTC.
  const equivalents = [
    "2026-07-06T22:00:00+00:00",
    "2026-07-06T22:00:00Z",
    "2026-07-06T22:00:00.000Z",
    "2026-07-06T22:00:00.000000+00:00",
    "2026-07-06T22:00:00.000000Z",
    "2026-07-06T19:00:00-03:00", // mesmo instante em -03:00 (America/Sao_Paulo)
    "2026-07-06T22:00:00.000+00:00",
  ];
  const canonical = "2026-07-06T22:00:00.000Z";
  for (const v of equivalents) {
    assertEquals(normalizeTs(v), canonical, `${v} deveria normalizar para ${canonical}`);
  }
});

Deno.test("normalizeTs: preserva microssegundos truncando para ms (comportamento Date)", () => {
  // Postgres pode devolver microsegundos; Date/toISOString trunca para ms.
  // O importante é que TODAS as variantes com os mesmos ms produzam a mesma saída.
  assertEquals(
    normalizeTs("2026-07-06T22:00:00.123456+00:00"),
    normalizeTs("2026-07-06T22:00:00.123Z"),
  );
});

Deno.test("normalizeTs: null/undefined/'' → null; inparseável → devolve original", () => {
  assertEquals(normalizeTs(null), null);
  assertEquals(normalizeTs(undefined), null);
  assertEquals(normalizeTs(""), null);
  // string inparseável não deve quebrar o fluxo — devolve como veio
  assertEquals(normalizeTs("not-a-date"), "not-a-date");
});

Deno.test("normalizeTs: idempotente (aplicar 2x = aplicar 1x)", () => {
  const inputs = [
    "2026-07-06T22:00:00+00:00",
    "2026-07-06T22:00:00.123456Z",
    "2026-01-01T00:00:00-03:00",
  ];
  for (const v of inputs) {
    const once = normalizeTs(v);
    const twice = normalizeTs(once);
    assertEquals(twice, once, `normalizeTs deve ser idempotente para ${v}`);
  }
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

// ═══════════════════════════════════════════════════════════════════════════
// SIMULAÇÕES EXAUSTIVAS — Rate Limiting (10 req/h por seller×quote)
// ═══════════════════════════════════════════════════════════════════════════

Deno.test({ name: "rate-limit: 10 chamadas sequenciais passam, 11ª bloqueia com 429", sanitizeOps: false, sanitizeResources: false }, async () => {
  const stub = installFetchStub({ championsResponse: { status: 200, body: { ok: true } } });
  try {
    let okCount = 0;
    let blockedCount = 0;
    for (let i = 0; i < 11; i++) {
      const res = await handler(buildRequest(baseBody(), { auth: `Bearer ${makeFakeJwt()}` }));
      const j = await res.json();
      if (res.status === 200) okCount++;
      else if (res.status === 429) blockedCount++;
      if (i === 10) {
        assertEquals(res.status, 429, `chamada 11 deveria bloquear (got ${res.status}, body=${JSON.stringify(j)})`);
        assertEquals(j.error, "rate_limit_exceeded");
        assert(j.retry_after, "retry_after deve estar presente no 429");
      }
    }
    assertEquals(okCount, 10, "exatamente 10 chamadas devem passar");
    assertEquals(blockedCount, 1, "exatamente 1 chamada deve ser bloqueada");
    // Champions deve receber exatamente 10 posts (a 11ª nem chega lá)
    assertEquals(stub.captured.length, 10, "Champions só recebe as 10 chamadas dentro do limite");
  } finally {
    stub.restore();
  }
});

Deno.test({ name: "rate-limit: seller×quote distintos NÃO colidem (isolamento por chave)", sanitizeOps: false, sanitizeResources: false }, async () => {
  const OTHER_QUOTE = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";
  const store = new Map<string, RateLimitRow>();

  // Estoura o limite pra (SELLER, QUOTE_ID)
  const stub1 = installFetchStub({
    championsResponse: { status: 200, body: { ok: true } },
    quote: defaultQuoteRow({ id: QUOTE_ID }),
    rateLimitStore: store,
  });
  try {
    for (let i = 0; i < 10; i++) {
      const r = await handler(buildRequest(baseBody(), { auth: `Bearer ${makeFakeJwt()}` }));
      await r.text();
    }
    // Confirma que quote1 está bloqueado
    const blocked = await handler(buildRequest(baseBody(), { auth: `Bearer ${makeFakeJwt()}` }));
    assertEquals(blocked.status, 429, "quote1 deve estar bloqueado");
    await blocked.text();
  } finally {
    stub1.restore();
  }

  // Agora chama (SELLER, OTHER_QUOTE) — deve passar limpo, chave diferente
  const stub2 = installFetchStub({
    championsResponse: { status: 200, body: { ok: true } },
    quote: defaultQuoteRow({ id: OTHER_QUOTE }),
    rateLimitStore: store,
  });
  try {
    const other = await handler(
      buildRequest({ ...baseBody(), quote_id: OTHER_QUOTE }, { auth: `Bearer ${makeFakeJwt()}` }),
    );
    assertEquals(other.status, 200, "outro quote não deve herdar bloqueio");
    // Store deve ter 2 chaves separadas
    assertEquals(store.size, 2, `esperava 2 chaves no store, tem ${store.size}: ${[...store.keys()].join(",")}`);
  } finally {
    stub2.restore();
  }
});

Deno.test({ name: "rate-limit: janela expirada (>1h) reseta contador e destrava", sanitizeOps: false, sanitizeResources: false }, async () => {
  const store = new Map<string, RateLimitRow>();
  const key = `${SELLER_ID}:${QUOTE_ID}::quote-sync-promo-champions`;
  const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString();
  // Semeia com contador estourado numa janela ANTIGA (já expirada)
  store.set(key, {
    request_count: 10,
    window_start: twoHoursAgo,
    blocked_until: null, // blocked_until já passou / não setado
  });

  const stub = installFetchStub({
    championsResponse: { status: 200, body: { ok: true } },
    rateLimitStore: store,
  });
  try {
    const res = await handler(buildRequest(baseBody(), { auth: `Bearer ${makeFakeJwt()}` }));
    assertEquals(res.status, 200, "janela expirada deveria destravar");
    // Store atualizado com count=1 e window_start novo
    const row = store.get(key);
    assert(row, "linha deve continuar existindo");
    assertEquals(row!.request_count, 1, "contador deve ter resetado para 1");
    assert(
      new Date(row!.window_start).getTime() > new Date(twoHoursAgo).getTime(),
      "window_start deve ter avançado para a chamada atual",
    );
    assertEquals(row!.blocked_until, null, "blocked_until deve limpar após reset");
  } finally {
    stub.restore();
  }
});

Deno.test({ name: "rate-limit: blocked_until ativo devolve 429 sem sequer bater no Champions", sanitizeOps: false, sanitizeResources: false }, async () => {
  const store = new Map<string, RateLimitRow>();
  const key = `${SELLER_ID}:${QUOTE_ID}::quote-sync-promo-champions`;
  const inTenMinutes = new Date(Date.now() + 10 * 60 * 1000).toISOString();
  store.set(key, {
    request_count: 10,
    window_start: new Date().toISOString(),
    blocked_until: inTenMinutes,
  });

  const stub = installFetchStub({
    championsResponse: { status: 200, body: { ok: true } },
    rateLimitStore: store,
  });
  try {
    const res = await handler(buildRequest(baseBody(), { auth: `Bearer ${makeFakeJwt()}` }));
    assertEquals(res.status, 429);
    const j = await res.json();
    assertEquals(j.error, "rate_limit_exceeded");
    assertEquals(j.retry_after, inTenMinutes);
    // Champions NÃO chamado
    assertEquals(stub.captured.length, 0, "Champions não pode ser chamado com bloqueio ativo");
  } finally {
    stub.restore();
  }
});

Deno.test({ name: "correlation_key: 50 chamadas em rajada com mesmo updated_at → todas idênticas", sanitizeOps: false, sanitizeResources: false }, async () => {
  // Simula "clique frenético" — usa store fresh e re-instala stub a cada 10 pra não bater no limit.
  const inputs = { ...baseBody() };
  const expected = `quote:${inputs.quote_id}:sent:${inputs.updated_at}`;

  let totalCalls = 0;
  for (let batch = 0; batch < 5; batch++) {
    // 5 batches × 10 chamadas = 50, cada batch com store limpo (simula janelas independentes)
    const stub = installFetchStub({ championsResponse: { status: 200, body: { ok: true } } });
    try {
      for (let i = 0; i < 10; i++) {
        const res = await handler(buildRequest(inputs, { auth: `Bearer ${makeFakeJwt()}` }));
        await res.text();
        totalCalls++;
      }
      for (const call of stub.captured) {
        assertEquals(
          call.headers["x-correlation-key"],
          expected,
          `correlation_key deve ser determinística em todas as 50 chamadas (falhou na chamada #${totalCalls})`,
        );
        const parsed = JSON.parse(call.body);
        assertEquals(parsed.correlation_key, expected);
      }
    } finally {
      stub.restore();
    }
  }
  assertEquals(totalCalls, 50);
});

Deno.test({ name: "correlation_key: DB.updated_at prevalece sobre body.updated_at (fonte da verdade)", sanitizeOps: false, sanitizeResources: false }, async () => {
  const dbUpdatedAt = "2026-07-06T12:00:00.000Z"; // do defaultQuoteRow
  const stub = installFetchStub({ championsResponse: { status: 200, body: { ok: true } } });
  try {
    // Body manda um updated_at DIFERENTE (cliente desatualizado)
    const staleBody = { ...baseBody(), updated_at: "2020-01-01T00:00:00.000Z" };
    const res = await handler(buildRequest(staleBody, { auth: `Bearer ${makeFakeJwt()}` }));
    assertEquals(res.status, 200);
    const call = stub.captured[0];
    // Deve usar o updated_at do DB, ignorando o body
    assertEquals(
      call.headers["x-correlation-key"],
      `quote:${staleBody.quote_id}:sent:${dbUpdatedAt}`,
      "correlation_key deve derivar do DB, não do body",
    );
  } finally {
    stub.restore();
  }
});
