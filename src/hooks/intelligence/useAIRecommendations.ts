/**
 * useAIRecommendations — Hook para consumir a edge function ai-recommendations.
 * Recebe perfil de cliente + lista de produtos e retorna recomendações rankeadas por IA.
 *
 * Features:
 * - AbortController para cancelamento de requisições em andamento
 * - Retry com backoff exponencial (apenas 502/503/504 — infra temporária)
 * - Cache em memória por chave de request
 * - Tratamento específico para 429 (rate limit) e 402 (créditos)
 * - extractErrorMessage: extrai mensagem legível de respostas 4xx/5xx (inclui 500 com body JSON)
 */
import { useState, useCallback, useRef } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

// ============================================
// TIPOS
// ============================================

export interface ClientProfile {
  name: string;
  company?: string;
  industry?: string;
  preferences?: string[];
  purchaseHistory?: string[];
  budget?: string;
}

export interface ProductForRecommendation {
  id: string;
  name: string;
  sku?: string;
  category: string;
  description?: string;
  priceRange?: string;
  imageUrl?: string;
  tags?: string[];
}

export interface Recommendation {
  productId: string;
  score: number;
  reason: string;
}

export interface AIRecommendationsResult {
  recommendations: Recommendation[];
  insights: string;
}

// ============================================
// HELPERS
// ============================================

const MAX_RETRIES = 2;
const INITIAL_BACKOFF_MS = 500;

/** Gera chave de cache a partir do payload */
function cacheKey(client: ClientProfile, products: ProductForRecommendation[]): string {
  return `${client.name}|${client.industry ?? ''}|${products
    .map((p) => p.id)
    .sort()
    .join(',')}`;
}

/** Delay com promise */
const delay = (ms: number) =>
  new Promise((resolve) => {
    setTimeout(resolve, ms);
  });

/** Verifica se o erro é retentável.
 * Apenas 502/503/504 (infra temporariamente indisponível) devem ser retentados.
 * 500 = erro de configuração/lógica no servidor — não adianta tentar de novo. */
function isRetryable(status: number): boolean {
  return status === 502 || status === 503 || status === 504;
}

/**
 * Extrai mensagem de erro legível de uma Response falha (4xx/5xx).
 * Tenta parsear JSON (campos message/error/msg), fallback para texto puro,
 * fallback para mensagem genérica amigável — nunca retorna string vazia.
 */
async function extractErrorMessage(response: Response): Promise<string> {
  try {
    const text = await response.text();
    if (!text.trim()) {
      return `Erro interno no serviço de recomendações (HTTP ${response.status}). Tente novamente mais tarde.`;
    }
    try {
      const json = JSON.parse(text);
      const msg = json.message ?? json.error ?? json.msg ?? null;
      return msg ? String(msg) : `${text} (HTTP ${response.status})`;
    } catch {
      return `${text} (HTTP ${response.status})`;
    }
  } catch {
    return `Erro interno no serviço de recomendações (HTTP ${response.status}). Tente novamente mais tarde.`;
  }
}

// ============================================
// HOOK
// ============================================

export function useAIRecommendations() {
  const [data, setData] = useState<AIRecommendationsResult | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const cacheRef = useRef<Map<string, AIRecommendationsResult>>(new Map());

  const fetchRecommendations = useCallback(
    async (client: ClientProfile, products: ProductForRecommendation[]) => {
      // Cancela requisição anterior se existir
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setIsLoading(true);
      setError(null);
      setData(null);

      try {
        // Validações
        if (!client.name) {
          throw new Error('Nome do cliente é obrigatório');
        }
        if (!products.length) {
          throw new Error('É necessário fornecer pelo menos um produto');
        }

        // Verifica cache
        const key = cacheKey(client, products);
        const cached = cacheRef.current.get(key);
        if (cached) {
          setData(cached);
          return cached;
        }

        // Autenticação
        const { data: sessionData } = await supabase.auth.getSession();
        const token = sessionData?.session?.access_token;
        if (!token) {
          throw new Error('Usuário não autenticado');
        }

        // Fetch com retry
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          if (controller.signal.aborted) {
            throw new DOMException('Requisição cancelada', 'AbortError');
          }

          if (attempt > 0) {
            await delay(INITIAL_BACKOFF_MS * 2 ** (attempt - 1));
          }

          try {
            // Usa supabase.functions.invoke para garantir que a URL e o token
            // pertencem ao MESMO projeto (canônico doufsxqlfjyuvxuezpln). Se
            // usássemos VITE_SUPABASE_URL diretamente, um .env regenerado
            // poderia apontar para outro projeto e invalidar o JWT (401
            // "Token inválido ou expirado").
            const supabaseUrl = (supabase as unknown as { supabaseUrl: string }).supabaseUrl;
            const response = await fetch(`${supabaseUrl}/functions/v1/ai-recommendations`, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                apikey: (supabase as unknown as { supabaseKey: string }).supabaseKey,
                Authorization: `Bearer ${token}`,
              },
              body: JSON.stringify({ client, products }),
              signal: controller.signal,
            });

            if (!response.ok) {
              if (response.status === 429) {
                throw new Error(
                  'Limite de requisições excedido. Tente novamente em alguns minutos.',
                );
              }
              if (response.status === 402) {
                throw new Error('Créditos de IA esgotados. Contate o administrador.');
              }
              if (isRetryable(response.status)) {
                const statusMsg = `Erro do servidor: ${response.status}`;
                if (attempt < MAX_RETRIES) {
                  lastError = new Error(statusMsg);
                  continue;
                }
                throw new Error(statusMsg);
              }
              const errMsg = await extractErrorMessage(response);
              throw new Error(errMsg);
            }

            const result: AIRecommendationsResult = await response.json();
            cacheRef.current.set(key, result);
            setData(result);
            return result;
          } catch (fetchErr) {
            if (fetchErr instanceof DOMException && fetchErr.name === 'AbortError') {
              throw fetchErr;
            }
            const fetchErrMsg = fetchErr instanceof Error ? fetchErr.message : String(fetchErr);
            if (fetchErrMsg.includes('Limite') || fetchErrMsg.includes('Créditos')) {
              throw fetchErr;
            }
            lastError = fetchErr instanceof Error ? fetchErr : new Error(String(fetchErr));
            if (attempt >= MAX_RETRIES) throw lastError;
          }
        }

        if (lastError) throw lastError;
        return null;
      } catch (err) {
        // Ignora silenciosamente requisições abortadas
        if (err instanceof DOMException && err.name === 'AbortError') {
          return null;
        }
        const message = err instanceof Error ? err.message : 'Erro desconhecido';
        setError(message);
        toast.error(message);
        return null;
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  const reset = useCallback(() => {
    abortRef.current?.abort();
    setData(null);
    setError(null);
    setIsLoading(false);
  }, []);

  const clearCache = useCallback(() => {
    cacheRef.current.clear();
  }, []);

  return {
    data,
    recommendations: data?.recommendations ?? [],
    insights: data?.insights ?? '',
    isLoading,
    error,
    fetchRecommendations,
    reset,
    clearCache,
  };
}
