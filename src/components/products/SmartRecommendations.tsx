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
import { useEffect, useMemo, useRef } from 'react';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { Sparkles, ChevronLeft, ChevronRight, TrendingUp, Trophy, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { getCdnUrl } from '@/utils/image-utils';
import { QuickAddToQuote } from './QuickAddToQuote';
import {
  useAIRecommendations,
  type ClientProfile,
  type ProductForRecommendation,
} from '@/hooks/intelligence/useAIRecommendations';

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
  isBestChoice?: boolean;
  badgeLabel?: string;
  onClick?: () => void;
}

function MiniCard({ product, score, reason, isBestChoice, badgeLabel, onClick }: MiniCardProps) {
  const scorePct = Math.round(score * 100);
  const interactive = Boolean(onClick);
  const isHighMatch = scorePct >= 95;

  return (
    <Card
      className={cn(
        'group/card min-w-[240px] max-w-[240px] shrink-0 overflow-hidden rounded-xl border-[1.5px] border-border',
        'relative animate-fade-in transition-all duration-300',
        interactive &&
          'cursor-pointer hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg',
        isBestChoice && 'border-amber-400/60 shadow-[0_0_20px_-5px_rgba(251,191,36,0.3)]',
        isHighMatch &&
          !isBestChoice &&
          'border-primary/40 shadow-[0_0_15px_-5px_rgba(59,130,246,0.2)]',
      )}
      onClick={onClick}
      role={interactive ? 'button' : undefined}
      tabIndex={interactive ? 0 : undefined}
      onKeyDown={
        interactive
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onClick?.();
              }
            }
          : undefined
      }
      aria-label={interactive ? `Ver ${product.name}` : undefined}
    >
      {/* Glow Effect for High Match */}
      {(isHighMatch || isBestChoice) && (
        <div
          className={cn(
            'absolute -inset-px opacity-0 transition-opacity duration-300 group-hover/card:opacity-100',
            isBestChoice ? 'bg-amber-400/10' : 'bg-primary/5',
          )}
        />
      )}

      <div className="relative aspect-video w-full overflow-hidden bg-muted/30">
        {product.imageUrl ? (
          <img
            src={getCdnUrl(product.imageUrl, 'card')}
            alt={product.name}
            className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-110"
            loading="lazy"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center bg-muted/10">
            <Sparkles className="h-6 w-6 text-muted-foreground/20" />
          </div>
        )}
      </div>

      <CardContent className="relative space-y-2.5 p-3">
        {/* Badges Row */}
        <div className="flex items-center justify-between gap-2">
          {isBestChoice ? (
            <div className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-bold text-amber-700">
              <Trophy className="h-2.5 w-2.5" />
              MELHOR ESCOLHA
            </div>
          ) : badgeLabel ? (
            <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-bold text-primary">
              {badgeLabel === 'Mais Pedido' ? (
                <TrendingUp className="h-2.5 w-2.5" />
              ) : (
                <Star className="h-2.5 w-2.5" />
              )}
              {badgeLabel.toUpperCase()}
            </div>
          ) : (
            <div className="h-4" />
          )}

          <span
            className={cn(
              'shrink-0 rounded-full border-[1.5px] px-1.5 py-0.5 font-display text-[10px] font-bold',
              isBestChoice
                ? 'border-amber-400/50 bg-amber-50 text-amber-600'
                : 'border-primary/30 bg-primary/5 text-primary',
            )}
            aria-label={`Score ${scorePct} por cento`}
          >
            {scorePct}%
          </span>
        </div>

        <div className="space-y-1">
          <h4 className="line-clamp-2 min-h-[2.5rem] font-display text-sm font-semibold leading-tight transition-colors group-hover/card:text-primary">
            {product.name}
          </h4>
          <p className="line-clamp-2 font-display text-[11px] leading-relaxed text-muted-foreground">
            {reason}
          </p>
        </div>

        {/* Quick Action Overlay/Bottom */}
        <div className="pt-1">
          <QuickAddToQuote
            productId={product.id}
            productName={product.name}
            productSku={product.sku}
            variant="badge"
            className="w-full justify-center py-1.5 opacity-90 hover:opacity-100"
          />
        </div>
      </CardContent>
    </Card>
  );
}

function CarouselSkeleton({ count }: { count: number }) {
  return (
    <div className="flex gap-3 overflow-hidden">
      {Array.from({ length: count }).map((_, i) => (
        <Card
          key={i}
          className="min-w-[240px] max-w-[240px] shrink-0 rounded-xl border-[1.5px] border-border"
        >
          <CardContent className="space-y-2 p-3">
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
  title = 'Recomendações inteligentes',
  onProductClick,
  className,
}: SmartRecommendationsProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Scroll horizontal via mouse wheel (fix_version horizontal-scroll-hook-v1)
  useHorizontalScroll(scrollerRef);
  const { data, recommendations, isLoading, error, fetchRecommendations } = useAIRecommendations();

  // Filtra o produto atual da lista de candidatos
  const filteredCandidates = useMemo(
    () => candidateProducts.filter((p) => p.id !== currentProductId),
    [candidateProducts, currentProductId],
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
      name: 'Cliente genérico',
      industry: filteredCandidates[0]?.category,
    };

    fetchRecommendations(profile, filteredCandidates);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filteredCandidates.map((p) => p.id).join(','), client?.name]);

  const visibleRecs = useMemo(
    () => recommendations.slice(0, maxResults),
    [recommendations, maxResults],
  );

  const scrollBy = (delta: number) => {
    scrollerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });
  };

  // Identifica a melhor escolha (maior score)
  const maxScore = useMemo(() => {
    if (visibleRecs.length === 0) return 0;
    return Math.max(...visibleRecs.map((r) => r.score));
  }, [visibleRecs]);

  // Fallback silencioso: nada para mostrar
  if (filteredCandidates.length === 0) return null;
  if (!isLoading && error) return null;
  if (!isLoading && data && visibleRecs.length === 0) return null;

  return (
    <section className={cn('animate-fade-in space-y-3 font-display', className)} aria-label={title}>
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
        className="scrollbar-thin flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
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
                  isBestChoice={rec.score === maxScore && rec.score > 0.8}
                  badgeLabel={
                    rec.score > 0.9 ? 'Mais Pedido' : rec.score > 0.7 ? 'Tendência' : undefined
                  }
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
