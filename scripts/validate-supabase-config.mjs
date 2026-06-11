import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { config } from 'dotenv';

// Load .env file into process.env to catch variables that are not explicitly passed but exist in the project root
if (existsSync('.env')) {
  config();
}

const CLIENT_PATH = join(process.cwd(), 'src/integrations/supabase/client.ts');
// SSOT: projeto Gold/Medallion de produção (doufsxqlfjyuvxuezpln).
const CANONICAL_PROJECT_ID = 'doufsxqlfjyuvxuezpln';

console.log('🚀 Validating Supabase Project Connection Configuration...');

try {
  const content = readFileSync(CLIENT_PATH, 'utf-8');

  // 1. Check if the canonical project ID constant matches in the code
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
  const codeOnly = content.replace(/\/\/.*$/gm, '');
  const hasForbiddenRefs = codeOnly.includes('pqpdolkaeqlyzpdpbizo');
  if (hasForbiddenRefs) {
    console.error(`❌ ERROR: Lovable Cloud project (pqpdolkaeqlyzpdpbizo) found in executable code in ${CLIENT_PATH}. Use ${CANONICAL_PROJECT_ID}.`);
    process.exit(1);
  }

  // 4. Validate current environment variables consistency
  const envUrl = process.env.VITE_SUPABASE_URL;
  
  if (envUrl) {
    const isLocal = envUrl.includes('localhost') || envUrl.includes('127.0.0.1');
    const isPlaceholder = envUrl.includes('placeholder');
    
    if (!isLocal && !isPlaceholder && !envUrl.includes(CANONICAL_PROJECT_ID)) {
      console.error(`❌ ERROR: VITE_SUPABASE_URL (from environment or .env) points to a different project: ${envUrl}. Expected: ${CANONICAL_PROJECT_ID}`);
      process.exit(1);
    }
    console.log(`✅ VITE_SUPABASE_URL is consistent with ${CANONICAL_PROJECT_ID}`);
  } else {
    console.log('⚠️  No VITE_SUPABASE_URL found in environment, the client will fallback to CANONICAL_URL.');
  }

  console.log('✅ Supabase configuration validation passed.');
} catch (error) {
  console.error('❌ Failed to validate Supabase configuration:', error.message);
  process.exit(1);
}
