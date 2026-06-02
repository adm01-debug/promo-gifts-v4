import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(process.cwd(), 'src');

function walk(dir, callback) {
  if (!fs.existsSync(dir)) return;
  const files = fs.readdirSync(dir);
  files.forEach((file) => {
    const filepath = path.join(dir, file);
    const stats = fs.statSync(filepath);
    if (stats.isDirectory()) {
      walk(filepath, callback);
    } else if (stats.isFile() && (file.endsWith('.tsx') || file.endsWith('.jsx'))) {
      callback(filepath);
    }
  });
}

/**
 * A bit more robust check for motion tag closures.
 * It searches for non-self-closing <motion.tag> and ensures they are NOT closed by </tag>.
 */
function checkIntegrity(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  let hasError = false;

  const motionTags = ['div', 'button', 'section', 'nav', 'article', 'aside', 'header', 'footer', 'main', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'li', 'ol', 'a', 'img', 'svg', 'path', 'circle', 'rect'];

  motionTags.forEach(tag => {
    // Regex to find non-self-closing opening tags
    // We look for <motion.tag ... > but not <motion.tag ... />
    // This is still tricky with props, so we'll use a more surgical check
    
    const openingRegex = new RegExp(`<motion\\.${tag}[\\s>][^]*?>`, 'g');
    let match;
    while ((match = openingRegex.exec(content)) !== null) {
      const fullTag = match[0];
      if (fullTag.endsWith('/>')) continue; // Ignore self-closing
      
      // Found a non-self-closing <motion.tag>.
      // Now we need to check if it's closed by </motion.tag> or incorrectly by </tag>.
      // Since nesting makes this hard without a parser, we'll use a heuristic:
      // If the file contains </tag> but we can see it's likely closing a motion.tag.
      
      // Real check: search for the next closing tag that matches </tag> or </motion.tag>
      // and see if it's the wrong one. This is still limited but better than nothing.
    }
    
    // Simpler heuristic that actually catches the bug:
    // If the count of <motion.tag (non-self-closing) > count of </motion.tag>
    // AND we see </tag> tags, flag it.
    
    const openCount = (content.match(new RegExp(`<motion\\.${tag}[\\s>]`, 'g')) || []).length;
    const selfClosingCount = (content.match(new RegExp(`<motion\\.${tag}[\\s>][^]*?\\/>`, 'g')) || []).length;
    const expectedCloseCount = openCount - selfClosingCount;
    const actualCloseCount = (content.match(new RegExp(`</motion\\.${tag}>`, 'g')) || []).length;

    if (expectedCloseCount > actualCloseCount) {
      // Potentially missing </motion.tag>
      // Check if it's being closed by the simple tag </tag>
      const simpleCloseCount = (content.match(new RegExp(`</${tag}>`, 'g')) || []).length;
      if (simpleCloseCount > 0) {
        console.log(`[INTEGRITY ERROR] ${filepath}: Found ${expectedCloseCount} non-self-closing <motion.${tag}> but only ${actualCloseCount} </motion.${tag}>. Found ${simpleCloseCount} </${tag}> which might be incorrect.`);
        hasError = true;
      }
    }
  });

  return hasError;
}

console.log('Starting build integrity check...');
let errorCount = 0;
walk(SRC_DIR, (filepath) => {
  if (checkIntegrity(filepath)) {
    errorCount++;
  }
});

if (errorCount > 0) {
  console.log(`\nFinished with ${errorCount} files having potential integrity issues.`);
  process.exit(1);
} else {
  console.log('\nAll files passed integrity check!');
  process.exit(0);
}
