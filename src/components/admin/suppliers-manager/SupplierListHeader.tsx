import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, RefreshCw, Plus, Building2, CheckCircle2, XCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SupplierListHeaderProps {
  search: string;
  setSearch: (s: string) => void;
  filterType: 'all' | 'engraving' | 'product';
  setFilterType: (t: 'all' | 'engraving' | 'product') => void;
  filterStatus: 'active' | 'all' | 'inactive';
  setFilterStatus: (s: 'active' | 'all' | 'inactive') => void;
  loading: boolean;
  totalCount: number;
  filteredCount: number;
  showFilteredBadge: boolean;
  onRefresh: () => void;
  onNew: () => void;
}

export function SupplierListHeader({
  search,
  setSearch,
  filterType,
  setFilterType,
  filterStatus,
  setFilterStatus,
  loading,
  totalCount,
  filteredCount,
  showFilteredBadge,
  onRefresh,
  onNew,
}: SupplierListHeaderProps) {
  return (
    <>
      <div className="flex items-center justify-between gap-4">
        <div className="relative max-w-sm flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar fornecedor..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 pl-9"
          />
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            className="gap-1.5"
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Atualizar
          </Button>
          <Button size="sm" onClick={onNew} data-testid="admin-create-btn" className="gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            Novo Fornecedor
          </Button>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1.5 rounded-lg border border-border p-1">
          <Button
            variant={filterType === 'all' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilterType('all')}
          >
            Todos
          </Button>
          <Button
            variant={filterType === 'product' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilterType('product')}
          >
            Produtos
          </Button>
          <Button
            variant={filterType === 'engraving' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilterType('engraving')}
          >
            Gravação
          </Button>
        </div>
        <div className="flex items-center gap-1.5 rounded-lg border border-border p-1">
          <Button
            variant={filterStatus === 'all' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 text-xs"
            onClick={() => setFilterStatus('all')}
          >
            Todos
          </Button>
          <Button
            variant={filterStatus === 'active' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setFilterStatus('active')}
          >
            <CheckCircle2 className="h-3 w-3" />
            Ativos
          </Button>
          <Button
            variant={filterStatus === 'inactive' ? 'default' : 'ghost'}
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => setFilterStatus('inactive')}
          >
            <XCircle className="h-3 w-3" />
            Inativos
          </Button>
        </div>
        <div className="ml-auto flex gap-2">
          <Badge variant="secondary" className="gap-1.5">
            <Building2 className="h-3 w-3" />
            {totalCount} fornecedores
          </Badge>
          {showFilteredBadge && (
            <Badge variant="outline" className="gap-1.5">
              {filteredCount} resultado(s)
            </Badge>
          )}
        </div>
      </div>
    </>
  );
}
