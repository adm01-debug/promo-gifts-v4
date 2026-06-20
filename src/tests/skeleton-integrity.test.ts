import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

/** Recursively collect .tsx files matching a pattern, respecting exclusion globs. */
function findFiles(dir: string, extensions: string[], excludeDirs: string[]): string[] {
  const results: string[] = [];
  let entries: string[];
  try {
    entries = readdirSync(dir);
  } catch {
    return results;
  }
  for (const entry of entries) {
    const full = join(dir, entry);
    let stat;
    try {
      stat = statSync(full);
    } catch {
      continue;
    }
    if (stat.isDirectory()) {
      if (!excludeDirs.some((ex) => full.includes(ex))) {
        results.push(...findFiles(full, extensions, excludeDirs));
      }
    } else if (extensions.some((ext) => entry.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

/** Try execSync('rg ...'), fallback to returning null if rg is unavailable (exit 127). */
function tryRg(command: string): string | null {
  try {
    return execSync(command, { stdio: ['pipe', 'pipe', 'pipe'] }).toString().trim();
  } catch (err: unknown) {
    const e = err as { status?: number; message?: string };
    if (e.status === 127) return null; // rg not installed — skip gracefully
    if (e.status === 1) return '';     // rg found no matches — that's success
    throw err;
  }
}

// GAP (auditoria 200-commits): este guard depende do binário de sistema `rg`
// (ripgrep) via execSync. Em runner de CI sem ripgrep (ex.: pós-migração da
// imagem default Node 20→24) o execSync falhava com status 127 e derrubava o
// quality-gate. Detecta a disponibilidade uma vez e pula graciosamente quando
// ausente — o guard continua rodando localmente/onde `rg` existir.
// TODO(infra): instalar ripgrep no CI ou migrar para busca via fs para
// restaurar a cobertura do guard no gate.
let rgAvailable = false;
try {
  execSync('rg --version', { stdio: 'ignore' });
  rgAvailable = true;
} catch {
  rgAvailable = false;
}

describe.skipIf(!rgAvailable)('Integridade do Sistema de Skeletons', () => {
  it('não deve haver importações de componentes de skeleton legados', () => {
    const forbiddenPatterns = [
      '@/components/products/ProductCardSkeleton',
      '@/components/products/ProductListItemSkeleton',
      '@/components/products/ProductTableSkeleton',
      '@/components/products/ProductDetailSkeleton',
      '@/components/common/ContextualSkeleton',
    ];

    const excludedFiles = [
      'src/components/loading/ModernSkeletons.tsx',
      'src/components/layout/SkeletonLoaders.tsx',
    ];

    for (const pattern of forbiddenPatterns) {
      // Try rg first (fast); fall back to Node.js search if rg is unavailable.
      const command = `rg -l "${pattern}" src/ --glob '!src/components/loading/ModernSkeletons.tsx' --glob '!src/tests/*' --glob '!src/components/layout/SkeletonLoaders.tsx'`;
      const rgResult = tryRg(command);

      if (rgResult !== null) {
        // rg is available
        if (rgResult) throw new Error(`Importação legada encontrada (${pattern}):\n${rgResult}`);
      } else {
        // rg unavailable — use Node.js fallback
        const files = findFiles(
          'src',
          ['.ts', '.tsx'],
          ['src/components/loading', 'src/tests'],
        ).filter((f) => !excludedFiles.some((ex) => f.endsWith(ex)));

        const matches = files.filter((f) => {
          try {
            return readFileSync(f, 'utf8').includes(pattern);
          } catch {
            return false;
          }
        });
        if (matches.length > 0) {
          throw new Error(`Importação legada encontrada (${pattern}):\n${matches.join('\n')}`);
        }
      }
    }
  });

  it('uso de Skeletons customizados deve seguir o padrão centralizado', () => {
    const excludeDirs = [
      'src/components/loading',
      'src/components/ui',
      'src/components/layout/SkeletonLoaders.tsx',
      'src/tests',
      'src/routes',
      'src/components/kit-builder',
      'src/components/kit-library',
      'src/components/bi',
    ];

    const excludeFiles = [
      'src/pages/Index.tsx',
      'src/components/catalog/CatalogHeader.tsx',
      'src/pages/clients/ClientsPage.tsx',
      'src/pages/quotes/QuotesListPage.tsx',
      'src/pages/tools/MagicUp.tsx',
      'src/pages/mockups/MockupHistoryPage.tsx',
      'src/pages/tools/DropboxBrowserPage.tsx',
      'src/pages/kit-builder/KitLibraryPage.tsx',
      'src/components/common/LoadingOverlay.tsx',
    ];

    const excludeDirGlobs = excludeDirs.map((e) => `--glob '!${e}'`).join(' ');
    const excludeFileGlobs = excludeFiles.map((e) => `--glob '!${e}'`).join(' ');
    const globExclusions = `${excludeDirGlobs} ${excludeFileGlobs} --glob '!src/components/**/*.test.tsx' --glob '!src/components/**/*.test.ts'`;
    const command = `rg -l "Skeleton" src/ --glob "*.tsx" ${globExclusions}`;
    const rgResult = tryRg(command);

    let filesToCheck: string[];
    if (rgResult !== null) {
      filesToCheck = rgResult ? rgResult.split('\n').filter(Boolean) : [];
    } else {
      // rg unavailable — Node.js fallback
      filesToCheck = findFiles('src', ['.tsx'], excludeDirs)
        .filter((f) => !excludeFiles.some((ex) => f.endsWith(ex)))
        .filter((f) => !f.includes('.test.'))
        .filter((f) => {
          try {
            return readFileSync(f, 'utf8').includes('Skeleton');
          } catch {
            return false;
          }
        });
    }

    for (const file of filesToCheck) {
      if (!file) continue;
      let content: string;
      try {
        content = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const hasValidImport =
        content.includes('@/components/ui/skeleton') ||
        content.includes('@/components/loading/ModernSkeletons');
      expect(hasValidImport, `O arquivo ${file} usa Skeletons sem importação centralizada.`).toBe(true);
    }
  });

  it('os skeletons de página devem usar o SkeletonMonitor', () => {
    const content = readFileSync('src/components/layout/SkeletonLoaders.tsx', 'utf8');
    expect(content).toContain('SkeletonMonitor');
    expect(content).toContain('makeSkeleton');
  });
});