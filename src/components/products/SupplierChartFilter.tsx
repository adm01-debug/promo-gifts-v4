/**
 * Dropdown filter to select a specific supplier or "All" in the stock chart.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Building2 } from 'lucide-react';

interface SupplierOption {
  id: string;
  name: string;
}

interface SupplierChartFilterProps {
  suppliers: SupplierOption[];
  selected: string; // 'all' or supplier_id
  onSelect: (value: string) => void;
}

export function SupplierChartFilter({ suppliers, selected, onSelect }: SupplierChartFilterProps) {
  if (suppliers.length <= 1) return null;

  return (
    <Select value={selected} onValueChange={onSelect}>
      <SelectTrigger className="h-7 w-auto min-w-[140px] gap-1.5 text-xs">
        <Building2 className="h-3 w-3 shrink-0 text-muted-foreground" />
        <SelectValue placeholder="Todos fornecedores" />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="all" className="text-xs">
          Todos ({suppliers.length})
        </SelectItem>
        {suppliers.map((s) => (
          <SelectItem key={s.id} value={s.id} className="text-xs">
            {s.name}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
