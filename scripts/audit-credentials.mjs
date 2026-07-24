#!/usr/bin/env node
/**
 * audit-credentials.mjs
 *
 * Static analyzer for credential handling in supabase/functions/**.
 *
 * Rules:
 *
 *   resolve-credential-type-mismatch (CRITICAL) — BUG-001/BUG-008 family
 *     `const KEY = await resolveCredential('X')` assigns the full CredentialResolution object
 *     (not a string). When interpolated into headers, sends `Bearer [object Object]`.
 *     tsc does not catch this because objects have valid `.toString()`.
 *     Fix: `const { value: KEY } = await resolveCredential('X')`
 *
 *   ssot-bypass (HIGH) — BUG-002/BUG-005/BUG-006 family
 *     `Deno.env.get('USER_CREDENTIAL')` for a credential that is user-configurable via /admin/conexoes.
 *     Fix: use resolveCredential() (DB-first → env fallback).
 *
 *   module-scope-credential-read (HIGH) — BUG-009/BUG-010 family
 *     Credential read at module scope (outside Deno.serve handler).
 *     Cold-start frozen; key rotations have no effect until isolate restart.
 *     Fix: move inside the handler.
 *
 * Modes:
 *   default          — human-readable report, exits 1 if any issue
 *   --json           — machine-readable JSON output
 *   --baseline FILE  — compare against baseline; only fail on issues NOT in baseline
 *   --update-baseline FILE — write current issues to baseline file (no failure)
 *   --quiet          — suppress success message
 */

import { readdirSync, readFileSync, statSync, writeFileSync, existsSync } from 'node:fs';
import { join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const ROOT = join(__dirname, '..');
const FUNCTIONS_DIR = join(ROOT, 'supabase', 'functions');

// Platform-managed credentials — Deno.env.get() is correct for these.
const PLATFORM_MANAGED = new Set([
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'ANON_KEY',
  'LOVABLE_API_KEY',
  'ALLOW_HTTP_FETCH',
  'IMAGE_PROXY_MAX_BYTES',
  'IMAGE_PROXY_ALLOW_LOCALHOST',
  'IMAGE_PROXY_TIMEOUT_MS',
  'DENO_DEPLOYMENT_ID',
  'DENO_REGION',
]);

// Patterns that mark a credential as user-configurable.
const USER_CREDENTIAL_PATTERNS = [
  /^EXTERNAL_/,
  /_API_KEY$/,
  /_ACCESS_TOKEN$/,
  /_WEBHOOK_URL$/,
  /_WEBHOOK_SECRET$/,
  /^CNPJA_/,
  /^DROPBOX_/,
  /^ELEVENLABS_/,
  /^HUGGINGFACE_/,
  /^N8N_/,
  /^SALESPRO_/,
  /^QUOTE_SYNC_/,
  /^BITRIX_/,
  /^CRM_/,
  /^RESEND_/,
  /^VIRUSTOTAL_/,
  /^WEBHOOK_DISPATCHER_SECRET$/,
];

function isUserCredential(name) {
  if (PLATFORM_MANAGED.has(name)) return false;
  return USER_CREDENTIAL_PATTERNS.some((p) => p.test(name));
}

function* walk(dir) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const st = statSync(full);
    if (st.isDirectory()) {
      if (entry === 'node_modules' || entry === '_shared') continue;
      yield* walk(full);
    } else if (entry === 'index.ts' || entry === 'index.tsx') {
      yield full;
    }
  }
}

const issues = [];

function addIssue(file, line, severity, rule, message) {
  issues.push({
    file: relative(ROOT, file).replace(/\\/g, '/'),
    line,
    severity,
    rule,
    message,
  });
}

function findHandlerStart(lines) {
  for (let i = 0; i < lines.length; i++) {
    if (/Deno\.serve\s*\(/.test(lines[i])) return i;
  }
  return lines.length;
}

function auditFile(file) {
  const text = readFileSync(file, 'utf8');
  const lines = text.split('\n');
  const handlerStart = findHandlerStart(lines);

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineNum = i + 1;

    const trimmed = line.trim();
    if (trimmed.startsWith('//') || trimmed.startsWith('*')) continue;

    // RULE 1: resolveCredential type mismatch
    const wrongResolveMatch = line.match(
      /(?:const|let)\s+([A-Z_][A-Z0-9_]*)\s*=\s*await\s+resolveCredential\s*\(/,
    );
    if (wrongResolveMatch) {
      addIssue(
        file,
        lineNum,
        'CRITICAL',
        'resolve-credential-type-mismatch',
        `'${wrongResolveMatch[1]}' assigned the full CredentialResolution object instead of .value. ` +
          `Use: const { value: ${wrongResolveMatch[1]} } = await resolveCredential(...)`,
      );
    }

    // RULE 2: SSOT bypass
    const envGetMatches = [...line.matchAll(/Deno\.env\.get\s*\(\s*['"]([A-Z_][A-Z0-9_]*)['"]\s*\)/g)];
    for (const m of envGetMatches) {
      const credName = m[1];
      if (isUserCredential(credName)) {
        addIssue(
          file,
          lineNum,
          'HIGH',
          'ssot-bypass',
          `Credential '${credName}' read via Deno.env.get(). Use resolveCredential('${credName}').`,
        );
      }
    }

    // RULE 3: module-scope credential read
    if (i < handlerStart) {
      for (const m of envGetMatches) {
        if (isUserCredential(m[1]) && /^\s*(?:const|let|var)\s+/.test(line)) {
          addIssue(
            file,
            lineNum,
            'HIGH',
            'module-scope-credential-read',
            `Credential '${m[1]}' read at module scope (cold-start frozen). Move inside the handler.`,
          );
        }
      }
      if (/^\s*(?:const|let|var)\s+.*=\s*await\s+resolveCredential\s*\(/.test(line)) {
        addIssue(
          file,
          lineNum,
          'HIGH',
          'module-scope-credential-read',
          `resolveCredential() called at module scope. Move inside the handler.`,
        );
      }
    }
  }
}

// Stable signature for baseline matching (file:line:rule:credentialName-or-empty).
function signature(issue) {
  const credMatch = issue.message.match(/'([A-Z_][A-Z0-9_]*)'/);
  const cred = credMatch ? credMatch[1] : '';
  return `${issue.file}:${issue.line}:${issue.rule}:${cred}`;
}

// CLI arg parsing
const args = process.argv.slice(2);
const isJson = args.includes('--json');
const isQuiet = args.includes('--quiet');
const baselineIdx = args.indexOf('--baseline');
const baselinePath = baselineIdx >= 0 ? args[baselineIdx + 1] : null;
const updateBaselineIdx = args.indexOf('--update-baseline');
const updateBaselinePath = updateBaselineIdx >= 0 ? args[updateBaselineIdx + 1] : null;

// Main scan
let scanned = 0;
try {
  for (const file of walk(FUNCTIONS_DIR)) {
    auditFile(file);
    scanned++;
  }
} catch (err) {
  console.error('Error walking functions directory:', err.message);
  process.exit(2);
}

// Update baseline mode — write and exit 0
if (updateBaselinePath) {
  const payload = {
    generated_at: new Date().toISOString(),
    issue_count: issues.length,
    issues: issues.map((i) => signature(i)).sort(),
  };
  writeFileSync(updateBaselinePath, JSON.stringify(payload, null, 2) + '\n');
  console.log(`📝 Baseline updated: ${updateBaselinePath} (${issues.length} known issues)`);
  process.exit(0);
}

// Load baseline if provided
let baselineSet = null;
if (baselinePath) {
  if (!existsSync(baselinePath)) {
    console.error(`❌ Baseline file not found: ${baselinePath}`);
    process.exit(2);
  }
  const baselineData = JSON.parse(readFileSync(baselinePath, 'utf8'));
  baselineSet = new Set(baselineData.issues || []);
}

// Partition issues
const newIssues = [];
const knownIssues = [];
for (const issue of issues) {
  const sig = signature(issue);
  if (baselineSet && baselineSet.has(sig)) {
    knownIssues.push(issue);
  } else {
    newIssues.push(issue);
  }
}

// Output
if (isJson) {
  console.log(JSON.stringify({ scanned, total: issues.length, new: newIssues, known: knownIssues.length }, null, 2));
} else {
  console.log(`\n🔍 Credentials audit — scanned ${scanned} edge function(s)`);
  if (baselineSet) {
    console.log(`   Baseline: ${baselinePath} (${baselineSet.size} known issues)`);
  }
  console.log('');

  if (newIssues.length === 0) {
    if (!isQuiet) {
      console.log(`✅ No new credential issues (${knownIssues.length} pre-existing in baseline).\n`);
    }
  } else {
    console.log(`❌ Found ${newIssues.length} NEW issue(s) not in baseline:\n`);
    for (const i of newIssues) {
      const icon = i.severity === 'CRITICAL' ? '🔴' : i.severity === 'HIGH' ? '🟠' : '🟡';
      console.log(`${icon} [${i.severity}] ${i.rule}`);
      console.log(`   ${i.file}:${i.line}`);
      console.log(`   ${i.message}\n`);
    }
    if (knownIssues.length > 0) {
      console.log(`(${knownIssues.length} pre-existing issues from baseline are ignored.)`);
    }
    console.log('\nTo update the baseline (only after fixing or accepting new state):');
    console.log('  npm run audit:credentials:update-baseline\n');
  }
}

process.exit(newIssues.length > 0 ? 1 : 0);
