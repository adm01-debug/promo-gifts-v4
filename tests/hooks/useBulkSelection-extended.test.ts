/**
 * Tests for useBulkSelection — extended scenarios
 */
import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkSelection } from '@/hooks/common/useBulkSelection';

describe('useBulkSelection — extended', () => {
  const items = [{ id: '1' }, { id: '2' }, { id: '3' }, { id: '4' }, { id: '5' }];

  it('starts empty', () => {
    const { result } = renderHook(() => useBulkSelection(items));
    expect(result.current.selectedCount).toBe(0);
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isSomeSelected).toBe(false);
  });

  it('toggleItem adds item', () => {
    const { result } = renderHook(() => useBulkSelection(items));
    act(() => result.current.toggleItem('1'));
    expect(result.current.selectedCount).toBe(1);
    expect(result.current.isSelected('1')).toBe(true);
    expect(result.current.isSomeSelected).toBe(true);
  });

  it('toggleItem removes when toggled again', () => {
    const { result } = renderHook(() => useBulkSelection(items));
    act(() => result.current.toggleItem('1'));
    act(() => result.current.toggleItem('1'));
    expect(result.current.selectedCount).toBe(0);
  });

  it('toggleAll selects all', () => {
    const { result } = renderHook(() => useBulkSelection(items));
    act(() => result.current.toggleAll());
    expect(result.current.selectedCount).toBe(5);
    expect(result.current.isAllSelected).toBe(true);
    expect(result.current.isSomeSelected).toBe(false);
  });

  it('toggleAll deselects all when all selected', () => {
    const { result } = renderHook(() => useBulkSelection(items));
    act(() => result.current.toggleAll());
    act(() => result.current.toggleAll());
    expect(result.current.selectedCount).toBe(0);
  });

  it('clearSelection resets', () => {
    const { result } = renderHook(() => useBulkSelection(items));
    act(() => { result.current.toggleItem('1'); result.current.toggleItem('3'); });
    act(() => result.current.clearSelection());
    expect(result.current.selectedCount).toBe(0);
  });

  it('selectedIds returns array', () => {
    const { result } = renderHook(() => useBulkSelection(items));
    act(() => result.current.toggleItem('2'));
    expect(result.current.selectedIds).toContain('2');
    expect(Array.isArray(result.current.selectedIds)).toBe(true);
  });

  it('handles empty items', () => {
    const { result } = renderHook(() => useBulkSelection([]));
    expect(result.current.isAllSelected).toBe(false);
    expect(result.current.isSomeSelected).toBe(false);
  });

  it('multiple items selected shows isSomeSelected', () => {
    const { result } = renderHook(() => useBulkSelection(items));
    act(() => { result.current.toggleItem('1'); result.current.toggleItem('2'); });
    expect(result.current.isSomeSelected).toBe(true);
    expect(result.current.isAllSelected).toBe(false);
  });
});
