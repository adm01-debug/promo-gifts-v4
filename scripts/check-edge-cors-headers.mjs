#!/usr/bin/env node
/**
 * CORS Headers Gate — Edge Functions
 *
 * Validates that every browser-callable edge function:
 *   1. Includes `x-request-id` in `Access-Control-Allow-Headers`
 *   2. Exposes `x-request-id` via `Access-Control-Expose-Headers`
 *
 * Two modes:
 *   - Functions that import `_shared/cors.ts` → validated transitively (one
 *     check on the shared module covers all of them).
 *   - Functions with **inline** CORS config → each `index.ts` is statically
 *     scanned for the two headers.
 *
 * Server-only functions (cron jobs, no browser preflight) can opt out via
 * the SERVER_ONLY_ALLOWLIST below. They still pass if compliant — opt-out
 * just means we don't fail when they're missing CORS entirely.
 *
 * Exit codes:
 *   0 — all good
 *   1 — at least one violation
 */
import { readFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";

const FUNCTIONS_DIR = "supabase/functions";
const SHARED_CORS = join(FUNCTIONS_DIR, "_shared", "cors.ts");
const REQUIRED_ALLOW = "x-request-id";
const REQUIRED_EXPOSE = "x-request-id";

// Server-only / cron functions that are NEVER hit by a browser preflight.
// They are excluded from the inline-CORS strict check (missing CORS is OK).
// If they DO declare CORS, it must still be compliant.
const SERVER_ONLY_ALLOWLIST = new Set([
  "cleanup-notifications",
  "process-queue",
  "process-scheduled-reports",
  "quote-followup-reminders",
  "send-digest",
  "send-scheduled-reports",
  "favorites-watcher",
  "collections-watcher",
  "comparison-price-watcher",
  "commemorative-dates",
  "cleanup-novelties",
  "rls-audit",
  "rls-integration-tests",
  "rls-matrix-export",
  "ownership-audit",
  "connections-auto-test",
  "connections-health-check",
  "connections-hub-audit",
  // pg_cron jobs — called via net.http_post internally, never by a browser.
  "backfill-image-dimensions",
  "asia-ingestion",
  "hash-product-images",
  "generate-blurhashes",
]);

function listFunctionDirs() {
  return readdirSync(FUNCTIONS_DIR)
    .filter((name) => !name.startsWith("_") && name !== "tests")
    .map((name) => ({ name, dir: join(FUNCTIONS_DIR, name) }))
    .filter(({ dir }) => {
      try { return statSync(dir).isDirectory(); } catch { return false; }
    })
    .filter(({ dir }) => existsSync(join(dir, "index.ts")));
}

/**
 * Extracts every Access-Control-Allow-Headers / Expose-Headers value declared
 * literally in a source file (string literal RHS or object property value).
 * Returns lowercase tokens grouped by header name. Robust to single/double quotes
 * and template literals without interpolation.
 */
function extractCorsLiterals(src) {
  const allow = new Set();
  const expose = new Set();

  const collect = (target, value) => {
    if (!value) return;
    for (const tok of value.split(",")) {
      const t = tok.trim().toLowerCase();
      if (t) target.add(t);
    }
  };

  // Match: 'Access-Control-Allow-Headers'( | : | =) ... 'value'
  const reAllow = /access-control-allow-headers["'\s:=,]+["'`]([^"'`]+)["'`]/gi;
  const reExpose = /access-control-expose-headers["'\s:=,]+["'`]([^"'`]+)["'`]/gi;

  let m;
  while ((m = reAllow.exec(src)) !== null) collect(allow, m[1]);
  while ((m = reExpose.exec(src)) !== null) collect(expose, m[1]);

  return { allow, expose };
}

function checkSharedCors() {
  const src = readFileSync(SHARED_CORS, "utf8");
  const { expose } = extractCorsLiterals(src);
  const violations = [];

  // Allow-Headers in the shared module is built from the ALLOWED_HEADERS_LIST
  // array literal — parse it directly.
  const arrayMatch = src.match(/ALLOWED_HEADERS_LIST\s*=\s*\[([\s\S]*?)\]/);
  const allowTokens = new Set();
  if (arrayMatch) {
    for (const m of arrayMatch[1].matchAll(/["'`]([^"'`]+)["'`]/g)) {
      allowTokens.add(m[1].trim().toLowerCase());
    }
  }
  if (!allowTokens.has(REQUIRED_ALLOW)) {
    violations.push(`_shared/cors.ts: ALLOWED_HEADERS_LIST missing "${REQUIRED_ALLOW}"`);
  }
  if (!expose.has(REQUIRED_EXPOSE)) {
    violations.push(`_shared/cors.ts: missing "${REQUIRED_EXPOSE}" in Access-Control-Expose-Headers`);
  }
  return violations;
}

function checkInlineFunction(name, dir) {
  const src = readFileSync(join(dir, "index.ts"), "utf8");

  // If the function declares no CORS at all and is server-only, skip silently.
  const hasAnyCors = /access-control-allow-headers/i.test(src);
  if (!hasAnyCors) {
    if (SERVER_ONLY_ALLOWLIST.has(name)) return [];
    return [`${name}: no CORS configuration found (browser-callable function must declare CORS)`];
  }

  const { allow, expose } = extractCorsLiterals(src);
  const violations = [];
  if (!allow.has(REQUIRED_ALLOW)) {
    violations.push(`${name}: missing "${REQUIRED_ALLOW}" in Access-Control-Allow-Headers`);
  }
  if (!expose.has(REQUIRED_EXPOSE)) {
    violations.push(`${name}: missing "${REQUIRED_EXPOSE}" in Access-Control-Expose-Headers`);
  }
  return violations;
}

function main() {
  const violations = [];

  // 1) Shared module gate
  violations.push(...checkSharedCors());

  // 2) Per-function gate
  const fns = listFunctionDirs();
  let usingShared = 0;
  let inlineChecked = 0;
  let inlineSkipped = 0;

  for (const { name, dir } of fns) {
    const src = readFileSync(join(dir, "index.ts"), "utf8");
    if (/_shared\/cors/.test(src)) {
      usingShared++;
      continue; // covered by shared check
    }
    if (SERVER_ONLY_ALLOWLIST.has(name) && !/access-control-allow-headers/i.test(src)) {
      inlineSkipped++;
      continue;
    }
    inlineChecked++;
    violations.push(...checkInlineFunction(name, dir));
  }

  const total = fns.length;
  console.log(`[cors-gate] scanned ${total} functions: ${usingShared} via _shared/cors, ${inlineChecked} inline checked, ${inlineSkipped} server-only skipped`);

  if (violations.length > 0) {
    console.error(`\n❌ CORS gate failed (${violations.length} violation${violations.length === 1 ? "" : "s"}):`);
    for (const v of violations) console.error(`  • ${v}`);
    console.error(`\nFix: ensure each violating function includes "${REQUIRED_ALLOW}" in Access-Control-Allow-Headers AND exposes it via Access-Control-Expose-Headers, or migrate it to import getCorsHeaders from "../_shared/cors.ts".`);
    process.exit(1);
  }

  console.log(`✅ CORS gate passed: x-request-id present in Allow-Headers and Expose-Headers across all browser-callable edge functions.`);
}

main();
