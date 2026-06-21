/**
 * Match Filters Panel — filters for product match page.
 *
 * Categoria é filtrada por `categoryId` (não por nome): no catálogo de produção
 * o nome de categoria nem sempre está disponível no payload, então o id é o
 * critério robusto. Os nomes exibidos são resolvidos pelo chamador.
 */
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Filter, X } from 'lucide-react';
import type { MatchFilters } from '@/hooks/products';

export interface CategoryOption {
  id: string;
  name: string;
}

interface MatchFiltersPanelProps {
  filters: Partial<MatchFilters>;
  setFilters: React.Dispatch<React.SetStateAction<Partial<MatchFilters>>>;
  categories: CategoryOption[];
  suppliers: string[];
}

const ALL = '__all__';

export function MatchFiltersPanel({
  filters,
  setFilters,
  categories,
  suppliers,
}: MatchFiltersPanelProps) {
  const hasActiveFilters = Boolean(
    filters.categoryId || filters.supplierFilter || filters.onlyInStock,
  );

  return (
    <Card className="border-border/30">
      <CardHeader className="p-3 pb-2">
        <CardTitle className="flex items-center gap-1.5 text-xs">
          <Filter className="h-3.5 w-3.5 text-primary" />
          Filtros Inteligentes
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-3 pt-0">
        {categories.length > 0 && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Categoria</label>
            <Select
              value={filters.categoryId || ALL}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, categoryId: v === ALL ? undefined : v }))
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todas as categorias</SelectItem>
                {categories.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {suppliers.length > 0 && (
          <div className="space-y-1">
            <label className="text-[10px] font-medium text-muted-foreground">Fornecedor</label>
            <Select
              value={filters.supplierFilter || ALL}
              onValueChange={(v) =>
                setFilters((f) => ({ ...f, supplierFilter: v === ALL ? undefined : v }))
              }
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder="Todos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL}>Todos os fornecedores</SelectItem>
                {suppliers.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-1">
          <label className="text-[10px] font-medium text-muted-foreground">Score mínimo</label>
          <Select
            value={String(filters.minScore || 10)}
            onValueChange={(v) => setFilters((f) => ({ ...f, minScore: Number(v) }))}
          >
            <SelectTrigger className="h-8 text-xs">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="5">5+ (todos)</SelectItem>
              <SelectItem value="10">10+ (relevante)</SelectItem>
              <SelectItem value="25">25+ (forte)</SelectItem>
              <SelectItem value="50">50+ (muito forte)</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="flex items-center justify-between">
          <label className="text-[10px] font-medium text-muted-foreground">Apenas em estoque</label>
          <Switch
            checked={filters.onlyInStock || false}
            onCheckedChange={(v) => setFilters((f) => ({ ...f, onlyInStock: v }))}
          />
        </div>

        {hasActiveFilters && (
          <Button
            variant="ghost"
            size="sm"
            className="w-full gap-1.5 text-xs text-destructive"
            onClick={() =>
              setFilters({
                minScore: 10,
                matchTypes: ['identical', 'similar', 'complementary'],
                onlyInStock: false,
              })
            }
          >
            <X className="h-3 w-3" />
            Limpar filtros
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
