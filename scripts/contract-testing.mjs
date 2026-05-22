/**
 * End-to-end contract tests against deployed Edge Functions (HTTP level).
 *
 * Validates:
 *   - Happy-path payloads → 200/201
 *   - Missing required fields → 422 (unified validation error shape)
 *   - Wrong-typed fields → 422
 *   - Empty values → 422
 *   - Version negotiation (v1 default vs v2 via header) returns the
 *     respective shape with the same semantic content.
 *
 * This is the live counterpart of tests/edge-functions/*.contract.test.ts —
 * the latter validates schemas in isolation, this one validates the full
 * HTTP envelope as a regression net against deployed code.
 *
 * Run: npm run test:contract
 *
 * Env:
 *   SUPABASE_URL                       — defaults to project URL
 *   SUPABASE_SERVICE_ROLE_KEY          — service role for invocation
 *   N8N_PRODUCT_WEBHOOK_SECRET         — header for product-webhook
 */
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "https://pqpdolkaeqlyzpdpbizo.supabase.co";
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "a46c3981-244a-4f81-9f57-bab5c45b5cde";
const PRODUCT_SECRET = process.env.N8N_PRODUCT_WEBHOOK_SECRET || "sim-secret";

// ---------- shape validators ----------

function isV1ValidationError(data) {
  return (
    data &&
    typeof data === "object" &&
    data.error === "Validation failed" &&
    "details" in data
  );
}

function isV2ValidationError(data) {
  return (
    data &&
    typeof data === "object" &&
    data.code === "validation_failed" &&
    data.version === "v2" &&
    typeof data.message === "string" &&
    Array.isArray(data.fields) &&
    data.fields.every(
      (f) => typeof f.path === "string" && typeof f.code === "string" && typeof f.message === "string",
    )
  );
}

function v2HasFieldPath(data, path) {
  return isV2ValidationError(data) && data.fields.some((f) => f.path === path);
}

function v1HasFieldKey(data, key) {
  return isV1ValidationError(data) && data.details && data.details[key] !== undefined;
}

// ---------- contracts ----------

const product = { sku: `TEST-${Date.now()}`, name: "Test Product", price: 10.5 };

const CONTRACTS = [
  {
    name: "product-webhook",
    endpoint: "product-webhook",
    headers: { "x-webhook-secret": PRODUCT_SECRET },
    scenarios: [
      {
        description: "happy path: upsert single product",
        payload: { action: "upsert", product },
        expectedStatus: 200,
        validateResponse: (d) => d.success === true && typeof d.sync_log_id === "string",
      },
      {
        description: "v1: invalid action enum → 422 v1 shape",
        payload: { action: "merge", product },
        expectedStatus: 422,
        validateResponse: (d) => isV1ValidationError(d) && v1HasFieldKey(d, "action"),
      },
      {
        description: "v2: invalid action enum → 422 v2 shape (header)",
        payload: { action: "merge", product },
        headers: { "x-api-version": "v2" },
        expectedStatus: 422,
        validateResponse: (d) => isV2ValidationError(d) && v2HasFieldPath(d, "action"),
      },
      {
        description: "v2: missing required name → 422 v2 (query)",
        payload: { action: "upsert", product: { sku: "x", price: 1 } },
        querystring: "api_version=v2",
        expectedStatus: 422,
        validateResponse: (d) => isV2ValidationError(d) && v2HasFieldPath(d, "product.name"),
      },
      {
        description: "v2: wrong-type price → 422 v2",
        payload: { action: "upsert", product: { ...product, price: "abc" } },
        headers: { "x-api-version": "v2" },
        expectedStatus: 422,
        validateResponse: (d) => isV2ValidationError(d) && v2HasFieldPath(d, "product.price"),
      },
      {
        description: "v2: empty sku → 422 v2",
        payload: { action: "upsert", product: { ...product, sku: "" } },
        headers: { "x-api-version": "v2" },
        expectedStatus: 422,
        validateResponse: (d) => isV2ValidationError(d) && v2HasFieldPath(d, "product.sku"),
      },
      {
        description: "v2: upsert without product (cross-field) → 422",
        payload: { action: "upsert" },
        headers: { "x-api-version": "v2" },
        expectedStatus: 422,
        validateResponse: (d) => isV2ValidationError(d) && v2HasFieldPath(d, "product"),
      },
      {
        description: "v2: delete with empty external_ids → 422",
        payload: { action: "delete", external_ids: [] },
        headers: { "x-api-version": "v2" },
        expectedStatus: 422,
        validateResponse: (d) => isV2ValidationError(d) && v2HasFieldPath(d, "external_ids"),
      },
      {
        description: "empty body → 400 unified",
        rawBody: "",
        expectedStatus: 400,
        validateResponse: (d) => /Request body is required|empty/i.test(JSON.stringify(d)),
      },
      {
        description: "malformed JSON → 400 unified",
        rawBody: "{not json",
        expectedStatus: 400,
        validateResponse: (d) => /Invalid JSON|invalid_json/i.test(JSON.stringify(d)),
      },
    ],
  },
  {
    name: "webhook-dispatcher",
    endpoint: "webhook-dispatcher",
    scenarios: [
      {
        description: "v2: missing event → 422 v2",
        payload: {},
        headers: { "x-api-version": "v2" },
        expectedStatus: 422,
        validateResponse: (d) => isV2ValidationError(d) && v2HasFieldPath(d, "event"),
      },
      {
        description: "v2: empty event → 422 v2",
        payload: { event: "" },
        headers: { "x-api-version": "v2" },
        expectedStatus: 422,
        validateResponse: (d) => isV2ValidationError(d) && v2HasFieldPath(d, "event"),
      },
      {
        description: "v2: test_mode without test_webhook_id → 422 cross-field",
        payload: { event: "x", test_mode: true },
        headers: { "x-api-version": "v2" },
        expectedStatus: 422,
        validateResponse: (d) => isV2ValidationError(d) && v2HasFieldPath(d, "test_webhook_id"),
      },
      {
        description: "v2: bad UUID for replay_delivery_id → 422",
        payload: { event: "x", replay_delivery_id: "not-a-uuid" },
        headers: { "x-api-version": "v2" },
        expectedStatus: 422,
        validateResponse: (d) => isV2ValidationError(d) && v2HasFieldPath(d, "replay_delivery_id"),
      },
      {
        description: "v1 default: same input returns v1 shape",
        payload: {},
        expectedStatus: 422,
        validateResponse: (d) => isV1ValidationError(d) && v1HasFieldKey(d, "event"),
      },
    ],
  },
  {
    name: "webhook-inbound",
    endpoint: "webhook-inbound",
    scenarios: [
      {
        description: "v2: missing slug → 422 (envelope rejected)",
        payload: { hi: "there" },
        querystring: "api_version=v2",
        expectedStatus: 422,
        validateResponse: (d) => isV2ValidationError(d) && v2HasFieldPath(d, "slug"),
      },
      {
        description: "v2: invalid slug (uppercase) → 422",
        payload: {},
        querystring: "slug=BadSlug&api_version=v2",
        expectedStatus: 422,
        validateResponse: (d) => isV2ValidationError(d) && v2HasFieldPath(d, "slug"),
      },
    ],
  },
  {
    name: "cnpj-lookup",
    endpoint: "cnpj-lookup",
    scenarios: [
      {
        description: "smoke: valid format simulation",
        payload: { cnpj: "00.000.000/0001-91" },
        expectedStatus: 200,
        validateResponse: (data) => data.cnpj !== undefined || data.error !== undefined,
      },
    ],
  },
];

async function runContractTests() {
  console.log("🚀 Iniciando Testes de Contrato (HTTP/Simulation Mode)...");
  let passed = 0;
  let failedCount = 0;
  const failures = [];

  for (const contract of CONTRACTS) {
    console.log(`\n📦 Contrato: ${contract.name}`);
    for (const scenario of contract.scenarios) {
      process.stdout.write(`  - ${scenario.description}: `);
      try {
        const qs = scenario.querystring ? `?${scenario.querystring}` : "";
        const url = `${SUPABASE_URL}/functions/v1/${contract.endpoint}${qs}`;
        const body =
          scenario.rawBody !== undefined ? scenario.rawBody : JSON.stringify(scenario.payload);
        const response = await fetch(url, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            ...(contract.headers || {}),
            ...(scenario.headers || {}),
          },
          body,
        });

        const actualStatus = response.status;
        let responseData;
        try {
          responseData = await response.json();
        } catch {
          responseData = { _raw: await response.text().catch(() => "") };
        }

        const statusMatch = actualStatus === scenario.expectedStatus;
        const validationMatch = scenario.validateResponse
          ? scenario.validateResponse(responseData)
          : true;

        if (statusMatch && validationMatch) {
          console.log("✅ PASS");
          passed++;
        } else {
          console.log("❌ FAIL");
          console.log(`    Esperado: ${scenario.expectedStatus}, Obtido: ${actualStatus}`);
          console.log(`    Resposta: ${JSON.stringify(responseData).slice(0, 300)}`);
          failedCount++;
          failures.push(`${contract.name} / ${scenario.description}`);
        }
      } catch (err) {
        console.log("💥 CRASH");
        console.error(err);
        failedCount++;
        failures.push(`${contract.name} / ${scenario.description} (crash)`);
      }
    }
  }

  console.log(`\n--- RESULTADO DOS TESTES DE CONTRATO ---`);
  console.log(`Sucessos: ${passed}`);
  console.log(`Falhas:   ${failedCount}`);
  if (failures.length > 0) {
    console.log("Cenários falhos:");
    for (const f of failures) console.log(`  • ${f}`);
  }
  console.log(`----------------------------------------\n`);

  if (failedCount > 0) process.exit(1);
}

runContractTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
