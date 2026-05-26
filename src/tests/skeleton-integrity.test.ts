import { describe, it, expect } from 'vitest';
import { execSync } from 'child_process';

describe('Integridade do Sistema de Skeletons', () => {
  it('não deve haver importações de componentes de skeleton legados', () => {
    // Lista de caminhos ou padrões de arquivos que NÃO devem ser importados
    const forbiddenPatterns = [
      '@/components/products/ProductCardSkeleton',
      '@/components/products/ProductListItemSkeleton',
      '@/components/products/ProductTableSkeleton',
      '@/components/products/ProductDetailSkeleton',
      '@/components/common/ContextualSkeleton'
    ];

    forbiddenPatterns.forEach(pattern => {
      try {
        // Busca por arquivos que importam os padrões proibidos, excluindo ModernSkeletons e testes
        const command = `rg -l "${pattern}" src/ --glob '!src/components/loading/ModernSkeletons.tsx' --glob '!src/tests/*' --glob '!src/components/layout/SkeletonLoaders.tsx'`;
        const result = execSync(command).toString().trim();
        
        if (result) {
          throw new Error(`Arquivos encontradas com importação legada (${pattern}):\n${result}`);
        }
      } catch (error: any) {
        // execSync lança erro se rg não encontrar nada (exit code 1), o que é o comportamento esperado
        if (error.status !== 1) {
          expect(error.message).toBe('');
        }
      }
    });
  });

  it('apenas o componente base Skeleton de ui deve ser usado diretamente para formas customizadas', () => {
    try {
      // Este teste foca em garantir que não criamos componentes de skeleton fora da pasta centralizada
      // e que o componente base ui/skeleton é importado corretamente quando necessário.
      
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
        'src/pages/kit-builder/KitLibraryPage.tsx'
      ].map(e => `--glob '!${e}'`).join(' ');

      const command = `rg -l "Skeleton" src/ --glob "*.tsx" ${globExclusions}`;
      const result = execSync(command).toString().trim();
      
      if (!result) return;
      const files = result.split('\n');
      
      files.forEach(file => {
        if (!file) return;
        const content = execSync(`cat ${file}`).toString();
        const hasCentralizedImport = 
          content.includes('@/components/ui/skeleton') || 
          content.includes('@/components/loading/ModernSkeletons') ||
          content.includes('@/components/loading');
        
        expect(hasCentralizedImport, `O arquivo ${file} usa Skeletons mas não segue o padrão de importação centralizado.`).toBe(true);
      });
    } catch (error: any) {
      if (error.status !== 1) throw error;
    }
  });

  it('todos os skeletons de página devem ser monitorados pelo SkeletonMonitor', () => {
    // Garante que o SkeletonLoaders.tsx (que centraliza fallbacks de rota) usa o monitor de performance
    const content = execSync('cat src/components/layout/SkeletonLoaders.tsx').toString();
    expect(content).toContain('SkeletonMonitor');
    expect(content).toContain('makeSkeleton');
  });
});
