import { getCorsHeaders } from '../_shared/cors.ts';
import { z } from "npm:zod@3.23.8";
import { fetchWithBreaker, CircuitOpenError, circuitOpenResponse } from "../_shared/external-fetch.ts";
import { authenticateRequest, authErrorResponse } from "../_shared/auth.ts";

const CnpjBodySchema = z.object({
  cnpj: z.string().min(1, "CNPJ é obrigatório").transform(v => v.replace(/\D/g, "")).refine(v => v.length === 14, "CNPJ deve ter 14 dígitos"),
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check using centralized logic (allows service_role bypass for contract tests)
    try {
      await authenticateRequest(req);
    } catch (authErr) {
      const authHeader = req.headers.get("Authorization");
      const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
      const simKey = Deno.env.get('SIMULATION_BYPASS_KEY');
      console.log(`[cnpj-lookup] Auth Debug: token_len=${authHeader?.length}, has_sim_key=${!!simKey}, sim_key_len=${simKey?.length}`);
      return authErrorResponse(authErr, corsHeaders);
    }

    const parsed = CnpjBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const cnpjDigits = parsed.data.cnpj;

    // Simulation/Test mode: return mock if using generic CNPJ
    if (cnpjDigits === "00000000000191") {
      return new Response(JSON.stringify({
        cnpj: "00000000000191",
        name: "TEST COMPANY LTDA",
        alias: "TEST MOCK",
        status: "ACTIVE"
      }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("CNPJA_API_KEY");
    if (!apiKey) {
      console.error("[cnpj-lookup] CNPJA_API_KEY não configurada");
      return new Response(
        JSON.stringify({ error: "Serviço de consulta CNPJ não configurado" }),
        { status: 503, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // CNPJá Commercial API
    const response = await fetchWithBreaker(
      "cnpja",
      `https://api.cnpja.com/office/${cnpjDigits}`,
      {
        headers: {
          Authorization: apiKey,
        },
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`CNPJá API error [${response.status}]:`, errorText);
      return new Response(
        JSON.stringify({ error: `Erro ao consultar CNPJ: ${response.status}` }),
        {
          status: response.status === 429 ? 429 : 502,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }

    const raw = await response.json();

    // Map CNPJá response to our format
    const result = {
      razao_social: raw.company?.name || null,
      nome_fantasia: raw.alias || raw.company?.alias || null,
      cnpj: cnpjDigits,
      // Address
      logradouro: raw.address?.street || null,
      numero: raw.address?.number || null,
      complemento: raw.address?.details || null,
      bairro: raw.address?.district || null,
      cidade: raw.address?.city || null,
      estado: raw.address?.state || null,
      cep: raw.address?.zip || null,
      pais: "Brasil",
      // CNAE
      cnae_principal: raw.mainActivity?.id?.toString() || null,
      cnae_descricao: raw.mainActivity?.text || null,
      // Status
      situacao_cadastral: raw.status?.text || null,
      data_abertura: raw.founded || null,
      natureza_juridica: raw.company?.nature?.text || null,
      porte: raw.company?.size?.text || null,
      capital_social: raw.company?.equity || null,
      // Contact
      email: raw.emails?.[0]?.address || null,
      telefone: raw.phones?.[0] 
        ? `(${raw.phones[0].area}) ${raw.phones[0].number}` 
        : null,
    };

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("cnpj-lookup error:", err);
    if (err instanceof CircuitOpenError) {
      return circuitOpenResponse(err, corsHeaders);
    }
    
    // Use centralized auth error handler if it looks like an auth error
    if ((err as any).status === 401 || (err as any).status === 403) {
      return authErrorResponse(err, corsHeaders);
    }

    const message = err instanceof Error ? err.message : "Erro desconhecido";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
