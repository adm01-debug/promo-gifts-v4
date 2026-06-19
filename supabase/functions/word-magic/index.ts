import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.4';
import { getCorsHeaders } from '../_shared/cors.ts';
import { authenticateRequest, authErrorResponse } from '../_shared/auth.ts';
import { safeErrorFields } from '../_shared/log-safety.ts';
import { z } from '../_shared/zod-validate.ts';
import { resolveCredential } from '../_shared/credentials.ts';
import { createStructuredLogger } from '../_shared/structured-logger.ts';
import { getOrCreateRequestId } from '../_shared/request-id.ts';

// ─── Constantes ───────────────────────────────────────────────────────────────

const DEEPSEEK_API_URL = 'https://api.deepseek.com/v1/chat/completions';
const DEEPSEEK_MODEL   = 'deepseek-v4-flash'; // MIGRADO: deepseek-chat depreca 24/jul/2026
const MAX_TOKENS       = 2048; // FIX: era 700 no processador batch → textos truncados

// ─── Schema de entrada ────────────────────────────────────────────────────────

const RequestSchema = z.object({
  product_id:        z.string().uuid('product_id deve ser um UUID válido'),
  force_regenerate:  z.boolean().optional().default(false),
});

// ─── Sistema de copywriting B2B ───────────────────────────────────────────────

const SYSTEM_PROMPT = `Você é um especialista em copywriting B2B para brindes corporativos no Brasil.
Escreva textos em português (pt-BR) que combinam clareza técnica com apelo comercial.
Foco: distribuidores e empresas comprando brindes em quantidade (50–10.000 unidades).
Estilo: direto, profissional, sem clichês, sem superlativos vazios.
REGRA CRÍTICA: retorne APENAS JSON válido, zero markdown, zero texto adicional, zero comentários.`;

function buildPrompt(ctx: Record<string, unknown>, config: Record<string, unknown>): string {
  const materials   = Array.isArray(ctx.materials)     ? (ctx.materials as string[]).join(', ')     : String(ctx.materials || '');
  const colors      = Array.isArray(ctx.colors)        ? (ctx.colors as string[]).join(', ')        : String(ctx.colors || '');
  const engravingAreas = Array.isArray(ctx.engraving_areas)
    ? (ctx.engraving_areas as string[]).join('; ')
    : String(ctx.engraving_areas || '');
  const certificates = Array.isArray(ctx.certificates) ? (ctx.certificates as string[]).join(', ') : '';

  const personas   = Array.isArray(config.personas)   ? (config.personas as string[]).join(', ')   : 'Marketing, RH, Compras';
  const ocasioes   = Array.isArray(config.ocasioes)   ? (config.ocasioes as string[]).join(', ')   : 'eventos, campanhas, datas comemorativas';
  const ctas       = Array.isArray(config.ctas)       ? (config.ctas as string[])[0]              : 'Solicite um orçamento!';
  const storytelling = typeof config.storytelling_template === 'string' ? config.storytelling_template : '';

  return `Produto do fornecedor:
- Nome: ${ctx.name}
- Descrição original: ${ctx.description || ctx.short_description || ''}
- Materiais: ${materials || 'não informado'}
- Categoria: ${ctx.category_type || ''} > ${ctx.category_subtype || ''}
- Cores disponíveis: ${colors || 'diversas'}
- Fornecedor: ${ctx.supplier_code}
- Gravação: ${ctx.engraving_type || ''} | Áreas: ${engravingAreas}
- Embalagem: ${ctx.packaging_info || ''}
- Qtd. mínima: ${ctx.min_quantity || 1} unidades
- Certificações: ${certificates || 'padrão'}

Público-alvo: ${personas}
Ocasiões ideais: ${ocasioes}
CTA sugerida: ${ctas}
${storytelling ? `Template narrativo: ${storytelling}` : ''}

Gere o JSON abaixo com textos comercialmente otimizados para brindes B2B brasileiros.
IMPORTANTE: ai_description deve ter entre 500 e 900 caracteres, NUNCA ser cortada no meio de uma frase. Finalize sempre com ponto.

{
  "ai_title": "Título comercial impactante (máx 90 chars, sem nº de referência do fornecedor)",
  "ai_description": "Descrição B2B completa com bullets ✅ mostrando benefícios. Entre 500-900 chars. SEMPRE terminar com frase completa.",
  "ai_summary": "Resumo para listagem do catálogo (máx 200 chars, terminar com ponto)"
}`;
}

// ─── Handler principal ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  const __reqId = getOrCreateRequestId(req);
  const log = createStructuredLogger({ fn: 'word-magic', requestId: __reqId, req });
  log.info('request_start');
  const corsHeaders = getCorsHeaders(req);
  if (req.method === 'OPTIONS') return new Response(null, { headers: corsHeaders });

  const startMs = Date.now();

  try {
    // 1. Autenticação obrigatória
    const auth = await authenticateRequest(req);

    // 2. Parse + validação do body
    let rawBody: unknown;
    try { rawBody = await req.json(); }
    catch {
      return new Response(
        JSON.stringify({ error: 'Body JSON inválido' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const parsed = RequestSchema.safeParse(rawBody);
    if (!parsed.success) {
      return new Response(
        JSON.stringify({ error: 'Validação falhou', details: parsed.error.flatten().fieldErrors }),
        { status: 422, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    const { product_id, force_regenerate } = parsed.data;

    // 3. Cliente Supabase com service_role
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
      { auth: { persistSession: false, autoRefreshToken: false } }
    );

    // 4. Verificar se produto existe + estado atual do AI
    const { data: product, error: productErr } = await supabase
      .from('products')
      .select('id, name, ai_title, ai_description, ai_summary, ai_version, ai_generated_at, locked_fields, is_active, is_deleted')
      .eq('id', product_id)
      .maybeSingle();

    if (productErr) throw productErr;
    if (!product) {
      return new Response(
        JSON.stringify({ error: 'Produto não encontrado', product_id }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }
    if (!product.is_active || product.is_deleted) {
      return new Response(
        JSON.stringify({ error: 'Produto inativo ou removido', product_id }),
        { status: 410, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 5. Cache hit: produto já tem AI e não está forçando regeneração
    if (!force_regenerate && (product.ai_version ?? 0) > 0 && product.ai_title) {
      console.log(`[word-magic] cache_hit product=${product_id} version=${product.ai_version}`);
      return new Response(
        JSON.stringify({
          source:         'cache',
          ai_title:       product.ai_title,
          ai_description: product.ai_description,
          ai_summary:     product.ai_summary,
          ai_version:     product.ai_version,
          ai_generated_at: product.ai_generated_at,
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 6. Obter contexto rico do produto (per-supplier: STRICKER/XBZ/ASIA/SOMARCAS)
    const { data: productCtx, error: ctxErr } = await supabase
      .rpc('fn_get_product_ai_context', { p_product_id: product_id });
    if (ctxErr) throw ctxErr;
    if (!productCtx || (productCtx as Record<string, unknown>).error) {
      throw new Error(`fn_get_product_ai_context falhou: ${JSON.stringify(productCtx)}`);
    }

    // 7. Obter config de copywriting por categoria
    const categoryId = (productCtx as Record<string, unknown>).category_id as string | null;
    let copywritingConfig: Record<string, unknown> = {};
    if (categoryId) {
      const { data: cfg } = await supabase.rpc('get_copywriting_config', { p_category_id: categoryId });
      if (cfg) copywritingConfig = cfg as Record<string, unknown>;
    }

    // 8. Claim queue item (UPSERT) — garante rastreabilidade e usa fn_save existente
    const now = new Date().toISOString();
    let queueId: string;

    const { data: existing } = await supabase
      .from('ai_enrichment_queue')
      .select('id, status')
      .eq('product_id', product_id)
      .eq('enrichment_type', 'all')
      .maybeSingle();

    if (!existing) {
      const { data: inserted, error: insertErr } = await supabase
        .from('ai_enrichment_queue')
        .insert({
          product_id,
          enrichment_type: 'all',
          status:          'processing',
          priority:        1,
          locked_by:       'word-magic',
          locked_at:       now,
          last_attempt_at: now,
        })
        .select('id')
        .single();
      if (insertErr) throw insertErr;
      queueId = inserted!.id;
    } else {
      await supabase
        .from('ai_enrichment_queue')
        .update({
          status:          'processing',
          locked_by:       'word-magic',
          locked_at:       now,
          last_attempt_at: now,
          updated_at:      now,
          attempts:        (existing.status === 'error' ? 0 : undefined),
        })
        .eq('id', existing.id);
      queueId = existing.id;
    }

    // 9. Obter chave DeepSeek (DB-first → env fallback) via SSOT resolveCredential.
    //    Reusa o service client já criado; nunca ler credencial user-configurável
    //    direto de Deno.env (ssot-bypass — ver scripts/audit-credentials.mjs).
    const { value: deepseekKey } = await resolveCredential('DEEPSEEK_API_KEY', supabase);

    if (!deepseekKey) {
      // Marcar fila como erro antes de lançar
      await supabase.from('ai_enrichment_queue')
        .update({ status: 'error', last_error: 'DEEPSEEK_API_KEY não configurada', updated_at: now })
        .eq('id', queueId);
      return new Response(
        JSON.stringify({ error: 'Chave DeepSeek não configurada. Verifique as credenciais.' }),
        { status: 503, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // 10. Chamar DeepSeek V4-Flash — max_tokens=2048 (FIX do truncamento)
    const aiStart = Date.now();
    const prompt  = buildPrompt(productCtx as Record<string, unknown>, copywritingConfig);

    const dsResponse = await fetch(DEEPSEEK_API_URL, {
      method:  'POST',
      headers: {
        'Authorization': `Bearer ${deepseekKey}`,
        'Content-Type':  'application/json',
      },
      body: JSON.stringify({
        model:           DEEPSEEK_MODEL,
        max_tokens:      MAX_TOKENS,
        temperature:     0.7,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user',   content: prompt },
        ],
      }),
    });

    const generationMs = Date.now() - aiStart;

    if (!dsResponse.ok) {
      const errText = await dsResponse.text().catch(() => '');
      console.error(`[word-magic] deepseek_error status=${dsResponse.status}`, errText.slice(0, 300));
      await supabase.rpc('fn_save_ai_enrichment_results', {
        p_queue_id:       queueId,
        p_product_id:     product_id,
        p_ai_model:       DEEPSEEK_MODEL,
        p_success:        false,
        p_error:          `DeepSeek HTTP ${dsResponse.status}: ${errText.slice(0, 200)}`,
        p_generation_ms:  generationMs,
      });
      return new Response(
        JSON.stringify({ error: `Geração AI falhou (HTTP ${dsResponse.status})` }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const dsData = await dsResponse.json();
    const rawContent = dsData.choices?.[0]?.message?.content ?? '';

    // 11. Parse + validação da resposta
    let enrichment: { ai_title?: string; ai_description?: string; ai_summary?: string };
    try {
      enrichment = JSON.parse(rawContent);
    } catch {
      console.error('[word-magic] json_parse_error raw=', rawContent.slice(0, 200));
      await supabase.rpc('fn_save_ai_enrichment_results', {
        p_queue_id:      queueId,
        p_product_id:    product_id,
        p_ai_model:      DEEPSEEK_MODEL,
        p_success:       false,
        p_error:         'Resposta AI não é JSON válido',
        p_generation_ms: generationMs,
      });
      return new Response(
        JSON.stringify({ error: 'Resposta da IA inválida. Tente novamente.' }),
        { status: 502, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Garantias básicas de qualidade
    const aiTitle       = enrichment.ai_title?.trim()       || product.name;
    const aiDescription = enrichment.ai_description?.trim() || '';
    const aiSummary     = enrichment.ai_summary?.trim()     || '';

    // 12. Salvar via fn_save_ai_enrichment_results (respeita locked_fields + histórico)
    const { data: saveResult, error: saveErr } = await supabase.rpc('fn_save_ai_enrichment_results', {
      p_queue_id:          queueId,
      p_product_id:        product_id,
      p_ai_title:          aiTitle,
      p_ai_description:    aiDescription,
      p_ai_summary:        aiSummary,
      p_ai_model:          DEEPSEEK_MODEL,
      p_success:           true,
      p_prompt_tokens:     dsData.usage?.prompt_tokens     ?? 0,
      p_completion_tokens: dsData.usage?.completion_tokens ?? 0,
      p_generation_ms:     generationMs,
    });

    if (saveErr) throw saveErr;

    const totalMs = Date.now() - startMs;
    console.log(
      `[word-magic] generated product=${product_id} version=${(saveResult as Record<string,unknown>)?.new_version} ` +
      `tokens_in=${dsData.usage?.prompt_tokens} tokens_out=${dsData.usage?.completion_tokens} ` +
      `ai_ms=${generationMs} total_ms=${totalMs} user=${auth.userId}`
    );

    return new Response(
      JSON.stringify({
        source:         'generated',
        ai_title:       aiTitle,
        ai_description: aiDescription,
        ai_summary:     aiSummary,
        ai_version:     (saveResult as Record<string, unknown>)?.new_version,
        ai_model:       DEEPSEEK_MODEL,
        generation_ms:  generationMs,
        total_ms:       totalMs,
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-Id': __reqId } }
    );

  } catch (e) {
    if ((e as Record<string, unknown>)?.status === 401 || (e as Record<string, unknown>)?.status === 403) {
      return authErrorResponse(e, corsHeaders);
    }
    console.error('[word-magic] unhandled_error', safeErrorFields(e));
    return new Response(
      JSON.stringify({ error: 'Erro interno. Tente novamente em instantes.' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json', 'X-Request-Id': __reqId } }
    );
  }
});
