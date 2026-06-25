/**
 * DiscountApprovalFilterBar — filtros estruturados para o painel do gestor.
 *
 * Estado controlado: o pai decide como aplicar (na lista carregada via
 * client-side filter ou via re-query). Mantemos puro/sem efeitos para
 * facilitar testes.
 */
import { useId } from 'react';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { X } from 'lucide-react';

export type DiscountApprovalStatus = 'all' | 'pending' | 'approved' | 'rejected';

export interface DiscountApprovalFilters {
  search: string;
  sellerId: string;
  status: DiscountApprovalStatus;
  minPercent: number | null;
  maxPercent: number | null;
  dateFrom: string;
  dateTo: string;
}

export const EMPTY_FILTERS: DiscountApprovalFilters = {
  search: '',
  sellerId: 'all',
  status: 'pending',
  minPercent: null,
  maxPercent: null,
  dateFrom: '',
  dateTo: '',
};

interface SellerOption {
  id: string;
  label: string;
}

interface Props {
  value: DiscountApprovalFilters;
  onChange: (next: DiscountApprovalFilters) => void;
  sellers: SellerOption[];
  totalCount: number;
  filteredCount: number;
}

export function DiscountApprovalFilterBar({
  value,
  onChange,
  sellers,
  totalCount,
  filteredCount,
}: Props) {
  const ids = {
    search: useId(),
    seller: useId(),
    status: useId(),
    min: useId(),
    max: useId(),
    from: useId(),
    to: useId(),
  };
  const patch = (p: Partial<DiscountApprovalFilters>) => onChange({ ...value, ...p });
  const isDirty =
    value.search !== '' ||
    value.sellerId !== 'all' ||
    value.status !== EMPTY_FILTERS.status ||
    value.minPercent !== null ||
    value.maxPercent !== null ||
    value.dateFrom !== '' ||
    value.dateTo !== '';

  return (
    <div
      className="space-y-3 rounded-lg border border-border/40 bg-muted/20 p-3"
      data-testid="discount-approval-filter-bar"
    >
      <div className="grid grid-cols-1 gap-2 md:grid-cols-3">
        <div>
          <Label htmlFor={ids.search} className="text-xs">
            Buscar (orçamento, cliente, justificativa)
          </Label>
          <Input
            id={ids.search}
            value={value.search}
            onChange={(e) => patch({ search: e.target.value })}
            placeholder="Ex.: ACME, ORC-2026..."
            className="h-9"
            data-testid="dar-filter-search"
          />
        </div>
        <div>
          <Label htmlFor={ids.seller} className="text-xs">
            Vendedor
          </Label>
          <Select value={value.sellerId} onValueChange={(v) => patch({ sellerId: v })}>
            <SelectTrigger id={ids.seller} className="h-9" data-testid="dar-filter-seller">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos os vendedores</SelectItem>
              {sellers.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label htmlFor={ids.status} className="text-xs">
            Status
          </Label>
          <Select
            value={value.status}
            onValueChange={(v) => patch({ status: v as DiscountApprovalStatus })}
          >
            <SelectTrigger id={ids.status} className="h-9" data-testid="dar-filter-status">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Pendentes</SelectItem>
              <SelectItem value="approved">Aprovados</SelectItem>
              <SelectItem value="rejected">Rejeitados</SelectItem>
              <SelectItem value="all">Todos</SelectItem>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
        <div>
          <Label htmlFor={ids.min} className="text-xs">
            % mínimo
          </Label>
          <Input
            id={ids.min}
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={value.minPercent ?? ''}
            onChange={(e) =>
              patch({ minPercent: e.target.value === '' ? null : Number(e.target.value) })
            }
            className="h-9"
            data-testid="dar-filter-min-pct"
          />
        </div>
        <div>
          <Label htmlFor={ids.max} className="text-xs">
            % máximo
          </Label>
          <Input
            id={ids.max}
            type="number"
            min={0}
            max={100}
            step={0.5}
            value={value.maxPercent ?? ''}
            onChange={(e) =>
              patch({ maxPercent: e.target.value === '' ? null : Number(e.target.value) })
            }
            className="h-9"
            data-testid="dar-filter-max-pct"
          />
        </div>
        <div>
          <Label htmlFor={ids.from} className="text-xs">
            De
          </Label>
          <Input
            id={ids.from}
            type="date"
            value={value.dateFrom}
            onChange={(e) => patch({ dateFrom: e.target.value })}
            className="h-9"
            data-testid="dar-filter-date-from"
          />
        </div>
        <div>
          <Label htmlFor={ids.to} className="text-xs">
            Até
          </Label>
          <Input
            id={ids.to}
            type="date"
            value={value.dateTo}
            onChange={(e) => patch({ dateTo: e.target.value })}
            className="h-9"
            data-testid="dar-filter-date-to"
          />
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <Badge variant="outline">
          {filteredCount} de {totalCount} solicitaç{totalCount === 1 ? 'ão' : 'ões'}
        </Badge>
        {isDirty && (
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={() => onChange(EMPTY_FILTERS)}
            data-testid="dar-filter-clear"
          >
            <X className="h-3 w-3" /> Limpar filtros
          </Button>
        )}
      </div>
    </div>
  );
}

/** Aplica os filtros em memória sobre as linhas já carregadas. */
export function applyDiscountApprovalFilters<
  T extends {
    seller_id: string;
    requested_discount_percent: number;
    real_discount_percent?: number | null;
    status?: string;
    created_at: string;
    seller_notes?: string | null;
    quotes?: { quote_number?: string | null; client_name?: string | null; client_company?: string | null } | null;
  },
>(rows: T[], filters: DiscountApprovalFilters): T[] {
  return rows.filter((r) => {
    if (filters.status !== 'all' && r.status !== filters.status) return false;
    if (filters.sellerId !== 'all' && r.seller_id !== filters.sellerId) return false;

    const pct = Number(r.real_discount_percent ?? r.requested_discount_percent);
    if (filters.minPercent !== null && pct < filters.minPercent) return false;
    if (filters.maxPercent !== null && pct > filters.maxPercent) return false;

    if (filters.dateFrom && r.created_at < filters.dateFrom) return false;
    // dateTo inclusivo: bate até 23:59:59 do dia
    if (filters.dateTo && r.created_at > `${filters.dateTo}T23:59:59`) return false;

    if (filters.search.trim()) {
      const q = filters.search.trim().toLowerCase();
      const hay = [
        r.quotes?.quote_number,
        r.quotes?.client_name,
        r.quotes?.client_company,
        r.seller_notes,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });
}
