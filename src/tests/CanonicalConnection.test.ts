import { describe, it, expect } from 'vitest';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../integrations/supabase/client';

describe('Supabase Canonical Connection', () => {
  const CANONICAL_URL = "https://doufsxqlfjyuvxuezpln.supabase.co";
  
  it('should always use the canonical URL', () => {
    expect(SUPABASE_URL).toBe(CANONICAL_URL);
  });

  it('should have a valid publishable key for the canonical project', () => {
    // The key should contain the project ref
    expect(SUPABASE_PUBLISHABLE_KEY).toContain('doufsxqlfjyuvxuezpln');
  });

  it('should not be using the empty project URL', () => {
    const EMPTY_PROJECT_URL = "https://pqpdolkaeqlyzpdpbizo.supabase.co";
    expect(SUPABASE_URL).not.toBe(EMPTY_PROJECT_URL);
  });
});
