import { describe, it, expect } from 'vitest';
import { getFallback } from '@/components/layout/SkeletonLoaders';
import React from 'react';

// Mocking React components to test existence without full rendering
describe('Cobertura de Skeletons por Rota', () => {
  const routesToTest = [
    '/',
    '/produtos',
    '/produto/123',
    '/filtros',
    '/novidades',
    '/reposicao',
    '/favoritos',
    '/orcamentos',
    '/orcamentos/123',
    '/clientes',
    '/clientes/123',
    '/admin',
    '/admin/usuarios',
    '/admin/cadastros',
    '/dashboard',
    '/login',
    '/auth',
    '/simulador',
    '/montar-kit',
    '/magic-up',
    '/busca-preco',
    '/comparar', // Should have a good skeleton
    '/colecoes', // Should have a good skeleton
    '/carrinhos', // Should have a good skeleton
    '/ferramentas/bi',
    '/estoque',
    '/raio-x',
  ];

  it('deve retornar um skeleton válido para cada rota principal', () => {
    expect(routesToTest).not.toHaveLength(0);
    for (const path of routesToTest) {
      const fallback = getFallback(path);
      expect(fallback, `Rota ${path} não possui um fallback definido`).toBeDefined();
      expect(
        React.isValidElement(fallback),
        `Fallback da rota ${path} não é um elemento React válido`,
      ).toBe(true);
    }
  });

  it('deve usar CatalogSkeleton para rotas de listagem de produtos', () => {
    const productListRoutes = [
      '/produtos',
      '/filtros',
      '/novidades',
      '/reposicao',
      '/favoritos',
      '/colecoes',
      '/carrinhos',
    ];
    expect(productListRoutes).not.toHaveLength(0);
    for (const path of productListRoutes) {
      const fallback = getFallback(path) as unknown as { type: { displayName: string } };
      expect(fallback.type.displayName).toBe('Catalog');
    }
  });

  it('deve usar ToolsSkeleton para ferramentas conhecidas', () => {
    const toolRoutes = ['/simulador', '/magic-up', '/busca-preco', '/estoque', '/raio-x'];
    expect(toolRoutes).not.toHaveLength(0);
    for (const path of toolRoutes) {
      const fallback = getFallback(path) as unknown as { type: { displayName: string } };
      expect(fallback.type.displayName).toBe('Tools');
    }
  });
});
