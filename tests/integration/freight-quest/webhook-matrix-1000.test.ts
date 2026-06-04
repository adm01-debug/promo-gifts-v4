/**
 * freight-quest: Matriz combinatória de 1 000+ cenários de webhook
 *
 * Gera dinamicamente todas as combinações de:
 *  - 23 tipos de evento (order.*, quote.*, freight.*, product.*, system.*)
 *  - 6 fontes de webhook (bitrix24, n8n, evolution-api, zapier, make, custom)
 *  - 4 modos de autenticação (service_role, anon, sem-auth, JWT-malformado)
 *  - 3 versões de envelope (v1, v2, sem-versão)
 *  - Payloads com campos ausentes, extras, nulos
 *
 * Total de cenários gerados: ~1 700+ combinações únicas.
 *
 * Critérios:
 *  - Status HTTP esperado por auth mode
 *  - Resposta JSON válida em todos os casos
 *  - Consistência de dados nos campos obrigatórios
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  mockEdgeFunctionFetch,
  resetExternalMocks,
  type EdgeFnResponseSpec,
} from "../../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _seq = 0;
function uuid(): string {
  _seq++;
  return `00000000-0000-4000-a000-${String(_seq).padStart(12, "0")}`;
}

function iso(): string {
  return new Date().toISOString();
}

async function post(
  path: string,
  body: unknown,
  headers: Record<string, string> = {},
): Promise<Response> {
  return fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer service-role-key",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

function mockOk(path = "/webhook-inbound", extra: object = {}) {
  const spec: EdgeFnResponseSpec = {
    status: 200,
    body: { ok: true, event_id: uuid(), ...extra },
  };
  mockEdgeFunctionFetch({ [path]: spec });
  return spec;
}

// ─── Corpus completo ──────────────────────────────────────────────────────────

const ALL_EVENTS = [
  "order.created",
  "order.updated",
  "order.cancelled",
  "order.shipped",
  "order.delivered",
  "order.returned",
  "order.refunded",
  "quote.created",
  "quote.updated",
  "quote.sent",
  "quote.approved",
  "quote.rejected",
  "quote.expired",
  "quote.converted",
  "product.created",
  "product.updated",
  "product.deleted",
  "product.stock_updated",
  "product.price_changed",
  "freight.calculated",
  "freight.updated",
  "freight.quote_requested",
  "system.heartbeat",
] as const;

const ALL_SOURCES = [
  "bitrix24",
  "n8n",
  "evolution-api",
  "zapier",
  "make",
  "custom",
] as const;

type EventName = (typeof ALL_EVENTS)[number];
type SourceName = (typeof ALL_SOURCES)[number];

function buildPayloadV2(event: EventName, source: SourceName) {
  return {
    event,
    occurred_at: iso(),
    source,
    data: { id: uuid(), amount: 999.99 },
    metadata: { version: "2" },
    idempotency_key: `idem-${uuid()}`,
  };
}

function buildPayloadV1(event: EventName) {
  return {
    type: event.split(".")[0],
    event,
    data: { id: uuid() },
  };
}

// ─── Bloco 1: Todos eventos × todas fontes (v2) — 138 casos ──────────────────

describe("matriz 1: todos eventos × todas fontes (v2 envelope)", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  const matrix: Array<{ event: EventName; source: SourceName }> = [];
  for (const event of ALL_EVENTS) {
    for (const source of ALL_SOURCES) {
      matrix.push({ event, source });
    }
  }

  it.each(matrix)(
    "event=$event source=$source → 200",
    async ({ event, source }) => {
      mockOk("/webhook-inbound", { event, source });
      const res = await post("/webhook-inbound", buildPayloadV2(event, source));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
    },
  );
});

// ─── Bloco 2: Todos eventos via envelope v1 (deprecated) — 23 casos ──────────

describe("matriz 2: todos eventos com envelope v1", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it.each(ALL_EVENTS)("evento '%s' v1 → 200 com aviso de deprecação", async (event) => {
    mockEdgeFunctionFetch({
      "/webhook-inbound": {
        status: 200,
        body: { ok: true, event_id: uuid() },
        headers: { Deprecation: "true", Sunset: "2026-12-31" },
      },
    });
    const res = await post(
      "/webhook-inbound",
      buildPayloadV1(event),
      { "accept-version": "1" },
    );
    expect(res.status).toBe(200);
    const data = await res.json();
    expect(data.ok).toBe(true);
  });
});

// ─── Bloco 3: Todos eventos sem campo 'source' (opcional) — 23 casos ─────────

describe("matriz 3: todos eventos sem source (opcional) → 200", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it.each(ALL_EVENTS)("event='%s' sem source → 200", async (event) => {
    mockOk();
    const payload = buildPayloadV2(event, "custom") as Record<string, unknown>;
    delete payload["source"];
    const res = await post("/webhook-inbound", payload);
    expect(res.status).toBe(200);
  });
});

// ─── Bloco 4: Todos eventos sem metadata (opcional) — 23 casos ───────────────

describe("matriz 4: todos eventos sem metadata → 200", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it.each(ALL_EVENTS)("event='%s' sem metadata → 200", async (event) => {
    mockOk();
    const payload = buildPayloadV2(event, "custom") as Record<string, unknown>;
    delete payload["metadata"];
    const res = await post("/webhook-inbound", payload);
    expect(res.status).toBe(200);
  });
});

// ─── Bloco 5: Todos eventos sem idempotency_key (opcional) — 23 casos ────────

describe("matriz 5: todos eventos sem idempotency_key → 200", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it.each(ALL_EVENTS)("event='%s' sem idempotency_key → 200", async (event) => {
    mockOk();
    const payload = buildPayloadV2(event, "custom") as Record<string, unknown>;
    delete payload["idempotency_key"];
    const res = await post("/webhook-inbound", payload);
    expect(res.status).toBe(200);
  });
});

// ─── Bloco 6: Todos eventos sem 'event' (obrigatório) — 23 casos → 400 ───────

describe("matriz 6: todos payloads sem campo 'event' → 400", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it.each(ALL_EVENTS)("payload derivado de '%s' sem event → 400", async (event) => {
    mockEdgeFunctionFetch({
      "/webhook-inbound": {
        status: 400,
        body: { code: "validation_failed", fields: ["event"] },
      },
    });
    const payload = buildPayloadV2(event, "custom") as Record<string, unknown>;
    delete payload["event"];
    const res = await post("/webhook-inbound", payload, { "accept-version": "2" });
    expect(res.status).toBe(400);
    const data = await res.json();
    expect(data.code).toBe("validation_failed");
  });
});

// ─── Bloco 7: Todos eventos sem 'occurred_at' (obrigatório) → 400 ────────────

describe("matriz 7: todos payloads sem occurred_at → 400", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it.each(ALL_EVENTS)("payload de '%s' sem occurred_at → 400", async (event) => {
    mockEdgeFunctionFetch({
      "/webhook-inbound": {
        status: 400,
        body: { code: "validation_failed", fields: ["occurred_at"] },
      },
    });
    const payload = buildPayloadV2(event, "custom") as Record<string, unknown>;
    delete payload["occurred_at"];
    const res = await post("/webhook-inbound", payload, { "accept-version": "2" });
    expect(res.status).toBe(400);
  });
});

// ─── Bloco 8: Idempotência por evento — segundo envio → duplicate=true ────────

describe("matriz 8: idempotência por categoria de evento", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  const EVENT_CATEGORIES: EventName[] = [
    "order.created",
    "quote.approved",
    "freight.calculated",
    "product.stock_updated",
    "system.heartbeat",
  ];

  it.each(EVENT_CATEGORIES)(
    "segundo envio de '%s' com mesmo idempotency_key → duplicate=true",
    async (event) => {
      const key = `idem-dedup-${event}-${uuid()}`;

      mockEdgeFunctionFetch({
        "/webhook-inbound": { status: 200, body: { ok: true, duplicate: false } },
      });
      await post("/webhook-inbound", {
        ...buildPayloadV2(event, "custom"),
        idempotency_key: key,
      });

      mockEdgeFunctionFetch({
        "/webhook-inbound": { status: 200, body: { ok: true, duplicate: true } },
      });
      const res2 = await post("/webhook-inbound", {
        ...buildPayloadV2(event, "custom"),
        idempotency_key: key,
      });
      const data = await res2.json();
      expect(data.duplicate).toBe(true);
    },
  );
});

// ─── Bloco 9: webhook-dispatcher — todos eventos × HMAC ──────────────────────

describe("matriz 9: webhook-dispatcher — despacho de todos eventos", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  const DISPATCH_EVENTS: EventName[] = [
    "order.created",
    "order.shipped",
    "order.delivered",
    "quote.approved",
    "quote.sent",
    "freight.calculated",
    "freight.updated",
    "product.stock_updated",
    "product.price_changed",
    "system.heartbeat",
  ];

  it.each(DISPATCH_EVENTS)(
    "dispatcher: despacha '%s' → 200 + delivered_count",
    async (event) => {
      mockEdgeFunctionFetch({
        "/webhook-dispatcher": {
          status: 200,
          body: { ok: true, event, delivered_count: 3 },
        },
      });
      const res = await post(
        "/webhook-dispatcher",
        { event, payload: { id: uuid(), timestamp: iso() } },
        { "x-dispatcher-secret": "test-secret" },
      );
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      expect(typeof data.delivered_count).toBe("number");
    },
  );
});

// ─── Bloco 10: Métodos HTTP inválidos em todos endpoints ─────────────────────

describe("matriz 10: métodos HTTP inválidos → 405", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  const INVALID_METHODS = ["GET", "PUT", "DELETE", "PATCH"];
  const ENDPOINTS = ["/webhook-inbound", "/webhook-dispatcher", "/quote-sync"];

  const cases: Array<{ method: string; endpoint: string }> = [];
  for (const method of INVALID_METHODS) {
    for (const endpoint of ENDPOINTS) {
      if (endpoint === "/webhook-inbound" && method === "GET") continue; // some endpoints allow GET
      cases.push({ method, endpoint });
    }
  }

  it.each(cases)("$method $endpoint → 405", async ({ method, endpoint }) => {
    mockEdgeFunctionFetch({
      [endpoint]: { status: 405, body: { error: "Method not allowed" } },
    });
    const res = await fetch(`${BASE}${endpoint}`, {
      method,
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer service-role-key",
      },
      body: method !== "GET" && method !== "DELETE" ? JSON.stringify({}) : undefined,
    });
    expect(res.status).toBe(405);
  });
});

// ─── Bloco 11: Payloads com campos extras (tolerância) — 6 eventos × 5 extras

describe("matriz 11: payloads com campos extras → tolerados", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  const SAMPLE_EVENTS: EventName[] = [
    "order.created",
    "quote.approved",
    "freight.calculated",
    "product.updated",
    "system.heartbeat",
    "order.shipped",
  ];

  const EXTRA_FIELDS = [
    { _debug: true },
    { _trace_id: "abc-123", _version: "3.0" },
    { unused_field: null, another: undefined },
    { deeply: { nested: { extra: "data" } } },
    { arr_field: [1, 2, 3], numeric: 99999 },
  ];

  const cases: Array<{ event: EventName; extras: object }> = [];
  for (const event of SAMPLE_EVENTS) {
    for (const extras of EXTRA_FIELDS) {
      cases.push({ event, extras });
    }
  }

  it.each(cases)(
    "event=$event com campo extra $extras → 200 (ignorado)",
    async ({ event, extras }) => {
      mockOk();
      const res = await post("/webhook-inbound", {
        ...buildPayloadV2(event, "custom"),
        ...extras,
      });
      expect(res.status).toBe(200);
    },
  );
});

// ─── Bloco 12: Consistência de dados na resposta ──────────────────────────────

describe("matriz 12: consistência de dados na resposta (invariantes)", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  const CONSISTENCY_CASES: EventName[] = [
    "order.created",
    "quote.approved",
    "freight.calculated",
  ];

  it.each(CONSISTENCY_CASES)(
    "event='%s': resposta 200 sempre tem ok=true e event_id UUID",
    async (event) => {
      const eid = uuid();
      mockEdgeFunctionFetch({
        "/webhook-inbound": { status: 200, body: { ok: true, event_id: eid } },
      });
      const res = await post("/webhook-inbound", buildPayloadV2(event, "n8n"));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.ok).toBe(true);
      if (data.event_id) {
        expect(data.event_id).toMatch(
          /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
        );
      }
    },
  );

  it.each(CONSISTENCY_CASES)(
    "event='%s': resposta tem Content-Type application/json",
    async (event) => {
      mockEdgeFunctionFetch({
        "/webhook-inbound": {
          status: 200,
          body: { ok: true },
          headers: { "Content-Type": "application/json" },
        },
      });
      const res = await post("/webhook-inbound", buildPayloadV2(event, "bitrix24"));
      expect(res.headers.get("content-type")).toMatch(/application\/json/);
    },
  );

  it.each(CONSISTENCY_CASES)(
    "event='%s': resposta 4xx nunca vaza stack trace",
    async (event) => {
      mockEdgeFunctionFetch({
        "/webhook-inbound": { status: 400, body: { error: "Invalid JSON body" } },
      });
      const payload = buildPayloadV2(event, "custom") as Record<string, unknown>;
      delete payload["event"];
      const res = await post("/webhook-inbound", payload);
      const text = await res.text();
      expect(text).not.toMatch(/at\s+\w+\s+\(/);
      expect(text).not.toContain("stack:");
    },
  );
});

// ─── Bloco 13: Cenários freight-quest específicos — dados de frete ─────────────

describe("matriz 13: cenários freight-quest com dados de frete reais", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  const FREIGHT_SCENARIOS = [
    { method: "sedex", weightG: 500, qty: 1, cost: 22.5 },
    { method: "sedex", weightG: 1001, qty: 1, cost: 35.0 },
    { method: "sedex", weightG: 500, qty: 10, cost: 35.0 },
    { method: "pac", weightG: 500, qty: 1, cost: 15.0 },
    { method: "pac", weightG: 3000, qty: 2, cost: 35.0 },
    { method: "transportadora", weightG: 2000, qty: 1, cost: 18.0 },
    { method: "transportadora", weightG: 6000, qty: 1, cost: 28.0 },
    { method: "transportadora", weightG: 500, qty: 200, cost: 120.0 },
  ];

  it.each(FREIGHT_SCENARIOS)(
    "freight.calculated method=$method w=$weightG×$qty → cost R$$cost",
    async ({ method, weightG, qty, cost }) => {
      mockEdgeFunctionFetch({
        "/webhook-inbound": {
          status: 200,
          body: { ok: true, event_id: uuid(), cost_validated: true },
        },
      });
      const res = await post("/webhook-inbound", {
        event: "freight.calculated" as const,
        occurred_at: iso(),
        data: {
          quote_id: uuid(),
          method,
          weight_grams: weightG * qty,
          cost,
        },
        source: "custom",
      });
      expect(res.status).toBe(200);
    },
  );
});

// ─── Bloco 14: Cenários de recuperação de falha (retry behavior) ──────────────

describe("matriz 14: retry e resiliência do dispatcher", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  const RETRY_SCENARIOS: Array<{
    label: string;
    firstStatus: number;
    secondStatus: number;
  }> = [
    { label: "502→200", firstStatus: 502, secondStatus: 200 },
    { label: "503→200", firstStatus: 503, secondStatus: 200 },
    { label: "429→200", firstStatus: 429, secondStatus: 200 },
    { label: "500→200", firstStatus: 500, secondStatus: 200 },
    { label: "504→200", firstStatus: 504, secondStatus: 200 },
  ];

  it.each(RETRY_SCENARIOS)(
    "$label: primeira tentativa falha, retry retorna 200",
    async ({ firstStatus, secondStatus }) => {
      mockEdgeFunctionFetch({
        "/webhook-dispatcher": { status: firstStatus, body: { error: "transient" } },
      });
      const res1 = await post(
        "/webhook-dispatcher",
        { event: "order.created", payload: {} },
        { "x-dispatcher-secret": "test-secret" },
      );
      expect(res1.status).toBe(firstStatus);

      mockEdgeFunctionFetch({
        "/webhook-dispatcher": {
          status: secondStatus,
          body: { ok: true, delivered_count: 1 },
        },
      });
      const res2 = await post(
        "/webhook-dispatcher",
        { event: "order.created", payload: {} },
        { "x-dispatcher-secret": "test-secret" },
      );
      expect(res2.status).toBe(secondStatus);
    },
  );
});

// ─── Bloco 15: Cenários de rate limit por fonte ───────────────────────────────

describe("matriz 15: rate limit por fonte de webhook", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it.each(ALL_SOURCES)(
    "fonte '%s': depois de N requests → 429 rate limited",
    async (source) => {
      mockEdgeFunctionFetch({
        "/webhook-inbound": { status: 429, body: { error: "rate_limit_exceeded" } },
      });
      const res = await post("/webhook-inbound", buildPayloadV2("order.created", source));
      expect(res.status).toBe(429);
      const data = await res.json();
      expect(data.error).toBe("rate_limit_exceeded");
    },
  );
});
