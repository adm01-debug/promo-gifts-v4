/**
 * SmartRecommendationsMock — versão estática com dados fake para PREVIEW de design.
 * Espelha o layout de SmartRecommendations sem depender da edge function de IA.
 * Use somente em produtos de demonstração (ex.: SKU 09138).
 */
import { useRef } from 'react';
import { useHorizontalScroll } from '@/hooks/useHorizontalScroll';
import { Sparkles, ChevronLeft, ChevronRight, Trophy, TrendingUp, Star } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { QuickAddToQuote } from './QuickAddToQuote';

type MockRec = {
  id: string;
  name: string;
  category: string;
  supplier: string;
  price: string;
  image: string;
  score: number; // 0-1
  reason: string;
};

const MOCK_RECS: MockRec[] = [
  {
    id: 'mock-1',
    name: 'Squeeze Alumínio 500ml com Mosquetão',
    category: 'Squeezes & Garrafas',
    supplier: 'Spot Brindes',
    price: 'R$ 17,90',
    image:
      'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=400&q=80',
    score: 0.96,
    reason: 'Mesmo material, MOQ menor e estoque alto na fábrica preferida.',
  },
  {
    id: 'mock-2',
    name: 'Squeeze Inox Térmico 600ml',
    category: 'Squeezes & Garrafas',
    supplier: 'Stricker',
    price: 'R$ 32,40',
    image:
      'https://images.unsplash.com/photo-1523362628745-0c100150b504?auto=format&fit=crop&w=400&q=80',
    score: 0.88,
    reason: 'Upgrade térmico — alta margem percebida pelo cliente.',
  },
  {
    id: 'mock-3',
    name: 'Garrafa Tritan 750ml com Alça',
    category: 'Garrafas',
    supplier: 'XBZ',
    price: 'R$ 21,50',
    image:
      'https://images.unsplash.com/photo-1517363898874-737b62a7db91?auto=format&fit=crop&w=400&q=80',
    score: 0.82,
    reason: 'Maior capacidade, ótimo para eventos esportivos.',
  },
  {
    id: 'mock-4',
    name: 'Copo Bambu 400ml Tampa Silicone',
    category: 'Copos Sustentáveis',
    supplier: 'EcoBrindes',
    price: 'R$ 19,80',
    image:
      'https://images.unsplash.com/photo-1572119865084-43c285814d63?auto=format&fit=crop&w=400&q=80',
    score: 0.74,
    reason: 'Apelo sustentável — encaixa com clientes ESG.',
  },
  {
    id: 'mock-5',
    name: 'Garrafa Vidro 500ml Capa Neoprene',
    category: 'Garrafas',
    supplier: 'Asia Import',
    price: 'R$ 24,90',
    image:
      'https://images.unsplash.com/photo-1610824352934-c10d87b700cc?auto=format&fit=crop&w=400&q=80',
    score: 0.68,
    reason: 'Acabamento premium para campanhas de luxo.',
  },
  {
    id: 'mock-6',
    name: 'Squeeze Dobrável Silicone 480ml',
    category: 'Squeezes',
    supplier: 'Innova',
    price: 'R$ 28,60',
    image:
      'https://images.unsplash.com/photo-1556228578-8c89e6adf883?auto=format&fit=crop&w=400&q=80',
    score: 0.61,
    reason: 'Diferencial de portabilidade — bom para kits de viagem.',
  },
];

function MockMiniCard({
  rec,
  isBestChoice,
  badgeLabel,
}: {
  rec: MockRec;
  isBestChoice?: boolean;
  badgeLabel?: string;
}) {
  const scorePct = Math.round(rec.score * 100);
  const isHighMatch = scorePct >= 95;

  return (
    <Card
      className={cn(
        'group/card min-w-[240px] max-w-[240px] shrink-0 overflow-hidden rounded-xl border-[1.5px] border-border',
        'relative animate-fade-in transition-all duration-300',
        'cursor-pointer hover:-translate-y-1 hover:border-primary/50 hover:shadow-lg',
        isBestChoice && 'border-amber-400/60 shadow-[0_0_20px_-5px_rgba(251,191,36,0.3)]',
        isHighMatch &&
          !isBestChoice &&
          'border-primary/40 shadow-[0_0_15px_-5px_rgba(59,130,246,0.2)]',
      )}
    >
      <div className="relative aspect-video w-full overflow-hidden bg-muted/30">
        <img
          src={rec.image}
          alt={rec.name}
          className="h-full w-full object-cover transition-transform duration-500 group-hover/card:scale-110"
          loading="lazy"
        />
        {(isHighMatch || isBestChoice) && (
          <div
            className={cn(
              'absolute -inset-px opacity-0 transition-opacity duration-300 group-hover/card:opacity-100',
              isBestChoice ? 'bg-amber-400/10' : 'bg-primary/5',
            )}
          />
        )}
      </div>

      <CardContent className="relative space-y-2.5 p-3">
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
          >
            {scorePct}%
          </span>
        </div>

        <div className="space-y-1">
          <h4 className="line-clamp-2 min-h-[2.5rem] font-display text-sm font-semibold leading-tight transition-colors group-hover/card:text-primary">
            {rec.name}
          </h4>
          <p className="line-clamp-2 font-display text-[11px] leading-relaxed text-muted-foreground">
            {rec.reason}
          </p>
        </div>

        <div className="pt-1">
          <QuickAddToQuote
            productId={rec.id}
            productName={rec.name}
            variant="badge"
            className="w-full justify-center py-1.5 opacity-90 hover:opacity-100"
          />
        </div>
      </CardContent>
    </Card>
  );
}

export function SmartRecommendationsMock() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  // Scroll horizontal via mouse wheel (fix_version horizontal-scroll-hook-v1)
  useHorizontalScroll(scrollerRef);
  const scrollBy = (delta: number) =>
    scrollerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });

  return (
    <section
      className="animate-fade-in space-y-3 font-display"
      aria-label="Recomendações inteligentes (preview)"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10">
            <Sparkles className="h-4 w-4 text-primary" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-base font-semibold text-foreground">
              Recomendações inteligentes para este produto
            </h3>
            <p className="text-xs text-muted-foreground">
              Sugestões geradas por IA com base em similaridade, margem e perfil do cliente ·{' '}
              <span className="font-medium text-primary">preview com dados mockados</span>
            </p>
          </div>
        </div>
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
      </div>

      <div
        ref={scrollerRef}
        className="scrollbar-thin flex snap-x snap-mandatory gap-3 overflow-x-auto pb-2"
        role="list"
      >
        {MOCK_RECS.map((rec, i) => (
          <div key={rec.id} className="snap-start" role="listitem">
            <MockMiniCard
              rec={rec}
              isBestChoice={i === 0}
              badgeLabel={
                rec.score > 0.9 ? 'Mais Pedido' : rec.score > 0.7 ? 'Tendência' : undefined
              }
            />
          </div>
        ))}
      </div>
    </section>
  );
}
