/**
 * Contratos do endpoint `product-webhook`.
 *
 * v1 (deprecated): payload legado usado pelo n8n desde 2025-Q1. `price` é
 *   número direto e moeda é implícita BRL.
 * v2 (stable): introduz `price` como objeto `{ amount, currency }`, eliminando
 *   ambiguidade quando o produto vem de fornecedor estrangeiro. Adicionado em
 *   2026-05-22; v1 entra em sunset 2026-08-22.
 *
 * O handler ramifica internamente: para v1, mantém comportamento atual; para
 * v2, mapeia `data.price.amount → productData.price` antes de persistir.
 */

import { z } from "zod";
import type { ContractRegistry } from "./versioning.ts";

// ---------------------------------------------------------------------------
// v1 — schema legado (extraído de product-webhook/index.ts:11-47)
// ---------------------------------------------------------------------------

const ProductPayloadV1 = z.object({
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
    .array(
      z.object({
        name: z.string(),
        hex: z.string(),
        group: z.string().optional(),
      }),
    )
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
  variations: z.array(z.any()).max(200).optional(),
  metadata: z.record(z.any()).optional(),
});

export const WebhookPayloadV1 = z.object({
  action: z.enum(["sync", "upsert", "delete", "batch_upsert"]),
  products: z.array(ProductPayloadV1).max(500).optional(),
  product: ProductPayloadV1.optional(),
  external_ids: z.array(z.string().max(255)).max(500).optional(),
});

// ---------------------------------------------------------------------------
// v2 — preço como objeto { amount, currency }
// ---------------------------------------------------------------------------

const PriceV2 = z.object({
  amount: z.number().nonnegative(),
  currency: z.enum(["BRL", "USD", "EUR"]),
});

const ProductPayloadV2 = ProductPayloadV1.omit({ price: true }).extend({
  price: PriceV2,
});

export const WebhookPayloadV2 = z.object({
  action: z.enum(["sync", "upsert", "delete", "batch_upsert"]),
  products: z.array(ProductPayloadV2).max(500).optional(),
  product: ProductPayloadV2.optional(),
  external_ids: z.array(z.string().max(255)).max(500).optional(),
});

export type WebhookPayloadV1Type = z.infer<typeof WebhookPayloadV1>;
export type WebhookPayloadV2Type = z.infer<typeof WebhookPayloadV2>;

// ---------------------------------------------------------------------------
// Registry versionado
// ---------------------------------------------------------------------------

export const contracts: ContractRegistry<"v1" | "v2"> = {
  v1: {
    schema: WebhookPayloadV1,
    status: "deprecated",
    sunset: "2026-08-22",
    examples: {
      valid: [
        {
          action: "upsert",
          product: { sku: "BRD-001", name: "Caneta", price: 12.5 },
        },
        {
          action: "batch_upsert",
          products: [
            { sku: "BRD-001", name: "Caneta", price: 12.5 },
            { sku: "BRD-002", name: "Caderno", price: 25.0 },
          ],
        },
        { action: "delete", external_ids: ["ext-1", "ext-2"] },
      ],
      invalid: [
        { payload: { action: "foo" }, expectedPath: "action" },
        {
          payload: {
            action: "upsert",
            product: { sku: "", name: "x", price: 1 },
          },
          expectedPath: "product.sku",
        },
        {
          payload: {
            action: "upsert",
            product: { sku: "x", name: "x", price: -5 },
          },
          expectedPath: "product.price",
        },
      ],
    },
  },
  v2: {
    schema: WebhookPayloadV2,
    status: "stable",
    examples: {
      valid: [
        {
          action: "upsert",
          product: {
            sku: "BRD-001",
            name: "Caneta",
            price: { amount: 12.5, currency: "BRL" },
          },
        },
      ],
      invalid: [
        {
          payload: {
            action: "upsert",
            product: { sku: "BRD-001", name: "Caneta", price: 12.5 },
          },
          expectedPath: "product.price",
        },
        {
          payload: {
            action: "upsert",
            product: {
              sku: "BRD-001",
              name: "Caneta",
              price: { amount: 12.5, currency: "JPY" },
            },
          },
          expectedPath: "product.price.currency",
        },
      ],
    },
  },
};
