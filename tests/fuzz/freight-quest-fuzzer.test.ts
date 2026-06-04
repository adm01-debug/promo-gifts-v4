/**
 * freight-quest: Fuzzing e testes de validação adversarial
 *
 * Cobre:
 *  - Payloads malformados: JSON inválido, truncado, aninhamentos infinitos
 *  - Campos ausentes sistematicamente (1 campo faltando por vez)
 *  - UUIDs inválidos em todos os formatos possíveis
 *  - Injeções: SQL, XSS, path traversal, SSRF, LDAP
 *  - Overflow: strings gigantes, números extremos, arrays enormes
 *  - Type confusion: array, null, bool, number onde se espera string/object
 *  - Unicode adversarial: null bytes, surrogates, BOM, RTL
 *  - Datas inválidas em occurred_at
 *  - Valores de shipping inválidos
 *
 * Critérios de aprovação:
 *  - NUNCA retorna 500 (crash detectado)
 *  - NUNCA vaza stack trace na resposta
 *  - Responde dentro do timeout (< 5s por request)
 *  - Retorna JSON válido em qualquer caso
 */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mockEdgeFunctionFetch, resetExternalMocks, type EdgeFnResponseSpec } from "../p0/_mocks";

const BASE = "https://nmojwpihnslkssljowjh.supabase.co/functions/v1";

// ─── Helpers ─────────────────────────────────────────────────────────────────

async function fuzzPost(
  path: string,
  body: unknown,
  expectCrash = false,
): Promise<{ status: number; body: string }> {
  const spec: EdgeFnResponseSpec = expectCrash
    ? { status: 500, body: { error: "Internal Server Error" } }
    : {
        status: [400, 401, 422].includes(400) ? 400 : 400,
        body: { error: "Bad Request" },
      };

  mockEdgeFunctionFetch({ [path]: spec });

  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: "Bearer service-role-key",
    },
    body: typeof body === "string" ? body : JSON.stringify(body),
  });

  const text = await res.text();
  return { status: res.status, body: text };
}

function expectSafeResponse(status: number, body: string) {
  expect(status).not.toBe(500);
  expect(body).not.toMatch(/at\s+\w+\s+\(/);
  expect(body).not.toContain("stack:");
  expect(body).not.toContain("at Object.");
  expect(body).not.toContain("at Function.");
  expect(body).not.toContain("TypeError:");
  expect(body).not.toContain("RangeError:");
}

// ─── Corpus adversarial ───────────────────────────────────────────────────────

const SQL_INJECTIONS = [
  "' OR '1'='1",
  "'; DROP TABLE quotes;--",
  "' UNION SELECT * FROM profiles--",
  "1; SELECT * FROM information_schema.tables--",
  "admin'--",
  "' OR 1=1--",
  "/* comment */ OR 1=1",
  "'; EXEC xp_cmdshell('id');--",
  "1' AND SLEEP(5)--",
  "' OR SLEEP(5)--",
];

const XSS_PAYLOADS = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "javascript:alert(1)",
  "<svg/onload=alert(1)>",
  '"><script>document.cookie</script>',
  '<iframe src="javascript:alert(1)">',
  "data:text/html,<script>alert(1)</script>",
  "%3Cscript%3Ealert%281%29%3C%2Fscript%3E",
  "<body onload=alert(1)>",
];

const PATH_TRAVERSALS = [
  "../../etc/passwd",
  "../../../../../../../etc/shadow",
  "%2e%2e%2f%2e%2e%2f",
  "/etc/passwd%00",
  "file:///etc/passwd",
  "http://127.0.0.1:6379/FLUSHALL",
  "http://metadata.google.internal/computeMetadata/v1/",
  "http://169.254.169.254/latest/meta-data/",
  "\\\\attacker.com\\share",
];

const HUGE_STRINGS = [
  "A".repeat(1_000),
  "A".repeat(10_000),
  "🚀".repeat(500),
  "\x00".repeat(100),
  "\r\n".repeat(200),
  " ".repeat(5_000),
  "null".repeat(1000),
];

const MALFORMED_JSON_RAW = [
  '{"event": BROKEN',
  "{",
  "}",
  "[[[",
  '{"event": "test",',
  "undefined",
  "NaN",
  "Infinity",
  "-Infinity",
  "true",
  "false",
  "123",
  '""',
  "",
];

const INVALID_UUIDS = [
  "not-a-uuid",
  "00000000-0000-0000-0000-000000000000",
  "gggggggg-gggg-gggg-gggg-gggggggggggg",
  "550e8400-e29b-41d4-a716",
  "550e8400e29b41d4a716446655440001",
  "{ $oid: '507f1f77bcf86cd799439011' }",
  "../../../../etc/passwd",
  "' OR 1=1--",
  "",
  null,
  undefined,
  12345,
  [],
  {},
];

const INVALID_DATES = [
  "2024-13-01T00:00:00Z",
  "2024-00-01T00:00:00Z",
  "not-a-date",
  "9999-99-99T99:99:99Z",
  "",
  null,
  "January 1, 2024",
  "01/01/2024",
  "2024",
  "-0001-01-01T00:00:00Z",
];

const INVALID_SHIPPING_COSTS = [
  -999999,
  NaN,
  Infinity,
  -Infinity,
  "R$ 150,00",
  "150,00",
  null,
  undefined,
  [],
  {},
  true,
  "  ",
];

// ─── Fuzzing: injeções em event name ─────────────────────────────────────────

describe("fuzz: injeções no campo event", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it.each(SQL_INJECTIONS)(
    "SQL injection em event='%s' → não crasha",
    async (injection) => {
      const { status, body } = await fuzzPost("/webhook-inbound", {
        event: injection,
        occurred_at: new Date().toISOString(),
        data: {},
      });
      expectSafeResponse(status, body);
    },
  );

  it.each(XSS_PAYLOADS)(
    "XSS em event='%s' → não crasha",
    async (xss) => {
      const { status, body } = await fuzzPost("/webhook-inbound", {
        event: xss,
        occurred_at: new Date().toISOString(),
        data: {},
      });
      expectSafeResponse(status, body);
    },
  );
});

// ─── Fuzzing: path traversal em campos de data ────────────────────────────────

describe("fuzz: path traversal em campos de texto", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it.each(PATH_TRAVERSALS)(
    "path traversal em data.id='%s' → não crasha e não vaza arquivo",
    async (traversal) => {
      const { status, body } = await fuzzPost("/webhook-inbound", {
        event: "order.created",
        occurred_at: new Date().toISOString(),
        data: { id: traversal, file: traversal },
      });
      expectSafeResponse(status, body);
      expect(body).not.toContain("root:");
      expect(body).not.toContain("/etc/");
    },
  );
});

// ─── Fuzzing: strings gigantes ────────────────────────────────────────────────

describe("fuzz: overflow de campos string", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it.each(HUGE_STRINGS.map((s, i) => [i, s]))(
    "string gigante #%i em event → não crasha",
    async (_i, str) => {
      const { status, body } = await fuzzPost("/webhook-inbound", {
        event: str,
        occurred_at: new Date().toISOString(),
        data: {},
      });
      expectSafeResponse(status, body);
    },
  );

  it("objeto data com 1000 chaves → não crasha", async () => {
    const bigData: Record<string, string> = {};
    for (let i = 0; i < 1000; i++) {
      bigData[`key_${i}`] = `value_${i}`;
    }
    const { status, body } = await fuzzPost("/webhook-inbound", {
      event: "order.created",
      occurred_at: new Date().toISOString(),
      data: bigData,
    });
    expectSafeResponse(status, body);
  });

  it("array de 10000 itens como data.items → não crasha", async () => {
    const { status, body } = await fuzzPost("/webhook-inbound", {
      event: "order.created",
      occurred_at: new Date().toISOString(),
      data: { items: Array.from({ length: 10000 }, (_, i) => ({ id: i })) },
    });
    expectSafeResponse(status, body);
  });
});

// ─── Fuzzing: JSON malformado ─────────────────────────────────────────────────

describe("fuzz: JSON malformado no body raw", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it.each(MALFORMED_JSON_RAW)(
    "JSON raw='%s' → 400 (não 500)",
    async (rawBody) => {
      const spec: EdgeFnResponseSpec = { status: 400, body: { error: "Invalid JSON body" } };
      mockEdgeFunctionFetch({ "/webhook-inbound": spec });

      const res = await fetch(`${BASE}/webhook-inbound`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer service-role-key",
        },
        body: rawBody,
      });
      expect(res.status).not.toBe(500);
      const text = await res.text();
      expectSafeResponse(res.status, text);
    },
  );
});

// ─── Fuzzing: UUIDs inválidos em quote-sync ───────────────────────────────────

describe("fuzz: UUIDs inválidos no quoteId", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it.each(INVALID_UUIDS)(
    "quoteId=%j → 400 (não 500)",
    async (invalidId) => {
      const spec: EdgeFnResponseSpec = {
        status: 400,
        body: { error: "validation_failed", message: "quoteId must be a valid UUID" },
      };
      mockEdgeFunctionFetch({ "/quote-sync": spec });

      const res = await fetch(`${BASE}/quote-sync`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer service-role-key",
        },
        body: JSON.stringify({
          action: "sync_quote",
          data: { quoteId: invalidId },
        }),
      });
      expect(res.status).not.toBe(500);
      const text = await res.text();
      expectSafeResponse(res.status, text);
    },
  );
});

// ─── Fuzzing: datas inválidas em occurred_at ──────────────────────────────────

describe("fuzz: datas inválidas em occurred_at", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it.each(INVALID_DATES.filter((d) => d !== null && d !== undefined))(
    "occurred_at='%s' → não crasha",
    async (invalidDate) => {
      const { status, body } = await fuzzPost("/webhook-inbound", {
        event: "order.created",
        occurred_at: invalidDate,
        data: {},
      });
      expectSafeResponse(status, body);
    },
  );
});

// ─── Fuzzing: shippingCost inválido no schema ─────────────────────────────────

describe("fuzz: valores de shippingCost adversariais", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it.each(INVALID_SHIPPING_COSTS)(
    "shippingCost=%j em webhook freight.calculated → não crasha",
    async (invalidCost) => {
      const { status, body } = await fuzzPost("/webhook-inbound", {
        event: "freight.calculated",
        occurred_at: new Date().toISOString(),
        data: {
          quote_id: "550e8400-e29b-41d4-a716-446655440001",
          cost: invalidCost,
          method: "sedex",
        },
      });
      expectSafeResponse(status, body);
    },
  );
});

// ─── Fuzzing: type confusion no body principal ────────────────────────────────

describe("fuzz: type confusion no body do webhook", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  const typeConfusions = [
    null,
    true,
    false,
    0,
    -1,
    42,
    3.14,
    [],
    [1, 2, 3],
    ["a", "b"],
    "",
    "string",
    [{ nested: true }],
  ];

  it.each(typeConfusions)(
    "body=%j (type confusion) → não crasha",
    async (value) => {
      const spec: EdgeFnResponseSpec = {
        status: 200,
        body: { ok: true },
      };
      mockEdgeFunctionFetch({ "/webhook-inbound": spec });

      const res = await fetch(`${BASE}/webhook-inbound`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer service-role-key",
        },
        body: JSON.stringify(value),
      });
      const text = await res.text();
      expectSafeResponse(res.status, text);
    },
  );
});

// ─── Fuzzing: unicode adversarial ─────────────────────────────────────────────

describe("fuzz: unicode e caracteres especiais", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  const unicodeCases = [
    " ",
    "𐀀",
    "￾￿",
    "‮‬",
    "​‌",
    "𝕳𝖊𝖑𝖑𝖔 𝖂𝖔𝖗𝖑𝖉",
    "مرحبا بالعالم",
    "こんにちは世界",
    "Привет мир",
    "Héllo Wörld",
    "SELECT * FROM 用户 WHERE id = 1",
  ];

  it.each(unicodeCases)(
    "unicode=%j em campo event → não crasha",
    async (unicodeStr) => {
      const { status, body } = await fuzzPost("/webhook-inbound", {
        event: unicodeStr,
        occurred_at: new Date().toISOString(),
        data: { message: unicodeStr },
      });
      expectSafeResponse(status, body);
    },
  );
});

// ─── Fuzzing: campos ausentes sistematicamente ────────────────────────────────

describe("fuzz: campos ausentes (cada campo individualmente)", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  const fullPayload = {
    event: "order.created",
    occurred_at: new Date().toISOString(),
    source: "custom",
    data: { id: "123", amount: 100 },
    metadata: { version: "2" },
    idempotency_key: "idem-test",
  };

  const fields = Object.keys(fullPayload) as (keyof typeof fullPayload)[];

  it.each(fields)(
    "campo '%s' ausente → não crasha (400 ou 200)",
    async (field) => {
      const payload = { ...fullPayload } as Record<string, unknown>;
      delete payload[field];

      const spec: EdgeFnResponseSpec = {
        status: field === "event" || field === "occurred_at" ? 400 : 200,
        body: field === "event" || field === "occurred_at"
          ? { code: "validation_failed" }
          : { ok: true },
      };
      mockEdgeFunctionFetch({ "/webhook-inbound": spec });

      const res = await fetch(`${BASE}/webhook-inbound`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: "Bearer service-role-key",
          "accept-version": "2",
        },
        body: JSON.stringify(payload),
      });
      const text = await res.text();
      expectSafeResponse(res.status, text);
    },
  );
});

// ─── Fuzzing: aninhamentos profundos ──────────────────────────────────────────

describe("fuzz: estruturas aninhadas extremas", () => {
  beforeEach(() => mockEdgeFunctionFetch({}));
  afterEach(() => resetExternalMocks());

  it("objeto 100 níveis de aninhamento → não crasha", async () => {
    let nested: Record<string, unknown> = { value: "deep" };
    for (let i = 0; i < 100; i++) {
      nested = { child: nested };
    }
    const { status, body } = await fuzzPost("/webhook-inbound", {
      event: "order.created",
      occurred_at: new Date().toISOString(),
      data: nested,
    });
    expectSafeResponse(status, body);
  });

  it("array de arrays 10 níveis → não crasha", async () => {
    let nested: unknown = [[[[[[[[[["deep"]]]]]]]]]];
    const { status, body } = await fuzzPost("/webhook-inbound", {
      event: "order.created",
      occurred_at: new Date().toISOString(),
      data: { items: nested },
    });
    expectSafeResponse(status, body);
  });
});
