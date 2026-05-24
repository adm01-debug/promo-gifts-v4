/**
 * supabase/functions/_shared/contracts/schemas/product-webhook.ts
 *
 * Contratos do endpoint `product-webhook`.
 *
 * v1: preserva 100% do schema atual em produção. Aceito por padrão.
 *     Será descontinuado em 2026-08-31.
 *
 * v2: strict — sem campos extras, datas como ISO, IDs externos obrigatórios
 *     em modo upsert/delete, e enum de action enxuto (`upsert | delete | batch_upsert`).
 *     `sync` foi removido: era ambíguo e nunca foi usado em produção.
 */

import { z } from "https://esm.sh/zod@3.23.8";

const JsonPrimitive = z.union([z.string(), z.number(), z.boolean(), z.null()]);
type JsonValue = z.infer<typeof JsonPrimitive> | { [key: string]: JsonValue } | JsonValue[];

const JsonValueSchema: z.ZodType<JsonValue> = z.lazy(() =>
  z.union([
    JsonPrimitive,
    z.array(JsonValueSchema).max(100),
    z.record(z.string().max(100), JsonValueSchema).superRefine((obj, ctx) => {
      if (Object.keys(obj).length > 100) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Object must have at most 100 keys",
        });
      }
    }),
  ])
);

const VariationSchema = z.unknown().superRefine((value, ctx) => {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Variation must be an object" });
    return;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  if (keys.length === 0) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Variation must not be empty" });
  }
  if (keys.length > 30) {
    ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Variation has too many keys" });
  }
  const candidateId = record.id ?? record.external_id ?? record.sku;
  if (typeof candidateId !== "string" || candidateId.trim().length === 0 || candidateId.length > 255) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Variation must include id/external_id/sku as non-empty string up to 255 chars",
    });
  }
});

// ---------------------------------------------------------------------------
// v1 (compatível com produção)
// ---------------------------------------------------------------------------

const ProductV1 = z.object({
  external_id: z.string().max(255).optional(),
  sku: z.string().min(1).max(100),
  name: z.string().min(1).max(500),
  description: z.string().max(5000).optional(),
  price: z.number().nonnegative(),
  min_quantity: z.number().int().positive().optional(),
  category_id: z.number().int().optional(),
  category_name: z.string().max(255).optional(),
  subcategory: z.string().max(255).optional(),
  supplier_id: z.string().max(255).optional(),
  supplier_name: z.string().max(255).optional(),
  stock: z.number().int().nonnegative().optional(),
  stock_status: z.string().max(50).optional(),
  is_kit: z.boolean().optional(),
  is_active: z.boolean().optional(),
  featured: z.boolean().optional(),
  new_arrival: z.boolean().optional(),
  on_sale: z.boolean().optional(),
  images: z.array(z.string().url().max(2000)).max(50).optional(),
  video_url: z.string().url().max(2000).optional().nullable(),
  colors: z
    .array(z.object({ name: z.string(), hex: z.string(), group: z.string().optional() }))
    .max(100)
    .optional(),
  materials: z.array(z.string().max(100)).max(50).optional(),
  tags: z.record(z.array(z.string())).optional(),
  kit_items: z
    .array(
      z.object({
        productId: z.string(),
        productName: z.string(),
        quantity: z.number(),
        sku: z.string(),
      }),
    )
    .max(50)
    .optional(),
  variations: z.array(VariationSchema).max(200).optional(),
  metadata: z.unknown().superRefine((value, ctx) => {
    if (value === undefined) return;
    const parsed = z.record(z.string().max(100), JsonValueSchema).safeParse(value);
    if (!parsed.success) {
      for (const issue of parsed.error.issues) {
        ctx.addIssue(issue);
      }
      return;
    }
    if (Object.keys(parsed.data).length > 100) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "metadata must have at most 100 keys",
      });
    }
  }).optional(),
});

export const ProductWebhookV1 = z.object({
  action: z.enum(["sync", "upsert", "delete", "batch_upsert"]),
  products: z.array(ProductV1).max(500).optional(),
  product: ProductV1.optional(),
  external_ids: z.array(z.string().max(255)).max(500).optional(),
});

// ---------------------------------------------------------------------------
// v2 (strict)
// ---------------------------------------------------------------------------

const ProductV2 = ProductV1
  .extend({
    external_id: z.string().min(1).max(255), // agora OBRIGATÓRIO
    updated_at: z.string().datetime().optional(),
    currency: z.enum(["BRL", "USD", "EUR"]).default("BRL"),
  })
  .strict(); // recusa campos desconhecidos

export const ProductWebhookV2 = z
  .object({
    action: z.enum(["upsert", "delete", "batch_upsert"]),
    products: z.array(ProductV2).max(500).optional(),
    product: ProductV2.optional(),
    external_ids: z.array(z.string().min(1).max(255)).max(500).optional(),
    /** Idempotency key obrigatória em v2. */
    idempotency_key: z.string().uuid(),
  })
  .strict()
  .superRefine((val, ctx) => {
    if (val.action === "delete") {
      if (!val.external_ids || val.external_ids.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["external_ids"],
          message: "external_ids is required when action='delete'",
        });
      }
    } else if (val.action === "upsert") {
      if (!val.product) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["product"],
          message: "product is required when action='upsert'",
        });
      }
    } else if (val.action === "batch_upsert") {
      if (!val.products || val.products.length === 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["products"],
          message: "products[] (non-empty) is required when action='batch_upsert'",
        });
      }
    }
  });

// ---------------------------------------------------------------------------
// Schemas exportados
// ---------------------------------------------------------------------------

export const ProductWebhookSchemas = {
  name: "product-webhook",
  versions: {
    "1": ProductWebhookV1,
    "2": ProductWebhookV2,
  },
  defaultVersion: "1" as const,
  deprecated: [
    {
      version: "1",
      sunset: "2026-08-31",
      migrationUrl:
        "https://github.com/adm01-debug/promo-gifts-v4/blob/main/docs/contracts/MIGRATION_GUIDE.md#product-webhook-v1-v2",
    },
  ],
};

export type ProductWebhookV1Payload = z.infer<typeof ProductWebhookV1>;
export type ProductWebhookV2Payload = z.infer<typeof ProductWebhookV2>;
