/**
 * RecentComparisonsSidebar — Sheet lateral com últimas 5 comparações do usuário.
 * Restaura comparação ao clicar; usa RPC get_user_recent_comparisons.
 */
import { useEffect, useState } from 'react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { History, RotateCcw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface RecentRow {
  id: string;
  name: string | null;
  client_name: string | null;
  items: Array<{ productId: string; variant?: Record<string, unknown> }>;
  item_count: number;
  updated_at: string;
}

export function RecentComparisonsSidebar() {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<RecentRow[]>([]);
  const [loading, setLoading] = useState(false);
  const clearCompare = useComparisonStore((s) => s.clearCompare);
  const addToCompare = useComparisonStore((s) => s.addToCompare);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    (async () => {
      try {
        const { data } = await supabase.rpc('get_user_recent_comparisons', { p_limit: 5 });
        setItems((data ?? []) as RecentRow[]);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    })();
  }, [open]);

  const restore = (row: RecentRow) => {
    clearCompare();
    let added = 0;
    (row.items ?? []).slice(0, 4).forEach((it) => {
      if (it?.productId && addToCompare(it.productId)) added++;
    });
    toast.success(`${added} produto${added !== 1 ? 's' : ''} restaurado${added !== 1 ? 's' : ''}`);
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm">
          <History className="mr-2 h-4 w-4" />
          Recentes
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-[360px]">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <History className="h-4 w-4" /> Comparações recentes
          </SheetTitle>
        </SheetHeader>
        <div className="mt-6 space-y-2">
          {loading && (
            <p className="py-8 text-center text-sm text-muted-foreground">Carregando...</p>
          )}
          {!loading && items.length === 0 && (
            <p className="py-8 text-center text-sm text-muted-foreground">
              Nenhuma comparação salva ainda.
            </p>
          )}
          {items.map((item) => (
            <div
              key={item.id}
              className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40"
            >
              <p className="truncate text-sm font-medium">
                {item.name || item.client_name || 'Sem título'}
              </p>
              <p className="mb-2 text-xs text-muted-foreground">
                {item.item_count ?? item.items?.length ?? 0} produtos ·{' '}
                {formatDistanceToNow(new Date(item.updated_at), { addSuffix: true, locale: ptBR })}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 w-full text-xs"
                onClick={() => restore(item)}
              >
                <RotateCcw className="mr-1 h-3 w-3" /> Restaurar
              </Button>
            </div>
          ))}
        </div>
      </SheetContent>
    </Sheet>
  );
}
