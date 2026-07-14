#!/usr/bin/env node
/**
 * check-security-definer-audit.mjs
 * Gate 5 — CHECK 2: Todas as funcoes SECURITY DEFINER em public
 * devem ter SET search_path explícito para evitar privilege escalation.
 *
 * Falha (exit 1) se qualquer funcao SECURITY DEFINER NAO tiver search_path.
 */

const { createClient } = await import('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY  = process.env.SUPABASE_SERVICE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('SUPABASE_URL e SUPABASE_SERVICE_KEY sao obrigatorios.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

// Funcoes SECURITY DEFINER sem search_path sao vetor de privilege escalation
const { data, error } = await supabase.rpc('audit_security_definer_acl');

if (error) {
  console.error('Erro ao executar audit_security_definer_acl:', error.message);
  process.exit(1);
}

const problems = (data ?? []).filter((row) => row.problem && row.problem.length > 0);

if (problems.length > 0) {
  console.error('\n❌ SECURITY DEFINER sem search_path detectadas:');
  problems.forEach((row) => {
    console.error(`  - ${row.function_name}(${row.arguments}): ${row.problem}`);
  });
  console.error('\nAdicione SET search_path = public nas funcoes acima.');
  process.exit(1);
}

console.log(`✅ SECURITY DEFINER audit OK — nenhum problema encontrado em ${(data ?? []).length} funcoes.`);
process.exit(0);
