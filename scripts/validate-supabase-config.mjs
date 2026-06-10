import { readFileSync } from 'fs';
import { join } from 'path';

const CLIENT_PATH = join(process.cwd(), 'src/integrations/supabase/client.ts');
const CANONICAL_PROJECT_ID = 'pqpdolkaeqlyzpdpbizo';
const CANONICAL_URL = `https://${CANONICAL_PROJECT_ID}.supabase.co`;

console.log('\u{1F680} Validating Supabase Project Connection Configuration...');

try {
  const content = readFileSync(CLIENT_PATH, 'utf-8');

  // 1. Check if the canonical URL constant matches the CURRENT project
  const hasCanonicalUrl = content.includes(CANONICAL_URL);
  if (!hasCanonicalUrl) {
    console.error(`\u274C ERROR: Project URL "${CANONICAL_URL}" not found in ${CLIENT_PATH}. This might mean the app is pointing to an external project.`);
    process.exit(1);
  }

  // 2. Check for boot validation logic
  const hasValidationLogic = content.includes('validateEnv') && content.includes('CURRENT_PROJECT_ID');
  if (!hasValidationLogic) {
    console.error(`\u274C ERROR: Boot validation logic for "${CANONICAL_PROJECT_ID}" not found in ${CLIENT_PATH}`);
    process.exit(1);
  }

  // 3. Ensure no mentions of the old project remain as fallbacks
  const hasForbiddenRefs = content.includes('doufsxqlfjyuvxuezpln');
  if (hasForbiddenRefs) {
    console.error(`\u274C ERROR: Hardcoded reference to EXTERNAL project found in ${CLIENT_PATH}.`);
    process.exit(1);
  }

  console.log('\u2705 Supabase connection is correctly pointing to the current project.');
} catch (error) {
  console.error('\u274C Failed to validate Supabase configuration:', error.message);
  process.exit(1);
}
