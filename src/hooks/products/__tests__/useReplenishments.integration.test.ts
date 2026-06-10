import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useReplenishmentsWithDetails, useReplenishmentStats } from '../useReplenishments';
import { TestWrapper as createWrapper } from '@/hooks/__tests__/replenishment-test-utils';

describe('useReplenishments Hooks Integration', () => {
  it('useReplenishmentsWithDetails deve retornar array de reposições', async () => {
    const { result } = renderHook(() => useReplenishmentsWithDetails(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it('useReplenishmentStats deve calcular KPIs corretamente', async () => {
    const { result } = renderHook(() => useReplenishmentStats(), {
      wrapper: createWrapper(),
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toHaveProperty('totalReplenishments');
    expect(result.current.data).toHaveProperty('activeReplenishments');
    expect(typeof result.current.data?.replenishmentRate).toBe('number');
  });
});
