import fs from 'fs';
import path from 'path';
import { execSync } from 'child_process';

const CANONICAL_ID = 'doufsxqlfjyuvxuezpln';
const FORBIDDEN_ID = 'pqpdolkaeqlyzpdpbizo';

console.log(`[CI Guard] Checking for forbidden project ID: ${FORBIDDEN_ID}...`);

try {
  // Use ripgrep (rg) if available, or fallback to grep
  let output;
  try {
    output = execSync(`rg "${FORBIDDEN_ID}" --glob "!node_modules/*" --glob "!.git/*" --glob "!.agents/*"`, { encoding: 'utf8' });
  } catch (e) {
    // If rg finds nothing it exits with code 1, which is what we want for success.
    // If it finds something, output will be populated.
    output = e.stdout || '';
  }

  if (output.trim()) {
    console.error(`\x1b[31m[CRITICAL ERROR]\x1b[0m Found references to the forbidden legacy project ID (${FORBIDDEN_ID}):`);
    console.error(output);
    console.error(`\x1b[33mPlease ensure all configurations point to the canonical project: ${CANONICAL_ID}\x1b[0m`);
    process.exit(1);
  }

  console.log('\x1b[32m[OK]\x1b[0m No legacy project references found.');

  // Also verify that the canonical ID is present in critical files
  const criticalFiles = [
    'src/integrations/supabase/client.ts',
    'supabase/config.toml'
  ];

  for (const file of criticalFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      if (!content.includes(CANONICAL_ID)) {
        console.error(`\x1b[31m[ERROR]\x1b[0m Canonical project ID (${CANONICAL_ID}) missing from ${file}`);
        process.exit(1);
      }
    }
  }
  
  console.log('\x1b[32m[OK]\x1b[0m Canonical project ID verified in critical files.');
  process.exit(0);
} catch (error) {
  console.error('[CI Guard] Error during validation:', error.message);
  process.exit(1);
}
