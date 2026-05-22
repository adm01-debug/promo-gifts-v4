/**
 * Canonical Zod schemas for inbound/outbound webhooks.
 *
 * These schemas are imported by both:
 *   - The Edge Functions (Deno runtime) — see product-webhook, webhook-inbound,
 *     webhook-dispatcher.
 *   - The Vitest contract tests (Node runtime), which re-validate every
 *     fixture and assert the unified 422 error shape.
 *
 * Keep this file pure: no Deno-specific globals (Deno.env, etc.) — only
 * Zod schema definitions and types so it can be loaded from any runtime.
 */

import { z } from "https://esm.sh/zod@3.23.8";

// ============================================================================
// product-webhook (inbound from n8n)
// ============================================================================

export const ProductColorSchema = z.object({
  name: z.string(),
  hex: z.string(),
  group: z.string().optional(),
});

export const KitItemSchema = z.object({
  productId: z.string(),
  productName: z.string(),
  quantity: z.number(),
  sku: z.string(),
});

export const ProductPayloadSchema = z.object({
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
  colors: z.array(ProductColorSchema).max(100).optional(),
  materials: z.array(z.string().max(100)).max(50).optional(),
  tags: z.record(z.array(z.string())).optional(),
  kit_items: z.array(KitItemSchema).max(50).optional(),
  variations: z.array(z.any()).max(200).optional(),
  metadata: z.record(z.any()).optional(),
});

export const ProductWebhookPayloadSchema = z.object({
  action: z.enum(["sync", "upsert", "delete", "batch_upsert"]),
  products: z.array(ProductPayloadSchema).max(500).optional(),
  product: ProductPayloadSchema.optional(),
  external_ids: z.array(z.string().max(255)).max(500).optional(),
}).superRefine((val, ctx) => {
  // Cross-field rules.  Keeping them as soft-refine so the basic shape
  // validation continues to surface all individual field errors first.
  if (val.action === "upsert" && !val.product) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["product"],
      message: "product is required for action=upsert",
    });
  }
  if ((val.action === "sync" || val.action === "batch_upsert") && (!val.products || val.products.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["products"],
      message: "products array is required for action=sync|batch_upsert",
    });
  }
  if (val.action === "delete" && (!val.external_ids || val.external_ids.length === 0)) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["external_ids"],
      message: "external_ids array is required for action=delete",
    });
  }
});

export type ProductPayload = z.infer<typeof ProductPayloadSchema>;
export type ProductWebhookPayload = z.infer<typeof ProductWebhookPayloadSchema>;

// ============================================================================
// webhook-dispatcher (outbound trigger)
// ============================================================================

export const DispatcherBodySchema = z.object({
  event: z.string().min(1),
  payload: z.unknown().optional(),
  replay_delivery_id: z.string().uuid().optional(),
  test_mode: z.boolean().optional(),
  test_webhook_id: z.string().uuid().optional(),
}).superRefine((val, ctx) => {
  if (val.test_mode && !val.test_webhook_id) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["test_webhook_id"],
      message: "test_webhook_id is required when test_mode=true",
    });
  }
});

export type DispatcherBody = z.infer<typeof DispatcherBodySchema>;

// ============================================================================
// webhook-inbound (incoming external HMAC-signed webhook)
//
// The body shape itself is intentionally permissive (any JSON object) because
// the function persists arbitrary 3rd-party payloads.  What MUST be validated
// is the routing envelope (slug present, event header present, signature
// header well-formed).
// ============================================================================

export const InboundWebhookEnvelopeSchema = z.object({
  slug: z.string().min(1).max(120).regex(/^[a-z0-9-]+$/, "slug must be kebab-case"),
  event_type: z.string().min(1).max(120).default("unknown"),
  signature: z.string().regex(/^(sha256=)?[a-f0-9]{64}$/i, "signature must be hex sha256, optionally prefixed").optional(),
});

/**
 * Optional body schema for inbound webhooks.  We don't reject unknown JSON
 * (we want to persist it), but we DO assert it parses to an object/array if
 * a Content-Type of application/json was claimed.
 */
export const InboundWebhookBodySchema = z.unknown();

export type InboundWebhookEnvelope = z.infer<typeof InboundWebhookEnvelopeSchema>;
