import { getCorsHeaders } from '../_shared/cors.ts';
import { z } from 'npm:zod@3.23.8';
import {
  fetchWithBreaker,
  CircuitOpenError,
  circuitOpenResponse,
} from '../_shared/external-fetch.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { safeErrorFields } from '../_shared/log-safety.ts';
// BUG-014 FIX: import resolveCredential for SSOT credential resolution (DB-first -> env fallback).
// Previously used Deno.env.get('CNPJA_API_KEY') directly; key rotations via /admin/conexoes
// had no effect until the Deno isolate was restarted.
import { resolveCredential } from '../_shared/credentials.ts';

const CnpjBodySchema = z.object({
  cnpj: z
    .string()
    .min(1, 'CNPJ \u00e9 obrigat\u00f3rio')
    .transform((v) => v.replace(/\D/g, ''))
    .refine((v) => v.length === 14, 'CNPJ deve ter 14 d\u00edgitos'),
});

Deno.serve(async (req) => {
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Auth check using centralized logic (allows service_role bypass for contract tests)
    try {
      await authenticateRequest(req);
    } catch (authErr) {
      const simKey = Deno.env.get('SIMULATION_BYPASS_KEY');
      console.warn(`[cnpj-lookup] Auth failed; simulation_key_configured=${!!simKey}`);
      return authErrorResponse(authErr, corsHeaders);
    }

    const parsed = CnpjBodySchema.safeParse(await req.json());
    if (!parsed.success) {
      return new Response(JSON.stringify({ error: parsed.error.flatten().fieldErrors }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }
    const cnpjDigits = parsed.data.cnpj;

    // BUG-003 FIX: Mock response format corrected.
    if (cnpjDigits === '00000000000191') {
      return new Response(
        JSON.stringify({
          success: true,
          data: {
            razao_social: 'TEST COMPANY LTDA',
            nome_fantasia: 'TEST MOCK',
            cnpj: cnpjDigits,
            logradouro: 'Rua Teste',
            numero: '123',
            complemento: null,
            bairro: 'Bairro Teste',
            cidade: 'S\u00e3o Paulo',
            estado: 'SP',
            cep: '01310100',
            pais: 'Brasil',
            cnae_principal: '4755501',
            cnae_descricao: 'Com\u00e9rcio varejista de tecidos',
            situacao_cadastral: 'ATIVA',
            data_abertura: '2000-01-01',
            natureza_juridica: 'Sociedade Empres\u00e1ria Limitada',
            porte: 'MEDIO',
            capital_social: 100000,
            email: 'contato@test.com.br',
            telefone: '(11) 99999-9999',
          },
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } },
      );
    }

    // BUG-014 FIX: use resolveCredential() (DB-first SSOT) instead of Deno.env.get().
    const { value: apiKey } = await resolveCredential('CNPJA_API_KEY');
    if (!apiKey) {
      console.error('[cnpj-lookup] CNPJA_API_KEY n\u00e3o configurada');
      return new Response(JSON.stringify({ error: 'Servi\u00e7o de consulta CNPJ n\u00e3o configurado' }), {
        status: 503,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const response = await fetchWithBreaker('cnpja', `https://api.cnpja.com/office/${cnpjDigits}`, {
      headers: { Authorization: apiKey },
    });

    if (!response.ok) {
      await response.text();
      console.error(`CNPJ\u00e1 API error [${response.status}]`);
      return new Response(JSON.stringify({ error: `Erro ao consultar CNPJ: ${response.status}` }), {
        status: response.status === 429 ? 429 : 502,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const raw = await response.json();

    const result = {
      razao_social: raw.company?.name || null,
      nome_fantasia: raw.alias || raw.company?.alias || null,
      cnpj: cnpjDigits,
      logradouro: raw.address?.street || null,
      numero: raw.address?.number || null,
      complemento: raw.address?.details || null,
      bairro: raw.address?.district || null,
      cidade: raw.address?.city || null,
      estado: raw.address?.state || null,
      cep: raw.address?.zip || null,
      pais: 'Brasil',
      cnae_principal: raw.mainActivity?.id?.toString() || null,
      cnae_descricao: raw.mainActivity?.text || null,
      situacao_cadastral: raw.status?.text || null,
      data_abertura: raw.founded || null,
      natureza_juridica: raw.company?.nature?.text || null,
      porte: raw.company?.size?.text || null,
      capital_social: raw.company?.equity || null,
      email: raw.emails?.[0]?.address || null,
      telefone: raw.phones?.[0] ? `(${raw.phones[0].area}) ${raw.phones[0].number}` : null,
    };

    return new Response(JSON.stringify({ success: true, data: result }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    console.error('cnpj-lookup error:', safeErrorFields(err));
    if (err instanceof CircuitOpenError) return circuitOpenResponse(err, corsHeaders);
    if ((err as any).status === 401 || (err as any).status === 403) return authErrorResponse(err, corsHeaders);
    const message = err instanceof Error ? err.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
