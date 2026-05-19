/**
 * useAIRecommendations — Hook para consumir a edge function ai-recommendations.
 * Recebe perfil de cliente + lista de produtos e retorna recomendações rankeadas por IA.
 *
 * Features:
 * - AbortController para cancelamento de requisições em andamento
 * - Retry com backoff exponencial (até 2 tentativas em erros 5xx)
 * - Cache em memória por chave de request
 * - Tratamento específico para 429 (rate limit) e 402 (créditos)
 */
import { useState, useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

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
  category: string;
  description?: string;
  priceRange?: string;
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
  return `${client.name}|${client.industry ?? ""}|${products.map((p) => p.id).sort().join(",")}`;
}

/** Delay com promise */
const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Verifica se o erro é retentável (5xx) */
function isRetryable(status: number): boolean {
  return status >= 500 && status < 600;
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
          throw new Error("Nome do cliente é obrigatório");
        }
        if (!products.length) {
          throw new Error("É necessário fornecer pelo menos um produto");
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
          throw new Error("Usuário não autenticado");
        }

        // Fetch com retry
        let lastError: Error | null = null;

        for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
          if (controller.signal.aborted) {
            throw new DOMException("Requisição cancelada", "AbortError");
          }

          if (attempt > 0) {
            await delay(INITIAL_BACKOFF_MS * Math.pow(2, attempt - 1));
          }

          try {
            const response = await fetch(
              `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/ai-recommendations`,
              {
                method: "POST",
                headers: {
                  "Content-Type": "application/json",
                  apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
                  Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify({ client, products }),
                signal: controller.signal,
              }
            );

            if (!response.ok) {
              if (response.status === 429) {
                throw new Error("Limite de requisições excedido. Tente novamente em alguns minutos.");
              }
              if (response.status === 402) {
                throw new Error("Créditos de IA esgotados. Contate o administrador.");
              }
              if (isRetryable(response.status) && attempt < MAX_RETRIES) {
                lastError = new Error(`Erro do servidor: ${response.status}`);
                continue;
              }
              const errText = await response.text().catch(() => "");
              throw new Error(`Erro ao gerar recomendações: ${response.status} ${errText}`);
            }

            const result: AIRecommendationsResult = await response.json();
            cacheRef.current.set(key, result);
            setData(result);
            return result;
          } catch (fetchErr) {
            if (fetchErr instanceof DOMException && fetchErr.name === "AbortError") {
              throw fetchErr;
            }
            if ((fetchErr as Error).message?.includes("Limite") ||
                (fetchErr as Error).message?.includes("Créditos")) {
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
        if (err instanceof DOMException && err.name === "AbortError") {
          return null;
        }
        const message = err instanceof Error ? err.message : "Erro desconhecido";
        setError(message);
        toast.error(message);
        return null;
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    },
    []
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
    insights: data?.insights ?? "",
    isLoading,
    error,
    fetchRecommendations,
    reset,
    clearCache,
  };
}
