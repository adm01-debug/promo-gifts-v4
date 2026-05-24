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
  const itemIds = items.map(i => i.id);

  const { data: discontinuedItems = [] } = useQuery({
    queryKey: ['discontinued-check', itemIds.join(',')],
    queryFn: async () => {
      if (itemIds.length === 0) return [];
      try {
        // Check against external DB via edge function
        const { data, error } = await supabase.functions.invoke('external-db-bridge', {
          body: {
            table: 'products',
            operation: 'select',
            filters: { id: `in.(${itemIds.join(',')})`, is_active: 'eq.false' },
            select: 'id,name,sku',
            limit: 50,
          },
        });
        if (error || !data?.data) return [];
        return data.data as Array<{ id: string; name: string; sku: string }>;
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
          <AlertTriangle className="h-5 w-5 text-destructive flex-shrink-0 mt-0.5" />
          <div className="space-y-2 flex-1">
            <h4 className="font-medium text-destructive text-sm">
              {discontinuedItems.length} {discontinuedItems.length === 1 ? 'item descontinuado' : 'itens descontinuados'}
            </h4>
            <p className="text-xs text-muted-foreground">
              Os seguintes itens foram desativados no catálogo. Considere substituí-los.
            </p>
            <div className="space-y-1">
              {discontinuedItems.map(item => (
                <div key={item.id} className="flex items-center gap-2 text-sm">
                  <Badge variant="destructive" className="text-[10px]">Descontinuado</Badge>
                  <span className="font-medium">{item.name}</span>
                  <span className="text-xs text-muted-foreground font-mono">{item.sku}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
