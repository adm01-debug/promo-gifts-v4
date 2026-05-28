/**
 * SmartRecommendationsMock — versão estática com dados fake para PREVIEW de design.
 * Espelha o layout de SmartRecommendations sem depender da edge function de IA.
 * Use somente em produtos de demonstração (ex.: SKU 09138).
 */
import { useRef } from 'react';
import { Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

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

function MockMiniCard({ rec }: { rec: MockRec }) {
  const scorePct = Math.round(rec.score * 100);
  return (
    <Card
      className={cn(
        'min-w-[240px] max-w-[240px] shrink-0 overflow-hidden rounded-xl border-[1.5px] border-border',
        'animate-fade-in cursor-pointer transition-all duration-200',
        'hover:-translate-y-0.5 hover:border-primary hover:shadow-md',
      )}
    >
      <div className="relative aspect-square overflow-hidden bg-muted">
        <img
          src={rec.image}
          alt={rec.name}
          className="h-full w-full object-cover"
          loading="lazy"
        />
        <div className="absolute right-2 top-2">
          <Badge className="gap-1 border-none bg-primary/90 px-2 py-0.5 text-[10px] text-primary-foreground shadow-sm backdrop-blur-sm">
            <Sparkles className="h-3 w-3" />
            {scorePct}% match
          </Badge>
        </div>
        <div className="absolute bottom-2 left-2">
          <Badge
            variant="secondary"
            className="border-none bg-background/85 px-2 py-0.5 text-[10px] shadow-sm backdrop-blur-sm"
          >
            {rec.supplier}
          </Badge>
        </div>
      </div>
      <CardContent className="space-y-1.5 p-3">
        <p className="truncate text-[10px] uppercase tracking-wide text-muted-foreground">
          {rec.category}
        </p>
        <h4 className="line-clamp-2 min-h-[2.25rem] text-sm font-semibold leading-tight text-foreground">
          {rec.name}
        </h4>
        <div className="flex items-center justify-between gap-2 pt-1">
          <span className="font-display text-base font-bold text-foreground">{rec.price}</span>
        </div>
        <p className="line-clamp-2 min-h-[2rem] rounded-md bg-accent/40 px-2 py-1 text-[11px] italic leading-snug text-muted-foreground">
          “{rec.reason}”
        </p>
      </CardContent>
    </Card>
  );
}

export function SmartRecommendationsMock() {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const scrollBy = (delta: number) =>
    scrollerRef.current?.scrollBy({ left: delta, behavior: 'smooth' });

  return (
    <section className="animate-fade-in space-y-3 font-display" aria-label="Recomendações inteligentes (preview)">
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
              Sugestões geradas por IA com base em similaridade, margem e perfil do cliente · <span className="font-medium text-primary">preview com dados mockados</span>
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
        {MOCK_RECS.map((rec) => (
          <div key={rec.id} className="snap-start" role="listitem">
            <MockMiniCard rec={rec} />
          </div>
        ))}
      </div>
    </section>
  );
}
