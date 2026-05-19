/**
 * useProductFreshnessOverride
 *
 * Lê e grava o override local da janela de validade de preço (30/60/90 dias)
 * por produto na tabela `public.product_price_freshness_overrides`.
 *
 * Precedência (resolvida no consumidor — UI/PDP):
 *   override local > valor exposto pelo BD externo > default 60 dias
 *
 * - Leitura: qualquer autenticado.
 * - Escrita: somente admin (RLS).
 */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

export const ALLOWED_FRESHNESS_THRESHOLDS = [30, 60, 90] as const;
export type FreshnessThreshold = (typeof ALLOWED_FRESHNESS_THRESHOLDS)[number];

const QK = (productId: string) => ["product-freshness-override", productId];
const QK_ALL = ["product-freshness-overrides"] as const;

export interface ProductFreshnessOverride {
  id: string;
  product_id: string;
  threshold_days: FreshnessThreshold;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
}

export function useProductFreshnessOverride(productId: string | null | undefined) {
  return useQuery({
    queryKey: QK(productId ?? "_"),
    enabled: !!productId,
    queryFn: async (): Promise<ProductFreshnessOverride | null> => {
      const { data, error } = await supabase
        .from("product_price_freshness_overrides")
        .select("*")
        .eq("product_id", productId!)
        .maybeSingle();
      if (error) throw error;
      return (data as ProductFreshnessOverride | null) ?? null;
    },
    staleTime: 60_000,
  });
}

export function useAllFreshnessOverrides() {
  return useQuery({
    queryKey: QK_ALL,
    queryFn: async (): Promise<ProductFreshnessOverride[]> => {
      const { data, error } = await supabase
        .from("product_price_freshness_overrides")
        .select("*")
        .order("updated_at", { ascending: false });
      if (error) throw error;
      return (data as ProductFreshnessOverride[]) ?? [];
    },
    staleTime: 30_000,
  });
}

export function useUpsertFreshnessOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: {
      productId: string;
      thresholdDays: FreshnessThreshold;
    }) => {
      if (!ALLOWED_FRESHNESS_THRESHOLDS.includes(input.thresholdDays)) {
        throw new Error("Validade inválida — use 30, 60 ou 90 dias.");
      }
      const { data: userRes } = await supabase.auth.getUser();
      const userId = userRes.user?.id ?? null;

      const { data, error } = await supabase
        .from("product_price_freshness_overrides")
        .upsert(
          {
            product_id: input.productId,
            threshold_days: input.thresholdDays,
            updated_by: userId,
          },
          { onConflict: "product_id" },
        )
        .select()
        .single();
      if (error) throw error;
      return data as ProductFreshnessOverride;
    },
    onSuccess: (data) => {
      qc.invalidateQueries({ queryKey: QK(data.product_id) });
      qc.invalidateQueries({ queryKey: QK_ALL });
      toast.success(`Validade definida para ${data.threshold_days} dias.`);
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Não foi possível salvar a validade.";
      toast.error(msg);
    },
  });
}

export function useDeleteFreshnessOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase
        .from("product_price_freshness_overrides")
        .delete()
        .eq("product_id", productId);
      if (error) throw error;
      return productId;
    },
    onSuccess: (productId) => {
      qc.invalidateQueries({ queryKey: QK(productId) });
      qc.invalidateQueries({ queryKey: QK_ALL });
      toast.success("Validade restaurada para o padrão (60 dias).");
    },
    onError: (err: unknown) => {
      const msg =
        err instanceof Error ? err.message : "Não foi possível restaurar.";
      toast.error(msg);
    },
  });
}
