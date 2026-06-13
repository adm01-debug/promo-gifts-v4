/**
 * word-magic-api.ts
 * Wrapper para a Edge Function `word-magic` que gera conteúdo AI on-demand.
 *
 * Padrão: supabase.functions.invoke('word-magic', { body }) — mesmo padrão
 * usado em quote-sync, send-transactional-email etc.
 */

import { supabase } from '@/integrations/supabase/client';

// ─── Tipo de enriquecimento (mantido local — store simplificado em v2) ─────────

export interface WordMagicEnrichment {
  ai_title: string;
  ai_description: string;
  ai_summary: string;
  ai_version: number;
  ai_generated_at?: string;
  source: 'cache' | 'generated';
}

// ─── Tipos de resposta da Edge Function ───────────────────────────────────────

interface WordMagicSuccess {
  source: 'cache' | 'generated';
  ai_title: string;
  ai_description: string;
  ai_summary: string;
  ai_version: number;
  ai_generated_at?: string;
  ai_model?: string;
  generation_ms?: number;
  total_ms?: number;
}

interface WordMagicError {
  error: string;
  product_id?: string;
}

type WordMagicResponse = WordMagicSuccess | WordMagicError;

function isErrorResponse(r: WordMagicResponse): r is WordMagicError {
  return 'error' in r;
}

// ─── Opções de chamada ────────────────────────────────────────────────────────

export interface InvokeWordMagicOptions {
  productId: string;
  forceRegenerate?: boolean;
  /** Timeout em ms (default 30s — DeepSeek pode demorar em cold start) */
  timeoutMs?: number;
}

export interface WordMagicResult {
  enrichment: WordMagicEnrichment;
  generation_ms?: number;
  total_ms?: number;
}

// ─── Função principal ─────────────────────────────────────────────────────────

/**
 * Chama a Edge Function `word-magic` para obter ou gerar conteúdo IA
 * para um produto. Retorna o enriquecimento pronto para armazenar no store.
 *
 * @throws Error com mensagem legível em caso de falha
 */
export async function invokeWordMagic(
  opts: InvokeWordMagicOptions,
): Promise<WordMagicResult> {
  const { productId, forceRegenerate = false } = opts;

  const { data, error } = await supabase.functions.invoke<WordMagicResponse>(
    'word-magic',
    {
      body: {
        product_id:       productId,
        force_regenerate: forceRegenerate,
      },
    },
  );

  // Erro de rede / autenticação (supabase.functions.invoke nível)
  if (error) {
    throw new Error(
      error.message ?? 'Erro ao conectar com o serviço Word Magic.',
    );
  }

  if (!data) {
    throw new Error('Resposta vazia da Edge Function word-magic.');
  }

  // Erro retornado pelo servidor (HTTP 4xx/5xx com body { error })
  if (isErrorResponse(data)) {
    throw new Error(data.error ?? 'Erro desconhecido no Word Magic.');
  }

  // Sucesso — normalizar para o formato do store
  const enrichment: WordMagicEnrichment = {
    ai_title:       data.ai_title,
    ai_description: data.ai_description,
    ai_summary:     data.ai_summary,
    ai_version:     data.ai_version,
    ai_generated_at: data.ai_generated_at,
    source:         data.source,
  };

  return {
    enrichment,
    generation_ms: data.generation_ms,
    total_ms:      data.total_ms,
  };
}
