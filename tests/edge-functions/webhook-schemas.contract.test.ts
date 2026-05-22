/**
 * Contract tests for webhook payload schemas.
 *
 * Every webhook must:
 *   1. Accept the canonical "happy path" payload.
 *   2. Reject payloads with missing required fields.
 *   3. Reject payloads with wrong-typed fields.
 *   4. Reject payloads with empty strings where non-empty is required.
 *   5. Surface the unified 422 error shape (validated via the response builder
 *      tests at validation-errors.test.ts and through-and-through here).
 *
 * The schemas under test are imported from the canonical node mirror at
 * src/lib/webhook-schemas.ts — the Edge Function copy in
 * supabase/functions/_shared/webhook-schemas.ts is verified by the parity
 * test (webhook-schemas-parity.test.ts).
 */
import { describe, expect, it } from "vitest";
import {
  buildValidationError,
  isValidationErrorV1,
  isValidationErrorV2,
  type ValidationErrorV2,
} from "@/lib/validation-errors";
import {
  DispatcherBodySchema,
  InboundWebhookEnvelopeSchema,
  ProductPayloadSchema,
  ProductWebhookPayloadSchema,
} from "@/lib/webhook-schemas";

function expectFail(schema: { safeParse: (v: unknown) => { success: boolean; error?: unknown } }, value: unknown) {
  const r = schema.safeParse(value);
  expect(r.success).toBe(false);
  return (r as { success: false; error: import("zod").ZodError }).error;
}

function expectPass<T>(schema: { safeParse: (v: unknown) => { success: boolean; data?: T } }, value: unknown): T {
  const r = schema.safeParse(value);
  if (!r.success) {
    throw new Error(`expected pass, got: ${JSON.stringify(r)}`);
  }
  return (r as { success: true; data: T }).data;
}

// ============================================================================
// product-webhook: ProductPayloadSchema (single product)
// ============================================================================

describe("ProductPayloadSchema", () => {
  const validProduct = { sku: "ABC-1", name: "Caneca", price: 19.9 };

  it("accepts minimal valid product", () => {
    const data = expectPass(ProductPayloadSchema, validProduct);
    expect(data.sku).toBe("ABC-1");
  });

  it("accepts product with optional fields populated", () => {
    expectPass(ProductPayloadSchema, {
      ...validProduct,
      images: ["https://cdn.example.com/a.jpg"],
      colors: [{ name: "Azul", hex: "#0000ff" }],
      materials: ["plástico"],
      stock: 10,
      is_active: true,
      tags: { theme: ["x", "y"] },
    });
  });

  describe("missing required fields", () => {
    it("rejects when sku is missing", () => {
      const err = expectFail(ProductPayloadSchema, { name: "x", price: 1 });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "sku")).toBeDefined();
      expect(v2.fields.find((f) => f.path === "sku")?.code).toBe("invalid_type");
    });
    it("rejects when name is missing", () => {
      const err = expectFail(ProductPayloadSchema, { sku: "x", price: 1 });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "name")).toBeDefined();
    });
    it("rejects when price is missing", () => {
      const err = expectFail(ProductPayloadSchema, { sku: "x", name: "x" });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "price")).toBeDefined();
    });
  });

  describe("empty values", () => {
    it("rejects empty sku string", () => {
      const err = expectFail(ProductPayloadSchema, { ...validProduct, sku: "" });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "sku")?.code).toBe("too_small");
    });
    it("rejects empty name string", () => {
      const err = expectFail(ProductPayloadSchema, { ...validProduct, name: "" });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "name")?.code).toBe("too_small");
    });
  });

  describe("wrong types", () => {
    it("rejects non-number price", () => {
      const err = expectFail(ProductPayloadSchema, { ...validProduct, price: "19.90" });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "price")?.code).toBe("invalid_type");
    });
    it("rejects negative price", () => {
      const err = expectFail(ProductPayloadSchema, { ...validProduct, price: -1 });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "price")?.code).toBe("too_small");
    });
    it("rejects non-integer min_quantity", () => {
      const err = expectFail(ProductPayloadSchema, { ...validProduct, min_quantity: 1.5 });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "min_quantity")).toBeDefined();
    });
    it("rejects non-URL image", () => {
      const err = expectFail(ProductPayloadSchema, { ...validProduct, images: ["not-a-url"] });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "images.0")).toBeDefined();
    });
    it("rejects too-many images (>50)", () => {
      const tooMany = Array.from({ length: 51 }, (_, i) => `https://x.test/${i}.jpg`);
      const err = expectFail(ProductPayloadSchema, { ...validProduct, images: tooMany });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "images")?.code).toBe("too_big");
    });
  });
});

// ============================================================================
// product-webhook: ProductWebhookPayloadSchema (envelope)
// ============================================================================

describe("ProductWebhookPayloadSchema", () => {
  const product = { sku: "A", name: "x", price: 1 };

  it("accepts action=upsert with single product", () => {
    expectPass(ProductWebhookPayloadSchema, { action: "upsert", product });
  });
  it("accepts action=sync with products array", () => {
    expectPass(ProductWebhookPayloadSchema, { action: "sync", products: [product] });
  });
  it("accepts action=batch_upsert with products array", () => {
    expectPass(ProductWebhookPayloadSchema, { action: "batch_upsert", products: [product] });
  });
  it("accepts action=delete with external_ids", () => {
    expectPass(ProductWebhookPayloadSchema, { action: "delete", external_ids: ["ext-1"] });
  });

  describe("invalid action enum", () => {
    it("rejects unknown action", () => {
      const err = expectFail(ProductWebhookPayloadSchema, { action: "merge", product });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "action")?.code).toBe("invalid_enum_value");
    });
    it("rejects missing action", () => {
      const err = expectFail(ProductWebhookPayloadSchema, { product });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "action")).toBeDefined();
    });
  });

  describe("cross-field rules", () => {
    it("rejects upsert without product", () => {
      const err = expectFail(ProductWebhookPayloadSchema, { action: "upsert" });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "product")).toBeDefined();
    });
    it("rejects sync with empty products array", () => {
      const err = expectFail(ProductWebhookPayloadSchema, { action: "sync", products: [] });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "products")).toBeDefined();
    });
    it("rejects delete with empty external_ids", () => {
      const err = expectFail(ProductWebhookPayloadSchema, { action: "delete", external_ids: [] });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "external_ids")).toBeDefined();
    });
    it("rejects delete with missing external_ids", () => {
      const err = expectFail(ProductWebhookPayloadSchema, { action: "delete" });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "external_ids")).toBeDefined();
    });
  });

  describe("nested product invariants surface through envelope", () => {
    it("propagates product.sku=''", () => {
      const err = expectFail(ProductWebhookPayloadSchema, {
        action: "upsert",
        product: { ...product, sku: "" },
      });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "product.sku")).toBeDefined();
    });
    it("propagates products.2.price negative", () => {
      const err = expectFail(ProductWebhookPayloadSchema, {
        action: "sync",
        products: [product, product, { ...product, price: -10 }],
      });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "products.2.price")).toBeDefined();
    });
  });

  describe("batch size limits", () => {
    it("rejects products array over 500", () => {
      const tooMany = Array.from({ length: 501 }, () => product);
      const err = expectFail(ProductWebhookPayloadSchema, { action: "sync", products: tooMany });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "products")?.code).toBe("too_big");
    });
  });
});

// ============================================================================
// webhook-dispatcher: DispatcherBodySchema
// ============================================================================

describe("DispatcherBodySchema", () => {
  it("accepts minimal valid dispatch", () => {
    expectPass(DispatcherBodySchema, { event: "order.created" });
  });
  it("accepts with payload", () => {
    expectPass(DispatcherBodySchema, { event: "x", payload: { foo: 1 } });
  });
  it("accepts replay mode", () => {
    expectPass(DispatcherBodySchema, {
      event: "x",
      replay_delivery_id: "11111111-1111-4111-8111-111111111111",
    });
  });
  it("accepts test_mode with test_webhook_id", () => {
    expectPass(DispatcherBodySchema, {
      event: "x",
      test_mode: true,
      test_webhook_id: "11111111-1111-4111-8111-111111111111",
    });
  });

  it("rejects empty event", () => {
    const err = expectFail(DispatcherBodySchema, { event: "" });
    const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
    expect(v2.fields.find((f) => f.path === "event")?.code).toBe("too_small");
  });
  it("rejects missing event", () => {
    const err = expectFail(DispatcherBodySchema, {});
    const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
    expect(v2.fields.find((f) => f.path === "event")).toBeDefined();
  });
  it("rejects bad UUID for replay_delivery_id", () => {
    const err = expectFail(DispatcherBodySchema, { event: "x", replay_delivery_id: "not-a-uuid" });
    const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
    expect(v2.fields.find((f) => f.path === "replay_delivery_id")?.code).toBe("invalid_string");
  });
  it("rejects bad UUID for test_webhook_id", () => {
    const err = expectFail(DispatcherBodySchema, {
      event: "x",
      test_mode: true,
      test_webhook_id: "bad",
    });
    const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
    expect(v2.fields.find((f) => f.path === "test_webhook_id")).toBeDefined();
  });
  it("rejects test_mode without test_webhook_id (cross-field)", () => {
    const err = expectFail(DispatcherBodySchema, { event: "x", test_mode: true });
    const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
    expect(v2.fields.find((f) => f.path === "test_webhook_id")?.code).toBe("custom");
  });
  it("rejects non-boolean test_mode", () => {
    const err = expectFail(DispatcherBodySchema, { event: "x", test_mode: "yes" });
    const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
    expect(v2.fields.find((f) => f.path === "test_mode")?.code).toBe("invalid_type");
  });
});

// ============================================================================
// webhook-inbound: InboundWebhookEnvelopeSchema
// ============================================================================

describe("InboundWebhookEnvelopeSchema", () => {
  it("accepts minimal envelope", () => {
    const data = expectPass(InboundWebhookEnvelopeSchema, { slug: "n8n-orders" });
    expect(data.event_type).toBe("unknown");
  });
  it("accepts full envelope with signature", () => {
    expectPass(InboundWebhookEnvelopeSchema, {
      slug: "n8n-orders",
      event_type: "order.created",
      signature: "sha256=" + "a".repeat(64),
    });
  });
  it("accepts raw 64-hex signature without sha256= prefix", () => {
    expectPass(InboundWebhookEnvelopeSchema, {
      slug: "n8n-orders",
      signature: "a".repeat(64),
    });
  });

  describe("invalid slug", () => {
    it("rejects empty slug", () => {
      const err = expectFail(InboundWebhookEnvelopeSchema, { slug: "" });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "slug")?.code).toBe("too_small");
    });
    it("rejects uppercase slug", () => {
      const err = expectFail(InboundWebhookEnvelopeSchema, { slug: "N8N-Orders" });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "slug")?.code).toBe("invalid_string");
    });
    it("rejects slug with spaces", () => {
      const err = expectFail(InboundWebhookEnvelopeSchema, { slug: "n8n orders" });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "slug")).toBeDefined();
    });
    it("rejects slug over 120 chars", () => {
      const err = expectFail(InboundWebhookEnvelopeSchema, { slug: "a".repeat(121) });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "slug")?.code).toBe("too_big");
    });
    it("rejects missing slug", () => {
      const err = expectFail(InboundWebhookEnvelopeSchema, {});
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "slug")).toBeDefined();
    });
  });

  describe("invalid signature", () => {
    it("rejects signature with non-hex chars", () => {
      const err = expectFail(InboundWebhookEnvelopeSchema, {
        slug: "x",
        signature: "sha256=zzzz" + "a".repeat(60),
      });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "signature")).toBeDefined();
    });
    it("rejects signature wrong length", () => {
      const err = expectFail(InboundWebhookEnvelopeSchema, {
        slug: "x",
        signature: "sha256=" + "a".repeat(20),
      });
      const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
      expect(v2.fields.find((f) => f.path === "signature")).toBeDefined();
    });
  });
});

// ============================================================================
// Cross-version compatibility (v1 ↔ v2 migration safety)
// ============================================================================

describe("contract versioning: v1 ↔ v2 backwards compatibility", () => {
  const err = (() => {
    const r = ProductWebhookPayloadSchema.safeParse({ action: "merge" });
    if (r.success) throw new Error("expected fail");
    return r.error;
  })();

  it("v1 and v2 share the same root issue set", () => {
    const v1 = buildValidationError(err, "v1");
    const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
    expect(isValidationErrorV1(v1)).toBe(true);
    expect(isValidationErrorV2(v2)).toBe(true);

    const v1Keys = Object.keys(((v1 as { details: Record<string, unknown> }).details ?? {}) as Record<string, unknown>);
    const v2Paths = v2.fields.map((f) => f.path.split(".")[0]);
    // Every v1 detail key must appear at the root of v2 fields paths.
    for (const k of v1Keys) {
      expect(v2Paths).toContain(k);
    }
  });

  it("v1 is a strict subset of v2 (no semantic regression)", () => {
    // v1 must always be derivable from v2 — we never drop information when
    // upgrading.  This is the contract that lets us deprecate v1 safely.
    const v2 = buildValidationError(err, "v2") as ValidationErrorV2;
    const synthesizedV1Details: Record<string, string[]> = {};
    for (const f of v2.fields) {
      const k = f.path.split(".")[0] || "_form";
      (synthesizedV1Details[k] = synthesizedV1Details[k] || []).push(f.message);
    }
    const v1 = buildValidationError(err, "v1");
    const actualV1Details = (v1 as { details: Record<string, string[]> }).details;
    for (const k of Object.keys(actualV1Details)) {
      expect(Object.keys(synthesizedV1Details)).toContain(k);
    }
  });
});
