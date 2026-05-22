#!/usr/bin/env node
/**
 * Codemod: migrate inline `Validation failed` responses in Edge Functions
 * to the unified `buildValidationErrorResponse` helper.
 *
 * Transforms two patterns:
 *
 *   PATTERN A (most common):
 *     return new Response(JSON.stringify({ error: "Validation failed",
 *       details: <ZodErr>.error.flatten().fieldErrors }), {
 *       status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" }
 *     });
 *
 *   PATTERN B (helper wrapper):
 *     return jsonResponse({ error: 'Validation failed',
 *       details: <ZodErr>.error.flatten().fieldErrors }, 400, corsHeaders);
 *
 * Both → `return buildValidationErrorResponse(<ZodErr>.error, req, corsHeaders);`
 *
 * Also ensures the import line for buildValidationErrorResponse is present.
 *
 * Idempotent: skips files that already import the helper or don't match.
 */
import { readFileSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

const TARGETS = [
  'ai-recommendations',
  'analyze-logo-colors',
  'bitrix-sync',
  'categories-api',
  'cnpj-lookup',
  'comparison-ai-advisor',
  'crm-db-bridge',
  'detect-new-device',
  'dropbox-list',
  'elevenlabs-tts',
  'expert-chat',
  'external-db-bridge',
  'external-db-inspect',
  'full-op-diagnostics',
  'generate-ad-image',
  'generate-ad-prompt',
  'generate-mockup',
  'generate-product-seo',
  'kit-identity-suggest',
  'log-login-attempt',
  'magic-up-score',
  'manage-users',
  'materials-api',
  'mcp-keys-issue',
  'mcp-keys-revoke',
  'mcp-keys-rotate',
  'mcp-keys-update',
  'rate-limit-check',
  'secrets-manager',
  'semantic-search',
  'send-notification',
  'sync-quote-bitrix',
  'validate-access',
  'verify-email',
  'visual-search',
  'voice-agent',
];

const HELPER_IMPORT_RE = /import\s*\{[^}]*buildValidationErrorResponse[^}]*\}\s*from/;

// Pattern A: new Response(JSON.stringify({ error: "Validation failed"|"Invalid input", details: <X>.error.flatten().fieldErrors }), { ... });
const PATTERN_A = new RegExp(
  String.raw`return\s+new\s+Response\(\s*JSON\.stringify\(\s*\{\s*error:\s*["'](?:Validation failed|Invalid input)["']\s*,\s*details:\s*([A-Za-z_$][\w$]*)\.error\.flatten\(\)\.fieldErrors\s*\}\s*\)\s*,\s*\{[\s\S]*?status:\s*4(?:00|22)[\s\S]*?\}\s*\)\s*;`,
  'g',
);

// Pattern B: jsonResponse({ error: 'Validation failed'|'Invalid input', details: <X>.error.flatten().fieldErrors }, 400 [, corsHeaders]);
const PATTERN_B = new RegExp(
  String.raw`return\s+jsonResponse\(\s*\{\s*error:\s*["'](?:Validation failed|Invalid input)["']\s*,\s*details:\s*([A-Za-z_$][\w$]*)\.error\.flatten\(\)\.fieldErrors\s*\}\s*,\s*4(?:00|22)\s*(?:,\s*corsHeaders\s*)?\)\s*;`,
  'g',
);

// Pattern C: jsonRes(corsHeaders, { error: "Invalid input", details: <X>.error.flatten().fieldErrors }, 400);
const PATTERN_C = new RegExp(
  String.raw`return\s+jsonRes\(\s*corsHeaders\s*,\s*\{\s*error:\s*["'](?:Validation failed|Invalid input)["']\s*,\s*details:\s*([A-Za-z_$][\w$]*)\.error\.flatten\(\)\.fieldErrors\s*\}\s*,\s*4(?:00|22)\s*\)\s*;`,
  'g',
);

// Pattern D: new Response(JSON.stringify({ error: <X>.error.flatten().fieldErrors }), { status: 400, ... });
// (no wrapper message — just dumps fieldErrors as the error value)
const PATTERN_D = new RegExp(
  String.raw`return\s+new\s+Response\(\s*JSON\.stringify\(\s*\{\s*error:\s*([A-Za-z_$][\w$]*)\.error\.flatten\(\)\.fieldErrors\s*\}\s*\)\s*,\s*\{[\s\S]*?status:\s*4(?:00|22)[\s\S]*?\}\s*\)\s*;`,
  'g',
);

// Pattern E: new Response(JSON.stringify({ success: false, error: <X>.error.issues[0]?.message || ... }), {...});
// Has different shape (success/error) — we migrate to unified 422 too.
const PATTERN_E = new RegExp(
  String.raw`return\s+new\s+Response\(\s*JSON\.stringify\(\s*\{\s*success:\s*false\s*,\s*error:\s*([A-Za-z_$][\w$]*)\.error\.issues\[0\]\?\.message\s*\|\|\s*["'][^"']*["']\s*\}\s*\)\s*,\s*\{[\s\S]*?status:\s*4(?:00|22)[\s\S]*?\}\s*\)\s*;`,
  'g',
);

// Pattern F (broad sweep): any new Response with ZodErr.flatten() inside,
// status 400/422.  Catches "Dados inválidos", "Payload inválido",
// "invalid_input", "Invalid payload", arbitrary wrappers.
const PATTERN_F = new RegExp(
  String.raw`return\s+new\s+Response\(\s*JSON\.stringify\(\s*\{[^{}]*?\b([A-Za-z_$][\w$]*)\.error\.flatten\(\)[^{}]*?\}\s*\)\s*,\s*\{[\s\S]*?status:\s*4(?:00|22)[\s\S]*?\}\s*\)\s*;`,
  'g',
);

// Pattern G: jsonRes helper with arbitrary wrapper but ZodErr.flatten() inside.
const PATTERN_G = new RegExp(
  String.raw`return\s+jsonRes\(\s*corsHeaders\s*,\s*\{[^{}]*?\b([A-Za-z_$][\w$]*)\.error\.flatten\(\)[^{}]*?\}\s*,\s*4(?:00|22)\s*\)\s*;`,
  'g',
);

// Pattern H: issues[0]?.message form (visual-search, analyze-logo-colors).
const PATTERN_H = new RegExp(
  String.raw`return\s+new\s+Response\(\s*JSON\.stringify\(\s*\{\s*error:\s*([A-Za-z_$][\w$]*)\.error\.issues\[0\]\?\.message\s*\|\|\s*["'][^"']*["']\s*\}\s*\)\s*,\s*\{[\s\S]*?status:\s*4(?:00|22)[\s\S]*?\}\s*\)\s*;`,
  'g',
);

let totalChanged = 0;
let totalSkipped = 0;
const errors = [];

for (const name of TARGETS) {
  const path = resolve(`supabase/functions/${name}/index.ts`);
  let src;
  try {
    src = readFileSync(path, 'utf8');
  } catch (e) {
    errors.push(`${name}: read failed — ${e.message}`);
    continue;
  }
  const original = src;
  let patternHits = 0;

  const subst = (re) => {
    src = src.replace(re, (_m, parsedVar) => {
      patternHits++;
      return `return buildValidationErrorResponse(${parsedVar}.error, req, corsHeaders);`;
    });
  };
  subst(PATTERN_A);
  subst(PATTERN_B);
  subst(PATTERN_C);
  subst(PATTERN_D);
  subst(PATTERN_E);
  subst(PATTERN_F);
  subst(PATTERN_G);
  subst(PATTERN_H);

  if (patternHits === 0) {
    totalSkipped++;
    continue;
  }

  // Add helper import if missing.
  if (!HELPER_IMPORT_RE.test(src)) {
    // Find the last `import ... from "..."` line and inject after it.
    const lines = src.split('\n');
    let lastImportIdx = -1;
    for (let i = 0; i < lines.length; i++) {
      if (/^import\s/.test(lines[i])) lastImportIdx = i;
    }
    if (lastImportIdx >= 0) {
      lines.splice(
        lastImportIdx + 1,
        0,
        'import { buildValidationErrorResponse } from "../_shared/validation-errors.ts";',
      );
      src = lines.join('\n');
    } else {
      errors.push(`${name}: no import block found, manual fix required`);
      continue;
    }
  }

  if (src === original) {
    totalSkipped++;
    continue;
  }

  writeFileSync(path, src);
  totalChanged++;
  console.log(`✅ ${name} — ${patternHits} site(s) migrated`);
}

console.log(`\n--- CODEMOD SUMMARY ---`);
console.log(`Changed: ${totalChanged}`);
console.log(`Skipped: ${totalSkipped}`);
if (errors.length > 0) {
  console.log(`Errors:`);
  for (const e of errors) console.log(`  • ${e}`);
}
