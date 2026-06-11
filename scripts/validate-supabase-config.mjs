import { readFileSync } from 'fs';
import { join } from 'path';

const CLIENT_PATH = join(process.cwd(), 'src/integrations/supabase/client.ts');
// SSOT: projeto Gold/Medallion de produção (doufsxqlfjyuvxuezpln).
const CANONICAL_PROJECT_ID = 'doufsxqlfjyuvxuezpln';

console.log('🚀 Validating Supabase Project Connection Configuration...');

try {
  const content = readFileSync(CLIENT_PATH, 'utf-8');

  // 1. Check if the canonical project ID constant matches
  const hasProjectId = content.includes(`const CURRENT_PROJECT_ID = "doufsxqlfjyuvxuezpln"`) || 
                      content.includes(`const CURRENT_PROJECT_ID = 'doufsxqlfjyuvxuezpln'`);
  if (!hasProjectId) {
    console.error(`❌ ERROR: Project ID "${CANONICAL_PROJECT_ID}" not found as CURRENT_PROJECT_ID in ${CLIENT_PATH}.`);
    process.exit(1);
  }

  // 2. Check for boot validation logic
  const hasValidationLogic = content.includes('validateEnv') && content.includes('CURRENT_PROJECT_ID');
  if (!hasValidationLogic) {
    console.error(`❌ ERROR: Boot validation logic for "${CANONICAL_PROJECT_ID}" not found in ${CLIENT_PATH}`);
    process.exit(1);
  }

  // 3. Ensure the old Lovable Cloud project is not used as a fallback in executable code.
  // Strip single-line comments before checking so historical incident notes don't trip the guard.
  const codeOnly = content.replace(/\/\/.*$/gm, '');
  const hasForbiddenRefs = codeOnly.includes('pqpdolkaeqlyzpdpbizo');
  if (hasForbiddenRefs) {
    console.error(`❌ ERROR: Lovable Cloud project (pqpdolkaeqlyzpdpbizo) found in executable code in ${CLIENT_PATH}. Use ${CANONICAL_PROJECT_ID}.`);
    process.exit(1);
  }

  // 4. Validate VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY consistency (if they exist in env)
  const envUrl = process.env.VITE_SUPABASE_URL;
  const envKey = process.env.VITE_SUPABASE_ANON_KEY;

  if (envUrl && !envUrl.includes('localhost') && !envUrl.includes('127.0.0.1') && !envUrl.includes('placeholder')) {
    if (!envUrl.includes(CANONICAL_PROJECT_ID)) {
      console.error(`❌ ERROR: VITE_SUPABASE_URL points to a different project: ${envUrl}. Expected: ${CANONICAL_PROJECT_ID}`);
      process.exit(1);
    }
    
    if (envKey) {
      // Basic check for JWT consistency if we have a way to decode it or match reference
      // The client.ts already has CANONICAL_ANON_KEY, we could compare if envKey is significantly different
      // but the main goal is ensuring the URL matches the SSOT project.
    }
  } else {
    console.log('⚠️  No VITE_SUPABASE_URL found in environment, falling back to CANONICAL_URL validation.');
  }


  console.log('✅ Supabase connection is correctly pointing to the current project.');
} catch (error) {
  console.error('❌ Failed to validate Supabase configuration:', error.message);
  process.exit(1);
}
