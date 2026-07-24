/**
 * Regression tests for bugs fixed during QA cycle (BUG-001 through BUG-011).
 * These tests verify structural invariants in the source code to prevent
 * the same patterns from reappearing.
 */
import { describe, it, expect } from 'vitest';
import fs from 'fs';
import path from 'path';

const SRC = path.resolve(__dirname, '../../src');

function readSrc(relPath: string): string {
  return fs.readFileSync(path.join(SRC, relPath), 'utf-8');
}

describe('BUG-001: ProductGrid Rules-of-Hooks', () => {
  it('useMemo and useProductsColorsBatch are called before isError check', () => {
    const src = readSrc('components/products/ProductGrid.tsx');
    const lines = src.split('\n');

    // Match either arrow or named-function form — we care about hook ordering,
    // not the specific function syntax chosen by the formatter/linter.
    const gridStart = lines.findIndex((l) =>
      l.includes('export const ProductGrid = memo('),
    );
    expect(gridStart).toBeGreaterThan(-1);

    let useMemoLine = -1;
    let useProductsColorsBatchLine = -1;
    let isErrorCheckLine = -1;

    for (let i = gridStart; i < lines.length; i++) {
      const line = lines[i];
      if (useMemoLine === -1 && /idsNeedingColors.*useMemo/.test(line)) {
        useMemoLine = i;
      }
      if (useProductsColorsBatchLine === -1 && /useProductsColorsBatch/.test(line)) {
        useProductsColorsBatchLine = i;
      }
      if (isErrorCheckLine === -1 && /if\s*\(isError\)/.test(line)) {
        isErrorCheckLine = i;
      }
    }

    expect(useMemoLine).toBeGreaterThan(gridStart);
    expect(useProductsColorsBatchLine).toBeGreaterThan(gridStart);
    expect(isErrorCheckLine).toBeGreaterThan(gridStart);
    expect(useMemoLine).toBeLessThan(isErrorCheckLine);
    expect(useProductsColorsBatchLine).toBeLessThan(isErrorCheckLine);
  });
});

describe('BUG-002: ProductCard TDZ (allMatchingVariants)', () => {
  it('allMatchingVariants is declared before its first usage in useEffect', () => {
    const src = readSrc('components/products/ProductCard.tsx');
    const declMatch = src.search(/const allMatchingVariants\s*=/);
    const useEffectWithVar = src.search(
      /useEffect\([^)]*allMatchingVariants/s,
    );

    expect(declMatch).toBeGreaterThan(-1);
    if (useEffectWithVar !== -1) {
      expect(declMatch).toBeLessThan(useEffectWithVar);
    }
  });
});

describe('BUG-003: NoveltyCards correct property paths', () => {
  it('does not use product.product.name or product.product.sku pattern', () => {
    const src = readSrc('components/novelties/NoveltyCards.tsx');
    expect(src).not.toMatch(/product\.product\.name/);
    expect(src).not.toMatch(/product\.product\.sku/);
    expect(src).not.toMatch(/product\.product\.image/);
  });
});

describe('BUG-005: untypedFrom migration', () => {
  const CRITICAL_UNTYPED_TABLES = [
    'v_products_public',
    'generated_mockups',
    'tecnicas_gravacao',
    'allowed_ips',
    'device_sessions',
    'geo_blocking_rules',
    'two_factor_auth',
    'access_security_settings',
    'sales_goals',
    'color_systems',
  ];

  it('no direct supabase.from() calls for critical untyped tables in their primary hooks', () => {
    const primaryFiles = [
      'hooks/admin/useAllowedIPs.ts',
      'hooks/admin/useDeviceDetection.ts',
      'hooks/admin/useGeoBlocking.ts',
      'hooks/auth/use2FA.ts',
      'hooks/auth/useAccessSecurity.ts',
      'hooks/intelligence/useSalesGoals.ts',
      'hooks/products/useColorSystem.ts',
      'hooks/gravacao/useTecnicasGravacao.ts',
    ];

    for (const relFile of primaryFiles) {
      const fullPath = path.join(SRC, relFile);
      if (!fs.existsSync(fullPath)) continue;
      const content = fs.readFileSync(fullPath, 'utf-8');
      for (const table of CRITICAL_UNTYPED_TABLES) {
        const directPattern = new RegExp(
          `supabase\\.from\\(['"\`]${table}['"\`]\\)`,
        );
        expect
          .soft(
            content.match(directPattern),
            `${relFile} should not have direct supabase.from('${table}')`,
          )
          .toBeNull();
      }
    }
  });
});

describe('BUG-006: dbInvokeDelete object signature', () => {
  it('no positional dbInvokeDelete(string, string) calls remain', () => {
    const files = findTsFiles(SRC);
    for (const file of files) {
      const content = fs.readFileSync(file, 'utf-8');
      const badPattern = /dbInvokeDelete\(\s*['"`]\w+['"`]\s*,/;
      if (badPattern.test(content)) {
        const rel = path.relative(SRC, file);
        expect
          .soft(
            content.match(badPattern),
            `${rel} has positional dbInvokeDelete call`,
          )
          .toBeNull();
      }
    }
  });
});

describe('BUG-010: Strict equality in hooks', () => {
  it('useSparklineSales uses !== instead of !=', () => {
    const src = readSrc('hooks/intelligence/useSparklineSales.tsx');
    const looseNotEqual = (src.match(/[^!]!=\s+null/g) || []).filter(
      (m) => !m.includes('!=='),
    );
    expect(looseNotEqual.length).toBe(0);
  });
});

describe('BUG-011: RLS coverage', () => {
  it('critical tables reference is consistent in RLS test', () => {
    const rlsTest = fs.readFileSync(
      path.resolve(__dirname, '../rls/critical-tables-rls.test.ts'),
      'utf-8',
    );
    const criticalTables = [
      'quotes',
      'orders',
      'profiles',
      'user_roles',
      'organizations',
    ];
    for (const table of criticalTables) {
      expect(rlsTest).toContain(table);
    }
  });
});

function findTsFiles(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith('__')) {
        results.push(...findTsFiles(full));
      } else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.includes('.test.')) {
        results.push(full);
      }
    }
  } catch {
    // ignore permission errors
  }
  return results;
}
