/**
 * EmpiricalRecommendations — Zona 4: curadoria do especialista por ramo.
 */
import { useMemo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Lightbulb } from 'lucide-react';
import { resolveIndustryRecommendation } from '@/lib/bi/industryRecommendations';
import { BIProductCard } from './BIProductCard';

interface Props {
  ramoAtividade: string | null;
  clientId: string;
}

export function EmpiricalRecommendations({ ramoAtividade, clientId }: Props) {
  const rec = useMemo(() => resolveIndustryRecommendation(ramoAtividade), [ramoAtividade]);

  return (
    <Card className="border-[1.5px] border-amber-500/30 bg-gradient-to-br from-amber-50/30 to-transparent dark:from-amber-950/10">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
            <Lightbulb className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="font-display font-semibold">Sugestão do especialista</h2>
              <Badge
                variant="outline"
                className="border-amber-500/50 text-[10px] text-amber-700 dark:text-amber-300"
              >
                Curadoria · {rec.ramo}
              </Badge>
            </div>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{rec.rationale}</p>
            {rec.categories.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                {rec.categories.map((c) => (
                  <Badge key={c} variant="secondary" className="text-[10px]">
                    {c}
                  </Badge>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-4">
          {rec.suggestedProducts.map((p) => (
            <BIProductCard
              key={p.name}
              name={p.name}
              category={p.category}
              priceFrom={p.priceFrom}
              priceTo={p.priceTo}
              reason={p.reason}
              variant="expert"
              clientId={clientId}
            />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
