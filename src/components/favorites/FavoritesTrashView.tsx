import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { RotateCcw, Trash2 } from "lucide-react";
import { useFavoriteTrash } from "@/hooks/favoritesLists";
import { useProductsContext } from "@/contexts/ProductsContext";
import { useMemo, useState } from "react";
import { DeleteConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EmptyState } from "@/components/common/EmptyState";

export function FavoritesTrashView() {
  const { items, isLoading, restoreItem, purgeItem, purgeAll } = useFavoriteTrash();
  const { getProductsByIds } = useProductsContext();
  const [confirmEmpty, setConfirmEmpty] = useState(false);

  const productMap = useMemo(() => {
    const ids = items.map((i) => i.product_id);
    const products = getProductsByIds(ids);
    return new Map(products.map((p) => [p.id, p]));
  }, [items, getProductsByIds]);

  const formatDaysLeft = (expiresAt: string) => {
    const ms = new Date(expiresAt).getTime() - Date.now();
    return Math.max(0, Math.ceil(ms / 86400_000));
  };

  if (isLoading) {
    return <div className="text-sm text-muted-foreground p-8 text-center">Carregando lixeira…</div>;
  }

  if (items.length === 0) {
    return (
      <EmptyState
        variant="default"
        title="Lixeira vazia"
        description="Itens removidos aparecem aqui por 30 dias antes de serem excluídos definitivamente."
      />
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {items.length} {items.length === 1 ? "item removido" : "itens removidos"} • TTL de 30 dias
        </p>
        <Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => setConfirmEmpty(true)}>
          <Trash2 className="h-3.5 w-3.5 mr-1.5" /> Esvaziar lixeira
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((it) => {
          const p = productMap.get(it.product_id);
          const daysLeft = formatDaysLeft(it.expires_at);
          const variantInfo = it.variant_info as { color_name?: string; thumbnail?: string } | null;
          const thumb = variantInfo?.thumbnail ?? p?.images?.[0];
          return (
            <div key={it.id} className="flex gap-3 p-3 rounded-xl border border-border bg-card">
              <div className="w-16 h-16 rounded-lg bg-muted overflow-hidden shrink-0">
                {thumb && (
                  <img src={thumb} alt={p?.name ?? it.product_id} className="w-full h-full object-cover" loading="lazy" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{p?.name ?? it.product_id}</p>
                {variantInfo?.color_name && (
                  <p className="text-xs text-muted-foreground truncate">Cor: {variantInfo.color_name}</p>
                )}
                <Badge variant={daysLeft <= 5 ? "destructive" : "secondary"} className="text-[10px] mt-1">
                  {daysLeft} dia{daysLeft !== 1 ? "s" : ""} restantes
                </Badge>
                <div className="flex gap-1.5 mt-2">
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => restoreItem.mutate(it.id)}>
                    <RotateCcw className="h-3 w-3 mr-1" /> Restaurar
                  </Button>
                  <Button size="sm" variant="ghost" className="h-7 text-xs text-destructive hover:text-destructive" onClick={() => purgeItem.mutate(it.id)}>
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
        onConfirm={async () => { await purgeAll.mutateAsync(); setConfirmEmpty(false); }}
      />
    </div>
  );
}
