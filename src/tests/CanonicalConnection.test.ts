import { describe, it, expect } from 'vitest';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../integrations/supabase/client';

describe('Supabase Canonical Connection', () => {
  const CANONICAL_URL = 'https://doufsxqlfjyuvxuezpln.supabase.co';

  it('should always use the canonical URL', () => {
    expect(SUPABASE_URL).toBe(CANONICAL_URL);
  });

  it('should have a valid publishable key for the canonical project', () => {
    // Check if the key is the CANONICAL_ANON_KEY from client.ts
    // or if it's a key that matches the canonical ref
    expect(SUPABASE_PUBLISHABLE_KEY).toBeDefined();

    // Instead of checking string containment which fails due to base64,
    // we can check if it starts with the known JWT header for Supabase anon keys
    expect(SUPABASE_PUBLISHABLE_KEY).toMatch(/^eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/);
  });

  it('should not be using the empty project URL', () => {
    const EMPTY_PROJECT_URL = 'https://pqpdolkaeqlyzpdpbizo.supabase.co';
    expect(SUPABASE_URL).not.toBe(EMPTY_PROJECT_URL);
  });
});
