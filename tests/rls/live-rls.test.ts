import { describe, it, expect, beforeAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.VITE_SUPABASE_URL || 'http://localhost:54321';
const supabaseAnonKey = process.env.VITE_SUPABASE_PUBLISHABLE_KEY || 'placeholder-anon-key';

describe('RLS Functional Tests (Anonymous Access)', () => {
  let anonClient: SupabaseClient;

  beforeAll(() => {
    anonClient = createClient(supabaseUrl, supabaseAnonKey);
  });

  const sensitiveTables = [
    'quotes',
    'orders',
    'profiles',
    'user_roles',
    'organizations',
    'organization_members',
    'custom_kits',
    'favorite_lists'
  ];

  sensitiveTables.forEach(table => {
    it(`should deny anonymous SELECT from ${table}`, async () => {
      const { data, error } = await anonClient.from(table).select('*').limit(1);
      
      // Se RLS está ativo, ou retorna erro de permissão ou retorna array vazio (filtrado)
      // Para tabelas sensíveis, anon não deve ver NADA.
      if (error) {
        expect(error.code).toBe('42501'); // Insufficient Privilege
      } else {
        expect(data).toHaveLength(0);
      }
    });

    it(`should deny anonymous INSERT into ${table}`, async () => {
      const { error } = await anonClient.from(table).insert({}).select().single();
      expect(error).toBeDefined();
      expect(error?.code).toBe('42501');
    });

    it(`should deny anonymous UPDATE on ${table}`, async () => {
      const { error } = await anonClient.from(table).update({ updated_at: new Date().toISOString() }).eq('id', '00000000-0000-0000-0000-000000000000');
      expect(error).toBeDefined();
      expect(error?.code).toBe('42501');
    });

    it(`should deny anonymous DELETE on ${table}`, async () => {
      const { error } = await anonClient.from(table).delete().eq('id', '00000000-0000-0000-0000-000000000000');
      expect(error).toBeDefined();
      expect(error?.code).toBe('42501');
    });
  });
});
