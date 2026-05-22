#!/usr/bin/env node
/**
 * CI guard: forbid inline validation-error responses in Edge Functions.
 *
 * Forces every new endpoint to use the unified helpers in
 * `_shared/validation-errors.ts` so the v1/v2 contract stays consistent.
 *
 * Run from CI: node scripts/check-unified-validation-errors.mjs
 *
 * Exit 0 = clean, exit 1 = regressions found.
 */
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve, join } from 'node:path';

const FUNCTIONS_DIR = resolve('supabase/functions');
const SHARED = '_shared';
// Endpoints intentionally exempt from this rule.
const EXEMPT = new Set([
  // Silent-fallback intake; never returns a validation error.
  'validate-access',
]);

// Patterns that signal an inline validation-error response.
const FORBIDDEN_PATTERNS = [
  // new Response(JSON.stringify({ error: "Validation failed" | "Invalid input" | ... + ZodErr.flatten() }))
  /JSON\.stringify\(\s*\{[^{}]*error:[^{}]*["'](?:Validation failed|Invalid input|Dados inválidos|Payload inválido|invalid_input|validation_failed)["'][^{}]*\.error\.flatten\(\)[^{}]*\}\s*\)/,
  // jsonResponse({error: ..., fields: ZodErr.flatten...}, 422 or 400, requestId)
  /jsonResponse\(\s*\{[^{}]*error:[^{}]*["']validation_failed["'][^{}]*fields[^{}]*\}\s*,\s*4\d\d/,
  // Direct dump of ZodErr.flatten() as the error message (no canonical envelope).
  /JSON\.stringify\(\s*\{\s*error:\s*\w+\.error\.flatten\(\)/,
];

function listDirs(p) {
  return readdirSync(p).filter((n) => {
    const full = join(p, n);
    return statSync(full).isDirectory();
  });
}

const violations = [];

for (const fn of listDirs(FUNCTIONS_DIR)) {
  if (fn === SHARED || EXEMPT.has(fn)) continue;
  const file = join(FUNCTIONS_DIR, fn, 'index.ts');
  let src;
  try {
    src = readFileSync(file, 'utf8');
  } catch {
    continue; // no index.ts
  }
  for (const pat of FORBIDDEN_PATTERNS) {
    if (pat.test(src)) {
      violations.push({ fn, pattern: pat.source.slice(0, 80) });
    }
  }
}

if (violations.length === 0) {
  console.log('✅ All Edge Functions use the unified validation error envelope.');
  process.exit(0);
}

console.error('❌ Inline validation-error responses detected.');
console.error('   Migrate to buildValidationErrorResponse / buildValidationErrorV2');
console.error('   from supabase/functions/_shared/validation-errors.ts');
console.error('');
for (const v of violations) {
  console.error(`  • ${v.fn} — matched: /${v.pattern}.../`);
}
console.error('');
console.error('See docs/WEBHOOKS_CONTRACT.md for migration examples.');
process.exit(1);
