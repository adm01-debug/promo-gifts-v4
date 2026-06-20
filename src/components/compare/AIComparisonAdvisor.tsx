/**
 * AIComparisonAdvisor — Botão que chama edge function `comparison-ai-advisor` (Lovable AI).
 * Cache: sessionStorage por 30 min para combinação de IDs.
 */
import { useState } from 'react';
import type { Product } from '@/types/product-catalog';
import { Brain, Sparkles, Loader2, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AIComparisonAdvisorProps {
  products: Product[];
}

interface AdvisorResult {
  bullets: string[];
  bestFor: { highVolume?: string; fastDelivery?: string; premium?: string };
  rationale?: string;
}

const CACHE_TTL_MS = 30 * 60 * 1000;

function cacheKey(products: Product[]): string {
  return `cmp-ai-${products
    .map((p) => p.id)
    .sort()
    .join('|')}`;
}

function readCache(key: string): AdvisorResult | null {
  try {
    const raw = sessionStorage.getItem(key);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() - parsed.t > CACHE_TTL_MS) return null;
    return parsed.data;
  } catch {
    return null;
  }
}

function writeCache(key: string, data: AdvisorResult) {
  try {
    sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), data }));
  } catch {
    /* ignore */
  }
}

export function AIComparisonAdvisor({ products }: AIComparisonAdvisorProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AdvisorResult | null>(() =>
    products.length >= 2 ? readCache(cacheKey(products)) : null,
  );

  const fetchAdvice = async () => {
    if (products.length < 2) return;
    const key = cacheKey(products);
    const cached = readCache(key);
    if (cached) {
      setResult(cached);
      return;
    }

    setLoading(true);
    try {
      const slim = products.map((p) => ({
        id: p.id,
        name: p.name,
        price: p.price,
        stock: p.stock,
        minQuantity: p.minQuantity,
        colorsCount: p.colors?.length ?? 0,
        stockStatus: p.stockStatus,
        category: p.category?.name,
        supplier: p.supplier?.name,
      }));

      const { data, error } = await supabase.functions.invoke('comparison-ai-advisor', {
        body: { products: slim },
      });

      if (error) throw error;
      if (data?.error) throw new Error(data.error);

      const advice: AdvisorResult = {
        bullets: data.bullets ?? [],
        bestFor: data.bestFor ?? {},
        rationale: data.rationale,
      };
      writeCache(key, advice);
      setResult(advice);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : 'Falha ao consultar IA';
      if (msg.includes('429') || msg.toLowerCase().includes('rate')) {
        toast.error('Muitas requisições. Tente novamente em 1 minuto.');
      } else if (msg.includes('402')) {
        toast.error('Créditos de IA esgotados. Contate o administrador.');
      } else {
        toast.error('Não foi possível obter recomendação da IA.');
      }
    } finally {
      setLoading(false);
    }
  };

  if (products.length < 2) return null;

  return (
    <div className="rounded-2xl border-[1.5px] border-accent/40 bg-gradient-to-br from-accent/10 via-background to-background p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-primary shadow-md">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-sm font-semibold">Conselheiro IA</h3>
              <Badge variant="outline" className="gap-1 text-[10px]">
                <Sparkles className="h-2.5 w-2.5" /> Lovable AI
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground">Análise contextual da sua comparação</p>
          </div>
        </div>
        <Button
          size="sm"
          variant={result ? 'outline' : 'default'}
          onClick={fetchAdvice}
          disabled={loading}
        >
          {loading ? (
            <>
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              Analisando...
            </>
          ) : result ? (
            <>Re-analisar</>
          ) : (
            <>
              <Sparkles className="mr-1.5 h-3.5 w-3.5" />
              Analisar com IA
            </>
          )}
        </Button>
      </div>

      {result && (
        <div className="mt-4 space-y-3">
          {result.bullets.length > 0 && (
            <ul className="space-y-1.5 text-sm">
              {result.bullets.map((b, i) => (
                <li key={i} className="flex gap-2">
                  <span className="mt-0.5 text-accent">•</span>
                  <span className="text-foreground/90">{b}</span>
                </li>
              ))}
            </ul>
          )}
          {result.bestFor && Object.keys(result.bestFor).length > 0 && (
            <div className="mt-3 grid grid-cols-1 gap-2 md:grid-cols-3">
              {result.bestFor.highVolume && (
                <BestForCard label="Para alto volume" value={result.bestFor.highVolume} />
              )}
              {result.bestFor.fastDelivery && (
                <BestForCard label="Para entrega rápida" value={result.bestFor.fastDelivery} />
              )}
              {result.bestFor.premium && (
                <BestForCard label="Para premium" value={result.bestFor.premium} />
              )}
            </div>
          )}
          {result.rationale && (
            <p className="mt-2 flex gap-1.5 text-xs italic text-muted-foreground">
              <AlertCircle className="mt-0.5 h-3 w-3 shrink-0" />
              {result.rationale}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function BestForCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border bg-card p-2.5">
      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </p>
      <p className="mt-0.5 line-clamp-2 text-sm font-medium text-foreground">{value}</p>
    </div>
  );
}
