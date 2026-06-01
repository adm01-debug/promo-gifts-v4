import { readFileSync } from 'fs';
import { join } from 'path';

const CLIENT_PATH = join(process.cwd(), 'src/integrations/supabase/client.ts');
const CANONICAL_PROJECT_ID = 'doufsxqlfjyuvxuezpln';
const CANONICAL_URL = `https://${CANONICAL_PROJECT_ID}.supabase.co`;

console.log('\u{1F680} Validating Supabase Canonical Connection Configuration...');

try {
  const content = readFileSync(CLIENT_PATH, 'utf-8');

  // 1. Check if the canonical URL constant exists and matches
  const hasCanonicalUrl = content.includes(CANONICAL_URL);
  if (!hasCanonicalUrl) {
    console.error(`\u274C ERROR: Canonical URL "${CANONICAL_URL}" not found in ${CLIENT_PATH}`);
    process.exit(1);
  }

  // 2. Check if the fallback/enforcement logic is present
  // Accepts either the old envMatchesCanonical pattern or the newer envPointsToForbidden pattern
  const hasFallbackLogic =
    content.includes('.includes("doufsxqlfjyuvxuezpln")') ||
    content.includes('FORBIDDEN_REFS') ||
    content.includes('envPointsToForbidden');
  if (!hasFallbackLogic) {
    console.error(`\u274C ERROR: Enforcement logic for "${CANONICAL_PROJECT_ID}" not found in ${CLIENT_PATH}`);
    process.exit(1);
  }

  // 3. Ensure SUPABASE_URL is assigned using the validation logic
  // Accepts either the old envMatchesCanonical pattern or the newer envPointsToForbidden pattern
  const hasCorrectAssignment =
    content.includes('export const SUPABASE_URL = envMatchesCanonical ? (envUrl as string) : CANONICAL_URL;') ||
    content.includes('export const SUPABASE_URL = envPointsToForbidden || !envUrl ? CANONICAL_URL : envUrl;');
  if (!hasCorrectAssignment) {
    console.error(`\u274C ERROR: SUPABASE_URL assignment does not enforce canonical fallback in ${CLIENT_PATH}`);
    process.exit(1);
  }

  console.log('\u2705 Supabase Canonical Connection is strictly enforced.');
} catch (error) {
  console.error('\u274C Failed to read or validate Supabase client configuration:', error.message);
  process.exit(1);
}
