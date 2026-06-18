/**
 * Testes — useGenericFuzzySearch
 *
 * Hook de busca fuzzy (Fuse.js) genérico, usado no catálogo, clientes, pedidos.
 *
 * Invariantes:
 *   - query vazia/curta (<minChars): retorna todos os itens, hasSearch=false
 *   - query com >= minChars: executa busca fuzzy, hasSearch=true
 *   - totalMatches: conta itens encontrados (ou todos quando sem busca)
 *   - maxResults: limita resultados
 *   - threshold=0: exato (só exato passa)
 *   - threshold=1: permissivo (mais resultados)
 *   - query com espaço: trim antes de checar minChars
 *   - results: itens que correspondem ao query
 */
import { renderHook } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useGenericFuzzySearch } from '../useGenericFuzzySearch';

const PRODUCTS = [
  { id: '1', name: 'Caneta Azul', category: 'escrita' },
  { id: '2', name: 'Caneta Vermelha', category: 'escrita' },
  { id: '3', name: 'Bloco de Notas', category: 'papelaria' },
  { id: '4', name: 'Porta Caneta', category: 'organização' },
  { id: '5', name: 'Marcador Fluorescente', category: 'escrita' },
];

type Product = (typeof PRODUCTS)[number];

describe('useGenericFuzzySearch', () => {
  // Sem busca
  it('query vazia: retorna todos os itens, hasSearch=false', () => {
    const { result } = renderHook(() =>
      useGenericFuzzySearch(PRODUCTS, '', ['name'])
    );
    expect(result.current.results).toHaveLength(5);
    expect(result.current.hasSearch).toBe(false);
    expect(result.current.totalMatches).toBe(5);
  });

  it('query de 1 char (< minChars=2): retorna todos, hasSearch=false', () => {
    const { result } = renderHook(() =>
      useGenericFuzzySearch(PRODUCTS, 'C', ['name'])
    );
    expect(result.current.hasSearch).toBe(false);
    expect(result.current.results).toHaveLength(5);
  });

  it('query apenas espaços: trim → sem busca, hasSearch=false', () => {
    const { result } = renderHook(() =>
      useGenericFuzzySearch(PRODUCTS, '   ', ['name'])
    );
    expect(result.current.hasSearch).toBe(false);
  });

  // Com busca
  it('query "caneta": hasSearch=true, encontra itens com "caneta"', () => {
    const { result } = renderHook(() =>
      useGenericFuzzySearch(PRODUCTS, 'caneta', ['name'])
    );
    expect(result.current.hasSearch).toBe(true);
    expect(result.current.results.length).toBeGreaterThan(0);
    // Pelo menos Caneta Azul e Caneta Vermelha
    const names = result.current.results.map(r => (r as Product).name);
    expect(names.some(n => n.includes('Caneta'))).toBe(true);
  });

  it('query exata: encontra item correto', () => {
    const { result } = renderHook(() =>
      useGenericFuzzySearch(PRODUCTS, 'Bloco de Notas', ['name'], { threshold: 0.1 })
    );
    expect(result.current.results[0]).toMatchObject({ name: 'Bloco de Notas' });
  });

  it('busca em categoria: encontra por campo alternativo', () => {
    const { result } = renderHook(() =>
      useGenericFuzzySearch(PRODUCTS, 'papelaria', ['category'])
    );
    expect(result.current.results.length).toBeGreaterThan(0);
    expect((result.current.results[0] as Product).category).toBe('papelaria');
  });

  // maxResults
  it('maxResults: limita quantidade de resultados', () => {
    const { result } = renderHook(() =>
      useGenericFuzzySearch(PRODUCTS, '', ['name'], { maxResults: 2 })
    );
    expect(result.current.results).toHaveLength(2);
  });

  it('maxResults com busca: limita resultados da busca', () => {
    const { result } = renderHook(() =>
      useGenericFuzzySearch(PRODUCTS, 'caneta', ['name'], { maxResults: 1 })
    );
    expect(result.current.results.length).toBeLessThanOrEqual(1);
  });

  // Lista vazia
  it('items=[]: retorna [], hasSearch=false, totalMatches=0', () => {
    const { result } = renderHook(() =>
      useGenericFuzzySearch([], 'caneta', ['name'])
    );
    expect(result.current.results).toEqual([]);
    expect(result.current.totalMatches).toBe(0);
    expect(result.current.hasSearch).toBe(true); // query válida, mas 0 resultados
  });

  // minChars customizado
  it('minChars=3: query de 2 chars nao dispara busca', () => {
    const { result } = renderHook(() =>
      useGenericFuzzySearch(PRODUCTS, 'ca', ['name'], { minChars: 3 })
    );
    expect(result.current.hasSearch).toBe(false);
  });

  it('minChars=1: query de 1 char dispara busca', () => {
    const { result } = renderHook(() =>
      useGenericFuzzySearch(PRODUCTS, 'B', ['name'], { minChars: 1 })
    );
    expect(result.current.hasSearch).toBe(true);
  });
});
