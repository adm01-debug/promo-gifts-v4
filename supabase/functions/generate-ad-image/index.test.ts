import "https://deno.land/std@0.224.0/dotenv/load.ts";
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { z } from "https://deno.land/x/zod@v3.23.8/mod.ts";

// Mirror the schema from the function
const BodySchema = z.object({
  productImageUrl: z.string().url(),
  logoBase64: z.string().optional(),
  logoUrl: z.string().url().optional(),
  productName: z.string().optional(),
  productColor: z.string().optional(),
  techniqueName: z.string().optional(),
  locationName: z.string().optional(),
  scenePrompt: z.string().min(1, "Scene prompt is required"),
  sceneCategory: z.string().optional(),
  brandColorHex: z.string().optional(),
  brandColorName: z.string().optional(),
}).refine((data) => data.logoBase64 || data.logoUrl, {
  message: "Either logoBase64 or logoUrl must be provided",
});

const validBody = {
  productImageUrl: "https://example.com/img.png",
  scenePrompt: "Modern office desk",
  logoBase64: "data:image/png;base64,abc123",
};

function assertPredictableValidationError(
  input: unknown,
  expectedFields: string[] = [],
  expectedFormErrors: string[] = [],
) {
  const result = BodySchema.safeParse(input);
  assertEquals(result.success, false);

  if (result.success) return;

  const flattened = result.error.flatten();
  const normalized = {
    message: "validation_error",
    fields: Object.fromEntries(
      Object.entries(flattened.fieldErrors)
        .filter(([, msgs]) => (msgs?.length ?? 0) > 0)
        .map(([field, msgs]) => [field, msgs]),
    ),
    formErrors: flattened.formErrors,
  };

  assertEquals(normalized.message, "validation_error");
  assertEquals(Object.keys(normalized.fields).sort(), expectedFields.sort());

  for (const formError of expectedFormErrors) {
    assertEquals(normalized.formErrors.includes(formError), true);
  }
}

Deno.test("rejects empty body", () => {
  assertPredictableValidationError({}, ["productImageUrl", "scenePrompt"], [
    "Either logoBase64 or logoUrl must be provided",
  ]);
});

Deno.test("required fields - missing cases", () => {
  const cases: Array<{ name: string; body: Record<string, unknown>; field: string }> = [
    {
      name: "missing productImageUrl",
      body: { scenePrompt: "Office", logoBase64: "abc" },
      field: "productImageUrl",
    },
    {
      name: "missing scenePrompt",
      body: { productImageUrl: "https://example.com/img.png", logoBase64: "abc" },
      field: "scenePrompt",
    },
  ];

  for (const testCase of cases) {
    assertPredictableValidationError(testCase.body, [testCase.field]);
  }
});

Deno.test("required and optional fields - wrong type cases", () => {
  const cases: Array<{ body: Record<string, unknown>; fields: string[] }> = [
    { body: { ...validBody, productImageUrl: 123 }, fields: ["productImageUrl"] },
    { body: { ...validBody, scenePrompt: 999 }, fields: ["scenePrompt"] },
    { body: { ...validBody, logoBase64: 1000 }, fields: ["logoBase64"] },
    { body: { ...validBody, logoUrl: true }, fields: ["logoUrl"] },
    { body: { ...validBody, productName: false }, fields: ["productName"] },
    { body: { ...validBody, productColor: 10 }, fields: ["productColor"] },
    { body: { ...validBody, techniqueName: {} }, fields: ["techniqueName"] },
    { body: { ...validBody, locationName: [] }, fields: ["locationName"] },
    { body: { ...validBody, sceneCategory: 1 }, fields: ["sceneCategory"] },
    { body: { ...validBody, brandColorHex: 2 }, fields: ["brandColorHex"] },
    { body: { ...validBody, brandColorName: 3 }, fields: ["brandColorName"] },
  ];

  for (const testCase of cases) {
    assertPredictableValidationError(testCase.body, testCase.fields);
  }
});

Deno.test("invalid format cases", () => {
  const cases: Array<{ body: Record<string, unknown>; fields: string[] }> = [
    {
      body: { ...validBody, productImageUrl: "not-a-url" },
      fields: ["productImageUrl"],
    },
    {
      body: { ...validBody, logoUrl: "not-a-url" },
      fields: ["logoUrl"],
    },
    {
      body: { ...validBody, scenePrompt: "" },
      fields: ["scenePrompt"],
    },
  ];

  for (const testCase of cases) {
    assertPredictableValidationError(testCase.body, testCase.fields);
  }
});

Deno.test("cross-field rule - rejects when neither logoBase64 nor logoUrl provided", () => {
  assertPredictableValidationError(
    {
      productImageUrl: "https://example.com/img.png",
      scenePrompt: "Office scene",
    },
    [],
    ["Either logoBase64 or logoUrl must be provided"],
  );
});

Deno.test("accepts valid body with logoBase64", () => {
  const result = BodySchema.safeParse({
    ...validBody,
    productName: "Caneca Premium",
    productColor: "Azul",
    techniqueName: "Serigrafia",
    locationName: "Frente",
  });
  assertEquals(result.success, true);
});

Deno.test("accepts valid body with logoUrl", () => {
  const result = BodySchema.safeParse({
    productImageUrl: "https://example.com/img.png",
    scenePrompt: "Coffee shop",
    logoUrl: "https://example.com/logo.png",
    brandColorHex: "#FF5500",
    brandColorName: "Laranja",
  });
  assertEquals(result.success, true);
});

Deno.test("accepts minimal valid body", () => {
  const result = BodySchema.safeParse({
    productImageUrl: "https://example.com/img.png",
    scenePrompt: "A",
    logoBase64: "x",
  });
  assertEquals(result.success, true);
});
