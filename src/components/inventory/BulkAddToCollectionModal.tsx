/**
 * BulkAddToCollectionModal — Adiciona N variações selecionadas a uma coleção
 * existente ou a uma coleção recém-criada.
 *
 * Paridade catálogo ↔ estoque: o catálogo usa `AddToCollectionModal` (1 produto).
 * Aqui aplicamos a mesma semântica (toggle/criar) em lote, preservando a
 * variação SKU (cor/tamanho) de cada linha.
 */
import { useMemo, useState } from 'react';
import { Plus, FolderPlus, Package } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { useCollectionsContext } from '@/contexts/CollectionsContext';
import type { CollectionVariantInfo } from '@/hooks/collections';

export interface BulkCollectionRow {
  productId: string;
  productName: string;
  variant?: CollectionVariantInfo;
}

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rows: BulkCollectionRow[];
  onApplied?: () => void;
}

export function BulkAddToCollectionModal({ open, onOpenChange, rows, onApplied }: Props) {
  const {
    collections,
    createCollection,
    addProductToCollection,
    isProductInCollection,
    defaultColors,
    defaultIcons,
  } = useCollectionsContext();

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState('');
  const [selectedColor, setSelectedColor] = useState(defaultColors[0]);
  const [selectedIcon, setSelectedIcon] = useState(defaultIcons[0]);

  const count = rows.length;
  const sortedCollections = useMemo(
    () => [...collections].sort((a, b) => a.name.localeCompare(b.name, 'pt-BR')),
    [collections],
  );

  const applyToCollection = (collectionId: string, collectionName: string) => {
    let added = 0;
    let skipped = 0;
    try {
      for (const r of rows) {
        if (isProductInCollection(r.productId, collectionId)) {
          skipped++;
          continue;
        }
        addProductToCollection(collectionId, r.productId, r.variant);
        added++;
      }
      toast.success(
        `${added} ${added === 1 ? 'item adicionado' : 'itens adicionados'} a "${collectionName}"` +
          (skipped > 0 ? ` (${skipped} já existia${skipped > 1 ? 'm' : ''})` : ''),
      );
      onApplied?.();
      onOpenChange(false);
    } catch {
      toast.error('Não foi possível adicionar todos os itens. Tente novamente.');
    }
  };

  const handleCreate = () => {
    const name = newName.trim();
    if (!name) return;
    try {
      const c = createCollection(name, undefined, selectedColor, selectedIcon);
      applyToCollection(c.id, c.name);
      setNewName('');
      setCreating(false);
    } catch {
      toast.error('Não foi possível criar a coleção. Tente novamente.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        data-testid="stock-bulk-collection-modal"
        onClick={(e) => e.stopPropagation()}
      >
        <DialogHeader>
          <DialogTitle>Adicionar {count} {count === 1 ? 'variação' : 'variações'} a uma coleção</DialogTitle>
          <DialogDescription>
            Escolha uma coleção existente ou crie uma nova. A variação (cor/tamanho)
            de cada SKU é preservada.
          </DialogDescription>
        </DialogHeader>

        {creating ? (
          <div className="space-y-3">
            <div>
              <Label htmlFor="bulk-coll-name">Nome da coleção</Label>
              <Input
                id="bulk-coll-name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="Ex: Brindes para Cliente X"
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleCreate();
                }}
              />
            </div>
            <div className="flex flex-wrap gap-2">
              {defaultColors.map((c) => (
                <button
                  type="button"
                  key={c}
                  aria-label={`Cor ${c}`}
                  onClick={() => setSelectedColor(c)}
                  className={cn(
                    'h-6 w-6 rounded-full border-2 transition',
                    selectedColor === c ? 'border-foreground scale-110' : 'border-transparent',
                  )}
                  style={{ background: c }}
                />
              ))}
            </div>
            <div className="flex flex-wrap gap-1">
              {defaultIcons.slice(0, 10).map((ic) => (
                <button
                  type="button"
                  key={ic}
                  onClick={() => setSelectedIcon(ic)}
                  className={cn(
                    'h-8 w-8 rounded-md text-base transition',
                    selectedIcon === ic
                      ? 'bg-primary/15 ring-1 ring-primary'
                      : 'hover:bg-muted',
                  )}
                >
                  {ic}
                </button>
              ))}
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
              <Button
                size="sm"
                onClick={handleCreate}
                disabled={!newName.trim()}
                data-testid="stock-bulk-collection-confirm-create"
              >
                Criar e adicionar
              </Button>
            </div>
          </div>
        ) : (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCreating(true)}
              className="w-full justify-start gap-2"
              data-testid="stock-bulk-collection-new"
            >
              <Plus className="h-4 w-4" />
              Criar nova coleção
            </Button>

            <ScrollArea className="max-h-[320px] pr-2">
              {sortedCollections.length === 0 ? (
                <div className="flex flex-col items-center gap-2 py-8 text-sm text-muted-foreground">
                  <FolderPlus className="h-8 w-8 opacity-40" />
                  Nenhuma coleção ainda — crie a primeira acima.
                </div>
              ) : (
                <ul className="space-y-1">
                  {sortedCollections.map((c) => (
                    <li key={c.id}>
                      <button
                        type="button"
                        onClick={() => applyToCollection(c.id, c.name)}
                        data-testid={`stock-bulk-collection-pick-${c.id}`}
                        className="flex w-full items-center justify-between rounded-md border border-border/60 bg-card/60 px-3 py-2 text-left text-sm hover:bg-muted/60"
                      >
                        <span className="flex items-center gap-2">
                          <span
                            className="inline-block h-3 w-3 rounded-full"
                            style={{ background: c.color }}
                          />
                          <span className="font-medium">{c.name}</span>
                        </span>
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <Package className="h-3 w-3" />
                          {c.productIds?.length ?? 0}
                        </span>
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </ScrollArea>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

export default BulkAddToCollectionModal;
