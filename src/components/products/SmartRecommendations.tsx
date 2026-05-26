/**
 * SmartRecommendations — Carrossel contextual de produtos recomendados pela IA.
 *
 * Uso típico: páginas de detalhe/catálogo. Recebe `currentProductId` + `category`
 * e produtos candidatos, dispara `useAIRecommendations` automaticamente e exibe
 * um carrossel horizontal compacto.
 *
 * - Skeleton elegante durante carregamento
 * - Fallback silencioso se IA falhar (não polui UX)
 * - Limite configurável (`maxResults`)
 */
import { useEffect, useMemo, useRef } from "react";
import { Sparkles, ChevronLeft, ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  useAIRecommendations,
  type ClientProfile,
  type ProductForRecommendation,
} from "@/hooks/intelligence/useAIRecommendations";

// ============================================
// PROPS
// ============================================

export interface SmartRecommendationsProps {
  /** ID do produto sendo visualizado (será excluído das recomendações). */
  currentProductId?: string;
  /** Lista de produtos candidatos (mesma categoria, marca, etc). */
  candidateProducts: ProductForRecommendation[];
  /** Perfil do cliente (opcional — sem ele, recomendações são genéricas). */
  client?: ClientProfile;
  /** Quantidade máxima de cards. Default: 4. */
  maxResults?: number;
  /** Título exibido no header. */
  title?: string;
  /** Callback ao clicar em um produto. */
  onProductClick?: (productId: string) => void;
  className?: string;
}

// ============================================
// SUB-COMPONENTES
// ============================================

interface MiniCardProps {
  product: ProductForRecommendation;
  score: number;
  reason: string;
  onClick?: () => void;
}

function MiniCard({ product, score, reason, onClick }: MiniCardProps) {
  const scorePct = Math.round(score * 100);
  const interactive = Boolean(onClick);

  return (
    <Card
      className={cn(
        "min-w-[240px] max-w-[240px] shrink-0 border-[1.5px] border-border rounded-xl overflow-hidden",
        "animate-fade-in transition-all duration-200",
        interactive && "cursor-pointer hover:border-primary hover:shadow-md hover:-translate-y-0.5"
      )}
      onClick={onClick}
      role={interactive ? "button" : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      aria-label={interactive ? `Ver ${product.name}` : undefined}
    >
      <CardContent className="p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <h4 className="text-sm font-semibold font-display line-clamp-2 flex-1">{product.name}</h4>
          <span
            className="shrink-0 rounded-full border-[1.5px] border-primary/30 bg-primary/5 px-1.5 py-0.5 text-[10px] font-bold text-primary font-display"
            aria-label={`Score ${scorePct} por cento`}
          >
            {scorePct}%
          </span>
        </div>
        <p className="text-xs text-muted-foreground font-display line-clamp-3">{reason}</p>
      </CardContent>
    </Card>
  );
}

function CarouselSkeleton({ count }: { count: number }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <Card key={i} className="min-w-[240px] max-w-[240px] shrink-0 border-[1.5px] border-border rounded-xl">
          <CardContent className="p-3 space-y-2">
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="h-3 w-1/2" />
            <Skeleton className="h-10 w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

// ============================================
// COMPONENTE PRINCIPAL
// ============================================

export function SmartRecommendations({
  currentProductId,
  candidateProducts,
  client,
  maxResults = 4,
  title = "Recomendações inteligentes",
  onProductClick,
  className,
}: SmartRecommendationsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const { data, recommendations, isLoading, error, fetchRecommendations } = useAIRecommendations();

  // Filtra o produto atual da lista de candidatos
  const filteredCandidates = useMemo(
    () => candidateProducts.filter((p) => p.id !== currentProductId),
    [candidateProducts, currentProductId]
  );

  // Mapa rápido para resolver produto por ID
  const productMap = useMemo(() => {
    const map = new Map<string, ProductForRecommendation>();
    filteredCandidates.forEach((p) => map.set(p.id, p));
    return map;
  }, [filteredCandidates]);

  // Dispara IA quando candidatos mudam
  useEffect(() => {
    if (filteredCandidates.length === 0) return;

    const profile: ClientProfile = client ?? {
      name: "Cliente genérico",
      industry: filteredCandidates[0]?.category,
    };

    fetchRecommendations(profile, filteredCandidates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCandidates.map((p) => p.id).join(","), client?.name]);

  const visibleRecs = useMemo(
    () => recommendations.slice(0, maxResults),
    [recommendations, maxResults]
  );

  const scrollBy = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: "smooth" });
  };

  // Fallback silencioso: nada para mostrar
  if (filteredCandidates.length === 0) return null;
  if (!isLoading && error) return null;
  if (!isLoading && data && visibleRecs.length === 0) return null;

  return (
    <section
      className={cn("space-y-3 font-display animate-fade-in", className)}
      aria-label={title}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          <h3 className="text-base font-semibold text-foreground">{title}</h3>
        </div>
        {!isLoading && visibleRecs.length > 1 && (
          <div className="flex items-center gap-1">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => scrollBy(-260)}
              aria-label="Rolar para a esquerda"
            >
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-8 w-8"
              onClick={() => scrollBy(260)}
              aria-label="Rolar para a direita"
            >
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        )}
      </div>

      <div
        ref={scrollerRef}
        className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin"
        role="list"
      >
        {isLoading ? (
          <CarouselSkeleton count={Math.min(maxResults, 4)} />
        ) : (
          visibleRecs.map((rec) => {
            const product = productMap.get(rec.productId);
            if (!product) return null;
            return (
              <div key={rec.productId} className="snap-start" role="listitem">
                <MiniCard
                  product={product}
                  score={rec.score}
                  reason={rec.reason}
                  onClick={onProductClick ? () => onProductClick(rec.productId) : undefined}
                />
              </div>
            );
          })
        )}
      </div>
    </section>
  );
}
