/**
 * MarginInsightBadge — badge inline com a margem do orçamento atual vs mediana histórica do vendedor.
 * Verde se acima da mediana; âmbar se abaixo. Usa quote_items históricos do vendedor.
 */
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { TrendingUp, TrendingDown, Info } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";

interface MarginInsightBadgeProps {
  /** Margem (ou desconto) aparente do orçamento atual em %. */
  currentMarginPercent: number;
  /** Quando informado e > 0, o componente entra em "modo dual": exibe aparente vs real. */
  realMarginPercent?: number;
  /** Markup de negociação aplicado, em %. Quando > 0 ativa o modo dual. */
  markupPercent?: number;
  className?: string;
}

export function MarginInsightBadge({
  currentMarginPercent,
  realMarginPercent,
  markupPercent,
  className,
}: MarginInsightBadgeProps) {
  const { user } = useAuth();
  const dualMode = (markupPercent ?? 0) > 0 && realMarginPercent !== null;

  const { data: median } = useQuery({
    queryKey: ["seller-margin-median", user?.id],
    enabled: !!user?.id && !dualMode,
    queryFn: async (): Promise<number | null> => {
      // Aproximação: usa subtotal vs total de orçamentos convertidos do vendedor (proxy de margem)
      const { data, error } = await supabase
        .from("quotes")
        .select("subtotal, total, discount_amount")
        .eq("seller_id", user!.id)
        .in("status", ["converted", "approved"])
        .order("created_at", { ascending: false })
        .limit(50);
      if (error || !data?.length) return null;

      const margins = data
        .map(q => {
          const sub = Number(q.subtotal ?? 0);
          const tot = Number(q.total ?? 0);
          if (sub <= 0) return null;
          // Margem aparente = (total - desconto) / subtotal — proxy para comparação relativa
          return ((tot / sub) - 1) * 100 + 100; // normaliza próximo a 100
        })
        .filter((v): v is number => v !== null)
        .sort((a, b) => a - b);
      if (!margins.length) return null;
      return margins[Math.floor(margins.length / 2)];
    },
    staleTime: 1000 * 60 * 10,
  });

  // Modo dual: mostra desconto APARENTE (cliente vê) vs REAL (alçada).
  if (dualMode) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge
              variant="outline"
              className={`gap-1.5 bg-warning/10 text-warning border-warning/30 ${className ?? ""}`}
            >
              <Info className="h-3 w-3" />
              <span className="text-[11px] font-medium">
                Aparente {currentMarginPercent.toFixed(1)}% · Real {realMarginPercent!.toFixed(1)}%
              </span>
            </Badge>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs max-w-xs">
            <p className="font-medium mb-1">Margem de negociação ativa</p>
            <p className="text-muted-foreground">
              Markup interno: <strong>+{markupPercent!.toFixed(1)}%</strong>
              <br />
              Cliente vê desconto de <strong>{currentMarginPercent.toFixed(1)}%</strong>
              <br />
              Desconto real (alçada): <strong>{realMarginPercent!.toLocaleString("pt-BR", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%</strong>
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  if (median === null) return null;

  const delta = currentMarginPercent - median;
  const isAbove = delta >= 0;
  const Icon = isAbove ? TrendingUp : TrendingDown;

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Badge
            variant="outline"
            className={`gap-1.5 ${
              isAbove
                ? "bg-success/10 text-success border-success/30"
                : "bg-warning/10 text-warning border-warning/30"
            } ${className ?? ""}`}
          >
            <Icon className="h-3 w-3" />
            <span className="text-[11px] font-medium">
              {isAbove ? "+" : ""}{delta.toFixed(1)}pp vs mediana
            </span>
            <Info className="h-2.5 w-2.5 opacity-60" />
          </Badge>
        </TooltipTrigger>
        <TooltipContent side="top" className="text-xs max-w-xs">
          <p className="font-medium mb-1">Insight de margem</p>
          <p className="text-muted-foreground">
            Sua mediana histórica: <strong>{median.toFixed(1)}%</strong>
            <br />
            Este orçamento: <strong>{currentMarginPercent.toFixed(1)}%</strong>
          </p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
