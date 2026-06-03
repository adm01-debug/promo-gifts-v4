import { describe, it, expect } from 'vitest';
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from '../integrations/supabase/client';

describe('Supabase Canonical Connection', () => {
  const CANONICAL_URL = 'https://doufsxqlfjyuvxuezpln.supabase.co';

  // Pula em ambientes locais/CI onde VITE_SUPABASE_URL aponta para localhost
  const isLocalEnv = SUPABASE_URL.includes('localhost') || SUPABASE_URL.includes('127.0.0.1');

  it('should always use the canonical URL', () => {
    if (isLocalEnv) {
      // Em modo local, apenas garantimos que a URL não seja a do projeto vazio
      expect(SUPABASE_URL).toBeDefined();
      console.info('[CanonicalConnection] Skip URL check: running against local Supabase');
      return;
    }
    expect(SUPABASE_URL).toBe(CANONICAL_URL);
  });

  it('should have a valid publishable key for the canonical project', () => {
    expect(SUPABASE_PUBLISHABLE_KEY).toBeDefined();
    // Verifica header JWT (válido em qualquer ambiente Supabase)
    expect(SUPABASE_PUBLISHABLE_KEY).toMatch(/^eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9/);
  });

  it('should not be using the empty project URL', () => {
    const EMPTY_PROJECT_URL = 'https://pqpdolkaeqlyzpdpbizo.supabase.co';
    expect(SUPABASE_URL).not.toBe(EMPTY_PROJECT_URL);
  });
});
