import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { resolveCredential } from "../_shared/credentials.ts";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";

const corsHeaders = buildPublicCorsHeaders({ allowMethods: "GET, OPTIONS" });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    // Em produção, não podemos ler a raiz do sistema de arquivos do projeto diretamente.
    // O inventário deve ser baseado nas funções já conhecidas ou passadas via parâmetro.
    // Como queremos o cruzamento real, vamos usar uma lista estática baseada na análise anterior
    // ou tentar inferir do ambiente se possível.
    
    const functions = [
      "external-db-bridge", "webhook-inbound", "product-webhook", "webhook-dispatcher",
      "ai-recommendations", "cnpj-lookup", "crm-db-bridge", "simulation-orchestrator",
      "expert-chat", "quote-sync", "auth-email-hook", "process-email-queue"
    ]; // Top 12 críticas para o MVP


    // 2. Mapeamento de dependências críticas (Secrets & Tabelas)
    const inventory = await Promise.all(functions.map(async (fn) => {
      // Como não podemos ler o arquivo index.ts de outras funções em runtime (isolamento),
      // vamos usar o resolveCredential para testar a presença das chaves conhecidas
      // que cada função costuma usar baseado nos padrões do projeto.

      const commonEnvs = [
        "SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_ANON_KEY",
        "N8N_PRODUCT_WEBHOOK_SECRET", "WEBHOOK_DISPATCHER_SECRET",
        "EXTERNAL_PROMOBRIND_URL", "EXTERNAL_CRM_URL"
      ];


      // Verificar status das credenciais
      const credentialStatus = await Promise.all(commonEnvs.map(async (env) => {
        const res = await resolveCredential(env, supabase);
        return { name: env, present: res.value !== null, source: res.source };
      }));

      return {
        name: fn,
        credentialStatus
      };
    }));


    return new Response(JSON.stringify({ 
      count: functions.length,
      inventory 
    }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err instanceof Error ? err.message : String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
