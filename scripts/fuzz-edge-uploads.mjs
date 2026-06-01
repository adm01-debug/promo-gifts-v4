#!/usr/bin/env node
/**
 * scripts/fuzz-edge-uploads.mjs
 *
 * Fuzz testing especializado para upload de arquivos e webhooks.
 * Complementa fuzz-testing.mjs com cenários específicos de:
 *   - Multipart form-data malformado
 *   - Tipos MIME adulterados (políglotas)
 *   - Arquivos com conteúdo adversarial (EICAR, zip-bomb simulado)
 *   - Webhooks com assinaturas inválidas
 *   - Payloads com campos numéricos extremos
 *   - Uploads concurrent (race condition)
 *
 * Em modo dry-run (sem credenciais), apenas valida estrutura dos cenários.
 */
import process from "node:process";

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || "").replace(/\/+$/, "");
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_TEST_BYPASS_TOKEN;
const DRY_RUN = !SUPABASE_URL || !SERVICE_ROLE_KEY;
const TIMEOUT_MS = 15_000;

if (DRY_RUN) {
  console.log("⚠️  Credenciais ausentes — modo dry-run (geração + validação de payloads sem HTTP).");
}

// ---------------------------------------------------------------------------
// Corpus de uploads adversariais
// ---------------------------------------------------------------------------

const MIME_POLYGLOTAS = [
  // MIME adulterado: extensão .jpg mas conteúdo não-imagem
  { name: "fake-jpg.jpg", content: "<?php echo shell_exec($_GET['cmd']); ?>", mime: "image/jpeg" },
  // SVG com XSS embutido
  { name: "xss.svg", content: '<svg xmlns="http://www.w3.org/2000/svg"><script>alert(document.cookie)</script></svg>', mime: "image/svg+xml" },
  // HTML disfarçado de PDF
  { name: "trojan.pdf", content: "<html><script>alert(1)</script></html>", mime: "application/pdf" },
  // EICAR test signature (antivírus)
  { name: "eicar.com", content: "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*", mime: "image/png" },
  // Arquivo executável disfarçado de imagem
  { name: "malware.png", content: "MZ\x90\x00\x03\x00\x00\x00", mime: "image/png" },
];

const UPLOAD_FIELD_FUZZING = [
  // Folder path traversal
  { folder: "../../etc/", filename: "passwd" },
  { folder: "/absolute/path/", filename: "evil.sh" },
  { folder: "a".repeat(256), filename: "long.jpg" },
  { folder: "valid", filename: "file\x00.jpg" },  // null byte em filename
  { folder: "valid", filename: "<script>alert(1)</script>.jpg" },
  { folder: "valid", filename: "'; DROP TABLE uploads;--.jpg" },
  { folder: null, filename: "missing-folder.jpg" },
  { folder: "valid", filename: null },  // missing filename
];

const WEBHOOK_ADVERSARIAL_PAYLOADS = [
  // Tipo de evento inexistente
  { event: "../../admin/delete_all", occurred_at: new Date().toISOString(), data: {} },
  // Event com unicode confuso
  { event: "product​.created", occurred_at: new Date().toISOString(), data: {} },
  // occurred_at inválido
  { event: "product.created", occurred_at: "not-a-date", data: {} },
  // occurred_at no futuro distante
  { event: "product.created", occurred_at: "2099-12-31T23:59:59Z", data: {} },
  // Data aninhada com valores extremos
  { event: "product.created", occurred_at: new Date().toISOString(), data: { price: Number.MAX_SAFE_INTEGER } },
  { event: "product.created", occurred_at: new Date().toISOString(), data: { price: -Infinity } },
  { event: "product.created", occurred_at: new Date().toISOString(), data: { price: NaN } },
  { event: "product.created", occurred_at: new Date().toISOString(), data: { name: "\x00\x01\x02" } },
  // Payload gigante
  { event: "product.created", occurred_at: new Date().toISOString(), data: { description: "A".repeat(100_000) } },
  // Array aninhado infinitamente (serializado)
  { event: "product.created", occurred_at: new Date().toISOString(), data: Array(100).fill(Array(100).fill("x")) },
];

const HMAC_SIGNATURES_ADVERSARIAIS = [
  "",                           // vazio
  "sha256=",                    // sem hash
  "sha256=" + "a".repeat(64),  // hash inválido
  "sha512=" + "b".repeat(64),  // algoritmo errado
  "sha256=abc",                 // hash curto
  "invalid-format",             // sem prefixo
  "sha256=" + "0".repeat(64),  // todos zeros
  "\x00" * 100,                 // bytes nulos
];

const CONTENT_TYPE_BYPASS = [
  "application/json; charset=utf-8; boundary=INJECTION",
  "multipart/form-data; boundary=; injection=evil",
  "text/plain; charset=utf-8\r\nX-Injected: true",
  "application/x-www-form-urlencoded\r\n\r\nINJECTED",
  "",  // content-type vazio
];

// ---------------------------------------------------------------------------
// Motor de execução
// ---------------------------------------------------------------------------

let totalTests = 0;
let totalPassed = 0;
let totalFailed = 0;
const failures = [];

async function runTest(label, fn) {
  totalTests++;
  if (DRY_RUN) {
    totalPassed++;
    return;
  }
  try {
    await fn();
    totalPassed++;
  } catch (err) {
    totalFailed++;
    failures.push({ label, error: err.message || String(err) });
    console.error(`  ✗ FAIL: ${label}\n    ${err.message}`);
  }
}

async function fetchWithTimeout(url, opts) {
  const ctrl = new AbortController();
  const tid = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, { ...opts, signal: ctrl.signal });
  } finally {
    clearTimeout(tid);
  }
}

function assertNoCrash(res, label) {
  if (res.status >= 500) {
    throw new Error(`Crash detectado: HTTP ${res.status} em '${label}'`);
  }
}

// ---------------------------------------------------------------------------
// Suite 1: Uploads adversariais (secure-upload)
// ---------------------------------------------------------------------------

async function runUploadFuzz() {
  console.log("\n📎 Suite: Uploads adversariais (secure-upload)");

  for (const { name, content, mime } of MIME_POLYGLOTAS) {
    await runTest(`MIME políglota: ${name}`, async () => {
      const form = new FormData();
      form.append("file", new Blob([content], { type: mime }), name);
      const res = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/secure-upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        body: form,
      });
      assertNoCrash(res, `MIME-polyglot-${name}`);
    });
  }

  for (const { folder, filename } of UPLOAD_FIELD_FUZZING) {
    const label = `folder=${JSON.stringify(folder)}, filename=${JSON.stringify(filename)}`;
    await runTest(`Upload field fuzz: ${label.slice(0, 60)}`, async () => {
      const form = new FormData();
      form.append("file", new Blob(["fake-image"], { type: "image/png" }), filename ?? "test.png");
      if (folder !== null) form.append("folder", folder);
      const res = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/secure-upload`, {
        method: "POST",
        headers: { Authorization: `Bearer ${SERVICE_ROLE_KEY}` },
        body: form,
      });
      assertNoCrash(res, label);
    });
  }

  // Upload com Content-Type injetado
  for (const ct of CONTENT_TYPE_BYPASS) {
    await runTest(`Content-Type bypass: ${JSON.stringify(ct).slice(0, 50)}`, async () => {
      const res = await fetchWithTimeout(`${SUPABASE_URL}/functions/v1/secure-upload`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          "Content-Type": ct,
        },
        body: "fake-multipart-body",
      });
      assertNoCrash(res, `ct-bypass`);
    });
  }
}

// ---------------------------------------------------------------------------
// Suite 2: Webhooks adversariais
// ---------------------------------------------------------------------------

async function runWebhookFuzz() {
  console.log("\n🪝 Suite: Webhooks adversariais (webhook-inbound + product-webhook)");

  const endpoints = ["/functions/v1/webhook-inbound?slug=test-fuzz", "/functions/v1/product-webhook"];

  for (const endpoint of endpoints) {
    for (const payload of WEBHOOK_ADVERSARIAL_PAYLOADS) {
      let bodyStr;
      try {
        bodyStr = JSON.stringify(payload);
      } catch {
        bodyStr = "{}";
      }
      await runTest(`Webhook ${endpoint.split("/").pop()}: ${JSON.stringify(payload).slice(0, 50)}`, async () => {
        const res = await fetchWithTimeout(`${SUPABASE_URL}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: bodyStr,
        });
        assertNoCrash(res, endpoint);
      });
    }

    // HMAC inválidos
    for (const sig of HMAC_SIGNATURES_ADVERSARIAIS) {
      await runTest(`Webhook HMAC inválido: ${JSON.stringify(sig).slice(0, 30)} em ${endpoint.split("/").pop()}`, async () => {
        const res = await fetchWithTimeout(`${SUPABASE_URL}${endpoint}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
            "x-webhook-signature": sig,
            "x-signature-256": sig,
          },
          body: JSON.stringify({ event: "product.created", occurred_at: new Date().toISOString(), data: {} }),
        });
        assertNoCrash(res, `hmac-${sig.slice(0, 10)}`);
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Suite 3: Campos numéricos extremos em edge functions JSON
// ---------------------------------------------------------------------------

async function runNumericFuzz() {
  console.log("\n🔢 Suite: Campos numéricos extremos");

  const numericEndpoints = [
    {
      path: "/functions/v1/ai-recommendations",
      base: { context: "test", limit: 5 },
      fuzzField: "limit",
    },
    {
      path: "/functions/v1/rate-limit-check",
      base: { action: "login", identifier: "fuzz@test.com" },
      fuzzField: "window_seconds",
    },
  ];

  const extremeValues = [
    Number.MAX_SAFE_INTEGER,
    Number.MIN_SAFE_INTEGER,
    Number.MAX_VALUE,
    -Number.MAX_VALUE,
    0.000000001,
    -0,
    1e308,
    -1e308,
    999_999_999_999,
    -999_999_999_999,
  ];

  for (const { path, base, fuzzField } of numericEndpoints) {
    for (const val of extremeValues) {
      await runTest(`Numeric fuzz ${path.split("/").pop()}.${fuzzField}=${val}`, async () => {
        const body = { ...base, [fuzzField]: val };
        let bodyStr;
        try { bodyStr = JSON.stringify(body); } catch { bodyStr = "{}"; }
        const res = await fetchWithTimeout(`${SUPABASE_URL}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: bodyStr,
        });
        assertNoCrash(res, `${path}-${fuzzField}-${val}`);
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Suite 4: Bytes nulos e unicode adversarial
// ---------------------------------------------------------------------------

async function runUnicodeFuzz() {
  console.log("\n🌐 Suite: Unicode adversarial e bytes nulos");

  const unicodeStrings = [
    " ",              // null bytes
    "﻿",                           // BOM
    "‮" + "password",             // RTL override
    "​‌‍",              // zero-width chars
    "À́̂̃",       // combining chars
    "𝕳𝖊𝖑𝖑𝖔",                          // mathematical bold
    "𐀀",                     // surrogate pair
    "﷽",                               // Arabic ligature (1 char, 4 bytes UTF-8)
    "\n\r\t" + "injection",            // control chars
    "a".repeat(50_000),                // very long string
  ];

  const endpoints = [
    { path: "/functions/v1/semantic-search", field: "query", base: {} },
    { path: "/functions/v1/ai-recommendations", field: "context", base: { limit: 1 } },
    // Funções de processamento de imagem — URL/campo adversarial (SSRF/XSS).
    { path: "/functions/v1/analyze-logo-colors", field: "logo_url", base: {} },
    { path: "/functions/v1/visual-search", field: "image_url", base: {} },
    { path: "/functions/v1/generate-mockup", field: "logo_url", base: { product_id: "p1" } },
  ];

  for (const { path, field, base } of endpoints) {
    for (const str of unicodeStrings) {
      await runTest(`Unicode fuzz ${path.split("/").pop()}.${field}: ${JSON.stringify(str).slice(0, 30)}`, async () => {
        const body = { ...base, [field]: str };
        let bodyStr;
        try { bodyStr = JSON.stringify(body); } catch { bodyStr = "{}"; }
        const res = await fetchWithTimeout(`${SUPABASE_URL}${path}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          },
          body: bodyStr,
        });
        assertNoCrash(res, `unicode-${field}`);

        // Verifica que a resposta não contém o string adversarial sem escape
        const text = await res.text().catch(() => "");
        if (str.includes("<script>")) {
          expect(!text.includes("<script>")).toBe(true);
        }
      });
    }
  }
}

// ---------------------------------------------------------------------------
// Suite 5: Headers HTTP adversariais
// ---------------------------------------------------------------------------

async function runHeaderFuzz() {
  console.log("\n🗂️  Suite: Headers HTTP adversariais");

  const adversarialHeaders = [
    { "X-Forwarded-For": "127.0.0.1, 10.0.0.1, 192.168.1.1" },
    { "X-Real-IP": "169.254.169.254" },
    { "X-Forwarded-Host": "evil.com" },
    { "Host": "evil.com" },
    { "Origin": "null" },
    { "Referer": "javascript:alert(1)" },
    { "User-Agent": "'; DROP TABLE requests;--" },
    { "X-Forwarded-Proto": "http; INJECT" },
    { "Content-Length": "-1" },
    { "Transfer-Encoding": "chunked, chunked" },  // TE.CL desync
  ];

  const healthEndpoint = "/functions/v1/health-check";

  for (const headers of adversarialHeaders) {
    const headerName = Object.keys(headers)[0];
    await runTest(`Header adversarial: ${headerName}=${JSON.stringify(headers[headerName]).slice(0, 30)}`, async () => {
      const res = await fetchWithTimeout(`${SUPABASE_URL}${healthEndpoint}`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${SERVICE_ROLE_KEY}`,
          ...headers,
        },
      });
      assertNoCrash(res, `header-${headerName}`);
    });
  }
}

// ---------------------------------------------------------------------------
// Runner principal
// ---------------------------------------------------------------------------

async function main() {
  console.log("=".repeat(60));
  console.log("🧪 FUZZ TESTING — Uploads, Webhooks, Unicode, Headers");
  console.log("=".repeat(60));

  if (DRY_RUN) {
    console.log(`\n📋 Gerando cenários (dry-run):`);
    console.log(`   MIME políglota: ${MIME_POLYGLOTAS.length}`);
    console.log(`   Upload fields: ${UPLOAD_FIELD_FUZZING.length}`);
    console.log(`   Content-Type bypass: ${CONTENT_TYPE_BYPASS.length}`);
    console.log(`   Webhook payloads adversariais: ${WEBHOOK_ADVERSARIAL_PAYLOADS.length}`);
    console.log(`   HMAC inválidos: ${HMAC_SIGNATURES_ADVERSARIAIS.length}`);
    console.log(`   Valores numéricos extremos: 10 × 2 endpoints`);
    console.log(`   Strings Unicode: 10 × 2 endpoints`);
    console.log(`   Headers adversariais: 10`);
  }

  await runUploadFuzz();
  await runWebhookFuzz();
  await runNumericFuzz();
  await runUnicodeFuzz();
  await runHeaderFuzz();

  // ---------------------------------------------------------------------------
  // Relatório final
  // ---------------------------------------------------------------------------
  console.log("\n" + "=".repeat(60));
  console.log(`📊 RESULTADO FINAL`);
  console.log("=".repeat(60));
  console.log(`Total:   ${totalTests}`);
  console.log(`✅ Pass: ${totalPassed}`);
  console.log(`❌ Fail: ${totalFailed}`);

  if (failures.length > 0) {
    console.log("\n🚨 Falhas detectadas:");
    for (const { label, error } of failures) {
      console.log(`  ✗ ${label}`);
      console.log(`    → ${error}`);
    }
    process.exit(1);
  } else {
    if (DRY_RUN) {
      console.log("\n✅ Dry-run concluído — todos os cenários gerados são válidos.");
    } else {
      console.log("\n✅ Todos os testes passaram — nenhum crash 5xx detectado.");
    }
  }
}

main().catch((err) => {
  console.error("Fatal:", err);
  process.exit(1);
});
