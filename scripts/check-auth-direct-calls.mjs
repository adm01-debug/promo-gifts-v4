#!/usr/bin/env node
/**
 * check-auth-direct-calls.mjs — Onda 10
 *
 * Bane novos usos de `supabase.auth.<método>` fora de:
 *  - src/services/authService.ts (SSOT)
 *  - src/lib/auth/**            (wrappers)
 *  - src/integrations/**        (client auto-gen)
 *  - __tests__ folders          (testes)
 *
 * Falha o CI se detectar chamada direta em novo arquivo (baseline via allowlist).
 */
import { readFileSync } from 'node:fs';
import { globSync } from 'node:fs';
import { execSync } from 'node:child_process';

const ALLOWLIST_PREFIXES = [
  'src/services/authService.ts',
  'src/lib/auth/',
  'src/integrations/',
  // Onda 15: 'src/hooks/auth/' removido — usePasswordResetRequests usa resetPasswordSafe.
];

// Onda 15 — Regex v2: cobre `.auth.method(` e `['auth'].method(` / `["auth"].method(`.
const MUTABLE_METHODS =
  'signInWithPassword|signInWithOtp|signInWithOAuth|signUp|signOut|resetPasswordForEmail|updateUser|verifyOtp|refreshSession|exchangeCodeForSession|reauthenticate';
const PATTERN = new RegExp(
  String.raw`(?:\.auth\.|\[["']auth["']\]\.)(` + MUTABLE_METHODS + String.raw`)\s*\(`,
  'g',
);

let files = [];
try {
  const out = execSync('git ls-files "src/**/*.ts" "src/**/*.tsx"', {
    encoding: 'utf8',
  });
  files = out.split('\n').filter(Boolean);
} catch {
  files = globSync('src/**/*.{ts,tsx}');
}

const violations = [];
for (const f of files) {
  if (ALLOWLIST_PREFIXES.some((p) => f.startsWith(p))) continue;
  if (f.includes('__tests__') || f.endsWith('.test.ts') || f.endsWith('.test.tsx')) continue;
  const src = readFileSync(f, 'utf8');
  const matches = [...src.matchAll(PATTERN)];
  if (matches.length > 0) {
    for (const m of matches) {
      violations.push({ file: f, method: m[1] });
    }
  }
}

if (violations.length > 0) {
  console.error('❌ [auth-direct-calls] Chamadas diretas fora do SSOT:');
  for (const v of violations) {
    console.error(`  - ${v.file}: supabase.auth.${v.method}`);
  }
  console.error('\nUse authService.<op>Safe() ou src/lib/auth/safeAuthCall.');
  process.exit(1);
}

console.log('✅ [auth-direct-calls] Nenhuma chamada direta fora do SSOT.');
process.exit(0);
