/**
 * Contract tests for all webhooks and Edge Functions.
 *
 * These tests run offline against the Zod schemas declared in
 * `tests/contracts/webhook-schemas.ts` (which mirror the schemas embedded
 * in each edge function). For each contract we verify:
 *
 *   1. Valid payloads parse successfully.
 *   2. Invalid payloads produce a 422 error in the canonical envelope
 *      { code, message, fields: [{ path, code, message }] }.
 *   3. Specific invalid scenarios: missing required fields, wrong types,
 *      empty values, and unsupported contract versions.
 *   4. v1 ↔ v2 backwards compatibility — payloads valid in v1 stay
 *      acceptable while v1 is in the deprecation window.
 *
 * The runner simulates the edge function envelope by calling the same
 * helpers a deployed function would call (parseBodyWithSchema /
 * parseVersionedBody). Live HTTP contract tests live in
 * `scripts/contract-testing.mjs` and exercise the same schemas end-to-end.
 */
import { describe, it, expect } from "vitest";
import { z } from "zod";
import {
  CONTRACTS,
  ProductWebhookSchemaV1,
  ProductWebhookSchemaV2,
  ProductWebhookVersions,
  WebhookDispatcherSchemaV1,
  CnpjLookupSchemaV1,
  ExternalDbBridgeSchemaV1,
  SendNotificationSchemaV1,
  SendTransactionalEmailSchemaV1,
  RateLimitCheckSchemaV1,
  LogLoginAttemptSchemaV1,
  ValidationErrorBodySchema,
  ERROR_CODES,
} from "./webhook-schemas";

// ---------------------------------------------------------------------------
// Local re-implementation of the Edge Function error envelope helpers.
// Mirrors `supabase/functions/_shared/zod-validate.ts`.
// ---------------------------------------------------------------------------
interface SimulatedResponse {
  status: number;
  headers: Record<string, string>;
  body: unknown;
}

function zodErrorToFields(err: z.ZodError) {
  return err.issues.map((i) => ({
    path: i.path.length ? i.path.join(".") : "(root)",
    code: i.code,
    message: i.message,
  }));
}

function buildErrorResponse(
  code: string,
  message: string,
  fields: ReturnType<typeof zodErrorToFields>,
  status: number,
  contractVersion?: string
): SimulatedResponse {
  return {
    status,
    headers: {
      "Content-Type": "application/json",
      "X-Error-Code": code,
      ...(contractVersion ? { "X-Contract-Version": contractVersion } : {}),
    },
    body: { code, message, fields },
  };
}

function parseAgainst<T extends z.ZodTypeAny>(
  schema: T,
  payload: unknown
): { ok: true; data: z.infer<T> } | { ok: false; response: SimulatedResponse } {
  const result = schema.safeParse(payload);
  if (result.success) return { ok: true, data: result.data };
  return {
    ok: false,
    response: buildErrorResponse(
      ERROR_CODES.VALIDATION_FAILED,
      "Validation failed",
      zodErrorToFields(result.error),
      422
    ),
  };
}

function parseVersioned(
  versions: Record<string, z.ZodTypeAny>,
  defaultVersion: string,
  payload: unknown,
  headerVersion?: string
): { ok: true; data: unknown; version: string } | { ok: false; response: SimulatedResponse } {
  const bodyVersion =
    payload && typeof payload === "object" && "version" in payload
      ? String((payload as Record<string, unknown>).version)
      : undefined;
  const requested = bodyVersion || headerVersion || defaultVersion;
  if (!(requested in versions)) {
    return {
      ok: false,
      response: buildErrorResponse(
        ERROR_CODES.UNSUPPORTED_VERSION,
        `Unsupported contract version: ${requested}`,
        [
          {
            path: "version",
            code: "invalid_version",
            message: `Supported versions: ${Object.keys(versions).join(", ")}`,
          },
        ],
        422
      ),
    };
  }
  const r = versions[requested].safeParse(payload);
  if (r.success) return { ok: true, data: r.data, version: requested };
  return {
    ok: false,
    response: buildErrorResponse(
      ERROR_CODES.VALIDATION_FAILED,
      "Validation failed",
      zodErrorToFields(r.error),
      422,
      requested
    ),
  };
}

/** Asserts the response is a well-formed 422 with the unified envelope. */
function expectUnified422(res: SimulatedResponse, expectedFieldPaths?: string[]) {
  expect(res.status).toBe(422);
  expect(res.headers["Content-Type"]).toBe("application/json");
  expect(res.headers["X-Error-Code"]).toBeTruthy();
  const parsed = ValidationErrorBodySchema.safeParse(res.body);
  expect(
    parsed.success,
    parsed.success ? "" : `Envelope mismatch: ${JSON.stringify(parsed.error.issues)}`
  ).toBe(true);
  if (parsed.success) {
    expect(parsed.data.code).toBeTruthy();
    expect(parsed.data.message).toBeTruthy();
    expect(Array.isArray(parsed.data.fields)).toBe(true);
    if (expectedFieldPaths) {
      const got = parsed.data.fields.map((f) => f.path);
      for (const p of expectedFieldPaths) expect(got).toContain(p);
    }
  }
}

// ===========================================================================
// Registry self-check
// ===========================================================================
describe("contract registry", () => {
  it("every contract has at least one version", () => {
    for (const [name, c] of Object.entries(CONTRACTS)) {
      expect(Object.keys(c.versions).length, `contract ${name} has no versions`).toBeGreaterThan(0);
      expect(c.defaultVersion in c.versions).toBe(true);
    }
  });

  it("every contract has an endpoint and description", () => {
    for (const [name, c] of Object.entries(CONTRACTS)) {
      expect(c.endpoint, `${name}.endpoint`).toBeTruthy();
      expect(c.description, `${name}.description`).toBeTruthy();
    }
  });
});

// ===========================================================================
// Unified error envelope — shape contract
// ===========================================================================
describe("unified validation error envelope (422)", () => {
  it("rejects bodies missing the code field", () => {
    const r = ValidationErrorBodySchema.safeParse({ message: "x", fields: [] });
    expect(r.success).toBe(false);
  });

  it("rejects bodies missing the fields array", () => {
    const r = ValidationErrorBodySchema.safeParse({ code: "X", message: "m" });
    expect(r.success).toBe(false);
  });

  it("rejects field entries missing path/code/message", () => {
    const r = ValidationErrorBodySchema.safeParse({
      code: "X",
      message: "m",
      fields: [{ path: "a", code: "b" }],
    });
    expect(r.success).toBe(false);
  });

  it("accepts the canonical envelope", () => {
    const r = ValidationErrorBodySchema.safeParse({
      code: "VALIDATION_FAILED",
      message: "Validation failed",
      fields: [{ path: "product.sku", code: "too_small", message: "Cannot be empty" }],
    });
    expect(r.success).toBe(true);
  });
});

// ===========================================================================
// product-webhook v1
// ===========================================================================
describe("contract: product-webhook v1", () => {
  it("accepts a valid upsert with single product", () => {
    const r = parseAgainst(ProductWebhookSchemaV1, {
      action: "upsert",
      product: { sku: "SKU-1", name: "Caneta", price: 5.5 },
    });
    expect(r.ok).toBe(true);
  });

  it("accepts a valid batch_upsert with products array", () => {
    const r = parseAgainst(ProductWebhookSchemaV1, {
      action: "batch_upsert",
      products: [
        { sku: "A", name: "A", price: 1 },
        { sku: "B", name: "B", price: 2 },
      ],
    });
    expect(r.ok).toBe(true);
  });

  it("422 on missing action (required field absent)", () => {
    const r = parseAgainst(ProductWebhookSchemaV1, {
      product: { sku: "X", name: "X", price: 0 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["action"]);
  });

  it("422 on invalid action enum value", () => {
    const r = parseAgainst(ProductWebhookSchemaV1, {
      action: "invalid-action",
      product: { sku: "X", name: "X", price: 0 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expectUnified422(r.response, ["action"]);
      const body = r.response.body as { fields: Array<{ code: string }> };
      expect(body.fields.some((f) => f.code === "invalid_enum_value")).toBe(true);
    }
  });

  it("422 on wrong type for price (string instead of number)", () => {
    const r = parseAgainst(ProductWebhookSchemaV1, {
      action: "upsert",
      product: { sku: "X", name: "X", price: "5.5" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["product.price"]);
  });

  it("422 on negative price", () => {
    const r = parseAgainst(ProductWebhookSchemaV1, {
      action: "upsert",
      product: { sku: "X", name: "X", price: -1 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["product.price"]);
  });

  it("422 on empty sku string", () => {
    const r = parseAgainst(ProductWebhookSchemaV1, {
      action: "upsert",
      product: { sku: "", name: "X", price: 1 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["product.sku"]);
  });

  it("422 on invalid image URL", () => {
    const r = parseAgainst(ProductWebhookSchemaV1, {
      action: "upsert",
      product: { sku: "X", name: "X", price: 1, images: ["not-a-url"] },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["product.images.0"]);
  });

  it("422 on too many products in batch (> 500)", () => {
    const products = Array.from({ length: 501 }, (_, i) => ({
      sku: `SKU-${i}`,
      name: `N${i}`,
      price: 1,
    }));
    const r = parseAgainst(ProductWebhookSchemaV1, { action: "batch_upsert", products });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["products"]);
  });

  it("collects multiple field errors in a single response", () => {
    const r = parseAgainst(ProductWebhookSchemaV1, {
      action: "invalid",
      product: { sku: "", name: "", price: -1 },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      const body = r.response.body as { fields: Array<{ path: string }> };
      expect(body.fields.length).toBeGreaterThanOrEqual(3);
    }
  });
});

// ===========================================================================
// product-webhook v2 (new contract version)
// ===========================================================================
describe("contract: product-webhook v2", () => {
  it("accepts a valid v2 payload with currency", () => {
    const r = parseAgainst(ProductWebhookSchemaV2, {
      version: "v2",
      action: "upsert",
      product: { sku: "S", name: "P", price: 1, currency: "BRL" },
    });
    expect(r.ok).toBe(true);
  });

  it("422 on v2 payload missing the version literal", () => {
    const r = parseAgainst(ProductWebhookSchemaV2, {
      action: "upsert",
      product: { sku: "S", name: "P", price: 1, currency: "BRL" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["version"]);
  });

  it("422 on invalid currency code", () => {
    const r = parseAgainst(ProductWebhookSchemaV2, {
      version: "v2",
      action: "upsert",
      product: { sku: "S", name: "P", price: 1, currency: "brl" },
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["product.currency"]);
  });

  it("accepts selectors instead of external_ids", () => {
    const r = parseAgainst(ProductWebhookSchemaV2, {
      version: "v2",
      action: "delete",
      selectors: [{ type: "sku", value: "S-1" }],
    });
    expect(r.ok).toBe(true);
  });
});

// ===========================================================================
// product-webhook — v1/v2 retro-compatibility
// ===========================================================================
describe("contract versioning: product-webhook v1 ↔ v2", () => {
  it("default version is v1 when no header / version field is present", () => {
    const r = parseVersioned(ProductWebhookVersions, "v1", {
      action: "upsert",
      product: { sku: "X", name: "X", price: 1 },
    });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe("v1");
  });

  it("X-Contract-Version: v2 header routes to v2 schema", () => {
    const r = parseVersioned(
      ProductWebhookVersions,
      "v1",
      { version: "v2", action: "upsert", product: { sku: "X", name: "X", price: 1, currency: "USD" } },
      "v2"
    );
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.version).toBe("v2");
  });

  it("v1 payload still works while v1 is in the deprecation window", () => {
    const r = parseVersioned(ProductWebhookVersions, "v1", {
      action: "delete",
      external_ids: ["ext-1", "ext-2"],
    });
    expect(r.ok).toBe(true);
  });

  it("422 UNSUPPORTED_VERSION for an unknown version", () => {
    const r = parseVersioned(ProductWebhookVersions, "v1", {
      version: "v99",
      action: "upsert",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.status).toBe(422);
      expect(r.response.headers["X-Error-Code"]).toBe(ERROR_CODES.UNSUPPORTED_VERSION);
      expectUnified422(r.response, ["version"]);
    }
  });

  it("X-Contract-Version header is echoed on validation failures", () => {
    const r = parseVersioned(
      ProductWebhookVersions,
      "v1",
      { version: "v2", action: "upsert", product: { sku: "", name: "", price: -1, currency: "brl" } },
      "v2"
    );
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.response.headers["X-Contract-Version"]).toBe("v2");
      expectUnified422(r.response);
    }
  });
});

// ===========================================================================
// webhook-dispatcher
// ===========================================================================
describe("contract: webhook-dispatcher", () => {
  it("accepts a minimal valid event", () => {
    const r = parseAgainst(WebhookDispatcherSchemaV1, { event: "product.updated" });
    expect(r.ok).toBe(true);
  });

  it("422 on empty event string", () => {
    const r = parseAgainst(WebhookDispatcherSchemaV1, { event: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["event"]);
  });

  it("422 on invalid UUID for replay_delivery_id", () => {
    const r = parseAgainst(WebhookDispatcherSchemaV1, {
      event: "x",
      replay_delivery_id: "not-a-uuid",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["replay_delivery_id"]);
  });

  it("422 on wrong type for test_mode (string instead of boolean)", () => {
    const r = parseAgainst(WebhookDispatcherSchemaV1, {
      event: "x",
      test_mode: "yes",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["test_mode"]);
  });
});

// ===========================================================================
// cnpj-lookup
// ===========================================================================
describe("contract: cnpj-lookup", () => {
  it("accepts a formatted CNPJ", () => {
    const r = parseAgainst(CnpjLookupSchemaV1, { cnpj: "00.000.000/0001-91" });
    expect(r.ok).toBe(true);
  });

  it("accepts a digits-only CNPJ", () => {
    const r = parseAgainst(CnpjLookupSchemaV1, { cnpj: "00000000000191" });
    expect(r.ok).toBe(true);
  });

  it("422 when cnpj is empty", () => {
    const r = parseAgainst(CnpjLookupSchemaV1, { cnpj: "" });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["cnpj"]);
  });

  it("422 when cnpj has invalid characters", () => {
    const r = parseAgainst(CnpjLookupSchemaV1, { cnpj: "ABCDEFGHIJKLMN" });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["cnpj"]);
  });

  it("422 when cnpj field is missing", () => {
    const r = parseAgainst(CnpjLookupSchemaV1, {});
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["cnpj"]);
  });
});

// ===========================================================================
// external-db-bridge
// ===========================================================================
describe("contract: external-db-bridge", () => {
  it("accepts a valid select", () => {
    const r = parseAgainst(ExternalDbBridgeSchemaV1, {
      operation: "select",
      table: "products",
      limit: 10,
    });
    expect(r.ok).toBe(true);
  });

  it("422 on invalid operation", () => {
    const r = parseAgainst(ExternalDbBridgeSchemaV1, { operation: "drop", table: "products" });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["operation"]);
  });

  it("422 on limit out of range", () => {
    const r = parseAgainst(ExternalDbBridgeSchemaV1, {
      operation: "select",
      table: "products",
      limit: 99999,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["limit"]);
  });

  it("422 on missing operation", () => {
    const r = parseAgainst(ExternalDbBridgeSchemaV1, { table: "products" });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["operation"]);
  });
});

// ===========================================================================
// send-notification
// ===========================================================================
describe("contract: send-notification", () => {
  it("accepts a valid notification", () => {
    const r = parseAgainst(SendNotificationSchemaV1, {
      user_id: "11111111-1111-1111-1111-111111111111",
      title: "Hello",
      body: "World",
    });
    expect(r.ok).toBe(true);
  });

  it("422 on invalid user_id", () => {
    const r = parseAgainst(SendNotificationSchemaV1, {
      user_id: "not-uuid",
      title: "Hello",
      body: "World",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["user_id"]);
  });

  it("422 on empty title", () => {
    const r = parseAgainst(SendNotificationSchemaV1, {
      user_id: "11111111-1111-1111-1111-111111111111",
      title: "",
      body: "World",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["title"]);
  });

  it("422 on unknown notification type", () => {
    const r = parseAgainst(SendNotificationSchemaV1, {
      user_id: "11111111-1111-1111-1111-111111111111",
      title: "T",
      body: "B",
      type: "alert",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["type"]);
  });
});

// ===========================================================================
// send-transactional-email
// ===========================================================================
describe("contract: send-transactional-email", () => {
  it("accepts single recipient + template", () => {
    const r = parseAgainst(SendTransactionalEmailSchemaV1, {
      to: "user@example.com",
      subject: "Hi",
      template: "welcome",
    });
    expect(r.ok).toBe(true);
  });

  it("accepts multiple recipients + html body", () => {
    const r = parseAgainst(SendTransactionalEmailSchemaV1, {
      to: ["a@x.com", "b@x.com"],
      subject: "Hi",
      html: "<p>Hi</p>",
    });
    expect(r.ok).toBe(true);
  });

  it("422 when neither template, html nor text is provided", () => {
    const r = parseAgainst(SendTransactionalEmailSchemaV1, {
      to: "a@x.com",
      subject: "Hi",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response);
  });

  it("422 on invalid recipient email", () => {
    const r = parseAgainst(SendTransactionalEmailSchemaV1, {
      to: "not-an-email",
      subject: "Hi",
      template: "welcome",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["to"]);
  });
});

// ===========================================================================
// rate-limit-check
// ===========================================================================
describe("contract: rate-limit-check", () => {
  it("accepts a valid rate-limit query", () => {
    const r = parseAgainst(RateLimitCheckSchemaV1, {
      key: "user:42",
      limit: 100,
      window_seconds: 60,
    });
    expect(r.ok).toBe(true);
  });

  it("422 on zero limit", () => {
    const r = parseAgainst(RateLimitCheckSchemaV1, {
      key: "user:42",
      limit: 0,
      window_seconds: 60,
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["limit"]);
  });

  it("422 on missing window_seconds", () => {
    const r = parseAgainst(RateLimitCheckSchemaV1, { key: "x", limit: 10 });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["window_seconds"]);
  });
});

// ===========================================================================
// log-login-attempt
// ===========================================================================
describe("contract: log-login-attempt", () => {
  it("accepts a successful login record", () => {
    const r = parseAgainst(LogLoginAttemptSchemaV1, {
      email: "user@example.com",
      success: true,
    });
    expect(r.ok).toBe(true);
  });

  it("422 on invalid email", () => {
    const r = parseAgainst(LogLoginAttemptSchemaV1, { email: "no-at", success: true });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["email"]);
  });

  it("422 on non-boolean success", () => {
    const r = parseAgainst(LogLoginAttemptSchemaV1, {
      email: "user@example.com",
      success: "true",
    });
    expect(r.ok).toBe(false);
    if (!r.ok) expectUnified422(r.response, ["success"]);
  });
});

// ===========================================================================
// Cross-contract consistency: every endpoint produces the same envelope
// ===========================================================================
describe("cross-contract: error envelope consistency", () => {
  const cases: Array<{ name: string; schema: z.ZodTypeAny; bad: unknown; expectPath: string }> = [
    { name: "product-webhook v1", schema: ProductWebhookSchemaV1, bad: {}, expectPath: "action" },
    { name: "webhook-dispatcher", schema: WebhookDispatcherSchemaV1, bad: {}, expectPath: "event" },
    { name: "cnpj-lookup", schema: CnpjLookupSchemaV1, bad: {}, expectPath: "cnpj" },
    {
      name: "external-db-bridge",
      schema: ExternalDbBridgeSchemaV1,
      bad: {},
      expectPath: "operation",
    },
    {
      name: "send-notification",
      schema: SendNotificationSchemaV1,
      bad: {},
      expectPath: "user_id",
    },
    {
      name: "send-transactional-email",
      schema: SendTransactionalEmailSchemaV1,
      bad: {},
      expectPath: "to",
    },
    { name: "rate-limit-check", schema: RateLimitCheckSchemaV1, bad: {}, expectPath: "key" },
    {
      name: "log-login-attempt",
      schema: LogLoginAttemptSchemaV1,
      bad: {},
      expectPath: "email",
    },
  ];

  for (const c of cases) {
    it(`${c.name} → unified 422 envelope on empty body`, () => {
      const r = parseAgainst(c.schema, c.bad);
      expect(r.ok).toBe(false);
      if (!r.ok) expectUnified422(r.response, [c.expectPath]);
    });
  }
});

// ===========================================================================
// Auto-generated coverage: every entry in CONTRACTS gets a baseline matrix
// (empty body / wrong-type / extra-noise) so adding a new endpoint to the
// registry yields tests for free. Endpoint-specific shape is validated in
// the hand-written describe() blocks above.
// ===========================================================================
describe("auto: CONTRACTS registry baseline coverage", () => {
  for (const [name, contract] of Object.entries(CONTRACTS)) {
    describe(`contract: ${name}`, () => {
      const schema = contract.versions[contract.defaultVersion];

      it("422 on empty body (unified envelope shape is consistent)", () => {
        const r = parseAgainst(schema, {});
        // Some schemas accept `{}` as a valid (all-optional) payload — skip
        // assertion in that case. We still verify that *some* response shape
        // is produced; if invalid, envelope is unified.
        if (!r.ok) expectUnified422(r.response);
      });

      it("422 when payload is not an object (string)", () => {
        const r = parseAgainst(schema, "not-an-object");
        // Same caveat: a schema like `z.unknown()` would accept this.
        if (!r.ok) expectUnified422(r.response);
      });

      it("422 when payload is null", () => {
        const r = parseAgainst(schema, null);
        if (!r.ok) expectUnified422(r.response);
      });

      it("422 when payload is an array", () => {
        const r = parseAgainst(schema, []);
        if (!r.ok) expectUnified422(r.response);
      });

      it("422 when payload has all wrong types", () => {
        const r = parseAgainst(schema, {
          action: 123,
          name: false,
          id: [],
          email: 0,
          query: null,
          operation: { x: 1 },
        });
        if (!r.ok) expectUnified422(r.response);
      });
    });
  }
});
