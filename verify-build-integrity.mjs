import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SRC_DIR = path.join(process.cwd(), 'src');

function walk(dir, callback) {
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

const motionTags = ['div', 'button', 'section', 'nav', 'article', 'aside', 'header', 'footer', 'main', 'span', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'ul', 'li', 'ol', 'a', 'img', 'svg', 'path', 'circle', 'rect'];

function checkIntegrity(filepath) {
  const content = fs.readFileSync(filepath, 'utf8');
  let hasError = false;

  motionTags.forEach(tag => {
    const openTag = `<motion.${tag}`;
    const closeTagCorrect = `</motion.${tag}>`;
    const closeTagWrong = `</${tag}>`;

    // Count occurrences
    const openCount = (content.split(openTag).length - 1);
    
    // Check for self-closing tags
    const selfClosingCount = (content.match(new RegExp(`<motion\\.${tag}[^>]*\\/>`, 'g')) || []).length;
    
    const expectedCloseCount = openCount - selfClosingCount;
    const actualCloseCount = (content.split(closeTagCorrect).length - 1);

    if (expectedCloseCount !== actualCloseCount) {
      // Check if it's being closed by the simple tag
      const wrongCloseMatches = (content.split(closeTagWrong).length - 1);
      
      if (wrongCloseMatches > 0) {
        console.log(`[INTEGRITY ERROR] ${filepath}: Found ${openCount} <motion.${tag}> tags but ${actualCloseCount} ${closeTagCorrect} tags. Found ${wrongCloseMatches} ${closeTagWrong} tags which might be incorrect closures.`);
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
