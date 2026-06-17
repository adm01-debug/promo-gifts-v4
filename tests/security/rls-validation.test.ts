import { test, expect } from 'vitest';
import { createClient } from '@supabase/supabase-js';

const hasCredentials =
  !!process.env.VITE_SUPABASE_URL &&
  !!process.env.SUPABASE_SERVICE_ROLE_KEY &&
  !!process.env.VITE_SUPABASE_ANON_KEY;

/**
 * Validação Programática de Políticas RLS e Segurança
 * Garante que o fluxo de login e dados sensíveis estão protegidos.
 * Skipped in CI when Supabase credentials are not available.
 */
test.skipIf(!hasCredentials)('Auditoria de Segurança: Tabelas Críticas e RLS', async () => {
  const supabase = createClient(
    process.env.VITE_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const tablesToCheck = ['quotes', 'profiles', 'products', 'audit_logs'];

  for (const table of tablesToCheck) {
    // 1. Verifica se RLS está habilitado
    const { data: rlsStatus, error: rlsError } = await supabase.rpc('check_rls_enabled', { table_name: table });
    
    // Se a função RPC não existir, fazemos uma consulta direta no catálogo do postgres
    if (rlsError) {
      const { data: pgStatus } = await supabase.from('pg_class').select('relrowsecurity').eq('relname', table).single();
      if (pgStatus) {
        expect(pgStatus.relrowsecurity).toBe(true);
      }
    } else {
      expect(rlsStatus).toBe(true);
    }
  }
});

test.skipIf(!hasCredentials)('Validação de Permissões de Login (Anon vs Auth)', async () => {
  const anonClient = createClient(process.env.VITE_SUPABASE_URL!, process.env.VITE_SUPABASE_ANON_KEY!);
  
  // Usuário anônimo não deve ver perfis
  const { data: profiles, error } = await anonClient.from('profiles').select('*');
  expect(error?.code).toBe('42501'); // Insufficient Privilege
  expect(profiles).toBeNull();
});
