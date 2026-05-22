/**
 * Contract tests for the unified validation error builder.
 *
 * The Edge Function source lives at:
 *   supabase/functions/_shared/validation-errors.ts
 *
 * A Node-compatible mirror at src/lib/validation-errors.ts is the one we
 * import here (Vitest runs in Node and cannot resolve Deno https:// imports).
 * Both files are byte-identical except for the Zod import path; the
 * webhook-schemas-parity test below enforces that.
 */
import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  buildValidationError,
  buildValidationErrorV1,
  buildValidationErrorV2,
  detectContractVersion,
  isValidationErrorV1,
  isValidationErrorV2,
  VALIDATION_ERROR_CODE,
  VALIDATION_ERROR_STATUS,
  zodIssuesToFieldErrors,
} from "@/lib/validation-errors";

const sampleSchema = z.object({
  sku: z.string().min(1),
  price: z.number().nonnegative(),
  email: z.string().email(),
});

function failingParse() {
  const r = sampleSchema.safeParse({ sku: "", price: -1, email: "not-an-email" });
  if (r.success) throw new Error("expected parse to fail");
  return r.error;
}

describe("validation-errors / version negotiation", () => {
  it.each([
    ["v1 when no signals", "https://x.test/foo", {}, "v1"],
    ["v2 via query api_version=v2", "https://x.test/foo?api_version=v2", {}, "v2"],
    ["v2 via query version=v2", "https://x.test/foo?version=v2", {}, "v2"],
    ["v2 via header X-API-Version", "https://x.test/foo", { "x-api-version": "v2" }, "v2"],
    ["v2 via header X-API-Version=2", "https://x.test/foo", { "x-api-version": "2" }, "v2"],
    ["v2 via Accept vendor mime", "https://x.test/foo", { accept: "application/vnd.promogifts.v2+json" }, "v2"],
    ["v1 via header X-API-Version=v1", "https://x.test/foo", { "x-api-version": "v1" }, "v1"],
    ["query takes precedence over header", "https://x.test/foo?api_version=v2", { "x-api-version": "v1" }, "v2"],
  ])("returns %s — %s", (_label, url, headerObj, expected) => {
    const req = { url, headers: new Headers(headerObj as Record<string, string>) };
    expect(detectContractVersion(req)).toBe(expected);
  });

  it("ignores malformed URL gracefully", () => {
    const req = { url: "not-a-url", headers: new Headers() };
    expect(detectContractVersion(req)).toBe("v1");
  });
});

describe("validation-errors / v1 builder (legacy)", () => {
  it("emits { error, details } with fieldErrors keyed by path", () => {
    const err = failingParse();
    const payload = buildValidationErrorV1(err);
    expect(payload.error).toBe("Validation failed");
    expect(payload.details).toBeTypeOf("object");
    const details = payload.details as Record<string, string[]>;
    expect(details.sku).toBeDefined();
    expect(details.price).toBeDefined();
    expect(details.email).toBeDefined();
    expect(details.sku[0]).toMatch(/at least 1/i);
  });

  it("falls back to formErrors[] when there are no field errors", () => {
    const schema = z.string().min(5);
    const r = schema.safeParse("ab");
    if (r.success) throw new Error("expected fail");
    const payload = buildValidationErrorV1(r.error);
    expect(payload.error).toBe("Validation failed");
    expect(Array.isArray(payload.details)).toBe(true);
  });
});

describe("validation-errors / v2 builder (canonical)", () => {
  it("emits { code, message, version, fields[] } with stable shape", () => {
    const err = failingParse();
    const payload = buildValidationErrorV2(err);
    expect(payload.code).toBe(VALIDATION_ERROR_CODE);
    expect(payload.version).toBe("v2");
    expect(payload.message).toBe("Validation failed");
    expect(Array.isArray(payload.fields)).toBe(true);
    expect(payload.fields.length).toBe(3);
    for (const f of payload.fields) {
      expect(f).toHaveProperty("path");
      expect(f).toHaveProperty("code");
      expect(f).toHaveProperty("message");
      expect(typeof f.path).toBe("string");
      expect(typeof f.code).toBe("string");
      expect(typeof f.message).toBe("string");
    }
    const paths = payload.fields.map((f) => f.path).sort();
    expect(paths).toEqual(["email", "price", "sku"]);
  });

  it("preserves nested paths using dot notation", () => {
    const nested = z.object({ product: z.object({ sku: z.string().min(1) }) });
    const r = nested.safeParse({ product: { sku: "" } });
    if (r.success) throw new Error("expected fail");
    const payload = buildValidationErrorV2(r.error);
    expect(payload.fields[0].path).toBe("product.sku");
  });

  it("preserves array indices in path", () => {
    const schema = z.object({ images: z.array(z.string().url()).min(1) });
    const r = schema.safeParse({ images: ["not-a-url"] });
    if (r.success) throw new Error("expected fail");
    const payload = buildValidationErrorV2(r.error);
    expect(payload.fields[0].path).toBe("images.0");
  });
});

describe("validation-errors / buildValidationError dispatch", () => {
  const err = failingParse();
  it("returns v1 shape for v1 version", () => {
    const out = buildValidationError(err, "v1");
    expect(isValidationErrorV1(out)).toBe(true);
    expect(isValidationErrorV2(out)).toBe(false);
  });
  it("returns v2 shape for v2 version", () => {
    const out = buildValidationError(err, "v2");
    expect(isValidationErrorV2(out)).toBe(true);
    expect(isValidationErrorV1(out)).toBe(false);
  });
});

describe("validation-errors / contract invariants", () => {
  it("VALIDATION_ERROR_STATUS is 422", () => {
    expect(VALIDATION_ERROR_STATUS).toBe(422);
  });
  it("VALIDATION_ERROR_CODE is 'validation_failed'", () => {
    expect(VALIDATION_ERROR_CODE).toBe("validation_failed");
  });
  it("zodIssuesToFieldErrors keeps issue codes intact", () => {
    const r = z.object({ x: z.number() }).safeParse({ x: "abc" });
    if (r.success) throw new Error("expected fail");
    const fields = zodIssuesToFieldErrors(r.error);
    expect(fields[0].code).toBe("invalid_type");
  });
});
