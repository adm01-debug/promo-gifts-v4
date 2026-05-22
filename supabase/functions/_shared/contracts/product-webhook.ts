/**
 * Contratos do product-webhook (v1 + v2).
 *
 * v1 — espelha exatamente o schema atual em produção (preservação de
 *      retrocompatibilidade com integrações n8n existentes).
 *
 * v2 — adiciona:
 *      - `idempotency_key`  (string 8..128 chars) — evita reprocessamento
 *      - `correlation_id`   (string opcional) — propagação de tracing
 *      - `action: "delete"` continua, "sync" e "batch_upsert" foram fundidos em
 *        "upsert" com `products[]` automático (simplificação)
 *      - validação cruzada: exigir exatamente um de `product` | `products` | `external_ids`
 */

import { z } from "https://esm.sh/zod@3.23.8";

// ---------------------------------------------------------------------------
// Sub-schemas reutilizáveis (espelho do estado atual)
// ---------------------------------------------------------------------------

const ProductPayloadCore = z.object({
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
    .array(z.object({
      name: z.string(),
      hex: z.string(),
      group: z.string().optional(),
    }))
    .max(100)
    .optional(),
  materials: z.array(z.string().max(100)).max(50).optional(),
  tags: z.record(z.array(z.string())).optional(),
  kit_items: z
    .array(z.object({
      productId: z.string(),
      productName: z.string(),
      quantity: z.number(),
      sku: z.string(),
    }))
    .max(50)
    .optional(),
  variations: z.array(z.any()).max(200).optional(),
  metadata: z.record(z.any()).optional(),
});

export type ProductPayload = z.infer<typeof ProductPayloadCore>;

// ---------------------------------------------------------------------------
// v1 — schema atual em produção (preservação 100%)
// ---------------------------------------------------------------------------

export const ProductWebhookV1Schema = z.object({
  action: z.enum(["sync", "upsert", "delete", "batch_upsert"]),
  products: z.array(ProductPayloadCore).max(500).optional(),
  product: ProductPayloadCore.optional(),
  external_ids: z.array(z.string().max(255)).max(500).optional(),
});

export type ProductWebhookV1 = z.infer<typeof ProductWebhookV1Schema>;

// ---------------------------------------------------------------------------
// v2 — idempotency + correlation_id + validação cruzada
// ---------------------------------------------------------------------------

export const ProductWebhookV2Schema = z
  .object({
    action: z.enum(["upsert", "delete"]),
    idempotency_key: z.string().min(8).max(128),
    correlation_id: z.string().max(128).optional(),
    product: ProductPayloadCore.optional(),
    products: z.array(ProductPayloadCore).min(1).max(500).optional(),
    external_ids: z.array(z.string().max(255)).min(1).max(500).optional(),
  })
  .superRefine((d, ctx) => {
    const sources = [d.product, d.products, d.external_ids].filter(Boolean).length;
    if (sources !== 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["product"],
        message:
          "Informe exatamente um de 'product', 'products' ou 'external_ids' (este último apenas em action=delete)",
      });
    }
    if (d.action === "upsert" && d.external_ids) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["external_ids"],
        message: "external_ids só é aceito em action=delete",
      });
    }
  });

export type ProductWebhookV2 = z.infer<typeof ProductWebhookV2Schema>;

// ---------------------------------------------------------------------------
// Manifesto de versões — fonte única de verdade
// ---------------------------------------------------------------------------

export const ProductWebhookVersions = ["v1", "v2"] as const;
export type ProductWebhookVersion = typeof ProductWebhookVersions[number];

export const ProductWebhookSchemaByVersion = {
  v1: ProductWebhookV1Schema,
  v2: ProductWebhookV2Schema,
} as const;
