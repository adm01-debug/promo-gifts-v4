/**
 * ProductSearchPanel — Search sidebar extracted from ProductMatchPage.
 */
import { useState, useMemo } from 'react';
import { useProducts, type Product } from '@/hooks/products';
import { useDebounce } from '@/hooks/common';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import { Search, Target } from 'lucide-react';
import { getCdnUrl } from '@/utils/image-utils';
import {
  createProductFuseOptions,
  dedupeById,
  rankProductSearchResults,
} from '@/utils/product-search';
import Fuse from 'fuse.js';

function formatPrice(value: number) {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
}

interface ProductSearchPanelProps {
  products: Product[];
  onSelect: (p: Product) => void;
  selectedId?: string;
}

export function ProductSearchPanel({ products, onSelect, selectedId }: ProductSearchPanelProps) {
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebounce(search, 250);

  const { data: remoteProducts = [], isFetching: isRemoteSearching } = useProducts(
    { search: debouncedSearch.trim(), limit: 120 },
    { enabled: debouncedSearch.trim().length >= 2, staleTime: 60_000 },
  );

  const fuse = useMemo(
    () =>
      new Fuse(
        products,
        createProductFuseOptions<Product>({ threshold: 0.35, minMatchCharLength: 2 }),
      ),
    [products],
  );

  const filtered = useMemo(() => {
    const query = search.trim();
    if (!query) return products.slice(0, 50);
    const localRanked = rankProductSearchResults(products, query, fuse, { limit: 50 });
    const merged = dedupeById([...localRanked, ...remoteProducts]);
    return rankProductSearchResults(merged, query, undefined, { limit: 50 });
  }, [search, products, fuse, remoteProducts]);

  return (
    <div className="space-y-3">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar produto por nome ou código..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>
      {search.trim().length >= 2 && isRemoteSearching && (
        <p className="text-[10px] text-muted-foreground">Buscando no catálogo completo…</p>
      )}
      <ScrollArea className="h-[calc(100vh-22rem)]">
        <div className="space-y-1.5 pr-3">
          {filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => onSelect(p)}
              className={cn(
                'flex w-full items-center gap-3 rounded-lg border p-2.5 text-left transition-all',
                selectedId === p.id
                  ? 'border-primary/40 bg-primary/10 shadow-sm'
                  : 'border-border/30 bg-card/50 hover:border-border/60 hover:bg-accent/50',
              )}
            >
              <img
                src={getCdnUrl(p.images?.[0] || p.image_url || '/placeholder.svg', 'thumbnail')}
                alt={p.name}
                className="h-10 w-10 shrink-0 rounded-md bg-muted object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-xs font-semibold text-foreground">{p.name}</p>
                <p className="text-[10px] text-muted-foreground">
                  {p.sku} • {formatPrice(p.price)}
                </p>
              </div>
              {selectedId === p.id && <Target className="h-4 w-4 shrink-0 text-primary" />}
            </button>
          ))}
          {filtered.length === 0 && !(search.trim().length >= 2 && isRemoteSearching) && (
            <p className="py-6 text-center text-xs text-muted-foreground">
              Nenhum produto encontrado
            </p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
