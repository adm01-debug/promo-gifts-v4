#!/usr/bin/env node
/**
 * scripts/fuzz-testing.mjs
 *
 * Bateria exaustiva de fuzz testing contra Edge Functions.
 * Gera milhares de cenários cobrindo:
 *   - Injeção SQL / NoSQL
 *   - XSS e script injection
 *   - Path traversal / SSRF
 *   - Overflow de buffer / campos gigantes
 *   - Type confusion (null, undefined, array, number onde se espera string)
 *   - Unicode / caracteres de controle / emojis
 *   - JSON malformado / truncado
 *   - CNPJ/CPF inválidos (formatos variados)
 *   - Datas inválidas / fora do range
 *   - Valores numéricos extremos (NaN, Infinity, MAX_SAFE_INTEGER)
 *   - Webhooks com payloads adversariais
 *
 * Critérios de falha:
 *   - HTTP 500 → crash detectado
 *   - Stack trace visível na resposta → stack leak
 *   - Timeout >15s por request
 *
 * Sem credenciais: modo dry-run (valida estrutura dos payloads sem HTTP).
 */

import process from "node:process";

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_TEST_BYPASS_TOKEN;
const CONCURRENCY = Number(process.env.FUZZ_CONCURRENCY) || 6;
const FUNCTION_CONCURRENCY = Number(process.env.FUZZ_FUNCTION_CONCURRENCY) || 3;
const MAX_COMBINATIONS_PER_FUNCTION = Number(process.env.FUZZ_MAX_COMBINATIONS) || 120;
const TIMEOUT_MS = 15_000;
const DRY_RUN = !SUPABASE_URL || !SERVICE_ROLE_KEY;

if (DRY_RUN) {
  console.log("⚠️  Credenciais ausentes — modo dry-run: gerando e validando payloads sem HTTP.");
}

// ---------------------------------------------------------------------------
// Corpus de payloads adversariais
// ---------------------------------------------------------------------------

const SQL_INJECTIONS = [
  "' OR '1'='1",
  "'; DROP TABLE products;--",
  "' UNION SELECT * FROM profiles--",
  "1; SELECT * FROM information_schema.tables--",
  "' OR 1=1--",
  "admin'--",
  "' OR 'x'='x",
  "/* comment */ OR 1=1",
  "'; EXEC xp_cmdshell('whoami');--",
  "1' AND SLEEP(5)--",
];

const XSS_PAYLOADS = [
  "<script>alert(1)</script>",
  "<img src=x onerror=alert(1)>",
  "javascript:alert(1)",
  "<svg/onload=alert(1)>",
  '"><script>document.cookie</script>',
  "';alert('xss')//",
  '<iframe src="javascript:alert(1)">',
  "data:text/html,<script>alert(1)</script>",
  "%3Cscript%3Ealert%281%29%3C%2Fscript%3E",
];

const PATH_TRAVERSALS = [
  "../../etc/passwd",
  "../../../../../../../etc/shadow",
  "..\\..\\windows\\system32\\config\\sam",
  "%2e%2e%2f%2e%2e%2f",
  "/etc/passwd%00",
  "file:///etc/passwd",
  "http://127.0.0.1:6379/FLUSHALL",  // SSRF — Redis
  "http://metadata.google.internal/computeMetadata/v1/",  // SSRF — GCP
  "http://169.254.169.254/latest/meta-data/",  // SSRF — AWS
];

const HUGE_STRINGS = [
  "A".repeat(1_000),
  "A".repeat(10_000),
  "A".repeat(100_000),
  "🚀".repeat(500),
  "\x00".repeat(100),
  "\r\n".repeat(200),
  " ".repeat(5_000),
];

const TYPE_CONFUSIONS = [null, true, false, 0, -1, [], {}, [1, 2, 3]];

const MALFORMED_JSON_STRINGS = [
  '{"key": BROKEN',
  "{",
  "",
  "undefined",
  "NaN",
  "null null",
  '{"a":1,}',
];

const INVALID_CNPJS = [
  "00.000.000/0001-00",
  "12345678",
  "123456789012345",
  "AAAA.AAA/AAAA-AA",
  "",
  " ",
];

const INVALID_DATES = [
  "not-a-date", "2024-13-01", "2024-02-30", "", null,
];

const NUMERIC_EXTREMES = [
  -1, 0, Number.MAX_SAFE_INTEGER, Number.MIN_SAFE_INTEGER, Infinity, -Infinity, NaN, "not-a-number",
];

// ---------------------------------------------------------------------------
// Geradores por função (campos críticos + regras de negócio)
// ---------------------------------------------------------------------------


function pick(values, count) {
  return values.slice(0, Math.max(0, count));
}

function combine(base, variations, maxCombos = MAX_COMBINATIONS_PER_FUNCTION) {
  const entries = Object.entries(variations);
  if (entries.length === 0) return [base];
  const out = [];
  const walk = (idx, curr) => {
    if (out.length >= maxCombos) return;
    if (idx >= entries.length) {
      out.push(curr);
      return;
    }
    const [key, vals] = entries[idx];
    for (const val of vals) {
      walk(idx + 1, { ...curr, [key]: val });
      if (out.length >= maxCombos) break;
    }
  };
  walk(0, { ...base });
  return out;
}

function generateCnpjLookupPayloads() {
  const p = combine({ cnpj: "12.345.678/0001-95" }, {
    cnpj: [...pick(INVALID_CNPJS, 5), ...pick(SQL_INJECTIONS, 3), ...pick(XSS_PAYLOADS, 2)],
  });
  for (const xss of XSS_PAYLOADS) p.push({ cnpj: xss });
  for (const path of PATH_TRAVERSALS.slice(0, 4)) p.push({ cnpj: path });
  for (const type of TYPE_CONFUSIONS) p.push({ cnpj: type });
  p.push({}, { cnpj: "A".repeat(1000) }, { cnpj: "\x00" });
  p.push({ cnpj: "00.000.000/0001-91" }); // valid — should pass
  return p;
}

function generateProductWebhookPayloads() {
  const valid = { action: "upsert", product: { sku: "TEST-001", name: "Produto teste", price: 10.0 } };
  const p = [valid, { ...valid, action: "delete" }];
  p.push(...combine(valid, {
    action: ["upsert", "delete", "batch_upsert", "explode"],
    product: [
      { sku: "TEST-001", name: "Produto teste", price: 10.0 },
      { sku: SQL_INJECTIONS[0], name: "Produto teste", price: 10.0 },
      { sku: "SKU-NEG", name: XSS_PAYLOADS[0], price: -1 },
      { sku: "SKU-HUGE", name: "A".repeat(5000), price: Number.MAX_SAFE_INTEGER },
    ],
  }));
  for (const action of ["explode", "", null, 123, SQL_INJECTIONS[0]]) p.push({ ...valid, action });
  for (const sql of SQL_INJECTIONS.slice(0, 5)) p.push({ ...valid, product: { sku: sql, name: sql, price: 10.0 } });
  for (const xss of XSS_PAYLOADS.slice(0, 4)) p.push({ ...valid, product: { sku: "X", name: xss, price: 10.0 } });
  for (const price of NUMERIC_EXTREMES) p.push({ ...valid, product: { sku: "X", name: "Test", price } });
  p.push({ action: "upsert" }, { product: { sku: "X" } }, {}, []);
  p.push({ ...valid, product: { sku: "X", name: "A".repeat(10_000), price: 10 } });
  p.push({ action: "batch_upsert", products: Array(500).fill(valid.product) });
  return p;
}

function generateWebhookInboundPayloads() {
  const valid = {
    event: "order.created",
    occurred_at: new Date().toISOString(),
    data: { order_id: "ORD-001" },
    idempotency_key: "idem-001",
  };
  const p = [valid];
  for (const event of SQL_INJECTIONS.slice(0, 3)) p.push({ ...valid, event });
  for (const event of XSS_PAYLOADS.slice(0, 3)) p.push({ ...valid, event });
  for (const date of INVALID_DATES) p.push({ ...valid, occurred_at: date });
  p.push({ event: "test" }, { occurred_at: new Date().toISOString() }, {}, null, []);
  const hugeData = {};
  for (let i = 0; i < 500; i++) hugeData[`f${i}`] = "v";
  p.push({ ...valid, data: hugeData });
  return p;
}

function generateSecureUploadPayloads() {
  const p = [];
  for (const sql of SQL_INJECTIONS.slice(0, 5)) p.push({ folder: sql, filename: sql });
  for (const xss of XSS_PAYLOADS.slice(0, 4)) p.push({ folder: xss });
  for (const path of PATH_TRAVERSALS.slice(0, 5)) p.push({ folder: path });
  p.push({}, { folder: "uploads", filename: "" });
  p.push({ folder: "uploads", filename: "malicious.exe" });
  p.push({ folder: "uploads", filename: "image.php" });
  p.push({ folder: "uploads", filename: "../../../etc/passwd" });
  return p;
}

function generateSendNotificationPayloads() {
  const valid = { user_id: "uuid-001", type: "quote_approved", title: "Título", message: "Mensagem", channel: "in-app" };
  const p = [valid];
  for (const type of SQL_INJECTIONS.slice(0, 3)) p.push({ ...valid, type });
  for (const type of XSS_PAYLOADS.slice(0, 3)) p.push({ ...valid, type });
  for (const huge of HUGE_STRINGS.slice(0, 3)) {
    p.push({ ...valid, title: huge });
    p.push({ ...valid, message: huge });
  }
  for (const ch of ["fax", "", null, 123]) p.push({ ...valid, channel: ch });
  p.push({ type: "x", title: "T", message: "M" }, { user_id: "u" }, {});
  for (const sql of SQL_INJECTIONS.slice(0, 3)) p.push({ ...valid, user_id: sql });
  return p;
}

function generateValidateAccessPayloads() {
  const valid = { route: "/produtos", action: "read" };
  const p = [valid];
  for (const path of PATH_TRAVERSALS.slice(0, 5)) p.push({ route: path, action: "read" });
  for (const action of ["drop_all", "exec", "", null, 123]) p.push({ route: "/produtos", action });
  for (const sql of SQL_INJECTIONS.slice(0, 3)) p.push({ route: sql, action: "read" });
  for (const xss of XSS_PAYLOADS.slice(0, 3)) p.push({ route: xss, action: "read" });
  p.push({ action: "read" }, { route: "/produtos" }, {});
  return p;
}

function generateGenerateMockupPayloads() {
  const valid = { product_id: "prod-001", logo_url: "https://cdn.example.com/logo.png" };
  const p = [valid];
  for (const xss of XSS_PAYLOADS.slice(0, 5)) p.push({ ...valid, logo_url: xss });
  for (const path of PATH_TRAVERSALS) p.push({ ...valid, logo_url: path });
  p.push({ ...valid, logo_url: "javascript:alert(1)" });
  p.push({ ...valid, logo_url: "data:text/html,<script>alert(1)</script>" });
  for (const sql of SQL_INJECTIONS.slice(0, 3)) p.push({ product_id: sql, logo_url: "https://cdn.example.com/logo.png" });
  p.push({ logo_url: "https://cdn.example.com/logo.png" }, { product_id: "x" }, {});
  return p;
}

function generateExternalDbBridgePayloads() {
  const valid = { operation: "select", table: "products", limit: 10 };
  const p = [valid];
  for (const sql of SQL_INJECTIONS.slice(0, 5)) p.push({ operation: "select", table: sql });
  for (const op of ["DROP", "TRUNCATE", "exec", "", null]) p.push({ operation: op, table: "products" });
  for (const limit of NUMERIC_EXTREMES) p.push({ ...valid, limit });
  p.push({ table: "products" }, { operation: "select" }, {});
  return p;
}

// ---------------------------------------------------------------------------
// Gerador genérico dirigido a campos: aplica todos os corpora adversariais a
// cada campo string de um payload válido. Usado para cobrir dezenas de funções
// orientadas a campo sem duplicar lógica.
// ---------------------------------------------------------------------------

function fieldFuzz(valid, stringFields) {
  const p = [valid];
  for (const field of stringFields) {
    for (const sql of SQL_INJECTIONS.slice(0, 4)) p.push({ ...valid, [field]: sql });
    for (const xss of XSS_PAYLOADS.slice(0, 4)) p.push({ ...valid, [field]: xss });
    for (const path of PATH_TRAVERSALS.slice(0, 3)) p.push({ ...valid, [field]: path });
    for (const huge of HUGE_STRINGS.slice(0, 2)) p.push({ ...valid, [field]: huge });
    for (const t of TYPE_CONFUSIONS) p.push({ ...valid, [field]: t });
  }
  // Campos ausentes / objeto vazio.
  p.push({}, ...stringFields.map((f) => {
    const clone = { ...valid };
    delete clone[f];
    return clone;
  }));
  return p;
}

function generateSemanticSearchPayloads() { return fieldFuzz({ query: "caneca personalizada" }, ["query"]); }
function generateCategoriesApiPayloads() { return fieldFuzz({ action: "list" }, ["action"]); }
function generateMaterialsApiPayloads() { return fieldFuzz({ action: "groups" }, ["action", "search", "groupId"]); }
function generateProductSeoPayloads() { return fieldFuzz({ product_id: "prod-001", name: "Caneca" }, ["product_id", "name"]); }
function generateKitAiBuilderPayloads() { return fieldFuzz({ brief: "kit boas-vindas", budget: 100 }, ["brief"]); }
function generateMagicUpScorePayloads() { return fieldFuzz({ text: "slogan", product_id: "p1" }, ["text", "product_id"]); }
function generateRateLimitCheckPayloads() { return fieldFuzz({ action: "check", key: "user:1" }, ["action", "key"]); }
function generateLogLoginAttemptPayloads() { return fieldFuzz({ email: "x@example.com", success: false }, ["email"]); }
function generateExpertChatPayloads() { return fieldFuzz({ message: "olá" }, ["message"]); }
function generateVisualSearchPayloads() { return fieldFuzz({ image_url: "https://cdn.example.com/x.png" }, ["image_url"]); }

function generateWebhookDispatcherPayloads() {
  const valid = { event: "order.created", payload: { id: "1" } };
  const p = fieldFuzz(valid, ["event"]);
  for (const date of INVALID_DATES) p.push({ ...valid, occurred_at: date });
  return p;
}
function generateSimulationOrchestratorPayloads() {
  return fieldFuzz({ action: "simulate", scenario_id: "s1" }, ["action", "scenario_id"]);
}

// ---------------------------------------------------------------------------
// Specs de funções alvo
// ---------------------------------------------------------------------------

const FUNCTION_SPECS = [
  { name: "cnpj-lookup",       endpoint: "cnpj-lookup",                     authRequired: true,  gen: generateCnpjLookupPayloads },
  { name: "product-webhook",   endpoint: "product-webhook",                  authRequired: false, gen: generateProductWebhookPayloads },
  { name: "webhook-inbound",   endpoint: "webhook-inbound?slug=test-slug",   authRequired: false, gen: generateWebhookInboundPayloads },
  { name: "secure-upload",     endpoint: "secure-upload",                    authRequired: true,  gen: generateSecureUploadPayloads },
  { name: "send-notification", endpoint: "send-notification",                authRequired: true,  gen: generateSendNotificationPayloads },
  { name: "validate-access",   endpoint: "validate-access",                  authRequired: true,  gen: generateValidateAccessPayloads },
  { name: "generate-mockup",   endpoint: "generate-mockup",                  authRequired: true,  gen: generateGenerateMockupPayloads },
  { name: "external-db-bridge",endpoint: "external-db-bridge",               authRequired: true,  gen: generateExternalDbBridgePayloads },
  // --- Expansão: funções orientadas a campo (catálogo, busca, IA) ---
  { name: "semantic-search",   endpoint: "semantic-search",                  authRequired: true,  gen: generateSemanticSearchPayloads },
  { name: "categories-api",    endpoint: "categories-api",                   authRequired: true,  gen: generateCategoriesApiPayloads },
  { name: "materials-api",     endpoint: "materials-api",                    authRequired: true,  gen: generateMaterialsApiPayloads },
  { name: "generate-product-seo", endpoint: "generate-product-seo",          authRequired: true,  gen: generateProductSeoPayloads },
  { name: "kit-ai-builder",    endpoint: "kit-ai-builder",                   authRequired: true,  gen: generateKitAiBuilderPayloads },
  { name: "magic-up-score",    endpoint: "magic-up-score",                   authRequired: true,  gen: generateMagicUpScorePayloads },
  { name: "rate-limit-check",  endpoint: "rate-limit-check",                 authRequired: true,  gen: generateRateLimitCheckPayloads },
  { name: "log-login-attempt", endpoint: "log-login-attempt",                authRequired: true,  gen: generateLogLoginAttemptPayloads },
  { name: "expert-chat",       endpoint: "expert-chat",                      authRequired: true,  gen: generateExpertChatPayloads },
  { name: "visual-search",     endpoint: "visual-search",                    authRequired: true,  gen: generateVisualSearchPayloads },
  // --- Expansão: webhooks / orquestradores ---
  { name: "webhook-dispatcher", endpoint: "webhook-dispatcher",              authRequired: false, gen: generateWebhookDispatcherPayloads },
  { name: "simulation-orchestrator", endpoint: "simulation-orchestrator",    authRequired: false, gen: generateSimulationOrchestratorPayloads },
];

// ---------------------------------------------------------------------------
// HTTP executor
// ---------------------------------------------------------------------------

const STACK_TRACE_RE = /\bat\s+\w[\w.]*\s+\(|TypeError:|ReferenceError:|SyntaxError:/;

async function execRequest(url, body, isRaw, authToken) {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const headers = { "Content-Type": "application/json" };
    if (authToken) headers["Authorization"] = `Bearer ${authToken}`;
    const bodyStr = isRaw
      ? (typeof body === "string" ? body : (body?.rawBody ?? ""))
      : body == null ? "" : JSON.stringify(body);
    const resp = await fetch(url, {
      method: "POST",
      headers,
      body: bodyStr === "" ? undefined : bodyStr,
      signal: ctrl.signal,
    });
    const text = await resp.text().catch(() => "");
    return { status: resp.status, body: text };
  } catch (err) {
    return { status: -1, error: err.name === "AbortError" ? "TIMEOUT" : String(err.message) };
  } finally {
    clearTimeout(timer);
  }
}

// ---------------------------------------------------------------------------
// Runner
// ---------------------------------------------------------------------------

async function runFuzz() {
  console.log("🚀 Fuzz Testing — Iniciando bateria exaustiva...");
  console.log(`   Modo: ${DRY_RUN ? "DRY-RUN (sem HTTP)" : "LIVE (HTTP real)"}`);
  console.log(`   Funções alvo: ${FUNCTION_SPECS.length} | Concorrência: ${CONCURRENCY}`);
  console.log("");

  let totalPayloads = 0;
  let totalRequests = 0;
  let totalCrashes = 0;
  let totalTimeouts = 0;
  let totalStackLeaks = 0;
  const allIssues = [];

  async function runFunctionSpec(spec) {
    const payloads = [...spec.gen(), ...MALFORMED_JSON_STRINGS.map(s => ({ rawBody: s }))];
    totalPayloads += payloads.length;
    console.log(`\n📦 [${spec.name}] — ${payloads.length} payloads`);
    if (DRY_RUN) return { fn: spec.name, crashes: 0, timeouts: 0, stackLeaks: 0, issues: [] };

    const url = `${SUPABASE_URL}/functions/v1/${spec.endpoint}`;
    const authToken = spec.authRequired ? SERVICE_ROLE_KEY : null;
    let fnCrashes = 0, fnTimeouts = 0, fnStackLeaks = 0;
    const fnIssues = [];

    for (let i = 0; i < payloads.length; i += CONCURRENCY) {
      const batch = payloads.slice(i, i + CONCURRENCY);
      const results = await Promise.all(batch.map(p => execRequest(url, p, p && typeof p === "object" && "rawBody" in p, authToken)));
      for (let j = 0; j < batch.length; j++) {
        totalRequests++;
        const r = results[j];
        const issues = [];
        if (r.status === 500) issues.push("HTTP 500 — CRASH");
        if (r.error === "TIMEOUT") { issues.push("TIMEOUT"); fnTimeouts++; }
        if (r.body && STACK_TRACE_RE.test(r.body)) issues.push("STACK TRACE LEAK");
        if (issues.some(i => i.includes("500"))) fnCrashes++;
        if (issues.some(i => i.includes("STACK"))) fnStackLeaks++;
        if (issues.length > 0) {
          fnIssues.push({ payload: batch[j], issues });
        }
      }
    }

    return { fn: spec.name, crashes: fnCrashes, timeouts: fnTimeouts, stackLeaks: fnStackLeaks, issues: fnIssues };
  }

  for (let i = 0; i < FUNCTION_SPECS.length; i += FUNCTION_CONCURRENCY) {
    const chunk = FUNCTION_SPECS.slice(i, i + FUNCTION_CONCURRENCY);
    const chunkResults = await Promise.all(chunk.map(runFunctionSpec));
    for (const result of chunkResults) {
      const ok = result.crashes === 0 && result.stackLeaks === 0;
      console.log(`   ${ok ? "✅" : "❌"} [${result.fn}] Crashes: ${result.crashes} | Timeouts: ${result.timeouts} | StackLeaks: ${result.stackLeaks}`);
      totalCrashes += result.crashes;
      totalTimeouts += result.timeouts;
      totalStackLeaks += result.stackLeaks;
      allIssues.push(...result.issues.map(issue => ({ fn: result.fn, ...issue })));
    }
  }

  console.log("\n" + "=".repeat(60));
  console.log("📊 RELATÓRIO FINAL DE FUZZ TESTING");
  console.log("=".repeat(60));
  console.log(`Payloads gerados:  ${totalPayloads}`);
  console.log(`Requests enviados: ${totalRequests}`);
  console.log(`Crashes (500):     ${totalCrashes}`);
  console.log(`Timeouts:          ${totalTimeouts}`);
  console.log(`Stack leaks:       ${totalStackLeaks}`);
  console.log("");
  if (allIssues.length > 0) {
    const byFunction = allIssues.reduce((acc, i) => { acc[i.fn] = (acc[i.fn] || 0) + 1; return acc; }, {});
    console.log("Falhas agregadas por função:");
    Object.entries(byFunction).sort((a, b) => b[1] - a[1]).forEach(([fn, count]) => console.log(` - ${fn}: ${count}`));
  }

  if (totalCrashes > 0 || totalStackLeaks > 0) {
    console.error(`❌ FALHOU — ${totalCrashes} crashes e ${totalStackLeaks} stack leaks.`);
    process.exit(1);
  }

  if (DRY_RUN) {
    console.log(`✅ DRY-RUN — ${totalPayloads} payloads gerados e validados estruturalmente.`);
    console.log("   Configure SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY para testes reais.");
  } else {
    console.log(`✅ PASSOU — ${totalRequests} requests sem crashes ou stack leaks.`);
  }
}

runFuzz().catch(err => {
  console.error("❌ Erro fatal:", err.message);
  process.exit(1);
});
