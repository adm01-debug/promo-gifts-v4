/**
 * Search result rendering helpers for SmartSearchInput
 */
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Search, Package, Folder, Building2, Zap, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { HighlightMatch } from './HighlightMatch';
import type { SearchResult } from '@/hooks/common';
import { getCdnUrl } from '@/utils/image-utils';
import { OptimizedImage } from '@/components/ui/OptimizedImage';

const typeIcons: Record<string, React.ReactNode> = {
  product: <Package className="h-4 w-4 text-primary" />,
  category: <Folder className="h-4 w-4 text-warning" />,
  supplier: <Building2 className="h-4 w-4 text-primary" />,
  history: <Search className="h-3 w-3 text-muted-foreground" />,
};

const typeLabels: Record<string, string> = {
  product: 'Produto',
  category: 'Categoria',
  supplier: 'Fornecedor',
  history: 'Histórico',
};

interface ResultItemProps {
  result: SearchResult;
  index: number;
  selectedIndex: number;
  query: string;
  onSelect: (result: SearchResult) => void;
  onHover: (index: number) => void;
}

export function SearchResultItem({
  result,
  index,
  selectedIndex,
  query,
  onSelect,
  onHover,
}: ResultItemProps) {
  const isProduct = result.type === 'product';
  const productImg =
    isProduct && result.data?.images?.[0] ? getCdnUrl(result.data.images[0], 'card') : null;

  return (
    <button
      key={result.id}
      className={cn(
        'group flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all duration-150 animate-in fade-in slide-in-from-left-1',
        selectedIndex === index ? 'bg-primary/10 text-foreground shadow-sm' : 'hover:bg-muted/80',
      )}
      style={{ animationDelay: `${index * 20}ms`, animationFillMode: 'both' }}
      onClick={() => onSelect(result)}
      onMouseEnter={() => onHover(index)}
    >
      <div
        className={cn(
          'flex h-10 w-10 flex-shrink-0 items-center justify-center overflow-hidden rounded-lg border border-transparent transition-all duration-200',
          selectedIndex === index ? 'scale-105 border-primary/20 bg-primary/15' : 'bg-muted',
        )}
      >
        {productImg ? (
          <OptimizedImage
            src={productImg}
            alt=""
            className="object-contain"
            containerClassName="h-full w-full"
          />
        ) : (
          typeIcons[result.type] || result.icon
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <HighlightMatch
            text={result.label}
            query={query}
            className="block truncate text-sm font-medium"
          />
          {isProduct && result.data?.featured && (
            <Badge
              variant="secondary"
              className="h-4 border-amber-200 bg-amber-100 px-1 text-[9px] font-bold uppercase text-amber-800"
            >
              Destaque
            </Badge>
          )}
        </div>
        {result.sublabel && (
          <HighlightMatch
            text={result.sublabel}
            query={query}
            className="mt-0.5 block truncate text-xs text-muted-foreground"
            highlightClassName="bg-primary/10 text-primary/80 font-medium rounded-sm px-0.5"
          />
        )}
      </div>
      <div className="flex flex-col items-end gap-1">
        <Badge
          variant="outline"
          className={cn(
            'h-4 shrink-0 px-1.5 text-[9px] uppercase tracking-tight transition-colors',
            selectedIndex === index && 'border-primary/30 text-primary',
          )}
        >
          {typeLabels[result.type]}
        </Badge>
        <ArrowRight
          className={cn(
            'h-3.5 w-3.5 text-muted-foreground transition-all',
            selectedIndex === index ? 'translate-x-0 opacity-100' : '-translate-x-1 opacity-0',
          )}
        />
      </div>
    </button>
  );
}

interface GroupedResultsProps {
  suggestions: SearchResult[];
  selectedIndex: number;
  query: string;
  onSelect: (result: SearchResult) => void;
  onHover: (index: number) => void;
}

export function GroupedSearchResults({
  suggestions,
  selectedIndex,
  query,
  onSelect,
  onHover,
}: GroupedResultsProps) {
  const products = suggestions.filter((s) => s.type === 'product');
  const categories = suggestions.filter((s) => s.type === 'category');
  const suppliers = suggestions.filter((s) => s.type === 'supplier');
  const resultCount = suggestions.filter((s) => s.type !== 'history').length;

  return (
    <div className="space-y-1 p-2">
      <div className="flex items-center justify-between px-2 py-1.5">
        <span className="flex items-center gap-2 text-xs font-medium text-muted-foreground">
          <Zap className="h-3 w-3 text-primary" />
          Sugestões
        </span>
        <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">
          {resultCount} {resultCount === 1 ? 'sugestão' : 'sugestões'}
        </Badge>
      </div>

      {products.length > 0 && (
        <div>
          {products.length > 1 && (
            <div className="flex items-center gap-1.5 px-3 pb-0.5 pt-1">
              <Package className="h-3 w-3 text-primary" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                Produtos ({products.length})
              </span>
            </div>
          )}
          {products.map((result) => {
            const idx = suggestions.indexOf(result);
            return (
              <SearchResultItem
                key={result.id}
                result={result}
                index={idx}
                selectedIndex={selectedIndex}
                query={query}
                onSelect={onSelect}
                onHover={onHover}
              />
            );
          })}
        </div>
      )}

      {categories.length > 0 && (
        <div>
          {products.length > 0 && <Separator className="my-1.5 opacity-50" />}
          <div className="flex items-center gap-1.5 px-3 pb-0.5 pt-1">
            <Folder className="h-3 w-3 text-warning" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Categorias ({categories.length})
            </span>
          </div>
          {categories.map((result) => {
            const idx = suggestions.indexOf(result);
            return (
              <SearchResultItem
                key={result.id}
                result={result}
                index={idx}
                selectedIndex={selectedIndex}
                query={query}
                onSelect={onSelect}
                onHover={onHover}
              />
            );
          })}
        </div>
      )}

      {suppliers.length > 0 && (
        <div>
          {(products.length > 0 || categories.length > 0) && (
            <Separator className="my-1.5 opacity-50" />
          )}
          <div className="flex items-center gap-1.5 px-3 pb-0.5 pt-1">
            <Building2 className="h-3 w-3 text-primary" />
            <span className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
              Fornecedores ({suppliers.length})
            </span>
          </div>
          {suppliers.map((result) => {
            const idx = suggestions.indexOf(result);
            return (
              <SearchResultItem
                key={result.id}
                result={result}
                index={idx}
                selectedIndex={selectedIndex}
                query={query}
                onSelect={onSelect}
                onHover={onHover}
              />
            );
          })}
        </div>
      )}
    </div>
  );
}
