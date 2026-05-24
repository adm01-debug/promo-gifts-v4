import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Guarda anti-regressão: o sidebar é renderizado uma única vez pelo
 * <MainLayout /> ancorado em AppRoutes. Páginas de conteúdo (incluindo
 * /filtros) NÃO podem reembrulhar-se em <MainLayout>, senão o sidebar
 * aparece duplicado (ver bug do módulo SUPER FILTRO).
 *
 * Este teste valida via source-code para evitar montar a árvore completa
 * (que depende de Suspense, providers, queries, etc).
 */
describe('FiltersPage / Sidebar duplication guard', () => {
  const root = resolve(__dirname, '../..', '..');
  const filtersSrc = readFileSync(resolve(root, 'src/pages/products/FiltersPage.tsx'), 'utf8');
  const appRoutesSrc = readFileSync(resolve(root, 'src/routes/AppRoutes.tsx'), 'utf8');

  it('FiltersPage não deve importar nem renderizar MainLayout', () => {
    expect(filtersSrc).not.toMatch(/from\s+['"]@\/components\/layout\/MainLayout['"]/);
    expect(filtersSrc).not.toMatch(/<\/?MainLayout[\s>]/);
  });

  it('AppRoutes deve renderizar MainLayout exatamente uma vez (layout route)', () => {
    const matches = appRoutesSrc.match(/<MainLayout[\s/>]/g) ?? [];
    expect(matches.length).toBe(1);
  });
});
