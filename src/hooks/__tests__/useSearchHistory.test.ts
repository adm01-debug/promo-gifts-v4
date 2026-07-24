import { renderHook, act } from '@testing-library/react';
import { useSearchHistory } from '@/hooks/common/useSearchHistory';
import { vi, describe, it, expect, beforeEach } from 'vitest';

describe('useSearchHistory', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should start with an empty history', () => {
    const { result } = renderHook(() => useSearchHistory('company'));
    expect(result.current.history).toEqual([]);
  });

  it('should add items to history', () => {
    const { result } = renderHook(() => useSearchHistory('company'));

    act(() => {
      result.current.addToHistory({
        id: '1',
        label: 'Company 1',
        type: 'company',
        metadata: { cnpj: '123' },
      });
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].label).toBe('Company 1');
  });

  it('should not allow duplicates by ID and type', () => {
    const { result } = renderHook(() => useSearchHistory('company'));

    act(() => {
      result.current.addToHistory({ id: '1', label: 'Company A', type: 'company' });
    });

    act(() => {
      result.current.addToHistory({ id: '1', label: 'Company A Updated', type: 'company' });
    });

    expect(result.current.history).toHaveLength(1);
    expect(result.current.history[0].label).toBe('Company A Updated');
  });

  it('should prioritize latest additions', () => {
    const { result } = renderHook(() => useSearchHistory('company'));

    act(() => {
      result.current.addToHistory({ id: '1', label: 'Company 1', type: 'company' });
    });

    act(() => {
      result.current.addToHistory({ id: '2', label: 'Company 2', type: 'company' });
    });

    expect(result.current.history[0].id).toBe('2');
    expect(result.current.history[1].id).toBe('1');
  });

  it('should remove items from history', () => {
    const { result } = renderHook(() => useSearchHistory('company'));

    act(() => {
      result.current.addToHistory({ id: '1', label: 'Company 1', type: 'company' });
    });

    act(() => {
      result.current.removeFromHistory('1');
    });

    expect(result.current.history).toEqual([]);
  });

  it('should clear history for a specific type', () => {
    const { result: companyHistory } = renderHook(() => useSearchHistory('company'));

    act(() => {
      companyHistory.current.addToHistory({ id: '1', label: 'C1', type: 'company' });
    });

    act(() => {
      companyHistory.current.clearHistory();
    });

    expect(companyHistory.current.history).toEqual([]);
  });
});
