import { readFileSync, readdirSync, statSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, it, expect } from 'vitest';

// Recursive directory scan for design regressions
const ALL_SRC_FILES = (function getAllFiles(dir: string, fileList: string[] = []): string[] {
  const files = readdirSync(dir);
  files.forEach((file) => {
    const name = resolve(dir, file);
    if (statSync(name).isDirectory()) {
      if (!name.includes('node_modules') && !name.includes('.git') && !name.includes('__tests__')) {
        getAllFiles(name, fileList);
      }
    } else if (/\.(tsx|ts|css)$/.test(name)) {
      fileList.push(name);
    }
  });
  return fileList;
})(resolve(process.cwd(), 'src'));

// Regex for forbidden glow patterns
// We use a looser regex for the scan but filter out valid uses in the test
const FORBIDDEN_GLOW =
  /\b(?:shadow-glow|text-shadow|ambient-glow|drop-shadow-\[.*?primary.*?\]|drop-shadow-\[.*?orange.*?\])\b/g;

describe('Global UI Regression — Zero Glow Policy', () => {
  // T-FIX-4: refatorado de `forEach(...) { it(...) }` para `it.each`.
  // Mais idiomático no Vitest e gera labels que mostram cada arquivo
  // individualmente no reporter. O filtro de skip continua aplicado.
  const SKIP_FILES = [
    'design-policy.ts',
    'index.css',
    'theme-presets.ts',
    'theme-presets.test.ts', // test file that legitimately references shadow-glow to verify the property
    'design-polish.css',
    'animations.css',
  ];

  const filesToCheck = ALL_SRC_FILES.filter(
    (file) => !SKIP_FILES.some((skip) => file.includes(skip)),
  );

  it.each(filesToCheck)('should not contain orange glow or halos in %s', (file) => {
    const content = readFileSync(file, 'utf8');
    const lines = content.split('\n');

    const violations = lines.filter((line) => {
      const hasGlow = FORBIDDEN_GLOW.test(line);
      if (!hasGlow) return false;

      // Skip comments and strings that mention the policy
      const isComment =
        line.trim().startsWith('//') || line.trim().startsWith('*') || line.trim().startsWith('/*');
      const mentionsPolicy = line.includes('NO_ORANGE_GLOW_POLICY');

      return !isComment && !mentionsPolicy;
    });

    expect(violations, `Found glow effects in ${file}:\n${violations.join('\n')}`).toHaveLength(0);
  });
});
