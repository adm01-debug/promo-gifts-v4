import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';

const SRC_DIR = join(process.cwd(), 'src');
const ERRORS = [];

function walk(dir) {
  const files = readdirSync(dir);
  for (const file of files) {
    const path = join(dir, file);
    if (statSync(path).isDirectory()) {
      if (file !== 'node_modules' && file !== '.git') {
        walk(path);
      }
    } else {
      const ext = extname(path);
      if (ext === '.tsx' || ext === '.jsx' || ext === '.ts' || ext === '.js') {
        checkFile(path);
      }
    }
  }
}

function checkFile(path) {
  const content = readFileSync(path, 'utf-8');
  
  // 1. Check for mismatched motion tags (common error reported by user)
  // Looking for <motion.X but closing with </X> instead of </motion.X>
  const motionTagMatch = content.match(/<motion\.([a-z0-9]+)/gi);
  if (motionTagMatch) {
    for (const tag of motionTagMatch) {
      const tagName = tag.split('.')[1];
      const closingTag = `</${tagName}>`;
      if (content.includes(closingTag)) {
        // This is a heuristic, it might have false positives if there's both motion and non-motion tags
        // But if we find a motion.div and a </div> that closes it, it's risky.
        // Let's look for the specific pattern: <motion.div ... > ... </div>
        const pattern = new RegExp(`<motion\\.${tagName}[^>]*>[\\s\\S]*?<\\/${tagName}>`, 'g');
        const matches = content.match(pattern);
        if (matches) {
          ERRORS.push(`[Potential Mismatched Tag] In ${path}: Found <motion.${tagName}> closed with </${tagName}>. Should be </motion.${tagName}>`);
        }
      }
    }
  }

  // 2. Check for common syntax errors that might pass esbuild but break runtime
  // (e.g. missing imports that were caught earlier)
  if (content.includes('cn(') && !content.includes("from '@/lib/utils'") && !content.includes("from \"@/lib/utils\"")) {
    ERRORS.push(`[Missing Import] In ${path}: 'cn' is used but not imported from '@/lib/utils'.`);
  }
}

console.log('🔍 Starting Build Integrity Audit...');
walk(SRC_DIR);

if (ERRORS.length > 0) {
  console.error('\n❌ Build Integrity Audit FAILED:');
  ERRORS.forEach(err => console.error(err));
  process.exit(1);
} else {
  console.log('\n✅ Build Integrity Audit PASSED. No obvious syntax/JSX mismatches found.');
  process.exit(0);
}
