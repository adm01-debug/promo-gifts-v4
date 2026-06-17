/**
 * tests/edge-functions/live/descriptors.ts
 * --------------------------------------------------------------
 * Registro central dos descritores de teste LIVE por edge function.
 *
 * O conteúdo real (método, body válido, happy-path, inputs inválidos extras)
 * vive AQUI — os arquivos `<fn>.test.ts` são shims finos que só chamam
 * `runLiveSuite(descriptorFor("<fn>"))`. Isso mantém um arquivo por função
 * (gate `check:edge-live-coverage` + reporting por função) sem duplicar lógica.
 *
 * Funções sem entrada usam o descritor padrão `{ fn }`:
 *   CORS + fronteira de auth (derivada do manifest) + 6 inputs malformados
 *   (sem crash 5xx) + contrato de erro {code|error|message}.
 *
 * Happy-paths só são adicionados quando conhecemos a saída e ela é SEGURA
 * (read-only / idempotente / dry-run). Geração cara fica atrás de `costly`.
 */
import type { LiveSuiteDescriptor } from "./_live-suite";
import { catalogListSchema, healthSchema } from "./_schemas";

type Descriptor = Omit<LiveSuiteDescriptor, "fn">;

export const DESCRIPTORS: Record<string, Descriptor> = {
  // ---------------- Públicas (read-only / catálogo / health) ----------------
  "health-check": {
    method: "GET",
    // happy-path usa JWT de usuário (gateway verify_jwt=true) → skip sem creds.
    happyPath: { method: "GET", expectStatus: [200], schema: healthSchema },
  },
  "materials-api": {
    // action válida do enum; retorna {data:[]} mesmo sem DB externo (200).
    validBody: { action: "groups" },
    happyPath: { body: { action: "groups" }, expectStatus: [200], schema: catalogListSchema },
    invalidInputs: [{ label: "action desconhecida", body: { action: "___nope___" } }],
  },
  "categories-api": {
    validBody: { action: "list" },
    invalidInputs: [{ label: "action desconhecida", body: { action: "___nope___" } }],
  },
  "commemorative-dates": {
    // Apesar de "public" no manifest, exige Bearer em runtime → reach/no-crash.
    validBody: { action: "get_active_dates" },
  },
  "cnpj-lookup": {
    validBody: { cnpj: "00000000000191" },
    invalidInputs: [
      { label: "cnpj curto", body: { cnpj: "123" } },
      { label: "cnpj não-numérico", body: { cnpj: "abc.def.ghi" } },
    ],
  },
  "image-proxy": {
    method: "GET",
    query: "url=https://example.com/x.png",
    invalidInputs: [{ label: "url ausente", body: undefined }],
  },
  "get-visitor-info": { method: "GET" },
  "rate-limit-check": { validBody: { action: "check", key: "test" } },
  "log-login-attempt": { validBody: { email: "x@example.com", success: false } },
  "detect-new-device": { validBody: { user_id: "00000000-0000-0000-0000-000000000000" } },
  "verify-email": { validBody: { token: "invalid-token" } },
  "dropbox-list": { validBody: { path: "/" } },
  "elevenlabs-scribe-token": {},
  "elevenlabs-tts": { validBody: { text: "ok" } },
  "semantic-search": {
    validBody: { query: "caneca" },
    invalidInputs: [{ label: "query vazia", body: { query: "" } }],
  },

  // ---------------- Webhooks (HMAC) — happy-path exige assinatura → omitido ----------------
  "webhook-inbound": {
    query: "slug=test-slug",
    baseHeaders: { "accept-version": "2" },
    invalidInputs: [
      {
        label: "assinatura HMAC inválida",
        headers: { "x-signature-256": "sha256=deadbeef" },
        body: { event: "x", occurred_at: new Date().toISOString(), data: {} },
        role: "anon",
      },
    ],
  },
  "product-webhook": {
    invalidInputs: [
      {
        label: "x-webhook-secret inválido",
        headers: { "x-webhook-secret": "wrong" },
        body: { action: "upsert", product: { sku: "X" } },
        role: "anon",
      },
    ],
  },
  "webhook-dispatcher": {},
  "simulation-orchestrator": {
    invalidInputs: [{ label: "HMAC ausente", body: { action: "simulate" }, role: "anon" }],
  },

  // ---------------- Uploads ----------------
  "secure-upload": {
    invalidInputs: [
      { label: "sem arquivo", body: {} },
      { label: "filename suspeito", body: { filename: "../../etc/passwd", contentType: "image/png" } },
    ],
  },
  "generate-mockup": {
    invalidInputs: [
      { label: "token ausente", body: { productImageUrl: "https://example.com/p.png" } },
    ],
  },

  // ---------------- Auditorias / dry-run seguro ----------------
  "ownership-repair": {
    // dry_run=true é read-only.
    happyPath: { role: "supervisor", body: { dry_run: true }, expectStatus: [200] },
  },
  "cors-audit": {},
  "rls-audit": {},
  "rls-matrix-export": {},
  "full-op-diagnostics": {},
  "connections-health-check": {},
  "connections-hub-audit": {},
  "connections-auto-test": {},
  "ownership-audit": {},

  // ---------------- Cron functions (x-cron-secret, verify_jwt=false) ----------------
  // These are pg_cron-called functions; not browser-facing. CORS and auth
  // boundary behave differently from JWT-gated functions.
  "asia-ingestion": {
    skipCors: true,
    // Auth is x-cron-secret header; anon POSTs reach the handler (verify_jwt=false).
    // No happy-path: full catalog sync is expensive and destructive.
    invalidInputs: [],
  },
  "backfill-image-dimensions": {
    skipCors: true,
    // Same auth pattern as asia-ingestion.
    invalidInputs: [],
  },
  "hash-product-images": {
    skipCors: true,
    // Auth is x-cron-secret header; called by pg_cron (verify_jwt=false).
    // No happy-path: downloads and hashes images — expensive and writes to DB.
    invalidInputs: [],
  },
  "generate-blurhashes": {
    skipCors: true,
    // Auth is x-cron-secret header; called by pg_cron (verify_jwt=false).
    // No happy-path: downloads images and writes blurhash strings — expensive.
    invalidInputs: [],
  },

  // ---------------- Geração de IA cara (gate COSTLY) ----------------
  "word-magic": {
    // Copywriting B2B via DeepSeek — escreve em ai_enrichment_queue/products e
    // consome créditos pagos. Sem happy-path: cobrimos CORS + fronteira de auth
    // + validação de input (UUID/bool) sem disparar geração real.
    validBody: { product_id: "00000000-0000-0000-0000-000000000000" },
    invalidInputs: [
      { label: "product_id não-UUID", body: { product_id: "not-a-uuid" } },
      {
        label: "force_regenerate tipo errado",
        body: { product_id: "00000000-0000-0000-0000-000000000000", force_regenerate: "yes" },
      },
    ],
  },
  "generate-ad-image": {
    happyPath: { role: "authenticated", body: { prompt: "logo" }, costly: true, expectStatus: [200] },
  },
  "voice-agent": {},
  "visual-search": {},
};

const DEFAULT: Descriptor = {};

export function descriptorFor(fn: string): LiveSuiteDescriptor {
  return { fn, ...(DESCRIPTORS[fn] ?? DEFAULT) };
}
