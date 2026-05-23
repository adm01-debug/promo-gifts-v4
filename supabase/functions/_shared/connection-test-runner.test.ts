/**
 * Testes para `validateUrlFormat` em connection-test-runner.ts
 * (Issue 2 do post-mortem 2026-05-22 — CRM bridge URL malformada).
 *
 * Cobre os 6 cenários da spec original:
 *  1. URL Supabase válida
 *  2. URL do Dashboard (anti-padrão #1 que causou o incidente)
 *  3. URL com trailing slash
 *  4. URL com path
 *  5. URL vazia
 *  6. URL sem https
 *
 * Plus: webhook Bitrix24, n8n e webhook_outbound.
 */
import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { validateUrlFormat } from "./connection-test-runner.ts";

// =====================================================================
// Supabase URL — o caso do incidente
// =====================================================================

Deno.test("validateUrlFormat: Supabase válida → null", () => {
  assertEquals(
    validateUrlFormat("https://pgxfvjmuubtbowutlide.supabase.co", "supabase"),
    null,
  );
});

Deno.test("validateUrlFormat: Supabase com project_ref de outro tamanho → URL_MALFORMED", () => {
  const result = validateUrlFormat("https://short.supabase.co", "supabase");
  assert(result !== null);
  assert(result.startsWith("URL_MALFORMED:"));
});

Deno.test("validateUrlFormat: URL do Dashboard (anti-padrão #1) → URL_MALFORMED com mensagem específica", () => {
  const result = validateUrlFormat(
    "https://supabase.com/dashboard/project/pgxfvjmuubtbowutlide",
    "supabase",
  );
  assert(result !== null);
  assert(result.includes("URL do Dashboard"));
});

Deno.test("validateUrlFormat: URL com trailing slash → URL_MALFORMED", () => {
  const result = validateUrlFormat(
    "https://pgxfvjmuubtbowutlide.supabase.co/",
    "supabase",
  );
  assert(result !== null);
  assert(result.startsWith("URL_MALFORMED:"));
});

Deno.test("validateUrlFormat: URL com path → URL_MALFORMED", () => {
  const result = validateUrlFormat(
    "https://pgxfvjmuubtbowutlide.supabase.co/rest/v1",
    "supabase",
  );
  assert(result !== null);
  assert(result.startsWith("URL_MALFORMED:"));
});

Deno.test("validateUrlFormat: URL vazia → URL_MALFORMED com 'vazio'", () => {
  const result = validateUrlFormat("", "supabase");
  assert(result !== null);
  assert(result.includes("vazio"));
});

Deno.test("validateUrlFormat: URL sem https → URL_MALFORMED", () => {
  const result = validateUrlFormat(
    "http://pgxfvjmuubtbowutlide.supabase.co",
    "supabase",
  );
  assert(result !== null);
  assert(result.startsWith("URL_MALFORMED:"));
});

Deno.test("validateUrlFormat: URL com whitespace → URL_MALFORMED com 'whitespace'", () => {
  const result = validateUrlFormat(
    "  https://pgxfvjmuubtbowutlide.supabase.co  ",
    "supabase",
  );
  assert(result !== null);
  assert(result.includes("whitespace"));
});

// =====================================================================
// Bitrix24
// =====================================================================

Deno.test("validateUrlFormat: Bitrix24 webhook válido → null", () => {
  assertEquals(
    validateUrlFormat("https://promo.bitrix24.com/rest/1/abc/", "bitrix24"),
    null,
  );
});

Deno.test("validateUrlFormat: Bitrix24 sem https → URL_MALFORMED", () => {
  const result = validateUrlFormat("http://promo.bitrix24.com/rest/1/abc/", "bitrix24");
  assert(result !== null);
  assert(result.startsWith("URL_MALFORMED:"));
});

// =====================================================================
// n8n
// =====================================================================

Deno.test("validateUrlFormat: n8n https → null", () => {
  assertEquals(validateUrlFormat("https://n8n.example.com", "n8n"), null);
});

Deno.test("validateUrlFormat: n8n http (permitido em dev) → null", () => {
  assertEquals(validateUrlFormat("http://localhost:5678", "n8n"), null);
});

Deno.test("validateUrlFormat: n8n sem protocolo → URL_MALFORMED", () => {
  const result = validateUrlFormat("n8n.example.com", "n8n");
  assert(result !== null);
  assert(result.startsWith("URL_MALFORMED:"));
});

// =====================================================================
// webhook_outbound (genérico)
// =====================================================================

Deno.test("validateUrlFormat: webhook_outbound https → null", () => {
  assertEquals(
    validateUrlFormat("https://hooks.zapier.com/abc", "webhook_outbound"),
    null,
  );
});

Deno.test("validateUrlFormat: webhook_outbound sem protocolo → URL_MALFORMED", () => {
  const result = validateUrlFormat("hooks.zapier.com/abc", "webhook_outbound");
  assert(result !== null);
  assert(result.startsWith("URL_MALFORMED:"));
});

// =====================================================================
// Type não validado (mcp não tem URL)
// =====================================================================

Deno.test("validateUrlFormat: mcp aceita qualquer string não-vazia (sem regra específica)", () => {
  // O type mcp não tem ping baseado em URL, então validateUrlFormat
  // só valida cenários comuns (vazio + whitespace) e segue.
  assertEquals(validateUrlFormat("qualquer-coisa", "mcp"), null);
});
