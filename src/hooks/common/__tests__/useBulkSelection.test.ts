/**
 * Testes — useBulkSelection
 *
 * Gerencia seleção múltipla de itens por ID.
 *
 * Invariantes:
 *   - selectedIds=[] e selectedCount=0 inicialmente
 *   - toggleItem: adiciona/remove id do Set
 *   - toggleAll: seleciona todos quando nenhum selecionado
 *   - toggleAll: deseleciona todos quando todos selecionados
 *   - clearSelection: esvazia Set
 *   - isSelected: true/false por id
 *   - isAllSelected: true quando todos selecionados
 *   - isSomeSelected: true quando parcialmente selecionado
 */
import { renderHook, act } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { useBulkSelection } from '../useBulkSelection';

const ITEMS = [
  { id: 'a', name: 'Item A' },
  { id: 'b', name: 'Item B' },
  { id: 'c', name: 'Item C' },
];

describe('useBulkSelection', () => {
  it('inicia com selectedIds=[], selectedCount=0', () => {
    const { result } = renderHook(() => useBulkSelection(ITEMS));
    expect(result.current.selectedIds).toEqual([]);
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isSomeSelected).toBe(false);
  });

  it('toggleItem: adiciona id quando não selecionado', () => {
    const { result } = renderHook(() => useBulkSelection(ITEMS));
    act(() => { result.current.toggleItem('a'); });
    expect(result.current.selectedIds).toContain('a');
    expect(result.current.selectedCount).toBe(1);
  });

  it('toggleItem: remove id quando já selecionado', () => {
    const { result } = renderHook(() => useBulkSelection(ITEMS));
    act(() => { result.current.toggleItem('a'); });
    act(() => { result.current.toggleItem('a'); });
    expect(result.current.selectedIds).not.toContain('a');
    expect(result.current.selectedCount).toBe(0);
  });

  it('isSelected retorna true para id selecionado', () => {
    const { result } = renderHook(() => useBulkSelection(ITEMS));
    act(() => { result.current.toggleItem('b'); });
    expect(result.current.isSelected('b')).toBe(true);
    expect(result.current.isSelected('c')).toBe(false);
  });

  it('toggleAll: seleciona todos quando nenhum selecionado', () => {
    const { result } = renderHook(() => useBulkSelection(ITEMS));
    act(() => { result.current.toggleAll(); });
    expect(result.current.selectedCount).toBe(3);
    expect(result.current.isAllSelected).toBe(true);
  });

  it('toggleAll: deseleciona todos quando todos selecionados', () => {
    const { result } = renderHook(() => useBulkSelection(ITEMS));
    act(() => { result.current.toggleAll(); });
    act(() => { result.current.toggleAll(); });
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
  });

  it('isSomeSelected: true quando parcialmente selecionado', () => {
    const { result } = renderHook(() => useBulkSelection(ITEMS));
    act(() => { result.current.toggleItem('a'); });
    expect(result.current.isSomeSelected).toBe(true);
    expect(result.current.isAllSelected).toBe(false);
  });

  it('clearSelection: esvazia a seleção', () => {
    const { result } = renderHook(() => useBulkSelection(ITEMS));
    act(() => { result.current.toggleAll(); });
    act(() => { result.current.clearSelection(); });
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.selectedIds).toEqual([]);
  });

  it('funciona com lista vazia (isAllSelected=false)', () => {
    const { result } = renderHook(() => useBulkSelection([]));
    expect(result.current.isAllSelected).toBe(false);
    act(() => { result.current.toggleAll(); });
    expect(result.current.selectedCount).toBe(0);
  });
});
