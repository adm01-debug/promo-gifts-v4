import { Search, X } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import type { FilterState } from '../types';

interface SuppliersFilterProps {
  filters: FilterState;
  supplierSearch: string;
  setSupplierSearch: (v: string) => void;
  supplierOptions: Array<{ id: string; name: string; leadTimeDays?: number | null }>;
  suppliersLoading: boolean;
  toggleArrayFilter: (key: keyof FilterState, value: number | string) => void;
}

export function SuppliersFilter({
  filters,
  supplierSearch,
  setSupplierSearch,
  supplierOptions,
  suppliersLoading,
  toggleArrayFilter,
}: SuppliersFilterProps) {
  return (
    <div className="space-y-2">
      {!suppliersLoading && supplierOptions.length > 0 && (
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar fornecedor..."
            value={supplierSearch}
            onChange={(e) => setSupplierSearch(e.target.value)}
            className="h-8 pl-8 pr-8 text-sm"
            aria-label="Buscar fornecedor por nome"
          />
          {supplierSearch && (
            <button
              type="button"
              onClick={() => setSupplierSearch('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              aria-label="Limpar busca"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      )}
      {suppliersLoading ? (
        <>
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-full" />
          <Skeleton className="h-6 w-3/4" />
        </>
      ) : supplierOptions.length > 0 ? (
        <div
          className="max-h-48 overflow-y-auto overscroll-contain pr-2"
          style={{ overscrollBehavior: 'contain' }}
        >
          <div className="space-y-2">
            {supplierOptions
              .filter(
                (s) =>
                  !supplierSearch || s.name.toLowerCase().includes(supplierSearch.toLowerCase()),
              )
              .map((supplier) => (
                <div key={supplier.id} className="flex items-center gap-2">
                  <Checkbox
                    id={`sup-${supplier.id}`}
                    checked={filters.suppliers.includes(supplier.id)}
                    onCheckedChange={() => toggleArrayFilter('suppliers', supplier.id)}
                  />
                  <Label
                    htmlFor={`sup-${supplier.id}`}
                    className="flex cursor-pointer items-center gap-2 text-sm"
                  >
                    <span>{supplier.name}</span>
                    {supplier.leadTimeDays && (
                      <span className="text-xs text-muted-foreground">
                        ({supplier.leadTimeDays}d)
                      </span>
                    )}
                  </Label>
                </div>
              ))}
          </div>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">Nenhum fornecedor disponível</p>
      )}
    </div>
  );
}
