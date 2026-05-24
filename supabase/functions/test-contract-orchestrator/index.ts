import { createStructuredLogger } from "../_shared/structured-logger.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";
import { encodeHex } from "https://deno.land/std@0.224.0/encoding/hex.ts";
import { buildPublicCorsHeaders } from "../_shared/cors.ts";
import { resolveCredential } from "../_shared/credentials.ts";


const corsHeaders = buildPublicCorsHeaders({ allowMethods: "POST, OPTIONS" });

async function hmacSign(payload: string, secret: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw", enc.encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(payload));
  return encodeHex(new Uint8Array(sig));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(supabaseUrl, serviceRoleKey);

  const results = [];

  // SIMULATION_BYPASS_KEY: resolvido via vault/env, nunca hardcoded.
  // Se não estiver configurado, este orchestrator não consegue executar
  // os contratos que exigem bypass — devolve 503 explícito (fail-closed).
  const bypassRes = await resolveCredential("SIMULATION_BYPASS_KEY", supabase);
  const SIM_BYPASS = bypassRes.value;
  if (!SIM_BYPASS) {
    return new Response(
      JSON.stringify({
        error: "service_misconfigured",
        message: "SIMULATION_BYPASS_KEY não configurado em integration_credentials nem em env. Este orchestrator exige bypass para chamar bridges internas.",
      }),
      { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }

  try {
    // 1. Testar external-db-bridge (Operação de Select Mocado ou Simples)
    const bridgeStart = performance.now();
    try {
      const bridgeRes = await fetch(`${supabaseUrl}/functions/v1/external-db-bridge`, {
        method: "POST",
        headers: { "Authorization": `Bearer ${SIM_BYPASS}`, "Content-Type": "application/json" },
        body: JSON.stringify({ operation: "select", table: "products", limit: 1 })
      });
      results.push({ 
        name: "external-db-bridge", 
        status: bridgeRes.status, 
        ok: bridgeRes.ok, 
        latency: performance.now() - bridgeStart 
      });
    } catch (e) {
      results.push({ name: "external-db-bridge", error: String(e) });
    }

    // 2. Testar webhook-inbound (Contrato de Assinatura)
    const inboundStart = performance.now();
    try {
      const payload = { event: "test", data: { ping: "pong" } };
      // Usar o mesmo segredo já resolvido para assinar (consistente com o endpoint mockado).
      const signature = "sha256=" + await hmacSign(JSON.stringify(payload), SIM_BYPASS);

      
      // Criar endpoint de teste se não existir
      await supabase.from("inbound_webhook_endpoints").upsert({
        slug: "test-automated",
        active: true,
        hmac_secret_ref: "SIMULATION_BYPASS_KEY" // Apontando para a chave que inserimos
      }, { onConflict: "slug" });

      const inboundRes = await fetch(`${supabaseUrl}/functions/v1/webhook-inbound?slug=test-automated`, {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "x-signature-256": signature 
        },
        body: JSON.stringify(payload)
      });
      results.push({ 
        name: "webhook-inbound", 
        status: inboundRes.status, 
        ok: inboundRes.ok, 
        latency: performance.now() - inboundStart 
      });
    } catch (e) {
      results.push({ name: "webhook-inbound", error: String(e) });
    }

    return new Response(JSON.stringify({ results }, null, 2), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
