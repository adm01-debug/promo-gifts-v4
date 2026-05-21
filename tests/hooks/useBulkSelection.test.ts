import { describe, it, expect } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useBulkSelection } from '@/hooks/common/useBulkSelection';

const mockItems = [
  { id: 'item-1' },
  { id: 'item-2' },
  { id: 'item-3' }
];

describe('useBulkSelection', () => {
  it('should toggle item selection', () => {
    const { result } = renderHook(() => useBulkSelection(mockItems));

    act(() => {
      result.current.toggleItem('item-1');
    });

    expect(result.current.isSelected('item-1')).toBe(true);
  });

  it('should toggle all items', () => {
    const { result } = renderHook(() => useBulkSelection(mockItems));

    act(() => {
      result.current.toggleAll();
    });

    expect(result.current.isAllSelected).toBe(true);
  });

  it('should clear selection', () => {
    const { result } = renderHook(() => useBulkSelection(mockItems));

    act(() => {
      result.current.toggleItem('item-1');
      result.current.clearSelection();
    });

    expect(result.current.selectedIds).toEqual([]);
  });
});
