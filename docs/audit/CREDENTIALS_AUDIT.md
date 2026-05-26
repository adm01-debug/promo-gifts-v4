# Credentials Audit

Static analyzer that catches the 3 bug classes found in the 26/05/2026 audit (PR #429, #430).

## Why

The original audit found 11 bugs related to credential handling. Two of them (BUG-001 in `elevenlabs-tts`, BUG-008 in `ai-recommendations`) had identical root cause and passed both TypeScript and ESLint silently — they only failed at runtime, with `Bearer [object Object]` being sent to APIs. This audit script is the safety net that prevents that exact class of bug from coming back.

## Rules

### `resolve-credential-type-mismatch` (CRITICAL)

`resolveCredential()` returns `CredentialResolution` (object), not a string. Assigning it directly and interpolating into a header sends `Bearer [object Object]` and breaks 100% of calls. `tsc` does not catch it because objects have valid `.toString()`.

**Catches:** BUG-001 family.

```ts
// ❌ WRONG
const KEY = await resolveCredential('SOME_KEY');
fetch(url, { headers: { Authorization: `Bearer ${KEY}` } }); // → Bearer [object Object]

// ✅ CORRECT
const { value: KEY } = await resolveCredential('SOME_KEY');
fetch(url, { headers: { Authorization: `Bearer ${KEY}` } }); // → Bearer sk-...
```

### `ssot-bypass` (HIGH)

User-configurable credentials must go through `resolveCredential()` so values set via `/admin/conexoes` (DB) take precedence over `.env`.

**Catches:** BUG-002, BUG-005, BUG-006 family.

```ts
// ❌ WRONG
const token = Deno.env.get('DROPBOX_ACCESS_TOKEN');

// ✅ CORRECT
const { value: token } = await resolveCredential('DROPBOX_ACCESS_TOKEN');
```

Platform-managed credentials (`SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `LOVABLE_API_KEY`, etc.) are allowlisted in the script and may use `Deno.env.get()` directly.

### `module-scope-credential-read` (HIGH)

Credentials read at module scope (above `Deno.serve(...)`) are frozen at cold-start. Rotations via `/admin/conexoes` won't take effect until the isolate is recycled.

**Catches:** BUG-009, BUG-010 family.

```ts
// ❌ WRONG
const N8N_URL = Deno.env.get('N8N_QUOTE_WEBHOOK_URL'); // module scope

Deno.serve(async (req) => { /* uses N8N_URL */ });

// ✅ CORRECT
Deno.serve(async (req) => {
  const { value: N8N_URL } = await resolveCredential('N8N_QUOTE_WEBHOOK_URL');
});
```

## How it runs

CI runs `scripts/audit-credentials.mjs --baseline .audit-credentials-baseline.json` on every PR touching `supabase/functions/**`. Workflow at `.github/workflows/credentials-audit.yml`.

**Behavior:**
- Issues already in `.audit-credentials-baseline.json` are ignored (matches repo convention with `.eslint-baseline.json`, `.tsc-baseline.json`).
- Issues NOT in the baseline fail the build.

## Local usage

```bash
# See all issues (no baseline)
node scripts/audit-credentials.mjs

# See only new issues (CI behavior)
node scripts/audit-credentials.mjs --baseline .audit-credentials-baseline.json

# JSON output for tooling
node scripts/audit-credentials.mjs --json

# Update the baseline AFTER fixing or accepting current state
node scripts/audit-credentials.mjs --update-baseline .audit-credentials-baseline.json
```

NPM scripts (added to `package.json`):

```bash
npm run audit:credentials                 # see new issues
npm run audit:credentials:all             # see all issues
npm run audit:credentials:update-baseline # snapshot current state
```

## Baseline burn-down

Initial baseline created on 2026-05-26 contains 31 pre-existing issues across:
- `health-check`, `materials-api`, `product-webhook`, `secure-upload`,
- `send-scheduled-reports`, `simulation-orchestrator`, `sync-external-db`, `webhook-dispatcher`.

These are tracked for future PRs to gradually fix. **Do not** add to the baseline; only remove from it as bugs are fixed.

## Adding new credentials

If you add a new user-configurable credential (managed via `/admin/conexoes`), no script change is needed if its name matches the existing patterns: `*_API_KEY`, `*_ACCESS_TOKEN`, `*_WEBHOOK_URL`, `*_WEBHOOK_SECRET`, `EXTERNAL_*`, or starts with one of the known service prefixes.

For other names, add the pattern to `USER_CREDENTIAL_PATTERNS` in `scripts/audit-credentials.mjs`.

## Platform-managed credentials (allowlisted)

These bypass the rules because they are injected by the Supabase/Lovable runtime:

- `SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `ANON_KEY`
- `LOVABLE_API_KEY`
- Operational flags: `ALLOW_HTTP_FETCH`, `IMAGE_PROXY_*`, `DENO_DEPLOYMENT_ID`, `DENO_REGION`
