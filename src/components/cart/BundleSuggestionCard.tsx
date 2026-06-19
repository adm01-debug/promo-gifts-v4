/**
 * BundleSuggestionCard — sugere produtos comumente orçados juntos com o produto-âncora.
 * Consulta histórico de quote_items via RPC `get_bundle_suggestions(_product_id)`.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { Database } from '@/integrations/supabase/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Sparkles, Plus } from 'lucide-react';
import { m as motion } from 'framer-motion';

import { logger } from '@/lib/logger';
type BundleSuggestion =
  Database['public']['Functions']['get_bundle_suggestions']['Returns'][number];

interface BundleSuggestionCardProps {
  productId: string;
  onAdd?: (suggestion: BundleSuggestion) => void;
  className?: string;
}

export function BundleSuggestionCard({ productId, onAdd, className }: BundleSuggestionCardProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['bundle-suggestions', productId],
    enabled: !!productId,
    queryFn: async (): Promise<BundleSuggestion[]> => {
      const { data: suggestionsData, error } = await supabase.rpc('get_bundle_suggestions', {
        _product_id: productId,
      });
      if (error) {
        logger.warn('get_bundle_suggestions error:', error);
        return [];
      }
      return suggestionsData ?? [];
    },
    staleTime: 1000 * 60 * 30,
  });

  if (!isLoading && !data?.length) return null;
  const suggestions = data ?? [];

  return (
    <Card
      className={`border-primary/20 shadow-sm transition-shadow duration-300 animate-in zoom-in-95 hover:shadow-md ${className ?? ''}`}
    >
      <CardHeader className="pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <div className="rounded-md bg-primary/10 p-1">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          Frequentemente orçado em conjunto
        </CardTitle>
        <CardDescription className="text-[11px] leading-tight">
          Vendedores que orçaram este produto também incluíram:
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-2 p-3 pt-0">
        {isLoading ? (
          <div className="animate-pulse space-y-3">
            {[...Array(3)].map((_, i) => (
              <div key={i} className="flex items-center gap-2.5 rounded-md p-2.5">
                <Skeleton className="h-10 w-10 shrink-0 rounded-md opacity-20" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-3 w-3/4 opacity-15" />
                  <Skeleton className="h-2 w-1/2 opacity-10" />
                </div>
                <Skeleton className="h-7 w-12 rounded-md opacity-20" />
              </div>
            ))}
          </div>
        ) : (
          suggestions.map((item) => (
            <motion.div
              layout
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              key={item.product_id}
              className="flex items-center gap-2 rounded-md p-2 transition-colors hover:bg-muted/50"
            >
              {item.product_image_url ? (
                <img
                  src={item.product_image_url}
                  alt={item.product_name}
                  className="h-10 w-10 rounded bg-muted object-cover"
                  loading="lazy"
                />
              ) : (
                <div className="h-10 w-10 shrink-0 rounded bg-muted" />
              )}
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-medium">{item.product_name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {item.frequency_percent}% das vezes · {item.cooccurrence_count}x
                </p>
              </div>
              {onAdd && (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 shrink-0 gap-1 text-[10px]"
                  onClick={() => onAdd(item)}
                  aria-label={`Adicionar ${item.product_name}`}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              )}
            </motion.div>
          ))
        )}
      </CardContent>
    </Card>
  );
}
