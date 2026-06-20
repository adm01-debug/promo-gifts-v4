import { describe, it, expect } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'fs';
import { join } from 'path';

// GAP (auditoria 200-commits): busca 100% via Node fs, SEM dependência do binário
// de sistema `rg` (ripgrep). A versão anterior usava execSync('rg ...') e, quando
// o runner não tinha ripgrep (ex.: pós-migração da imagem default Node 20→24),
// ou falhava com status 127 ou era inteiramente PULADA por um `describe.skipIf`
// — deixando o guard sem cobertura no quality-gate. Agora roda igual em qualquer
// ambiente (local == CI), restaurando a cobertura.

/** Coleta recursivamente arquivos com as extensões dadas, respeitando dirs excluídos. */
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

describe('Integridade do Sistema de Skeletons', () => {
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

    expect(forbiddenPatterns).not.toHaveLength(0);

    const files = findFiles('src', ['.ts', '.tsx'], ['src/components/loading', 'src/tests']).filter(
      (f) => !excludedFiles.some((ex) => f.endsWith(ex)),
    );

    for (const pattern of forbiddenPatterns) {
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

    const filesToCheck = findFiles('src', ['.tsx'], excludeDirs)
      .filter((f) => !excludeFiles.some((ex) => f.endsWith(ex)))
      .filter((f) => !f.includes('.test.'))
      .filter((f) => {
        try {
          return readFileSync(f, 'utf8').includes('Skeleton');
        } catch {
          return false;
        }
      });

    for (const file of filesToCheck) {
      let content: string;
      try {
        content = readFileSync(file, 'utf8');
      } catch {
        continue;
      }
      const hasValidImport =
        content.includes('@/components/ui/skeleton') ||
        content.includes('@/components/loading/ModernSkeletons');
      expect(hasValidImport, `O arquivo ${file} usa Skeletons sem importação centralizada.`).toBe(
        true,
      );
    }
  });

  it('os skeletons de página devem usar o SkeletonMonitor', () => {
    const content = readFileSync('src/components/layout/SkeletonLoaders.tsx', 'utf8');
    expect(content).toContain('SkeletonMonitor');
    expect(content).toContain('makeSkeleton');
  });
});
