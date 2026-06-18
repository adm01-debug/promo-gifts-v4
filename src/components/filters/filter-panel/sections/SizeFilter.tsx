/**
 * SizeFilter — Filtro de tamanho no Super Filtro
 * Extrai size_codes únicos das variações dos produtos carregados.
 */
import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';

const SIZE_ORDER = [
  'PP',
  'P',
  'M',
  'G',
  'GG',
  'XG',
  'XXG',
  'EG',
  'EGG',
  'XS',
  'S',
  'L',
  'XL',
  'XXL',
  '2XL',
  '3XL',
  '34',
  '35',
  '36',
  '37',
  '38',
  '39',
  '40',
  '41',
  '42',
  '43',
  '44',
  '45',
  '46',
  '100ml',
  '200ml',
  '300ml',
  '350ml',
  '400ml',
  '500ml',
  '600ml',
  '750ml',
  '1L',
];

function getSizeOrder(code: string): number {
  const upper = code.toUpperCase().trim();
  const idx = SIZE_ORDER.indexOf(upper);
  if (idx >= 0) return idx;
  const num = parseFloat(upper);
  if (!Number.isNaN(num)) return 1000 + num;
  return 2000;
}

interface SizeFilterProps {
  selectedSizes: string[];
  onToggleSize: (size: string) => void;
  /** Products with variations containing size_code */
  products?: Array<{ variations?: Array<{ size_code?: string | null }> }>;
}

export function SizeFilter({ selectedSizes, onToggleSize, products = [] }: SizeFilterProps) {
  const [search, setSearch] = useState('');

  const availableSizes = useMemo(() => {
    const sizeSet = new Set<string>();
    products.forEach((p) => {
      p.variations?.forEach((v) => {
        if (v.size_code) sizeSet.add(v.size_code);
      });
    });
    return Array.from(sizeSet).sort((a, b) => getSizeOrder(a) - getSizeOrder(b));
  }, [products]);

  const filteredSizes = useMemo(() => {
    if (!search) return availableSizes;
    const q = search.toLowerCase();
    return availableSizes.filter((s) => s.toLowerCase().includes(q));
  }, [availableSizes, search]);

  if (availableSizes.length === 0) {
    return (
      <p className="px-1 text-xs text-muted-foreground">
        Nenhum tamanho disponível nos produtos carregados.
      </p>
    );
  }

  return (
    <div className="space-y-2 px-1">
      {availableSizes.length > 10 && (
        <div className="relative">
          <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar tamanho..."
            className="h-7 pl-7 pr-7 text-xs"
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-2 top-1/2 -translate-y-1/2"
            >
              <X className="h-3 w-3 text-muted-foreground" />
            </button>
          )}
        </div>
      )}
      <div className="flex flex-wrap gap-1.5">
        {filteredSizes.map((size) => {
          const isSelected = selectedSizes.includes(size);
          return (
            <button
              key={size}
              onClick={() => onToggleSize(size)}
              className={cn(
                'rounded-md border px-2.5 py-1 text-xs font-medium transition-all',
                isSelected
                  ? 'border-primary bg-primary text-primary-foreground shadow-sm'
                  : 'border-border bg-card text-foreground hover:border-primary/40 hover:bg-accent',
              )}
            >
              {size}
            </button>
          );
        })}
      </div>
      {selectedSizes.length > 0 && (
        <p className="text-[10px] text-muted-foreground">
          {selectedSizes.length} tamanho(s) selecionado(s)
        </p>
      )}
    </div>
  );
}
