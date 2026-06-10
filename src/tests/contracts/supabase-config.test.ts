import { describe, it, expect } from 'vitest';
import { SUPABASE_URL } from '@/integrations/supabase/client';

describe('Supabase Client Contract', () => {
  const CURRENT_PROJECT_ID = 'pqpdolkaeqlyzpdpbizo';

  it('should point to the correct project URL', () => {
    expect(SUPABASE_URL).toContain(CURRENT_PROJECT_ID);
    expect(SUPABASE_URL).not.toContain('doufsxqlfjyuvxuezpln');
    expect(SUPABASE_URL).not.toContain('pqpdolkaeqlyzpdpbizo.supabase.co.supabase.co'); // common double-suffix error
  });

  it('should use a valid HTTPS protocol', () => {
    expect(SUPABASE_URL).startsWith('https://');
  });

  it('should have a project ID in the URL', () => {
    const url = new URL(SUPABASE_URL);
    const hostParts = url.hostname.split('.');
    expect(hostParts[0]).toBe(CURRENT_PROJECT_ID);
  });
});
