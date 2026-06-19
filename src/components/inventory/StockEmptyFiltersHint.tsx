/**
 * StockEmptyFiltersHint — empty state explanatório para /estoque.
 *
 * Aparece quando os filtros ativos zeram o resultado (productStocks vazio,
 * mas o universo total tem produtos). Lista os filtros responsáveis pelo
 * "0 de N produtos" e oferece um botão único "Limpar filtros" que reseta
 * Categoria, Cor, Quantidade, Fornecedor, Busca, etc.
 */
import { AlertCircle, RotateCcw, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import type { StockFilters } from '@/types/stock';

interface Props {
  filters: StockFilters;
  totalProducts: number;
  onResetFilters: () => void;
  onUpdateFilter: <K extends keyof StockFilters>(key: K, value: StockFilters[K]) => void;
}

interface ActiveFilterChip {
  key: keyof StockFilters;
  label: string;
  value: string;
}

function collectActiveFilters(filters: StockFilters): ActiveFilterChip[] {
  const chips: ActiveFilterChip[] = [];
  if (filters.search) chips.push({ key: 'search', label: 'Busca', value: filters.search });
  if (filters.categoryId)
    chips.push({ key: 'categoryId', label: 'Categoria', value: filters.categoryId });
  if (filters.supplierId)
    chips.push({ key: 'supplierId', label: 'Fornecedor', value: filters.supplierId });
  if (filters.colorGroup)
    chips.push({ key: 'colorGroup', label: 'Cor', value: filters.colorGroup });
  if (filters.colorName) chips.push({ key: 'colorName', label: 'Cor', value: filters.colorName });
  if (filters.minQuantityNeeded && filters.minQuantityNeeded > 0)
    chips.push({
      key: 'minQuantityNeeded',
      label: 'Quantidade mínima',
      value: `≥ ${filters.minQuantityNeeded} un`,
    });
  if (filters.status && filters.status !== 'all')
    chips.push({ key: 'status', label: 'Status', value: filters.status });
  if (filters.showOnlyWithAlerts)
    chips.push({ key: 'showOnlyWithAlerts', label: 'Alertas', value: 'Somente com alertas' });
  return chips;
}

export function StockEmptyFiltersHint({
  filters,
  totalProducts,
  onResetFilters,
  onUpdateFilter,
}: Props) {
  const active = collectActiveFilters(filters);
  if (active.length === 0) return null;

  return (
    <div
      data-testid="stock-empty-filters-hint"
      role="status"
      aria-live="polite"
      className="flex animate-fade-in flex-col gap-3 rounded-lg border border-warning/30 bg-warning/5 p-4"
    >
      <div className="flex items-start gap-3">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0 text-warning" aria-hidden="true" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-foreground">
            0 de {totalProducts.toLocaleString('pt-BR')} produtos
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            Os filtros abaixo estão zerando o resultado. Remova um por vez ou limpe todos para
            voltar à lista completa.
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={onResetFilters}
          data-testid="stock-empty-filters-reset"
          className="shrink-0 gap-1.5"
        >
          <RotateCcw className="h-3.5 w-3.5" />
          Limpar filtros
        </Button>
      </div>

      <div className="flex flex-wrap gap-1.5 pl-8">
        {active.map((chip) => (
          <Badge
            key={String(chip.key)}
            variant="secondary"
            className="gap-1 pr-1 text-xs"
            data-testid={`stock-empty-filters-chip-${String(chip.key)}`}
          >
            <span className="text-muted-foreground">{chip.label}:</span>
            <span className="font-medium">{chip.value}</span>
            <button
              type="button"
              aria-label={`Remover filtro ${chip.label}`}
              onClick={() => {
                // Reset semântico por chave; minQuantityNeeded volta a undefined.
                if (chip.key === 'status') onUpdateFilter('status', 'all');
                else if (chip.key === 'showOnlyWithAlerts')
                  onUpdateFilter('showOnlyWithAlerts', false);
                else if (chip.key === 'search') onUpdateFilter('search', '');
                else onUpdateFilter(chip.key, undefined as never);
              }}
              className="ml-0.5 rounded-sm p-0.5 hover:bg-muted-foreground/10 hover:text-foreground"
            >
              <X className="h-3 w-3" />
            </button>
          </Badge>
        ))}
      </div>
    </div>
  );
}
