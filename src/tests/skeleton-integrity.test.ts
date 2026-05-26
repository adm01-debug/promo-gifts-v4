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
      // Verifica se arquivos TSX estão usando Skeleton mas não importam de ModernSkeletons ou ui/skeleton
      // Excluímos gerenciadores de skeletons e componentes de Kit que usam padrões específicos
      // Também excluímos Index.tsx e CatalogHeader.tsx que gerenciam estados de carregamento específicos
      const command = `rg -l "Skeleton" src/ --glob "*.tsx" --glob '!src/components/loading/*' --glob '!src/components/ui/skeleton.tsx' --glob '!src/components/layout/SkeletonLoaders.tsx' --glob '!src/tests/*' --glob '!src/routes/AppRoutes.tsx' --glob '!src/components/kit-builder/*' --glob '!src/components/kit-library/*' --glob '!src/pages/Index.tsx' --glob '!src/components/catalog/CatalogHeader.tsx'`;
      const files = execSync(command).toString().trim().split('\n');
      
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
