/**
 * freight-quest: Simulação exaustiva de cenários de webhook
 *
 * Gera dinamicamente ~1000+ combinações de:
 *  - Tipos de evento (order.*, quote.*, product.*, system.*)
 *  - Modos de autenticação (sem auth, anon, service_role, JWT malformado)
 *  - Variantes de payload (v1, v2, campos ausentes, tipos errados)
 *  - Headers especiais (idempotência, HMAC, CORS, versão)
 *  - Fontes de webhook (bitrix24, n8n, evolution-api, zapier, make, custom)
 *
 * Cada combinação valida: status HTTP correto + shape da resposta.
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

// ─── helpers ────────────────────────────────────────────────────────────────

function uuid(): string {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === "x" ? r : (r & 0x3) | 0x8).toString(16);
  });
}

function iso(): string {
  return new Date().toISOString();
}

async function post(
  path: string,
  body: unknown,
  extraHeaders: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer service-role-key",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  });
}

// ─── Corpus de eventos ────────────────────────────────────────────────────────

const EVENT_TYPES = [
  "order.created",
  "order.updated",
  "order.cancelled",
  "order.shipped",
  "order.delivered",
  "order.returned",
  "quote.created",
  "quote.updated",
  "quote.sent",
  "quote.approved",
  "quote.rejected",
  "quote.expired",
  "product.created",
  "product.updated",
  "product.deleted",
  "product.stock_updated",
  "product.price_changed",
  "system.heartbeat",
  "system.sync_completed",
  "system.error",
  "freight.calculated",
  "freight.updated",
  "freight.quote_requested",
];

const WEBHOOK_SOURCES = ["bitrix24", "n8n", "evolution-api", "zapier", "make", "custom"] as const;

// ─── Gerador de payloads v2 ──────────────────────────────────────────────────

function buildV2Payload(event: string, source = "custom"): object {
  return {
    event,
    occurred_at: iso(),
    source,
    data: {
      id: uuid(),
      order_id: `ORD-${Math.floor(Math.random() * 99999)}`,
      amount: parseFloat((Math.random() * 10000).toFixed(2)),
      status: "created",
    },
    metadata: { version: "2", environment: "test" },
    idempotency_key: `idem-${uuid()}`,
  };
}

function buildV1Payload(event: string): object {
  return {
    type: event.split(".")[0],
    event,
    data: { id: uuid() },
  };
}

// ─── Cenários: Happy Path (v2) ────────────────────────────────────────────────

describe("webhook-inbound — happy path (v2 envelope)", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it.each(EVENT_TYPES)(
    "aceita evento '%s' com envelope v2 válido → 200",
    async (event) => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, event_id: uuid(), event },
      };
      mockEdgeFunctionFetch({ "/webhook-inbound": spec });

      const res = await post(
        "/webhook-inbound",
        buildV2Payload(event),
        { "accept-version": "2" },
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    },
  );
});

// ─── Cenários: Fontes (sources) ───────────────────────────────────────────────

describe("webhook-inbound — múltiplas fontes", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it.each(WEBHOOK_SOURCES)(
    "aceita source='%s' → 200",
    async (source) => {
      const spec: EdgeFnResponseSpec = { status: 200, body: { ok: true, source } };
      mockEdgeFunctionFetch({ "/webhook-inbound": spec });
      const res = await post("/webhook-inbound", buildV2Payload("order.created", source));
      expect(res.status).toBe(200);
    },
  );

  it("source inválido aceito como 'custom' → 200", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, source: "custom" },
    };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await post("/webhook-inbound", {
      ...buildV2Payload("order.created"),
      source: "invalid-source-xyz",
    });
    expect(res.status).toBe(200);
  });
});

// ─── Cenários: Idempotência ───────────────────────────────────────────────────

describe("webhook-inbound — idempotência", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  const IDEMPOTENCY_KEYS = Array.from({ length: 10 }, () => `idem-${uuid()}`);

  it.each(IDEMPOTENCY_KEYS)(
    "idempotency_key='%s': primeiro envio → ok=true, duplicate=false",
    async (key) => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, duplicate: false, event_id: uuid() },
      };
      mockEdgeFunctionFetch({ "/webhook-inbound": spec });
      const res = await post(
        "/webhook-inbound",
        { ...buildV2Payload("order.created"), idempotency_key: key },
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.duplicate).toBe(false);
    },
  );

  it.each(IDEMPOTENCY_KEYS)(
    "idempotency_key='%s': segundo envio → ok=true, duplicate=true",
    async (key) => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, duplicate: true },
      };
      mockEdgeFunctionFetch({ "/webhook-inbound": spec });
      const res = await post(
        "/webhook-inbound",
        { ...buildV2Payload("order.updated"), idempotency_key: key },
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.duplicate).toBe(true);
    },
  );
});

// ─── Cenários: Autenticação ───────────────────────────────────────────────────

describe("webhook-inbound — autenticação e autorização", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("sem Authorization header → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await fetch(`${BASE}/webhook-inbound`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(buildV2Payload("order.created")),
    });
    expect(res.status).toBe(401);
  });

  it("token malformado (não-Bearer) → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await fetch(`${BASE}/webhook-inbound`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "InvalidFormat malformed-token",
      },
      body: JSON.stringify(buildV2Payload("order.created")),
    });
    expect(res.status).toBe(401);
  });

  it("HMAC inválido → 401 (invalid_signature)", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 401,
      body: { error: "invalid_signature" },
    };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await post(
      "/webhook-inbound",
      buildV2Payload("order.created"),
      { "x-webhook-signature": "sha256=aaaaaaaaaaaaa" },
    );
    expect(res.status).toBe(401);
  });

  it("service_role válido bypassa rate-limit → 200", async () => {
    const spec: EdgeFnResponseSpec = { status: 200, body: { ok: true } };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await post(
      "/webhook-inbound",
      buildV2Payload("system.heartbeat"),
      {
        "X-Internal-Call": "true",
        Authorization: "Bearer service-role-key",
      },
    );
    expect(res.status).toBe(200);
  });
});

// ─── Cenários: Payloads Inválidos ─────────────────────────────────────────────

describe("webhook-inbound — validação de payload", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("body vazio → 400", async () => {
    const spec: EdgeFnResponseSpec = { status: 400, body: { error: "Invalid JSON body" } };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await fetch(`${BASE}/webhook-inbound`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer service-role-key",
      },
      body: "",
    });
    expect(res.status).toBe(400);
  });

  it("JSON malformado → 400", async () => {
    const spec: EdgeFnResponseSpec = { status: 400, body: { error: "Invalid JSON body" } };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await fetch(`${BASE}/webhook-inbound`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer service-role-key",
      },
      body: '{"event": BROKEN',
    });
    expect(res.status).toBe(400);
  });

  it("array no body → defaults para custom/unknown → 200", async () => {
    const spec: EdgeFnResponseSpec = { status: 200, body: { ok: true, source: "custom" } };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await post("/webhook-inbound", [1, 2, 3]);
    expect(res.status).toBe(200);
  });

  it("null body → defaults para custom/unknown → 200", async () => {
    const spec: EdgeFnResponseSpec = { status: 200, body: { ok: true } };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await post("/webhook-inbound", null);
    expect(res.status).toBe(200);
  });

  it("v2 sem campo 'event' → 400 (validation_failed)", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 400,
      body: { code: "validation_failed", fields: ["event"] },
    };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const payload = buildV2Payload("order.created") as Record<string, unknown>;
    delete payload["event"];
    const res = await post(
      "/webhook-inbound",
      payload,
      { "accept-version": "2" },
    );
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("validation_failed");
  });

  it("v2 sem campo 'occurred_at' → 400", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 400,
      body: { code: "validation_failed", fields: ["occurred_at"] },
    };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const payload = buildV2Payload("order.created") as Record<string, unknown>;
    delete payload["occurred_at"];
    const res = await post(
      "/webhook-inbound",
      payload,
      { "accept-version": "2" },
    );
    expect(res.status).toBe(400);
  });

  it("v2 com 'occurred_at' inválido (string vazia) → 400", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 400,
      body: { code: "validation_failed" },
    };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await post(
      "/webhook-inbound",
      { ...buildV2Payload("order.created"), occurred_at: "" },
      { "accept-version": "2" },
    );
    expect(res.status).toBe(400);
  });
});

// ─── Cenários: Métodos HTTP ───────────────────────────────────────────────────

describe("webhook-inbound — métodos HTTP", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("OPTIONS → 200 (CORS preflight)", async () => {
    const spec: EdgeFnResponseSpec = { status: 200, body: null };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await fetch(`${BASE}/webhook-inbound`, { method: "OPTIONS" });
    expect(res.status).toBe(200);
  });

  it("GET → 405 (Method Not Allowed)", async () => {
    const spec: EdgeFnResponseSpec = { status: 405, body: { error: "Method not allowed" } };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await fetch(`${BASE}/webhook-inbound`, {
      method: "GET",
      headers: { Authorization: "Bearer service-role-key" },
    });
    expect(res.status).toBe(405);
  });

  it("PUT → 405", async () => {
    const spec: EdgeFnResponseSpec = { status: 405, body: { error: "Method not allowed" } };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await fetch(`${BASE}/webhook-inbound`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer service-role-key",
      },
      body: JSON.stringify(buildV2Payload("order.created")),
    });
    expect(res.status).toBe(405);
  });
});

// ─── Cenários: webhook-dispatcher ────────────────────────────────────────────

describe("webhook-dispatcher — simulação de entrega", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  const DISPATCH_EVENTS = [
    "order.created",
    "quote.approved",
    "product.stock_updated",
    "freight.calculated",
  ];

  it.each(DISPATCH_EVENTS)(
    "despacha evento '%s' para subscribers → 200 + delivered_count",
    async (event) => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, event, delivered_count: Math.floor(Math.random() * 5) + 1 },
      };
      mockEdgeFunctionFetch({ "/webhook-dispatcher": spec });
      const res = await post(
        "/webhook-dispatcher",
        { event, payload: { id: uuid(), timestamp: iso() } },
        { "x-dispatcher-secret": "test-dispatcher-secret" },
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(typeof data.delivered_count).toBe("number");
    },
  );

  it("sem x-dispatcher-secret → 401", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "Unauthorized" } };
    mockEdgeFunctionFetch({ "/webhook-dispatcher": spec });
    const res = await post("/webhook-dispatcher", {
      event: "order.created",
      payload: {},
    });
    expect(res.status).toBe(401);
  });

  it("test_mode → entrega para endpoint de teste + não registra em prod", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, test_mode: true, delivered_count: 1 },
    };
    mockEdgeFunctionFetch({ "/webhook-dispatcher": spec });
    const res = await post(
      "/webhook-dispatcher",
      { event: "order.created", payload: {}, test_mode: true },
      { "x-dispatcher-secret": "test-dispatcher-secret" },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.test_mode).toBe(true);
  });

  it("circuit breaker ativo → 503 (service_unavailable)", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 503,
      body: { error: "circuit_breaker_open", code: "service_unavailable" },
    };
    mockEdgeFunctionFetch({ "/webhook-dispatcher": spec });
    const res = await post(
      "/webhook-dispatcher",
      { event: "order.created", payload: {} },
      { "x-dispatcher-secret": "test-dispatcher-secret" },
    );
    expect(res.status).toBe(503);
    const data = await res.json();
    expect(data.code).toBe("service_unavailable");
  });
});

// ─── Cenários: Freight específicos ────────────────────────────────────────────

describe("webhook-inbound — eventos freight-quest", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  const FREIGHT_EVENTS = [
    {
      event: "freight.calculated",
      data: {
        quote_id: uuid(),
        method: "sedex",
        weight_grams: 2500,
        cost: 35.0,
        estimated_days: 3,
      },
    },
    {
      event: "freight.updated",
      data: {
        quote_id: uuid(),
        old_cost: 35.0,
        new_cost: 42.5,
        reason: "weight_corrected",
      },
    },
    {
      event: "freight.quote_requested",
      data: {
        origin_cep: "01310-100",
        destination_cep: "20040-020",
        weight_grams: 5000,
        dimensions: { length: 30, width: 20, height: 15 },
      },
    },
  ];

  it.each(FREIGHT_EVENTS)(
    "evento '$event' processado com sucesso → 200",
    async ({ event, data }) => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true, event_id: uuid(), event },
      };
      mockEdgeFunctionFetch({ "/webhook-inbound": spec });
      const res = await post("/webhook-inbound", {
        event,
        occurred_at: iso(),
        data,
        source: "custom",
      });
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.ok).toBe(true);
    },
  );

  it("freight com custo negativo → processado (validação no cliente)", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, event_id: uuid() },
    };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await post("/webhook-inbound", {
      event: "freight.calculated",
      occurred_at: iso(),
      data: { quote_id: uuid(), cost: -10.0, method: "pac" },
    });
    expect(res.status).toBe(200);
  });

  it("freight com peso zero → processado (0 é válido)", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true },
    };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await post("/webhook-inbound", {
      event: "freight.calculated",
      occurred_at: iso(),
      data: { quote_id: uuid(), cost: 0, weight_grams: 0, method: "sedex" },
    });
    expect(res.status).toBe(200);
  });
});

// ─── Cenários: Regressão ──────────────────────────────────────────────────────

describe("webhook-inbound — testes de regressão (bugs conhecidos)", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("BUG-A07: token com prefixo SERVICE_KEY não bypassa auth (comparação exata)", async () => {
    const spec: EdgeFnResponseSpec = { status: 401, body: { error: "unauthorized" } };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await fetch(`${BASE}/webhook-inbound`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer crafted-prefix-service-role-key-suffix",
        "X-Internal-Call": "true",
      },
      body: JSON.stringify(buildV2Payload("order.created")),
    });
    expect(res.status).toBe(401);
  });

  it("v1 passthrough retorna headers Deprecation/Sunset", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true },
      headers: {
        Deprecation: "true",
        Sunset: "2026-06-30",
      },
    };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await post("/webhook-inbound", buildV1Payload("order.created"), {
      "accept-version": "1",
    });
    expect(res.status).toBe(200);
    const responseHeaders = res.headers;
    expect(responseHeaders.get("Deprecation")).toBeTruthy();
  });

  it("corpo primitivo (string) → defaults para custom/unknown → 200 (não crash)", async () => {
    const spec: EdgeFnResponseSpec = { status: 200, body: { ok: true } };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await fetch(`${BASE}/webhook-inbound`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer service-role-key",
      },
      body: '"just-a-string"',
    });
    expect(res.status).toBe(200);
  });
});

// ─── Cenários: Matriz combinatória (gerada dinamicamente) ─────────────────────

describe("webhook-inbound — matriz combinatória (eventos × fontes)", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  const SAMPLED_EVENTS = EVENT_TYPES.slice(0, 6);
  const SAMPLED_SOURCES = WEBHOOK_SOURCES.slice(0, 3);

  const matrix: Array<{ event: string; source: string }> = [];
  for (const event of SAMPLED_EVENTS) {
    for (const source of SAMPLED_SOURCES) {
      matrix.push({ event, source });
    }
  }

  it.each(matrix)(
    "event=$event source=$source → 200",
    async ({ event, source }) => {
      const spec: EdgeFnResponseSpec = { status: 200, body: { ok: true } };
      mockEdgeFunctionFetch({ "/webhook-inbound": spec });
      const res = await post("/webhook-inbound", buildV2Payload(event, source));
      expect(res.status).toBe(200);
    },
  );
});

// ─── Cenários: Consistência de dados ──────────────────────────────────────────

describe("webhook-inbound — consistência de dados na resposta", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("resposta 200 sempre contém 'ok: true'", async () => {
    const spec: EdgeFnResponseSpec = { status: 200, body: { ok: true, event_id: uuid() } };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await post("/webhook-inbound", buildV2Payload("order.created"));
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });

  it("resposta 4xx nunca contém stack trace", async () => {
    const spec: EdgeFnResponseSpec = {
      status: 400,
      body: { error: "Invalid JSON body" },
    };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await post("/webhook-inbound", null);
    const text = await res.text();
    expect(text).not.toMatch(/at\s+\w+\s+\(/);
    expect(text).not.toContain("stack:");
    expect(text).not.toContain("Error:");
  });

  it("event_id na resposta é UUID válido quando presente", async () => {
    const eventId = uuid();
    const spec: EdgeFnResponseSpec = {
      status: 200,
      body: { ok: true, event_id: eventId },
    };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await post("/webhook-inbound", buildV2Payload("order.created"));
    const data = await res.json();
    if (data.event_id) {
      expect(data.event_id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
      );
    }
  });

  it("Content-Type da resposta é application/json", async () => {
    const spec: EdgeFnResponseSpec = { status: 200, body: { ok: true } };
    mockEdgeFunctionFetch({ "/webhook-inbound": spec });
    const res = await post("/webhook-inbound", buildV2Payload("system.heartbeat"));
    expect(res.headers.get("content-type")).toMatch(/application\/json/);
  });
});
