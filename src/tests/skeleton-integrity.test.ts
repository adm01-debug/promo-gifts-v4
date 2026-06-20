import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Integridade do Sistema de Skeletons', () => {
  it('não deve haver importações de componentes de skeleton legados', () => {
    const forbiddenPatterns = [
      '@/components/products/ProductCardSkeleton',
      '@/components/products/ProductListItemSkeleton',
      '@/components/products/ProductTableSkeleton',
      '@/components/products/ProductDetailSkeleton',
      '@/components/common/ContextualSkeleton',
    ];

    expect(forbiddenPatterns).not.toHaveLength(0);
    for (const pattern of forbiddenPatterns) {
      try {
        const command = `rg -l "${pattern}" src/ --glob '!src/components/loading/ModernSkeletons.tsx' --glob '!src/tests/*' --glob '!src/components/layout/SkeletonLoaders.tsx'`;
        const result = execSync(command).toString().trim();
        if (result) throw new Error(`Importação legada encontrada (${pattern}):\n${result}`);
      } catch (error: unknown) {
        const e = error as { status?: number; message?: string };
        // status 1 = rg found no matches (good); status 127 = rg not installed (skip)
        if (e.status !== 1 && e.status !== 127) expect(e.message).toBe('');
      }
    }
  });

  it('uso de Skeletons customizados deve seguir o padrão centralizado', () => {
    try {
      const globExclusions = [
        'src/components/loading/*',
        'src/components/ui/skeleton.tsx',
        'src/components/layout/SkeletonLoaders.tsx',
        'src/tests/*',
        'src/routes/AppRoutes.tsx',
        'src/components/kit-builder/*',
        'src/components/kit-library/*',
        'src/pages/Index.tsx',
        'src/components/catalog/CatalogHeader.tsx',
        'src/pages/clients/ClientsPage.tsx',
        'src/pages/quotes/QuotesListPage.tsx',
        'src/pages/tools/MagicUp.tsx',
        'src/pages/mockups/MockupHistoryPage.tsx',
        'src/pages/tools/DropboxBrowserPage.tsx',
        'src/pages/kit-builder/KitLibraryPage.tsx',
        'src/components/bi/*',
        'src/components/common/LoadingOverlay.tsx',
        'src/components/**/*.test.tsx',
        'src/components/**/*.test.ts',
      ]
        .map((e) => `--glob '!${e}'`)
        .join(' ');

      const command = `rg -l "Skeleton" src/ --glob "*.tsx" ${globExclusions}`;
      const result = execSync(command).toString().trim();
      if (!result) return;

      const files = result.split('\n');
      expect(files.filter(Boolean)).not.toHaveLength(0);
      for (const file of files) {
        if (!file) return;
        const content = execSync(`cat ${file}`).toString();
        const hasValidImport =
          content.includes('@/components/ui/skeleton') ||
          content.includes('@/components/loading/ModernSkeletons');
        expect(hasValidImport, `O arquivo ${file} usa Skeletons sem importação centralizada.`).toBe(
          true,
        );
      }
    } catch (error: unknown) {
      const status = (error as { status?: number }).status;
      // status 1 = rg no matches; status 127 = rg not installed — both are non-failures
      if (status !== 1 && status !== 127) throw error;
    }
  });

  it('os skeletons de página devem usar o SkeletonMonitor', () => {
    const content = execSync('cat src/components/layout/SkeletonLoaders.tsx').toString();
    expect(content).toContain('SkeletonMonitor');
    expect(content).toContain('makeSkeleton');
  });
});
