/* eslint-disable no-console */
/**
 * Audit Técnico do Sistema - Junho 2026
 * ------------------------------------
 * Lovable: Lovable (Lovable-1.0)
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

    const { data: _tableData, error: tableError } = await supabase
      .from('profiles')
      .select('count', { count: 'exact', head: true });
    if (tableError) throw tableError;
    console.log('✅ Conexão DB (profiles): OK');
  } catch (err) {
    console.error('❌ Falha Crítica de Conectividade:', err);
  }

  // 2. Verificação de Tabelas Essenciais
  const tables = ['profiles', 'user_roles', 'products', 'categories', 'suppliers'];
  for (const table of tables) {
    try {
      // @ts-expect-error: string table name causes excessive generic depth in Supabase types
      const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
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
(window as unknown as { performTechnicalAudit: () => Promise<void> }).performTechnicalAudit =
  performTechnicalAudit;
