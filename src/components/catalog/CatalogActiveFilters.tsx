import { memo } from 'react';
import { Badge } from '@/components/ui/badge';
import type { FilterState } from '@/components/filters/FilterPanel';
import {
  getCategoryIcon,
  useCategoryIcons,
  type CategoryIcon,
} from '@/hooks/products/useCategoryIcons';
import { useExternalCategoriesQuery } from '@/hooks/products/useExternalCategoriesQuery';
import { useSupplierNames } from '@/hooks/products/useSupplierNames';
import { toTitleCase } from '@/lib/textUtils';
import { X } from 'lucide-react';

interface CatalogActiveFiltersProps {
  filters: FilterState;
  setFilters: (f: FilterState) => void;
  activeFiltersCount: number;
}

export const CatalogActiveFilters = memo(
  ({ filters, setFilters, activeFiltersCount }: CatalogActiveFiltersProps) => {
    const { data: categories = [] } = useExternalCategoriesQuery();
    const { data: iconsRaw } = useCategoryIcons();
    const icons = (iconsRaw ?? []) as CategoryIcon[];
    const { data: supplierNamesMap } = useSupplierNames(filters.suppliers);

    if (activeFiltersCount === 0) return null;

    return (
      <div className="flex flex-wrap gap-2 duration-300 animate-in fade-in slide-in-from-top-1">
        {filters.colors.map((color) => (
          <Badge
            key={color}
            variant="secondary"
            className="cursor-pointer hover:bg-destructive/10"
            onClick={() =>
              setFilters({ ...filters, colors: filters.colors.filter((c) => c !== color) })
            }
          >
            🎨 {color}
            <span className="ml-1">×</span>
          </Badge>
        ))}

        {filters.colorGroups?.map((group) => (
          <Badge
            key={`group-${group}`}
            variant="secondary"
            className="cursor-pointer hover:bg-destructive/10"
            onClick={() =>
              setFilters({
                ...filters,
                colorGroups: filters.colorGroups?.filter((g) => g !== group),
              })
            }
          >
            🌈 {toTitleCase(group)}
            <span className="ml-1">×</span>
          </Badge>
        ))}

        {filters.colorVariations?.map((variation) => (
          <Badge
            key={`var-${variation}`}
            variant="secondary"
            className="cursor-pointer hover:bg-destructive/10"
            onClick={() =>
              setFilters({
                ...filters,
                colorVariations: filters.colorVariations?.filter((v) => v !== variation),
              })
            }
          >
            🖌️ {toTitleCase(variation.replace(/-/g, ' '))}
            <span className="ml-1">×</span>
          </Badge>
        ))}

        {filters.categories.map((catId) => {
          const cat = categories.find((c) => c.id === catId);
          if (!cat) return null;

          const icon = getCategoryIcon(cat.name, icons);
          return (
            <Badge
              key={catId}
              variant="secondary"
              className="cursor-pointer hover:bg-destructive/10"
              onClick={() =>
                setFilters({
                  ...filters,
                  categories: filters.categories.filter((c) => c !== catId),
                })
              }
            >
              <span className="mr-1">{icon}</span>
              {toTitleCase(cat.name)}
              <X className="ml-1 h-3 w-3" />
            </Badge>
          );
        })}

        {filters.suppliers.map((supplierId) => {
          const name = supplierNamesMap?.get(supplierId) || supplierId;
          return (
            <Badge
              key={supplierId}
              variant="secondary"
              className="cursor-pointer hover:bg-destructive/10"
              onClick={() =>
                setFilters({
                  ...filters,
                  suppliers: filters.suppliers.filter((s) => s !== supplierId),
                })
              }
            >
              🏭 {toTitleCase(name)}
              <span className="ml-1">×</span>
            </Badge>
          );
        })}

        {filters.featured && (
          <Badge
            variant="secondary"
            className="cursor-pointer hover:bg-destructive/10"
            onClick={() => setFilters({ ...filters, featured: false })}
          >
            ⭐ Destaques
            <span className="ml-1">×</span>
          </Badge>
        )}
        {filters.isKit && (
          <Badge
            variant="secondary"
            className="cursor-pointer hover:bg-destructive/10"
            onClick={() => setFilters({ ...filters, isKit: false })}
          >
            📦 KITs
            <span className="ml-1">×</span>
          </Badge>
        )}
        {filters.inStock && (
          <Badge
            variant="secondary"
            className="cursor-pointer border-success/30 text-success-foreground hover:bg-destructive/10"
            onClick={() => setFilters({ ...filters, inStock: false })}
          >
            ✅ Em estoque
            <span className="ml-1">×</span>
          </Badge>
        )}
      </div>
    );
  },
);
