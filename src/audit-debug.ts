/* eslint-disable no-console */
/**
 * Audit Técnico do Sistema - Junho 2026
 * ------------------------------------
 * Lovable: Lovable (Lovable-1.0)
 * Script de diagnóstico executado via console do DevTools — console.log é o output intencional.
 */

import { supabase } from './integrations/supabase/client';

async function performTechnicalAudit() {
  console.log('--- Iniciando Auditoria Técnica Profunda ---');

  // 1. Verificação de Conectividade Supabase
  try {
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession();
    if (sessionError) throw sessionError;
    console.log(
      '✅ Conexão Auth: OK',
      session ? `Sessão ativa: ${session.user.email}` : 'Nenhuma sessão ativa',
    );

    const { error: tableError } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });
    if (tableError) throw tableError;
    console.log('✅ Conexão DB (profiles): OK');
  } catch (err) {
    console.error('❌ Falha Crítica de Conectividade:', err);
  }

  // 2. Verificação de Tabelas Essenciais
  // Audit checks a known list of base tables; cast bypasses Supabase's strict from() overloads.
  // Using `string` avoids TS2589 caused by the 585-table union type in Parameters<from>[0].
  type AuditFrom = (t: string) => {
    select: (
      c: string,
      o?: { count: string; head: boolean },
    ) => PromiseLike<{ error: { code: string; message: string } | null }>;
  };
  const auditSupabase = supabase as unknown as { from: AuditFrom };
  const tables = ['profiles', 'user_roles', 'products', 'categories', 'suppliers'];
  for (const table of tables) {
    try {
      const { error } = await auditSupabase
        .from(table)
        .select('count', { count: 'exact', head: true });
      if (error) console.warn(`⚠️ Tabela ${table}: Erro ou Acesso Negado (${error.code})`);
      else console.log(`✅ Tabela ${table}: Acessível`);
    } catch (err) {
      console.error(`❌ Erro inesperado ao checar ${table}:`, err);
    }
  }

  // 3. Verificação de Configurações de Ambiente
  const envVars = ['VITE_SUPABASE_URL', 'VITE_SUPABASE_PUBLISHABLE_KEY'];
  envVars.forEach((v) => {
    if (!import.meta.env[v]) console.error(`❌ Variável de ambiente ausente: ${v}`);
    else console.log(`✅ Variável de ambiente presente: ${v}`);
  });

  console.log('--- Auditoria Concluída ---');
}

// Para rodar no console do devtools se necessário
(
  window as unknown as Window & { performTechnicalAudit: () => Promise<void> }
).performTechnicalAudit = performTechnicalAudit;
