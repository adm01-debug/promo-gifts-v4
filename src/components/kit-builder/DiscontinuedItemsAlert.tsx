/**
 * Discontinued Items Alert
 * Checks if any items in a kit are marked inactive and alerts the user
 */

import { AlertTriangle } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import type { KitItem } from '@/lib/kit-builder';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface DiscontinuedItemsAlertProps {
  items: KitItem[];
}

export function DiscontinuedItemsAlert({ items }: DiscontinuedItemsAlertProps) {
  const itemIds = items.map((i) => i.id);

  const { data: discontinuedItems = [] } = useQuery({
    queryKey: ['discontinued-check', itemIds.join(',')],
    queryFn: async (): Promise<Array<{ id: string; name: string; sku: string }>> => {
      if (itemIds.length === 0) return [];
      try {
        // REST native (bridge external-db-bridge foi descontinuada — 410 Gone)
        const { data, error } = await supabase
          .from('products' as never)
          .select('id,name,sku')
          .in('id', itemIds)
          .eq('is_active', false)
          .limit(50);
        if (error || !data) return [];
        return data;
      } catch {
        return [];
      }
    },
    enabled: itemIds.length > 0,
    staleTime: 60_000,
  });

  if (discontinuedItems.length === 0) return null;

  return (
    <Card className="border-destructive/50 bg-destructive/5">
      <CardContent className="pt-4">
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-destructive" />
          <div className="flex-1 space-y-2">
            <h4 className="text-sm font-medium text-destructive">
              {discontinuedItems.length}{' '}
              {discontinuedItems.length === 1 ? 'item descontinuado' : 'itens descontinuados'}
            </h4>
            <p className="text-xs text-muted-foreground">
              Os seguintes itens foram desativados no catálogo. Considere substituí-los.
            </p>
            <div className="space-y-1">
              {discontinuedItems.map((item) => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="destructive" className="text-[10px]">
                    Descontinuado
                  </Badge>
                  <span className="font-medium">{item.name}</span>
                  <span className="font-mono text-xs text-muted-foreground">{item.sku}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
