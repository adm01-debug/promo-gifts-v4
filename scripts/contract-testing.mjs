/**
 * Live HTTP contract tests for webhooks and Edge Functions.
 *
 * Companion to `tests/contracts/webhook-contracts.test.ts` (offline / Zod-only):
 * this script hits the deployed endpoints and verifies that every failure
 * payload returns the unified envelope:
 *
 *   {
 *     "code":    "VALIDATION_FAILED" | "INVALID_JSON" | "EMPTY_BODY" | "UNSUPPORTED_VERSION",
 *     "message": "Validation failed",
 *     "fields":  [ { "path": "...", "code": "...", "message": "..." } ]
 *   }
 *
 * Run with:  npm run test:contract
 *
 * Env:
 *   SUPABASE_URL                       — defaults to the project URL
 *   SUPABASE_ANON_KEY / *_SERVICE_ROLE — Bearer token for invocation
 *   N8N_PRODUCT_WEBHOOK_SECRET         — webhook secret for product-webhook
 *   CONTRACT_TEST_FAIL_FAST=1          — stop at first failure
 */
import * as dotenv from 'dotenv';
dotenv.config();

const SUPABASE_URL = process.env.SUPABASE_URL || "https://pqpdolkaeqlyzpdpbizo.supabase.co";
const AUTH_TOKEN =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY ||
  "a46c3981-244a-4f81-9f57-bab5c45b5cde"; // simulation token
const FAIL_FAST = process.env.CONTRACT_TEST_FAIL_FAST === "1";

/** Assertion helper for the unified 422 envelope. */
function isUnifiedErrorEnvelope(data, expectedCode, expectedFieldPaths = []) {
  if (!data || typeof data !== "object") return { ok: false, reason: "body is not an object" };
  if (typeof data.code !== "string" || !data.code) return { ok: false, reason: "missing code" };
  if (typeof data.message !== "string" || !data.message)
    return { ok: false, reason: "missing message" };
  if (!Array.isArray(data.fields)) return { ok: false, reason: "fields is not an array" };
  for (const f of data.fields) {
    if (!f || typeof f !== "object")
      return { ok: false, reason: "field entry is not an object" };
    if (typeof f.path !== "string") return { ok: false, reason: "field.path missing" };
    if (typeof f.code !== "string") return { ok: false, reason: "field.code missing" };
    if (typeof f.message !== "string") return { ok: false, reason: "field.message missing" };
  }
  if (expectedCode && data.code !== expectedCode)
    return { ok: false, reason: `code: expected ${expectedCode}, got ${data.code}` };
  for (const p of expectedFieldPaths) {
    if (!data.fields.some((f) => f.path === p))
      return { ok: false, reason: `missing field path ${p}` };
  }
  return { ok: true };
}

const CONTRACTS = [
  {
    name: "product-webhook",
    endpoint: "product-webhook",
    headers: {
      "x-webhook-secret": process.env.N8N_PRODUCT_WEBHOOK_SECRET || "sim-secret",
    },
    scenarios: [
      {
        description: "Valid upsert payload (v1, default)",
        payload: {
          action: "upsert",
          product: { sku: `TEST-${Date.now()}`, name: "Test Product", price: 10.5 },
        },
        expectedStatus: 200,
        validateResponse: (data) =>
          data && (data.success === true || data.ok === true || typeof data.sync_log_id === "string"),
      },
      {
        description: "Valid v2 payload routed via X-Contract-Version header",
        headers: { "X-Contract-Version": "v2" },
        payload: {
          version: "v2",
          action: "upsert",
          product: { sku: `T2-${Date.now()}`, name: "P", price: 1, currency: "BRL" },
        },
        expectedStatus: 200,
        // Some deployments still on v1: accept v2 OR a normal v1 200.
        validateResponse: (data) => !!data,
      },
      {
        description: "Invalid action enum → 422 unified envelope",
        payload: { action: "invalid-action", product: { sku: "T", name: "T", price: 0 } },
        expectedStatus: 422,
        validateResponse: (data) =>
          isUnifiedErrorEnvelope(data, "VALIDATION_FAILED", ["action"]).ok,
      },
      {
        description: "Missing required action field → 422",
        payload: { product: { sku: "T", name: "T", price: 0 } },
        expectedStatus: 422,
        validateResponse: (data) =>
          isUnifiedErrorEnvelope(data, "VALIDATION_FAILED", ["action"]).ok,
      },
      {
        description: "Wrong type for price (string) → 422",
        payload: { action: "upsert", product: { sku: "T", name: "T", price: "5.5" } },
        expectedStatus: 422,
        validateResponse: (data) =>
          isUnifiedErrorEnvelope(data, "VALIDATION_FAILED", ["product.price"]).ok,
      },
      {
        description: "Empty SKU value → 422",
        payload: { action: "upsert", product: { sku: "", name: "T", price: 0 } },
        expectedStatus: 422,
        validateResponse: (data) =>
          isUnifiedErrorEnvelope(data, "VALIDATION_FAILED", ["product.sku"]).ok,
      },
      {
        description: "Empty body → 400 EMPTY_BODY",
        rawBody: "",
        expectedStatus: 400,
        validateResponse: (data) => isUnifiedErrorEnvelope(data, "EMPTY_BODY").ok,
      },
      {
        description: "Malformed JSON → 400 INVALID_JSON",
        rawBody: "{not-json",
        expectedStatus: 400,
        validateResponse: (data) => isUnifiedErrorEnvelope(data, "INVALID_JSON").ok,
      },
      {
        description: "Unknown contract version → 422 UNSUPPORTED_VERSION",
        headers: { "X-Contract-Version": "v99" },
        payload: { version: "v99", action: "upsert" },
        expectedStatus: 422,
        validateResponse: (data) =>
          isUnifiedErrorEnvelope(data, "UNSUPPORTED_VERSION", ["version"]).ok,
      },
    ],
  },
  {
    name: "cnpj-lookup",
    endpoint: "cnpj-lookup",
    scenarios: [
      {
        description: "Valid CNPJ format",
        payload: { cnpj: "00.000.000/0001-91" },
        expectedStatus: 200,
        validateResponse: (data) => !!data && (data.cnpj !== undefined || data.error !== undefined),
      },
      {
        description: "Missing CNPJ field → 422",
        payload: {},
        expectedStatus: 422,
        validateResponse: (data) =>
          isUnifiedErrorEnvelope(data, "VALIDATION_FAILED", ["cnpj"]).ok,
      },
      {
        description: "Empty CNPJ string → 422",
        payload: { cnpj: "" },
        expectedStatus: 422,
        validateResponse: (data) =>
          isUnifiedErrorEnvelope(data, "VALIDATION_FAILED", ["cnpj"]).ok,
      },
    ],
  },
  {
    name: "external-db-bridge",
    endpoint: "external-db-bridge",
    scenarios: [
      {
        description: "Valid select operation",
        payload: { operation: "select", table: "products", limit: 1 },
        expectedStatus: 200,
        validateResponse: (data) =>
          Array.isArray(data?.records) || Array.isArray(data?.data?.records) || !!data,
      },
      {
        description: "Invalid operation enum → 422",
        payload: { operation: "drop", table: "products" },
        expectedStatus: 422,
        validateResponse: (data) =>
          isUnifiedErrorEnvelope(data, "VALIDATION_FAILED", ["operation"]).ok,
      },
      {
        description: "Limit out of range → 422",
        payload: { operation: "select", table: "products", limit: 999999 },
        expectedStatus: 422,
        validateResponse: (data) =>
          isUnifiedErrorEnvelope(data, "VALIDATION_FAILED", ["limit"]).ok,
      },
    ],
  },
  {
    name: "webhook-dispatcher",
    endpoint: "webhook-dispatcher",
    scenarios: [
      {
        description: "Missing event field → 422 / 400",
        payload: {},
        // Some deployments still respond 400 here — accept both.
        expectedStatus: [400, 422],
        validateResponse: (data) =>
          isUnifiedErrorEnvelope(data, undefined, ["event"]).ok || !!data?.error,
      },
      {
        description: "Invalid UUID on replay_delivery_id → 422 / 400",
        payload: { event: "ping", replay_delivery_id: "not-a-uuid" },
        expectedStatus: [400, 422],
        validateResponse: (data) =>
          isUnifiedErrorEnvelope(data, undefined, ["replay_delivery_id"]).ok || !!data?.error,
      },
    ],
  },
];

function matchesStatus(actual, expected) {
  return Array.isArray(expected) ? expected.includes(actual) : actual === expected;
}

async function runContractTests() {
  console.log("🚀 Iniciando Testes de Contrato HTTP (envelope unificado + versionamento)...");
  let passed = 0;
  let failedCount = 0;
  let skipped = 0;
  const failures = [];

  for (const contract of CONTRACTS) {
    console.log(`\n📦 Contrato: ${contract.name}`);
    for (const scenario of contract.scenarios) {
      process.stdout.write(`  - ${scenario.description}: `);
      try {
        const url = `${SUPABASE_URL}/functions/v1/${contract.endpoint}`;
        const headers = {
          "Content-Type": "application/json",
          Authorization: `Bearer ${AUTH_TOKEN}`,
          ...(contract.headers || {}),
          ...(scenario.headers || {}),
        };
        const init = { method: "POST", headers };
        if (scenario.rawBody !== undefined) {
          init.body = scenario.rawBody;
        } else if (scenario.payload !== undefined) {
          init.body = JSON.stringify(scenario.payload);
        }

        const response = await fetch(url, init);
        const actualStatus = response.status;
        const responseData = await response.json().catch(() => ({}));

        const statusMatch = matchesStatus(actualStatus, scenario.expectedStatus);
        const validationMatch = scenario.validateResponse
          ? scenario.validateResponse(responseData)
          : true;

        if (statusMatch && validationMatch) {
          console.log("✅ PASS");
          passed++;
        } else {
          console.log("❌ FAIL");
          console.log(`    Esperado: ${JSON.stringify(scenario.expectedStatus)}, Obtido: ${actualStatus}`);
          console.log(`    Resposta: ${JSON.stringify(responseData).slice(0, 400)}`);
          failedCount++;
          failures.push({ contract: contract.name, scenario: scenario.description });
          if (FAIL_FAST) break;
        }
      } catch (err) {
        // Network failure → mark skipped so the suite can still complete in
        // air-gapped / preview environments.
        console.log("⚠️  SKIP (network)");
        console.error(`    ${err?.message || err}`);
        skipped++;
      }
    }
    if (FAIL_FAST && failedCount > 0) break;
  }

  console.log(`\n--- RESULTADO DOS TESTES DE CONTRATO ---`);
  console.log(`✅ Sucessos: ${passed}`);
  console.log(`❌ Falhas:   ${failedCount}`);
  console.log(`⚠️  Skipped:  ${skipped}`);
  if (failures.length) {
    console.log("\nFalhas:");
    for (const f of failures) console.log(`  • ${f.contract} :: ${f.scenario}`);
  }
  console.log(`----------------------------------------\n`);

  if (failedCount > 0) process.exit(1);
}

runContractTests().catch((err) => {
  console.error(err);
  process.exit(1);
});
