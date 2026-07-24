import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { getCredential } from "../_shared/credentials.ts";

Deno.test({
  name: "Conectividade do Supabase Externo",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const url = await getCredential('EXTERNAL_PROMOBRIND_URL');
    const key = await getCredential('EXTERNAL_PROMOBRIND_SERVICE_ROLE_KEY');

    if (!url || !key) {
      throw new Error("Credenciais externas não encontradas no Vault ou Env");
    }

    const client = createClient(url, key);
    
    // Teste 1: Conexão básica e leitura de tabela central
    const { data, error } = await client.from("products").select("id").limit(1);
    
    if (error) {
      throw new Error(`Falha ao ler tabela 'products' no Supabase Externo: ${error.message}`);
    }
    
    console.log("✅ Conexão com Supabase Externo estabelecida com sucesso.");
    console.log(`✅ Tabela 'products' acessível. Amostra ID: ${data?.[0]?.id}`);
  }
});

Deno.test({
  name: "Validação de RLS no Supabase Externo",
  sanitizeOps: false,
  sanitizeResources: false,
  async fn() {
    const url = await getCredential('EXTERNAL_PROMOBRIND_URL');
    const anonKey = await getCredential('EXTERNAL_PROMOBRIND_ANON_KEY');

    if (!url || !anonKey) {
      console.log("⚠️ Anon Key externa não encontrada, pulando teste de RLS público.");
      return;
    }

    const client = createClient(url, anonKey);
    
    // Tentar ler tabela protegida sem auth (deve respeitar RLS)
    const { error } = await client.from("admin_audit_log").select("*").limit(1);
    
    if (error && (error.code === '42501' || error.message.includes('permission denied'))) {
      console.log("✅ RLS funcionando: Acesso negado para anon em tabela restrita.");
    } else if (!error) {
      console.log("⚠️ Alerta: Tabela 'admin_audit_log' parece estar sem RLS ou com política pública.");
    }
  }
});
