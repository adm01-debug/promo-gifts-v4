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

function countOccurrences(str, substr) {
  return str.split(substr).length - 1;
}

function checkFile(path) {
  const content = readFileSync(path, 'utf-8');
  
  // 1. Strict count check for motion tags
  const motionTags = ['div', 'span', 'button', 'section', 'article', 'nav', 'header', 'footer', 'tr', 'td', 'li', 'ul', 'ol', 'p', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'];
  
  for (const tag of motionTags) {
    const openTag = `<motion.${tag}`;
    const closeTag = `</motion.${tag}>`;
    
    // We only care if the tag is actually used
    if (content.includes(openTag)) {
      const openCount = countOccurrences(content, openTag);
      const closeCount = countOccurrences(content, closeTag);
      
      if (openCount !== closeCount) {
        // Potential mismatch. But wait, it could be a self-closing tag or a variable?
        // motion tags are rarely self-closing if they have content, but <motion.div /> is valid.
        const selfClosingCount = countOccurrences(content, `<motion.${tag} />`) + 
                                countOccurrences(content, `<motion.${tag}  />`); // Basic check for self-closing
        
        if (openCount !== (closeCount + selfClosingCount)) {
           // Before failing, check if the standard closing tag exists and might be mis-used
           const standardClose = `</${tag}>`;
           if (content.includes(standardClose)) {
             ERRORS.push(`[Mismatched Tag] In ${path}: Found ${openCount} <motion.${tag}> but only ${closeCount} </motion.${tag}>. Check if you closed it with ${standardClose} by mistake.`);
           }
        }
      }
    }
  }

  // 2. Missing Import check
  if (content.includes('cn(') && !content.includes("from '@/lib/utils'")) {
    ERRORS.push(`[Missing Import] In ${path}: 'cn' is used but not imported from '@/lib/utils'.`);
  }
}

console.log('🔍 Starting Build Integrity Audit (Strict Version)...');
walk(SRC_DIR);

if (ERRORS.length > 0) {
  console.error('\n❌ Build Integrity Audit FAILED:');
  ERRORS.forEach(err => console.error(err));
  process.exit(1);
} else {
  console.log('\n✅ Build Integrity Audit PASSED. No obvious motion tag mismatches found.');
  process.exit(0);
}
