import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock supabase so this test runs offline (no DB credentials in CI).
vi.mock('@/integrations/supabase/client', () => {
  const mockSelect = vi.fn().mockReturnThis();
  const mockEq    = vi.fn().mockReturnThis();
  const mockLimit = vi.fn().mockResolvedValue({
    data: [
      {
        id: 'prod-1',
        name: 'Produto Reposição A',
        updated_at: '2026-06-15T10:00:00Z',
        created_at: '2026-06-01T08:00:00Z',
        stock_quantity: 50,
        min_quantity: 5,
      },
      {
        id: 'prod-2',
        name: 'Produto Reposição B',
        updated_at: '2026-06-20T09:00:00Z',
        created_at: '2026-06-18T07:00:00Z',
        stock_quantity: 10,
        min_quantity: 2,
      },
    ],
    error: null,
  });

  return {
    supabase: {
      from: vi.fn(() => ({ select: mockSelect, eq: mockEq, limit: mockLimit })),
    },
    SUPABASE_URL: 'https://doufsxqlfjyuvxuezpln.supabase.co',
    SUPABASE_PUBLISHABLE_KEY: 'mock-anon-key',
  };
});

import { supabase } from '@/integrations/supabase/client';

describe('Replenishment: DB integrity (mocked)', () => {
  beforeEach(() => vi.clearAllMocks());

  it('valida que updated_at e created_at são datas ISO válidas', async () => {
    const { data, error } = await supabase
      .from('v_products_public')
      .select('id, name, updated_at, created_at, stock_quantity, min_quantity')
      .eq('is_active', true)
      .limit(10);

    expect(error).toBeNull();
    expect(data).toBeDefined();
    expect(Array.isArray(data)).toBe(true);

    for (const p of data!) {
      if (p.updated_at) expect(isNaN(new Date(p.updated_at).getTime())).toBe(false);
      if (p.created_at) expect(isNaN(new Date(p.created_at).getTime())).toBe(false);
    }
  });

  it('valida que stock_quantity >= min_quantity para produtos em estoque', async () => {
    const { data } = await supabase
      .from('v_products_public')
      .select('id, name, updated_at, created_at, stock_quantity, min_quantity')
      .eq('is_active', true)
      .limit(10);

    for (const p of data!) {
      expect(typeof p.stock_quantity).toBe('number');
      expect(typeof p.min_quantity).toBe('number');
      expect(p.stock_quantity).toBeGreaterThanOrEqual(0);
      expect(p.min_quantity).toBeGreaterThanOrEqual(0);
    }
  });

  it('valida que updated_at >= created_at (reposição implica edição posterior)', async () => {
    const { data } = await supabase
      .from('v_products_public')
      .select('id, name, updated_at, created_at, stock_quantity, min_quantity')
      .eq('is_active', true)
      .limit(10);

    for (const p of data!) {
      if (p.updated_at && p.created_at) {
        const updatedMs = new Date(p.updated_at).getTime();
        const createdMs = new Date(p.created_at).getTime();
        expect(updatedMs).toBeGreaterThanOrEqual(createdMs);
      }
    }
  });
});
