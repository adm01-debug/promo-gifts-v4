import { describe, it, expect, vi, beforeEach } from 'vitest';
import { dbInvoke } from '@/lib/db/postgrest';
import { supabase } from '@/integrations/supabase/client';

vi.mock('@/integrations/supabase/client', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn().mockReturnThis(),
        gte: vi.fn().mockReturnThis(),
        order: vi.fn().mockReturnThis(),
        range: vi.fn().mockResolvedValue({ data: [], error: { message: '410 Gone' } }),
      })),
    })),
  },
}));

vi.mock('@/lib/external-db/silent-empty-report', () => ({
  reportSilentEmpty: vi.fn(),
}));

describe('dbInvoke 410 handling', () => {
  it('returns empty array on 410 Gone error', async () => {
    const result = await dbInvoke({
      table: 'products',
      operation: 'select',
    });
    expect(result.records).toEqual([]);
    expect(result.count).toBe(0);
  });
});
