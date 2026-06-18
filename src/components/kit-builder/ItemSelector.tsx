/**
 * Item Selector
 * Seletor de itens para compor o kit (refatorado)
 */

import { useState, useMemo } from 'react';
import { Search, AlertTriangle, X, Package } from 'lucide-react';
import { SelectedItemsBadges } from './SelectedItemsBadges';
import { ItemCard } from './ItemCard';
import { Input } from '@/components/ui/input';
import { ItemCardSkeleton } from './KitCardSkeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { KitItem, ItemFilters, CompatibilityResult } from '@/lib/kit-builder';
import type { VariantSelectionData } from './VariantSelector';

interface ItemWithCompatibility extends KitItem {
  compatibility: CompatibilityResult | null;
}

interface ItemSelectorProps {
  items: ItemWithCompatibility[];
  selectedItems: KitItem[];
  isLoading: boolean;
  filters: ItemFilters;
  onFiltersChange: (filters: ItemFilters) => void;
  onAddItem: (item: KitItem) => CompatibilityResult;
  onRemoveItem: (itemId: string) => void;
  onUpdateQuantity: (itemId: string, quantity: number) => void;
  onUpdateVariant: (itemId: string, data: VariantSelectionData) => void;
  onReorder?: (fromIndex: number, toIndex: number) => void;
  boxSelected: boolean;
}

export function ItemSelector({
  items,
  selectedItems,
  isLoading,
  filters,
  onFiltersChange,
  onAddItem,
  onRemoveItem,
  onUpdateQuantity,
  onUpdateVariant,
  onReorder,
  boxSelected,
}: ItemSelectorProps) {
  const [searchValue, setSearchValue] = useState('');
  const [lastError, setLastError] = useState<string | null>(null);

  const handleSearchChange = (value: string) => {
    setSearchValue(value);
    onFiltersChange({ ...filters, search: value || undefined });
  };

  const handleAddItem = (item: KitItem) => {
    const result = onAddItem(item);
    if (!result.fits) {
      setLastError(result.reason || 'Item não cabe na caixa');
      setTimeout(() => setLastError(null), 3000);
    }
  };

  // Extract unique categories for filter
  const categories = useMemo(() => {
    const cats = new Set<string>();
    items.forEach((i) => {
      if (i.category) cats.add(i.category);
    });
    return [...cats].sort();
  }, [items]);

  const selectedItemIds = new Set(selectedItems.map((i) => i.id));

  return (
    <div className="space-y-4">
      {!boxSelected && (
        <div className="flex items-center gap-3 rounded-lg border border-warning/30 bg-warning/10 p-4">
          <AlertTriangle className="h-5 w-5 flex-shrink-0 text-warning" />
          <p className="text-sm">
            Selecione uma caixa primeiro para verificar a compatibilidade dos itens.
          </p>
        </div>
      )}

      {lastError && (
        <div className="flex items-center gap-3 rounded-lg border border-destructive/30 bg-destructive/10 p-4 animate-in fade-in slide-in-from-top-2">
          <X className="h-5 w-5 flex-shrink-0 text-destructive" />
          <p className="text-sm text-destructive">{lastError}</p>
        </div>
      )}

      <div className="flex flex-col gap-4 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar item..."
            value={searchValue}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        {boxSelected && (
          <div className="flex items-center gap-2">
            <Switch
              id="only-fitting"
              checked={filters.onlyFitting ?? false}
              onCheckedChange={(checked) => onFiltersChange({ ...filters, onlyFitting: checked })}
            />
            <Label htmlFor="only-fitting" className="cursor-pointer text-sm">
              Apenas itens que cabem
            </Label>
          </div>
        )}
      </div>

      {/* Category filter */}
      {categories.length > 1 && (
        <Select
          value={filters.category || 'all'}
          onValueChange={(v) =>
            onFiltersChange({ ...filters, category: v === 'all' ? undefined : v })
          }
        >
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {categories.map((cat) => (
              <SelectItem key={cat} value={cat}>
                {cat}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      <SelectedItemsBadges
        items={selectedItems}
        onRemoveItem={onRemoveItem}
        onUpdateQuantity={onUpdateQuantity}
        onUpdateVariant={onUpdateVariant}
        onReorder={onReorder}
      />

      <ScrollArea className="h-[50vh] pr-4">
        {isLoading ? (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <ItemCardSkeleton key={i} />
            ))}
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center">
            <Package className="mx-auto mb-3 h-12 w-12 text-muted-foreground" />
            <p className="text-muted-foreground">Nenhum item encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <ItemCard
                key={item.id}
                item={item}
                isSelected={selectedItemIds.has(item.id)}
                boxSelected={boxSelected}
                onAdd={handleAddItem}
                onRemove={onRemoveItem}
              />
            ))}
          </div>
        )}
      </ScrollArea>
    </div>
  );
}
