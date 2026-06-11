import { describe, it, expect } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { useReplenishmentsWithDetails, useReplenishmentStats } from '../useReplenishments';
import { TestWrapper } from '@/hooks/__tests__/replenishment-test-utils';

// Skip when no real Supabase backend is available (localhost fallback from tests/setup.ts)
const supabaseUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined) ?? '';
const isLocalSupabase =
  !supabaseUrl ||
  supabaseUrl.includes('localhost') ||
  supabaseUrl.includes('127.0.0.1') ||
  supabaseUrl.includes('placeholder');

describe.skipIf(isLocalSupabase)('useReplenishments Hooks Integration', () => {
  it('useReplenishmentsWithDetails deve retornar array de reposições', async () => {
    const { result } = renderHook(() => useReplenishmentsWithDetails(), {
      wrapper: TestWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 15000 });
    expect(Array.isArray(result.current.data)).toBe(true);
  });

  it('useReplenishmentStats deve calcular KPIs corretamente', async () => {
    const { result } = renderHook(() => useReplenishmentStats(), {
      wrapper: TestWrapper,
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true), { timeout: 15000 });
    expect(result.current.data).toHaveProperty('totalReplenishments');
    expect(result.current.data).toHaveProperty('activeReplenishments');
    expect(typeof result.current.data?.replenishmentRate).toBe('number');
  });
});
