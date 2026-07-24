import { describe, it, expect } from 'vitest';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

describe('A11y Clickable drift gate', () => {
  it('baseline atual está sem regressões', () => {
    let code = 0;
    let out = '';
    try {
      out = execSync('node scripts/check-clickable-drift.mjs', { encoding: 'utf8', stdio: 'pipe' });
    } catch (e: unknown) {
      const err = e as { status?: number; stdout?: string; stderr?: string };
      code = err.status ?? 1;
      out = (err.stdout ?? '') + (err.stderr ?? '');
    }
    expect(code, out).toBe(0);
  });

  it('baseline é JSON válido com campo files array de strings', () => {
    const raw = readFileSync('.a11y/clickable-baseline.json', 'utf8');
    const parsed = JSON.parse(raw);
    expect(Array.isArray(parsed.files)).toBe(true);
    for (const f of parsed.files) {
      expect(typeof f).toBe('string');
      expect(f.startsWith('src/')).toBe(true);
    }
  });

  it('baseline não referencia o próprio Clickable.tsx', () => {
    const parsed = JSON.parse(readFileSync('.a11y/clickable-baseline.json', 'utf8'));
    expect(parsed.files).not.toContain('src/components/shared/Clickable.tsx');
  });
});
