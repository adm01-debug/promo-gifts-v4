/**
 * ProductFiltersBar — Filtros avançados para listagem de produtos no Admin
 * Filtros server-side: categoria, fornecedor, status
 * Filtro client-side: faixa de preço (aplicado na página atual)
 */

import { dbInvoke } from '@/lib/db/postgrest';
import { useState, useEffect, useCallback, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Filter, X, ChevronDown, RotateCcw, Boxes } from 'lucide-react';
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';

import { logger } from '@/lib/logger';
export interface ProductFilters {
  category_id?: string;
  supplier_id?: string;
  is_active?: boolean | 'all';
  is_kit?: boolean;
  price_min?: number;
  price_max?: number;
}

interface CategoryOption {
  id: string;
  name: string;
}

interface SupplierOption {
  id: string;
  name: string;
  code: string;
}

interface ProductFiltersBarProps {
  filters: ProductFilters;
  onChange: (filters: ProductFilters) => void;
}

export function ProductFiltersBar({ filters, onChange }: ProductFiltersBarProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierOption[]>([]);
  const [loadingCats, setLoadingCats] = useState(false);
  const [loadingSups, setLoadingSups] = useState(false);
  const [catSearch, setCatSearch] = useState('');
  const [supSearch, setSupSearch] = useState('');

  const loadCategories = useCallback(async () => {
    setLoadingCats(true);
    try {
      const result = await dbInvoke<CategoryOption>({
        table: 'categories',
        operation: 'select',
        select: 'id,name',
        orderBy: { column: 'name', ascending: true },
        limit: 500,
      });
      setCategories(result.records || []);
    } catch (e) {
      logger.error('Erro ao carregar categorias:', e);
    } finally {
      setLoadingCats(false);
    }
  }, []);

  const loadSuppliers = useCallback(async () => {
    setLoadingSups(true);
    try {
      const result = await dbInvoke<SupplierOption>({
        table: 'suppliers',
        operation: 'select',
        select: 'id,name,code',
        orderBy: { column: 'name', ascending: true },
        limit: 200,
      });
      setSuppliers(result.records || []);
    } catch (e) {
      logger.error('Erro ao carregar fornecedores:', e);
    } finally {
      setLoadingSups(false);
    }
  }, []);

  // Carregar categorias e fornecedores ao abrir
  useEffect(() => {
    if (!isOpen) return;
    if (categories.length === 0) loadCategories();
    if (suppliers.length === 0) loadSuppliers();
  }, [isOpen, categories.length, suppliers.length, loadCategories, loadSuppliers]);

  const update = useCallback(
    (partial: Partial<ProductFilters>) => {
      onChange({ ...filters, ...partial });
    },
    [filters, onChange],
  );

  const clearAll = useCallback(() => {
    onChange({});
    setCatSearch('');
    setSupSearch('');
  }, [onChange]);

  const activeCount = useMemo(() => {
    let count = 0;
    if (filters.category_id) count++;
    if (filters.supplier_id) count++;
    if (filters.is_active !== undefined && filters.is_active !== 'all') count++;
    if (filters.is_kit) count++;
    if (filters.price_min !== undefined && filters.price_min > 0) count++;
    if (filters.price_max !== undefined && filters.price_max > 0) count++;
    return count;
  }, [filters]);

  const filteredCategories = useMemo(() => {
    if (!catSearch) return categories.slice(0, 50);
    const s = catSearch.toLowerCase();
    return categories.filter((c) => c.name.toLowerCase().includes(s)).slice(0, 50);
  }, [categories, catSearch]);

  const filteredSuppliers = useMemo(() => {
    if (!supSearch) return suppliers;
    const s = supSearch.toLowerCase();
    return suppliers.filter(
      (sp) => sp.name.toLowerCase().includes(s) || sp.code?.toLowerCase().includes(s),
    );
  }, [suppliers, supSearch]);

  const selectedCategoryName = categories.find((c) => c.id === filters.category_id)?.name;
  const selectedSupplierName = suppliers.find((s) => s.id === filters.supplier_id)?.name;

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="flex items-center gap-2">
        <CollapsibleTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className={cn(
              'gap-2 transition-colors',
              activeCount > 0 && 'border-primary text-primary hover:text-primary',
            )}
          >
            <Filter className="h-3.5 w-3.5" />
            Filtros
            {activeCount > 0 && (
              <Badge variant="default" className="h-5 min-w-[20px] px-1.5 text-[10px]">
                {activeCount}
              </Badge>
            )}
            <ChevronDown
              className={cn('h-3.5 w-3.5 transition-transform', isOpen && 'rotate-180')}
            />
          </Button>
        </CollapsibleTrigger>

        {/* Badges dos filtros ativos */}
        {activeCount > 0 && !isOpen && (
          <div className="flex flex-wrap items-center gap-1.5">
            {selectedCategoryName && (
              <Badge variant="secondary" className="gap-1 text-xs">
                Cat:{' '}
                {selectedCategoryName.length > 20
                  ? `${selectedCategoryName.slice(0, 20)}…`
                  : selectedCategoryName}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => update({ category_id: undefined })}
                />
              </Badge>
            )}
            {selectedSupplierName && (
              <Badge variant="secondary" className="gap-1 text-xs">
                Forn:{' '}
                {selectedSupplierName.length > 15
                  ? `${selectedSupplierName.slice(0, 15)}…`
                  : selectedSupplierName}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => update({ supplier_id: undefined })}
                />
              </Badge>
            )}
            {filters.is_active !== undefined && filters.is_active !== 'all' && (
              <Badge variant="secondary" className="gap-1 text-xs">
                {filters.is_active ? 'Ativos' : 'Inativos'}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => update({ is_active: 'all' })}
                />
              </Badge>
            )}
            {filters.is_kit && (
              <Badge variant="secondary" className="gap-1 text-xs">
                <Boxes className="h-3 w-3" />
                Apenas Kits
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => update({ is_kit: undefined })}
                />
              </Badge>
            )}
            {((filters.price_min ?? 0) > 0 || (filters.price_max ?? 0) > 0) && (
              <Badge variant="secondary" className="gap-1 text-xs">
                R$ {filters.price_min || 0} – {filters.price_max || '∞'}
                <X
                  className="h-3 w-3 cursor-pointer"
                  onClick={() => update({ price_min: undefined, price_max: undefined })}
                />
              </Badge>
            )}
            <Button
              variant="ghost"
              size="sm"
              className="h-6 px-2 text-xs text-muted-foreground"
              onClick={clearAll}
            >
              <RotateCcw className="mr-1 h-3 w-3" />
              Limpar
            </Button>
          </div>
        )}
      </div>

      <CollapsibleContent>
        <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg border border-border/50 bg-muted/30 p-3 sm:grid-cols-2 lg:grid-cols-4">
          {/* Categoria */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Categoria</label>
            <Select
              value={filters.category_id || '__all__'}
              onValueChange={(v) => update({ category_id: v === '__all__' ? undefined : v })}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={loadingCats ? 'Carregando...' : 'Todas'} />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <div className="p-2 pb-1">
                  <Input
                    placeholder="Buscar categoria..."
                    value={catSearch}
                    onChange={(e) => setCatSearch(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <SelectItem value="__all__">Todas as categorias</SelectItem>
                {filteredCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Fornecedor */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Fornecedor</label>
            <Select
              value={filters.supplier_id || '__all__'}
              onValueChange={(v) => update({ supplier_id: v === '__all__' ? undefined : v })}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder={loadingSups ? 'Carregando...' : 'Todos'} />
              </SelectTrigger>
              <SelectContent className="max-h-64">
                <div className="p-2 pb-1">
                  <Input
                    placeholder="Buscar fornecedor..."
                    value={supSearch}
                    onChange={(e) => setSupSearch(e.target.value)}
                    className="h-8 text-xs"
                  />
                </div>
                <SelectItem value="__all__">Todos os fornecedores</SelectItem>
                {filteredSuppliers.map((sup) => (
                  <SelectItem key={sup.id} value={sup.id}>
                    {sup.name} {sup.code ? `(${sup.code})` : ''}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Status</label>
            <Select
              value={
                filters.is_active === undefined || filters.is_active === 'all'
                  ? '__all__'
                  : filters.is_active
                    ? 'active'
                    : 'inactive'
              }
              onValueChange={(v) => {
                if (v === '__all__') update({ is_active: 'all' });
                else update({ is_active: v === 'active' });
              }}
            >
              <SelectTrigger className="h-9 text-sm">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__all__">Todos</SelectItem>
                <SelectItem value="active">Ativos</SelectItem>
                <SelectItem value="inactive">Inativos</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Kit */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Tipo</label>
            <div className="flex h-9 items-center gap-2 rounded-md border border-input bg-background px-3">
              <Boxes className="h-3.5 w-3.5 text-primary" />
              <span className="flex-1 text-sm">Apenas Kits</span>
              <Switch
                checked={!!filters.is_kit}
                onCheckedChange={(checked) => update({ is_kit: checked || undefined })}
                className="scale-90"
              />
            </div>
          </div>

          {/* Faixa de Preço */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground">Faixa de Preço (R$)</label>
            <div className="flex items-center gap-2">
              <Input
                type="number"
                placeholder="Mín"
                value={filters.price_min ?? ''}
                onChange={(e) =>
                  update({ price_min: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                className="h-9 text-sm"
                min={0}
                step={0.01}
              />
              <span className="text-xs text-muted-foreground">–</span>
              <Input
                type="number"
                placeholder="Máx"
                value={filters.price_max ?? ''}
                onChange={(e) =>
                  update({ price_max: e.target.value ? parseFloat(e.target.value) : undefined })
                }
                className="h-9 text-sm"
                min={0}
                step={0.01}
              />
            </div>
          </div>

          {/* Ações */}
          {activeCount > 0 && (
            <div className="flex justify-end sm:col-span-2 lg:col-span-4">
              <Button variant="ghost" size="sm" className="text-xs" onClick={clearAll}>
                <RotateCcw className="mr-1 h-3.5 w-3.5" />
                Limpar todos os filtros
              </Button>
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  );
}
