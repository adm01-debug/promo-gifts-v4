import { describe, it, expect } from 'vitest';
import { SUPABASE_URL } from '@/integrations/supabase/client';

describe('Supabase Client Contract', () => {
  const CURRENT_PROJECT_ID = 'doufsxqlfjyuvxuezpln';

  // Em CI/dev o VITE_SUPABASE_URL pode apontar para um override local
  // (ex.: http://localhost:54321). O contrato de projeto só se aplica
  // quando a URL resolvida é um projeto hospedado no Supabase.
  const isSupabaseHosted = SUPABASE_URL.includes('.supabase.co');

  it('should point to the correct project URL', () => {
    if (!isSupabaseHosted) return;
    expect(SUPABASE_URL).toContain(CURRENT_PROJECT_ID);
    expect(SUPABASE_URL).not.toContain('pqpdolkaeqlyzpdpbizo');
  });

  it('should use a valid HTTPS protocol', () => {
    if (!isSupabaseHosted) return;
    expect(SUPABASE_URL.startsWith('https://')).toBe(true);
  });

  it('should have a project ID in the URL', () => {
    if (!isSupabaseHosted) return;
    const url = new URL(SUPABASE_URL);
    const hostParts = url.hostname.split('.');
    expect(hostParts[0]).toBe(CURRENT_PROJECT_ID);
  });
});
