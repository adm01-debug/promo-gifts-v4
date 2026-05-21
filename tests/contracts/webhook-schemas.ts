/**
 * Centralized Zod schemas for webhooks and Edge Functions contracts.
 *
 * These mirror the schemas declared inside each edge function but live in the
 * `tests/` tree so they can be imported by the (Node-based) Vitest contract
 * test suite without needing to load Deno modules.
 *
 * IMPORTANT: When a schema here drifts from the schema in the edge function,
 * the contract test will catch it via the "schema parity" cases below.
 */
import { z } from "zod";

// ===========================================================================
// Reusable primitives (mirror supabase/functions/_shared/zod-validate.ts)
// ===========================================================================
export const uuidSchema = z.string().uuid();
export const nonEmptyString = z.string().trim().min(1, "Cannot be empty");
export const positiveInt = z.number().int().positive();
export const nonNegativeNumber = z.number().nonnegative();
export const emailSchema = z.string().email().max(255);

// ===========================================================================
// Unified validation error envelope
// ===========================================================================
export const ValidationFieldErrorSchema = z.object({
  path: z.string().min(1),
  code: z.string().min(1),
  message: z.string().min(1),
});

export const ValidationErrorBodySchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  fields: z.array(ValidationFieldErrorSchema),
});

export type ValidationErrorBody = z.infer<typeof ValidationErrorBodySchema>;

export const ERROR_CODES = {
  VALIDATION_FAILED: "VALIDATION_FAILED",
  INVALID_JSON: "INVALID_JSON",
  EMPTY_BODY: "EMPTY_BODY",
  UNSUPPORTED_VERSION: "UNSUPPORTED_VERSION",
} as const;

// ===========================================================================
// product-webhook
// ===========================================================================
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
      })
    )
    .max(50)
    .optional(),
  variations: z.array(z.unknown()).max(200).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const ProductWebhookSchemaV1 = z.object({
  action: z.enum(["sync", "upsert", "delete", "batch_upsert"]),
  products: z.array(ProductPayloadV1).max(500).optional(),
  product: ProductPayloadV1.optional(),
  external_ids: z.array(z.string().max(255)).max(500).optional(),
});

/**
 * V2 introduces:
 *   - mandatory `version: "v2"` discriminator
 *   - `currency` ISO-4217 code on the product payload
 *   - replaces `external_ids` (string[]) with a richer `selectors` array
 *
 * V1 must keep working until at least 2026-12-31 (deprecation window).
 */
const ProductPayloadV2 = ProductPayloadV1.extend({
  currency: z.string().regex(/^[A-Z]{3}$/, "Currency must be ISO-4217").default("BRL"),
});

export const ProductWebhookSchemaV2 = z.object({
  version: z.literal("v2"),
  action: z.enum(["sync", "upsert", "delete", "batch_upsert"]),
  products: z.array(ProductPayloadV2).max(500).optional(),
  product: ProductPayloadV2.optional(),
  selectors: z
    .array(
      z.object({
        type: z.enum(["external_id", "sku"]),
        value: z.string().min(1).max(255),
      })
    )
    .max(500)
    .optional(),
});

export const ProductWebhookVersions = {
  v1: ProductWebhookSchemaV1,
  v2: ProductWebhookSchemaV2,
} as const;

// ===========================================================================
// webhook-dispatcher
// ===========================================================================
export const WebhookDispatcherSchemaV1 = z.object({
  event: z.string().min(1),
  payload: z.unknown().optional(),
  replay_delivery_id: z.string().uuid().optional(),
  test_mode: z.boolean().optional(),
  test_webhook_id: z.string().uuid().optional(),
});

// ===========================================================================
// webhook-inbound (query/header driven — body is opaque JSON)
// ===========================================================================
export const WebhookInboundQuerySchema = z.object({
  slug: z.string().min(1).max(120),
});

// ===========================================================================
// cnpj-lookup
// ===========================================================================
export const CnpjLookupSchemaV1 = z.object({
  cnpj: z
    .string()
    .min(11)
    .max(20)
    .regex(/^[\d./-]+$/, "CNPJ must contain only digits and . / -"),
});

// ===========================================================================
// external-db-bridge
// ===========================================================================
export const ExternalDbBridgeSchemaV1 = z.object({
  operation: z.enum(["select", "insert", "update", "delete", "count", "rpc"]),
  table: z.string().min(1).max(120).optional(),
  rpc: z.string().min(1).max(120).optional(),
  filters: z.record(z.unknown()).optional(),
  data: z.record(z.unknown()).optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().nonnegative().optional(),
  order_by: z.string().max(120).optional(),
  ascending: z.boolean().optional(),
});

// ===========================================================================
// send-notification
// ===========================================================================
export const SendNotificationSchemaV1 = z.object({
  user_id: uuidSchema,
  title: nonEmptyString.max(200),
  body: nonEmptyString.max(2000),
  type: z.enum(["info", "success", "warning", "error", "system"]).optional(),
  link: z.string().url().max(2000).optional(),
  metadata: z.record(z.unknown()).optional(),
});

// ===========================================================================
// send-transactional-email
// ===========================================================================
export const SendTransactionalEmailSchemaV1 = z.object({
  to: z.union([emailSchema, z.array(emailSchema).min(1).max(100)]),
  subject: nonEmptyString.max(255),
  template: nonEmptyString.max(120).optional(),
  html: z.string().min(1).max(500_000).optional(),
  text: z.string().min(1).max(500_000).optional(),
  variables: z.record(z.unknown()).optional(),
}).refine((d) => !!(d.template || d.html || d.text), {
  message: "One of template, html or text is required",
  path: ["template"],
});

// ===========================================================================
// rate-limit-check
// ===========================================================================
export const RateLimitCheckSchemaV1 = z.object({
  key: nonEmptyString.max(200),
  limit: positiveInt,
  window_seconds: positiveInt,
});

// ===========================================================================
// log-login-attempt
// ===========================================================================
export const LogLoginAttemptSchemaV1 = z.object({
  email: emailSchema,
  success: z.boolean(),
  ip: z.string().max(64).optional(),
  user_agent: z.string().max(500).optional(),
  reason: z.string().max(255).optional(),
});

// ===========================================================================
// Contract registry — single source of truth for the test runner
// ===========================================================================
export interface ContractDefinition {
  endpoint: string;
  description: string;
  /** Versioned schemas, keyed by `vN`. */
  versions: Record<string, z.ZodTypeAny>;
  defaultVersion: string;
  /** Versions accepted at the wire but slated for removal. */
  deprecatedVersions?: string[];
}

export const CONTRACTS: Record<string, ContractDefinition> = {
  "product-webhook": {
    endpoint: "product-webhook",
    description: "Sync product catalog from n8n / external ERP",
    versions: ProductWebhookVersions,
    defaultVersion: "v1",
    deprecatedVersions: [],
  },
  "webhook-dispatcher": {
    endpoint: "webhook-dispatcher",
    description: "Outbound webhook dispatcher (event fan-out)",
    versions: { v1: WebhookDispatcherSchemaV1 },
    defaultVersion: "v1",
  },
  "cnpj-lookup": {
    endpoint: "cnpj-lookup",
    description: "Brazilian CNPJ company lookup",
    versions: { v1: CnpjLookupSchemaV1 },
    defaultVersion: "v1",
  },
  "external-db-bridge": {
    endpoint: "external-db-bridge",
    description: "Generic bridge to external Postgres",
    versions: { v1: ExternalDbBridgeSchemaV1 },
    defaultVersion: "v1",
  },
  "send-notification": {
    endpoint: "send-notification",
    description: "Push a user notification",
    versions: { v1: SendNotificationSchemaV1 },
    defaultVersion: "v1",
  },
  "send-transactional-email": {
    endpoint: "send-transactional-email",
    description: "Send a transactional email via SMTP/Resend",
    versions: { v1: SendTransactionalEmailSchemaV1 },
    defaultVersion: "v1",
  },
  "rate-limit-check": {
    endpoint: "rate-limit-check",
    description: "Sliding-window rate limit gate",
    versions: { v1: RateLimitCheckSchemaV1 },
    defaultVersion: "v1",
  },
  "log-login-attempt": {
    endpoint: "log-login-attempt",
    description: "Append-only login attempt audit log",
    versions: { v1: LogLoginAttemptSchemaV1 },
    defaultVersion: "v1",
  },
};
