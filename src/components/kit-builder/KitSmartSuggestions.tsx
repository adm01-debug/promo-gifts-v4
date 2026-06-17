/**
 * Kit Smart Suggestions
 * Suggests items commonly paired with selected ones (co-occurrence)
 */

import { useState } from 'react';
import { Sparkles, Plus, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { KitItem } from '@/lib/kit-builder';

interface KitSmartSuggestionsProps {
  selectedItems: KitItem[];
  onAddItem?: (item: { id: string; name: string }) => void;
}

export function KitSmartSuggestions({ selectedItems, onAddItem }: KitSmartSuggestionsProps) {
  const { user } = useAuth();
  const [expanded, setExpanded] = useState(false);
  const selectedIds = new Set(selectedItems.map((i) => i.id));

  const { data: suggestions = [] } = useQuery({
    queryKey: ['kit-suggestions', ...Array.from(selectedIds)],
    queryFn: async () => {
      if (!user?.id || selectedIds.size === 0) return [];

      // Get all saved kits to find co-occurring items
      const { data: kits, error } = await supabase
        .from('custom_kits')
        .select('items_data')
        .limit(100);

      if (error || !kits) return [];

      // Count co-occurrences
      const coOccurrence = new Map<string, { name: string; count: number; imageUrl?: string }>();

      for (const kit of kits) {
        const items = (kit.items_data as unknown[]) ?? [];
        const kitItemIds = items.map((i) => (i as { id: string }).id);
        const hasSelectedItem = kitItemIds.some((id: string) => selectedIds.has(id));

        if (hasSelectedItem) {
          for (const _item of items) {
            const item = _item as { id: string; name: string; imageUrl?: string };
            if (!selectedIds.has(item.id)) {
              const existing = coOccurrence.get(item.id);
              if (existing) {
                existing.count++;
              } else {
                coOccurrence.set(item.id, {
                  name: item.name,
                  count: 1,
                  imageUrl: item.imageUrl,
                });
              }
            }
          }
        }
      }

      // Sort by frequency and return top 5
      return Array.from(coOccurrence.entries())
        .map(([id, data]) => ({ id, ...data }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);
    },
    enabled: !!user?.id && selectedIds.size > 0,
    staleTime: 60_000,
  });

  if (suggestions.length === 0) return null;

  const visibleSuggestions = expanded ? suggestions : suggestions.slice(0, 3);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="px-4 pb-2 pt-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Sparkles className="h-4 w-4 text-primary" />
          Sugestões Inteligentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5 px-4 pb-3">
        {visibleSuggestions.map((item) => (
          <div key={item.id} className="flex items-center gap-2 text-sm">
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt=""
                className="h-7 w-7 rounded border bg-card object-contain"
                loading="lazy"
              />
            )}
            <span className="flex-1 truncate">{item.name}</span>
            <Badge variant="secondary" className="text-[10px]">
              {item.count}x usados juntos
            </Badge>
            {onAddItem && (
              <Button
                variant="ghost"
                size="icon"
                aria-label="Adicionar"
                className="h-6 w-6"
                onClick={() => onAddItem(item)}
              >
                <Plus className="h-3 w-3" />
              </Button>
            )}
          </div>
        ))}
        {suggestions.length > 3 && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full text-xs"
            onClick={() => setExpanded(!expanded)}
          >
            {expanded ? (
              <ChevronUp className="mr-1 h-3 w-3" />
            ) : (
              <ChevronDown className="mr-1 h-3 w-3" />
            )}
            {expanded ? 'Menos' : `+${suggestions.length - 3} sugestões`}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
