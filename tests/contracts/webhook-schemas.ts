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
// AI / search / image generation
// ===========================================================================
export const AiRecommendationsSchemaV1 = z.object({
  user_context: z.record(z.unknown()).optional(),
  query: z.string().trim().min(1).max(500).optional(),
  limit: z.number().int().min(1).max(50).optional(),
}).refine((d) => !!(d.query || d.user_context), { message: "Provide query or user_context", path: ["query"] });

export const AnalyzeLogoColorsSchemaV1 = z.object({
  imageBase64: z.string().min(10).max(10_000_000),
});

export const BiCopilotSchemaV1 = z.object({
  question: nonEmptyString.max(500),
  context: z.record(z.unknown()).optional(),
  history: z.array(z.object({ role: z.string(), content: z.string() })).max(50).optional(),
});

export const CategoriesApiSchemaV1 = z.object({
  action: z.enum(["tree", "all", "descendants", "products_by_categories"]),
  categoryIds: z.array(uuidSchema).max(200).optional(),
  includeDescendants: z.boolean().optional(),
});

export const CommemorativeDatesSchemaV1 = z.object({
  action: z.enum(["list", "get", "create", "update", "delete"]).default("list"),
  id: uuidSchema.optional(),
  data: z.record(z.unknown()).optional(),
}).partial({ action: true });

export const ComparisonAiAdvisorSchemaV1 = z.object({
  products: z.array(z.object({
    id: z.union([z.string(), z.number()]),
    name: nonEmptyString.max(300),
    price: nonNegativeNumber,
  })).min(2).max(6),
});

export const ElevenLabsTtsSchemaV1 = z.object({
  text: nonEmptyString.max(5000),
  voiceId: z.string().optional(),
});

export const ExpertChatSchemaV1 = z.object({
  message: nonEmptyString.max(4000),
  conversation_id: uuidSchema.optional(),
  context: z.record(z.unknown()).optional(),
});

export const GenerateAdImageSchemaV1 = z.object({
  productImageUrl: z.string().url(),
  scenePrompt: nonEmptyString,
  logoBase64: z.string().optional(),
  logoUrl: z.string().url().optional(),
  productName: z.string().optional(),
  aspectRatio: z.string().optional(),
});

export const GenerateAdPromptSchemaV1 = z.object({
  productName: nonEmptyString.max(255),
  productColor: z.string().max(100).optional(),
  productCategory: z.string().max(100).optional(),
  numberOfPrompts: z.number().int().min(1).max(6).optional(),
});

export const GenerateProductSeoSchemaV1 = z.object({
  product: z.object({
    name: nonEmptyString.max(255),
    sku: z.string().max(100).optional(),
    description: z.string().max(5000).optional(),
  }),
});

export const GenerateMockupSchemaV1 = z.object({
  productImageUrl: z.string().url(),
  logoBase64: z.string().min(10).optional(),
  logoUrl: z.string().url().optional(),
  technique: z.string().max(100).optional(),
}).refine((d) => !!(d.logoBase64 || d.logoUrl), { message: "logoBase64 or logoUrl required", path: ["logoBase64"] });

export const KitAiBuilderSchemaV1 = z.object({
  prompt: nonEmptyString.max(2000),
  budget: nonNegativeNumber.optional(),
  audience: z.string().max(200).optional(),
});

export const KitIdentitySuggestSchemaV1 = z.object({
  name: z.string().max(200).optional(),
  description: z.string().max(500).nullable().optional(),
  items: z.array(z.object({ name: z.string().max(200).optional(), sku: z.string().max(100).optional() })).max(50).optional(),
});

export const MagicUpScoreSchemaV1 = z.object({
  imageUrl: z.string().min(10),
  productName: z.string().nullable().optional(),
  clientName: z.string().nullable().optional(),
  campaignBrief: z.record(z.unknown()).nullable().optional(),
});

export const MaterialsApiSchemaV1 = z.object({
  action: z.enum(["groups", "types", "types_by_group", "product_materials", "products_by_materials", "stats", "search", "complete"]),
  groupId: z.string().max(255).optional(),
  materialId: uuidSchema.optional(),
  limit: z.number().int().min(1).max(500).optional(),
  search: z.string().max(200).optional(),
});

export const SemanticSearchSchemaV1 = z.object({
  query: z.string().trim().min(2).max(500),
  products: z.array(z.object({ id: z.string().min(1) })).max(500).optional(),
  limit: z.number().int().min(1).max(100).optional(),
});

export const VisualSearchSchemaV1 = z.object({
  imageBase64: z.string().min(10).max(10_000_000),
});

export const VoiceAgentSchemaV1 = z.object({
  transcript: nonEmptyString.max(1000),
});

export const MarketIntelligenceSchemaV1 = z.object({
  days: z.number().int().min(1).max(365).optional(),
  productId: uuidSchema.optional(),
  supplierName: z.string().max(255).optional(),
  categoryName: z.string().max(255).optional(),
});

export const TrendsInsightsSchemaV1 = z.object({
  days: z.number().int().min(1).max(365).optional(),
  topic: z.string().max(255).optional(),
});

// ===========================================================================
// Admin / security / audit
// ===========================================================================
export const BlockIpTemporarilySchemaV1 = z.object({
  ip: z.string().min(7).max(45),
  hours: z.number().int().min(1).max(720).optional(),
  reason: z.string().max(500).optional(),
});

export const ConnectionTesterSchemaV1 = z.object({
  action: z.enum(["test", "last_test", "test_history", "last_test_full", "consecutive_failures_overview"]).optional(),
  type: z.enum(["supabase", "bitrix24", "n8n", "mcp", "webhook_outbound"]),
  config: z.record(z.string()).optional(),
  connection_id: uuidSchema.optional(),
  limit: z.number().int().min(1).max(50).optional(),
});

export const CrmDbBridgeSchemaV1 = z.object({
  operation: z.enum(["select", "search", "insert", "update", "delete", "batch"]),
  table: z.string().trim().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/i).optional(),
  id: uuidSchema.optional(),
  filters: z.record(z.unknown()).optional(),
  limit: z.number().int().min(1).max(1000).optional(),
  offset: z.number().int().min(0).optional(),
});

export const DetectNewDeviceSchemaV1 = z.object({
  userId: uuidSchema,
  userEmail: emailSchema,
  deviceInfo: z.object({
    fingerprint: nonEmptyString.max(256),
    userAgent: z.string().max(1024),
    browserName: z.string().max(100),
    osName: z.string().max(100),
    deviceType: z.string().max(50),
  }),
});

export const DropboxListSchemaV1 = z.object({
  path: z.string().max(1000).optional(),
  action: z.enum(["list", "check"]).optional(),
});

export const E2eCleanupSchemaV1 = z.object({
  email: emailSchema.optional(),
  dryRun: z.boolean().optional(),
  sellerScope: z.enum(["self", "explicit"]).optional(),
  sellerId: z.string().optional(),
});

export const ExternalDbInspectSchemaV1 = z.object({
  mode: z.enum(["tables", "columns"]).optional(),
  tableName: z.string().trim().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/i).optional(),
});

export const ForceGlobalLogoutSchemaV1 = z.object({
  confirm: z.literal("FORCE_LOGOUT_ALL"),
  reason: z.string().max(500).optional(),
});

export const FullOpDiagnosticsSchemaV1 = z.object({
  mcp_key_plain: z.string().min(8).max(512).optional(),
  step_up_token: z.string().min(8).max(512).optional(),
  step_up_action: z.string().min(1).max(64).optional(),
  step_up_target_ref: z.string().max(255).nullable().optional(),
});

export const McpKeysIssueSchemaV1 = z.object({
  name: z.string().trim().min(3).max(100),
  scopes: z.array(z.string()).min(1),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  justification: z.string().trim().max(1000).nullable().optional(),
  step_up_token: z.string().min(32).max(256).nullable().optional(),
});

export const McpKeysRevokeSchemaV1 = z.object({
  key_id: uuidSchema,
  reason: z.string().trim().max(500).nullable().optional(),
  step_up_token: z.string().min(32).max(256).nullable().optional(),
});

export const McpKeysRotateSchemaV1 = z.object({
  source_key_id: uuidSchema,
  justification: z.string().trim().max(1000).nullable().optional(),
  confirmation_phrase: z.string().nullable().optional(),
  step_up_token: z.string().min(32).max(256).nullable().optional(),
});

export const Verify2faTokenSchemaV1 = z.object({
  action: z.enum(["verify", "disable"]),
  token: z.string().trim().min(6).max(64).optional(),
  target_user_id: uuidSchema.optional(),
  is_admin_bypass: z.boolean().optional(),
});

export const BulkRandomPasswordsSchemaV1 = z.object({
  mode: z.enum(["dry_run", "apply"]).optional(),
  length: z.number().int().min(8).max(32).optional(),
  includeUpper: z.boolean().optional(),
  includeLower: z.boolean().optional(),
  includeDigits: z.boolean().optional(),
  includeSymbols: z.boolean().optional(),
  excludeEmails: z.array(emailSchema).max(10_000).optional(),
  onlyEmails: z.array(emailSchema).max(10_000).optional(),
  maxUsers: z.number().int().min(1).max(1000).optional(),
  pageSize: z.number().int().min(10).max(500).optional(),
});

export const LoadTestSchemaV1 = z.object({
  concurrency: z.number().int().min(1).max(1000).optional(),
  totalRequests: z.number().int().min(1).max(100_000).optional(),
  targetEndpoint: z.string().min(1).max(255).optional(),
  method: z.enum(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).optional(),
  body: z.unknown().nullable().optional(),
  headers: z.record(z.string()).optional(),
  useIdempotency: z.boolean().optional(),
});

export const McpKeysUpdateSchemaV1 = z.object({
  key_id: uuidSchema,
  name: z.string().trim().min(3).max(100).optional(),
  description: z.string().trim().max(1000).nullable().optional(),
  scopes: z.array(z.string()).min(1).optional(),
  expires_at: z.string().datetime({ offset: true }).nullable().optional(),
  step_up_token: z.string().min(32).max(256).nullable().optional(),
});

export const OwnershipAuditSchemaV1 = z.object({
  triggered_by: z.string().max(64).optional(),
}).passthrough();

export const OwnershipRepairSchemaV1 = z.object({
  dry_run: z.boolean().optional(),
  triggered_by: z.string().max(64).optional(),
  report_id: uuidSchema.nullable().optional(),
});

export const SecretsManagerSchemaV1 = z.object({
  action: z.enum(["list", "set", "delete", "status", "rotate", "rotation_history", "refresh_cache", "cache_metrics", "reset_cache_metrics"]),
  names: z.array(z.string()).optional(),
  name: z.string().optional(),
  value: z.string().optional(),
  notes: z.string().max(500).optional(),
});

export const SimulationOrchestratorSchemaV1 = z.object({
  mode: z.enum(["resilience", "load", "fuzzing"]).optional(),
  duration_ms: z.number().int().min(100).max(600_000).optional(),
  concurrency: z.number().int().min(1).max(100).optional(),
});

export const StepUpVerifySchemaV1 = z.object({
  step: z.enum(["request", "verify_password", "verify_otp"]),
  action: z.string().max(64).nullable().optional(),
  action_label: z.string().max(255).nullable().optional(),
  target_ref: z.string().max(255).nullable().optional(),
  challenge_id: uuidSchema.optional(),
  password: z.string().min(1).max(500).optional(),
  otp: z.string().min(1).max(20).optional(),
});

export const SyncExternalDbSchemaV1 = z.object({
  table: z.string().trim().min(1).max(100).regex(/^[a-z_][a-z0-9_]*$/i),
  direction: z.enum(["to-external", "from-external"]).optional(),
  since: z.string().datetime({ offset: true }).optional(),
});

export const ValidateAccessSchemaV1 = z.object({
  ip: z.string().max(45).optional(),
  userAgent: z.string().max(512).optional(),
}).passthrough();

export const VerifyEmailSchemaV1 = z.object({
  token: nonEmptyString.max(512),
});

// ===========================================================================
// Bitrix / quote sync
// ===========================================================================
export const BitrixSyncSchemaV1 = z.object({
  action: z.enum([
    "get_companies", "get_company", "search_companies",
    "get_deals", "get_deal_products", "sync_full",
    "get_stored_clients", "get_stored_deals",
    "create_deal", "update_deal", "get_sync_logs",
  ]),
  data: z.record(z.unknown()).optional(),
});

export const SyncQuoteBitrixSchemaV1 = z.object({
  quote: z.record(z.unknown()).optional(),
  proposalData: z.record(z.unknown()).optional(),
  pdfUrl: z.string().url().max(2000).optional(),
  filename: z.string().max(500).optional(),
  bitrixCompanyId: z.string().max(50).optional(),
  shippingType: z.string().max(50).optional(),
  shippingCost: nonNegativeNumber.optional(),
  sellerEmail: emailSchema.optional(),
});

// ===========================================================================
// webhook-inbound — body is opaque (validated by HMAC + per-slug schema in DB)
// ===========================================================================
export const WebhookInboundEnvelopeSchemaV1 = z.object({
  // Generic envelope: each registered slug declares its own contract_schema
  // (jsonb in inbound_webhook_endpoints). The HMAC layer guarantees authenticity;
  // payload shape is enforced lazily after lookup. This schema only models the
  // minimum we accept at the transport level — any non-empty JSON object.
}).passthrough();

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


// ===========================================================================
// check-login
// ===========================================================================
export const CheckLoginSchemaV1 = z.object({
  email: z.string().email().max(255).optional(),
  city: z.string().max(100).optional(),
}).passthrough(); // body é opcional — a fn aceita body vazio gracefully

// ===========================================================================
// word-magic
// ===========================================================================
export const WordMagicSchemaV1 = z.object({
  product_id: z.string().uuid('product_id deve ser um UUID válido'),
  force_regenerate: z.boolean().optional().default(false),
});

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
  "check-login": {
    endpoint: "check-login",
    description: "Pre-authentication check — verifica se email/IP pode logar",
    versions: { v1: CheckLoginSchemaV1 },
    defaultVersion: "v1",
  },
  "word-magic": {
    endpoint: "word-magic",
    description: "Geração de copy B2B via IA (DeepSeek) para produtos",
    versions: { v1: WordMagicSchemaV1 },
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
  "webhook-inbound": {
    endpoint: "webhook-inbound",
    description: "Generic inbound webhook (HMAC-signed, per-slug schema in DB)",
    versions: { v1: WebhookInboundEnvelopeSchemaV1 },
    defaultVersion: "v1",
  },
  "ai-recommendations": {
    endpoint: "ai-recommendations",
    description: "Personalized product recommendations",
    versions: { v1: AiRecommendationsSchemaV1 },
    defaultVersion: "v1",
  },
  "analyze-logo-colors": {
    endpoint: "analyze-logo-colors",
    description: "Extract brand palette from a logo image",
    versions: { v1: AnalyzeLogoColorsSchemaV1 },
    defaultVersion: "v1",
  },
  "bi-copilot": {
    endpoint: "bi-copilot",
    description: "Conversational BI assistant",
    versions: { v1: BiCopilotSchemaV1 },
    defaultVersion: "v1",
  },
  "categories-api": {
    endpoint: "categories-api",
    description: "Product categories tree / descendants / lookup",
    versions: { v1: CategoriesApiSchemaV1 },
    defaultVersion: "v1",
  },
  "commemorative-dates": {
    endpoint: "commemorative-dates",
    description: "CRUD for commemorative dates calendar",
    versions: { v1: CommemorativeDatesSchemaV1 },
    defaultVersion: "v1",
  },
  "comparison-ai-advisor": {
    endpoint: "comparison-ai-advisor",
    description: "AI-driven comparison advisor for 2–6 products",
    versions: { v1: ComparisonAiAdvisorSchemaV1 },
    defaultVersion: "v1",
  },
  "elevenlabs-tts": {
    endpoint: "elevenlabs-tts",
    description: "Text-to-speech via ElevenLabs",
    versions: { v1: ElevenLabsTtsSchemaV1 },
    defaultVersion: "v1",
  },
  "expert-chat": {
    endpoint: "expert-chat",
    description: "Internal expert chat assistant",
    versions: { v1: ExpertChatSchemaV1 },
    defaultVersion: "v1",
  },
  "generate-ad-image": {
    endpoint: "generate-ad-image",
    description: "Generate an ad image from product + brand kit",
    versions: { v1: GenerateAdImageSchemaV1 },
    defaultVersion: "v1",
  },
  "generate-ad-prompt": {
    endpoint: "generate-ad-prompt",
    description: "Compose ad prompts for image generation",
    versions: { v1: GenerateAdPromptSchemaV1 },
    defaultVersion: "v1",
  },
  "generate-product-seo": {
    endpoint: "generate-product-seo",
    description: "Generate SEO copy for a product",
    versions: { v1: GenerateProductSeoSchemaV1 },
    defaultVersion: "v1",
  },
  "generate-mockup": {
    endpoint: "generate-mockup",
    description: "Compose a product mockup with applied logo",
    versions: { v1: GenerateMockupSchemaV1 },
    defaultVersion: "v1",
  },
  "kit-ai-builder": {
    endpoint: "kit-ai-builder",
    description: "AI-driven gift kit builder",
    versions: { v1: KitAiBuilderSchemaV1 },
    defaultVersion: "v1",
  },
  "kit-identity-suggest": {
    endpoint: "kit-identity-suggest",
    description: "Suggest a name/identity for a gift kit",
    versions: { v1: KitIdentitySuggestSchemaV1 },
    defaultVersion: "v1",
  },
  "magic-up-score": {
    endpoint: "magic-up-score",
    description: "Score an uploaded creative asset",
    versions: { v1: MagicUpScoreSchemaV1 },
    defaultVersion: "v1",
  },
  "materials-api": {
    endpoint: "materials-api",
    description: "Product materials catalog / lookup",
    versions: { v1: MaterialsApiSchemaV1 },
    defaultVersion: "v1",
  },
  "semantic-search": {
    endpoint: "semantic-search",
    description: "Semantic search over the product catalog",
    versions: { v1: SemanticSearchSchemaV1 },
    defaultVersion: "v1",
  },
  "visual-search": {
    endpoint: "visual-search",
    description: "Reverse-image search over the product catalog",
    versions: { v1: VisualSearchSchemaV1 },
    defaultVersion: "v1",
  },
  "voice-agent": {
    endpoint: "voice-agent",
    description: "Voice → intent transcription / action",
    versions: { v1: VoiceAgentSchemaV1 },
    defaultVersion: "v1",
  },
  "market-intelligence-insights": {
    endpoint: "market-intelligence-insights",
    description: "Aggregated sales/market intelligence insights",
    versions: { v1: MarketIntelligenceSchemaV1 },
    defaultVersion: "v1",
  },
  "trends-insights": {
    endpoint: "trends-insights",
    description: "Trend insights over the catalog/sales",
    versions: { v1: TrendsInsightsSchemaV1 },
    defaultVersion: "v1",
  },
  "block-ip-temporarily": {
    endpoint: "block-ip-temporarily",
    description: "Add an IP to the temporary block list",
    versions: { v1: BlockIpTemporarilySchemaV1 },
    defaultVersion: "v1",
  },
  "connection-tester": {
    endpoint: "connection-tester",
    description: "Diagnose connectivity for outbound integrations",
    versions: { v1: ConnectionTesterSchemaV1 },
    defaultVersion: "v1",
  },
  "crm-db-bridge": {
    endpoint: "crm-db-bridge",
    description: "Bridge to the CRM database (Bitrix-backed)",
    versions: { v1: CrmDbBridgeSchemaV1 },
    defaultVersion: "v1",
  },
  "detect-new-device": {
    endpoint: "detect-new-device",
    description: "Detect a previously-unseen device on login",
    versions: { v1: DetectNewDeviceSchemaV1 },
    defaultVersion: "v1",
  },
  "dropbox-list": {
    endpoint: "dropbox-list",
    description: "List files from the connected Dropbox account",
    versions: { v1: DropboxListSchemaV1 },
    defaultVersion: "v1",
  },
  "e2e-cleanup": {
    endpoint: "e2e-cleanup",
    description: "Cleanup helper for end-to-end test fixtures",
    versions: { v1: E2eCleanupSchemaV1 },
    defaultVersion: "v1",
  },
  "external-db-inspect": {
    endpoint: "external-db-inspect",
    description: "Inspect tables/columns on the external Postgres",
    versions: { v1: ExternalDbInspectSchemaV1 },
    defaultVersion: "v1",
  },
  "force-global-logout": {
    endpoint: "force-global-logout",
    description: "Force every session to log out (admin)",
    versions: { v1: ForceGlobalLogoutSchemaV1 },
    defaultVersion: "v1",
  },
  "full-op-diagnostics": {
    endpoint: "full-op-diagnostics",
    description: "End-to-end operational diagnostics",
    versions: { v1: FullOpDiagnosticsSchemaV1 },
    defaultVersion: "v1",
  },
  "mcp-keys-issue": {
    endpoint: "mcp-keys-issue",
    description: "Issue a new MCP API key (admin + step-up)",
    versions: { v1: McpKeysIssueSchemaV1 },
    defaultVersion: "v1",
  },
  "mcp-keys-revoke": {
    endpoint: "mcp-keys-revoke",
    description: "Revoke an MCP API key (admin + step-up)",
    versions: { v1: McpKeysRevokeSchemaV1 },
    defaultVersion: "v1",
  },
  "mcp-keys-rotate": {
    endpoint: "mcp-keys-rotate",
    description: "Rotate an MCP API key (admin + step-up)",
    versions: { v1: McpKeysRotateSchemaV1 },
    defaultVersion: "v1",
  },
  "mcp-keys-update": {
    endpoint: "mcp-keys-update",
    description: "Update scopes/expiry on an MCP API key",
    versions: { v1: McpKeysUpdateSchemaV1 },
    defaultVersion: "v1",
  },
  "ownership-audit": {
    endpoint: "ownership-audit",
    description: "Audit ownership of records vs. business rules",
    versions: { v1: OwnershipAuditSchemaV1 },
    defaultVersion: "v1",
  },
  "ownership-repair": {
    endpoint: "ownership-repair",
    description: "Repair ownership drift detected by the audit",
    versions: { v1: OwnershipRepairSchemaV1 },
    defaultVersion: "v1",
  },
  "secrets-manager": {
    endpoint: "secrets-manager",
    description: "Manage runtime secrets (rotate, list, status)",
    versions: { v1: SecretsManagerSchemaV1 },
    defaultVersion: "v1",
  },
  "simulation-orchestrator": {
    endpoint: "simulation-orchestrator",
    description: "Run resilience/load/fuzz simulations",
    versions: { v1: SimulationOrchestratorSchemaV1 },
    defaultVersion: "v1",
  },
  "step-up-verify": {
    endpoint: "step-up-verify",
    description: "Multi-step elevated auth (password + OTP)",
    versions: { v1: StepUpVerifySchemaV1 },
    defaultVersion: "v1",
  },
  "verify-2fa-token": {
    endpoint: "verify-2fa-token",
    description: "Server-side TOTP verification (verify/disable) — keeps totp_secret server-only",
    versions: { v1: Verify2faTokenSchemaV1 },
    defaultVersion: "v1",
  },
  "bulk-random-passwords": {
    endpoint: "bulk-random-passwords",
    description: "Generate and rotate random passwords for bulk users (admin, dry_run/apply)",
    versions: { v1: BulkRandomPasswordsSchemaV1 },
    defaultVersion: "v1",
  },
  "load-test": {
    endpoint: "load-test",
    description: "Synthetic load harness — fans out N concurrent requests to a target endpoint",
    versions: { v1: LoadTestSchemaV1 },
    defaultVersion: "v1",
  },
  "sync-external-db": {
    endpoint: "sync-external-db",
    description: "Bidirectional sync with the external Postgres",
    versions: { v1: SyncExternalDbSchemaV1 },
    defaultVersion: "v1",
  },
  "validate-access": {
    endpoint: "validate-access",
    description: "Validate session/IP/geo access policy",
    versions: { v1: ValidateAccessSchemaV1 },
    defaultVersion: "v1",
  },
  "verify-email": {
    endpoint: "verify-email",
    description: "Verify an email confirmation token",
    versions: { v1: VerifyEmailSchemaV1 },
    defaultVersion: "v1",
  },
  "bitrix-sync": {
    endpoint: "bitrix-sync",
    description: "Bitrix CRM sync — companies, deals, products",
    versions: { v1: BitrixSyncSchemaV1 },
    defaultVersion: "v1",
  },
  "sync-quote-bitrix": {
    endpoint: "sync-quote-bitrix",
    description: "Push a quote/proposal to Bitrix as a deal",
    versions: { v1: SyncQuoteBitrixSchemaV1 },
    defaultVersion: "v1",
  },
};

// ===========================================================================
// Coverage exempt-list — Edge Functions that legitimately do not accept a body
// (GET-only health checks, scheduled cron workers triggered by Supabase, etc).
// These are excluded by `scripts/check-contract-coverage.mjs`.
// ===========================================================================
export const NO_BODY_EXEMPT: ReadonlySet<string> = new Set<string>([
  "_shared",
  "tests",
  "cleanup-notifications",
  "cleanup-novelties",
  "collections-watcher",
  "comparison-price-watcher",
  "connections-auto-test",
  "connections-health-check",
  "connections-hub-audit",
  "cors-audit",
  "elevenlabs-scribe-token",
  "favorites-watcher",
  "get-visitor-info",
  "github-credentials-test",
  "health-check",
  "image-proxy",
  "mcp-server",
  "process-queue",
  "process-scheduled-reports",
  "quote-followup-reminders",
  "quote-sync",
  "rls-audit",
  "rls-integration-tests",
  "rls-matrix-export",
  "secure-upload",
  "send-digest",
  "send-scheduled-reports",
  "test-contract-orchestrator",
  "test-inventory-orchestrator",
  "rate-limit-check",
]);
