/**
 * CollectionsTrashView — Lixeira de itens removidos de uma coleção.
 * Espelho de FavoritesTrashView. TTL de 30 dias.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { useProductsContext } from '@/contexts/ProductsContext';
import { useCollectionsContext } from '@/contexts/CollectionsContext';
import { DeleteConfirmDialog } from '@/components/ui/ConfirmDialog';
import { EmptyState } from '@/components/common/EmptyState';

interface TrashRow {
  id: string;
  product_id: string;
  collection_id: string;
  color_name: string | null;
  color_hex: string | null;
  thumbnail_url: string | null;
  expires_at: string;
}

interface Props {
  collectionId: string;
  onCountChange?: (n: number) => void;
}

export function CollectionsTrashView({ collectionId, onCountChange }: Props) {
  const { restoreFromTrash } = useCollectionsContext();
  const { getProductsByIds } = useProductsContext();
  const [items, setItems] = useState<TrashRow[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    const { data, error } = await supabase
      .from('collection_items_trash' as never)
      .select('*')
      .eq('collection_id', collectionId)
      .order('deleted_at', { ascending: false });
    if (error) {
      toast.error('Erro ao carregar lixeira');
      setItems([]);
    } else {
      setItems(data ?? []);
    }
    setIsLoading(false);
  }, [collectionId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    onCountChange?.(items.length);
  }, [items.length, onCountChange]);

  const productMap = useMemo(() => {
    const ids = items.map((i) => i.product_id);
    const products = getProductsByIds(ids);
    return new Map(products.map((p) => [p.id, p]));
  }, [items, getProductsByIds]);

  const formatDaysLeft = (expiresAt: string) => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86400_000));
  };

  const handleRestore = async (productId: string) => {
    const ok = await restoreFromTrash(collectionId, productId);
    if (ok) {
      toast.success('Produto restaurado');
      load();
    } else {
      toast.error('Não foi possível restaurar');
    }
  };

  const handlePurge = async (id: string) => {
    const { error } = await supabase
      .from('collection_items_trash' as never)
      .delete()
      .eq('id', id);
    if (error) toast.error('Erro ao excluir');
    else {
      toast.success('Item excluído permanentemente');
      load();
    }
  };

  const handlePurgeAll = async () => {
    const { error } = await supabase
      .from('collection_items_trash' as never)
      .delete()
      .eq('collection_id', collectionId);
    if (error) toast.error('Erro ao esvaziar lixeira');
    else {
      toast.success('Lixeira esvaziada');
      setConfirmEmpty(false);
      load();
    }
  };

  if (isLoading) {
    return <div className="p-8 text-center text-sm text-muted-foreground">Carregando lixeira…</div>;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        variant="generic"
        title="Lixeira vazia"
        description="Itens removidos aparecem aqui por 30 dias antes de serem excluídos definitivamente."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? 'item removido' : 'itens removidos'} • TTL de 30 dias
        </p>
        <Button
          variant="outline"
          size="sm"
          className="text-destructive hover:text-destructive"
          onClick={() => setConfirmEmpty(true)}
        >
          <Trash2 className="mr-1.5 h-3.5 w-3.5" /> Esvaziar lixeira
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {items.map((it) => {
          const p = productMap.get(it.product_id);
          const daysLeft = formatDaysLeft(it.expires_at);
          const thumb = it.thumbnail_url ?? p?.images?.[0];
          return (
            <div key={it.id} className="flex gap-3 rounded-xl border border-border bg-card p-3">
              <div className="h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-muted">
                {thumb && (
                  <img
                    src={thumb}
                    alt={p?.name ?? it.product_id}
                    className="h-full w-full object-cover"
                    loading="lazy"
                  />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{p?.name ?? it.product_id}</p>
                {it.color_name && (
                  <p className="truncate text-xs text-muted-foreground">Cor: {it.color_name}</p>
                )}
                <Badge
                  variant={daysLeft <= 5 ? 'destructive' : 'secondary'}
                  className="mt-1 text-[10px]"
                >
                  {daysLeft} dia{daysLeft !== 1 ? 's' : ''} restantes
                </Badge>
                <div className="mt-2 flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs"
                    onClick={() => handleRestore(it.product_id)}
                  >
                    <RotateCcw className="mr-1 h-3 w-3" /> Restaurar
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 text-xs text-destructive hover:text-destructive"
                    onClick={() => handlePurge(it.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                  </Button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <DeleteConfirmDialog
        open={confirmEmpty}
        onOpenChange={setConfirmEmpty}
        entityName="lixeira"
        onConfirm={handlePurgeAll}
      />
    </div>
  );
}
