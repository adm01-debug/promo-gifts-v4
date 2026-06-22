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

const DEFAULT_PRICE_RANGE: [number, number] = [0, 9999];

function rmBadge(label: string, onRemove: () => void, key: string) {
  return (
    <Badge
      key={key}
      variant="secondary"
      className="cursor-pointer hover:bg-destructive/10"
      onClick={onRemove}
    >
      {label}
      <span className="ml-1">×</span>
    </Badge>
  );
}

export const CatalogActiveFilters = memo(
  ({ filters, setFilters, activeFiltersCount }: CatalogActiveFiltersProps) => {
    const { data: categories = [] } = useExternalCategoriesQuery();
    const { data: iconsRaw } = useCategoryIcons();
    const icons = (iconsRaw ?? []) as CategoryIcon[];
    const { data: supplierNamesMap } = useSupplierNames(filters.suppliers);

    if (activeFiltersCount === 0) return null;

    const priceActive =
      filters.priceRange[0] !== DEFAULT_PRICE_RANGE[0] ||
      filters.priceRange[1] !== DEFAULT_PRICE_RANGE[1];

    return (
      <div className="flex flex-wrap gap-2 duration-300 animate-in fade-in slide-in-from-top-1">
        {/* Cores planas */}
        {filters.colors.map((color) =>
          rmBadge(
            `🎨 ${color}`,
            () => setFilters({ ...filters, colors: filters.colors.filter((c) => c !== color) }),
            color,
          ),
        )}

        {/* Grupos de cor */}
        {filters.colorGroups?.map((group) =>
          rmBadge(
            `🌈 ${toTitleCase(group)}`,
            () =>
              setFilters({
                ...filters,
                colorGroups: filters.colorGroups?.filter((g) => g !== group),
              }),
            `group-${group}`,
          ),
        )}

        {/* Variações de cor */}
        {filters.colorVariations?.map((variation) =>
          rmBadge(
            `🖌️ ${toTitleCase(variation.replace(/-/g, ' '))}`,
            () =>
              setFilters({
                ...filters,
                colorVariations: filters.colorVariations?.filter((v) => v !== variation),
              }),
            `var-${variation}`,
          ),
        )}

        {/* Nuances de cor */}
        {filters.colorNuances?.map((nuance) =>
          rmBadge(
            `🎭 ${toTitleCase(nuance.replace(/-/g, ' '))}`,
            () =>
              setFilters({
                ...filters,
                colorNuances: filters.colorNuances?.filter((n) => n !== nuance),
              }),
            `nuance-${nuance}`,
          ),
        )}

        {/* Categorias */}
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

        {/* Fornecedores */}
        {filters.suppliers.map((supplierId) => {
          const name = supplierNamesMap?.get(supplierId) || supplierId;
          return rmBadge(
            `🏭 ${toTitleCase(name)}`,
            () =>
              setFilters({
                ...filters,
                suppliers: filters.suppliers.filter((s) => s !== supplierId),
              }),
            supplierId,
          );
        })}

        {/* Grupos de material */}
        {filters.materialGroups?.map((g) =>
          rmBadge(
            `🧱 ${toTitleCase(g)}`,
            () =>
              setFilters({
                ...filters,
                materialGroups: filters.materialGroups?.filter((m) => m !== g),
              }),
            `matgrp-${g}`,
          ),
        )}

        {/* Tipos de material */}
        {filters.materialTypes?.map((t) =>
          rmBadge(
            `⚗️ ${toTitleCase(t)}`,
            () =>
              setFilters({
                ...filters,
                materialTypes: filters.materialTypes?.filter((m) => m !== t),
              }),
            `mattype-${t}`,
          ),
        )}

        {/* Materiais legados */}
        {filters.materiais?.map((m) =>
          rmBadge(
            `🧲 ${toTitleCase(m)}`,
            () => setFilters({ ...filters, materiais: filters.materiais?.filter((x) => x !== m) }),
            `mat-${m}`,
          ),
        )}

        {/* Gênero */}
        {filters.gender?.map((g) =>
          rmBadge(
            `👤 ${g}`,
            () => setFilters({ ...filters, gender: filters.gender?.filter((x) => x !== g) }),
            `gender-${g}`,
          ),
        )}

        {/* Tamanhos */}
        {filters.sizes?.map((s) =>
          rmBadge(
            `📐 ${s}`,
            () => setFilters({ ...filters, sizes: filters.sizes?.filter((x) => x !== s) }),
            `size-${s}`,
          ),
        )}

        {/* Público-alvo */}
        {filters.publicoAlvo?.map((p) =>
          rmBadge(
            `👥 ${toTitleCase(p)}`,
            () =>
              setFilters({ ...filters, publicoAlvo: filters.publicoAlvo?.filter((x) => x !== p) }),
            `pub-${p}`,
          ),
        )}

        {/* Datas comemorativas */}
        {filters.datasComemorativas?.map((d) =>
          rmBadge(
            `🎉 ${toTitleCase(d.replace(/-/g, ' '))}`,
            () =>
              setFilters({
                ...filters,
                datasComemorativas: filters.datasComemorativas?.filter((x) => x !== d),
              }),
            `data-${d}`,
          ),
        )}

        {/* Endomarketing */}
        {filters.endomarketing?.map((e) =>
          rmBadge(
            `💼 ${toTitleCase(e)}`,
            () =>
              setFilters({
                ...filters,
                endomarketing: filters.endomarketing?.filter((x) => x !== e),
              }),
            `endo-${e}`,
          ),
        )}

        {/* Ramos de atividade */}
        {filters.ramosAtividade?.map((r) =>
          rmBadge(
            `🏢 ${toTitleCase(r.replace(/-/g, ' '))}`,
            () =>
              setFilters({
                ...filters,
                ramosAtividade: filters.ramosAtividade?.filter((x) => x !== r),
              }),
            `ramo-${r}`,
          ),
        )}

        {/* Segmentos de atividade */}
        {filters.segmentosAtividade?.map((s) =>
          rmBadge(
            `🏭 ${toTitleCase(s.replace(/-/g, ' '))}`,
            () =>
              setFilters({
                ...filters,
                segmentosAtividade: filters.segmentosAtividade?.filter((x) => x !== s),
              }),
            `seg-${s}`,
          ),
        )}

        {/* Tags */}
        {filters.tags?.map((t) =>
          rmBadge(
            `🏷️ ${t}`,
            () => setFilters({ ...filters, tags: filters.tags?.filter((x) => x !== t) }),
            `tag-${t}`,
          ),
        )}

        {/* Faixa de preço */}
        {priceActive &&
          rmBadge(
            `💰 R$${filters.priceRange[0]}–${filters.priceRange[1]}`,
            () => setFilters({ ...filters, priceRange: DEFAULT_PRICE_RANGE }),
            'price-range',
          )}

        {/* Estoque mínimo */}
        {filters.minStock > 0 &&
          rmBadge(
            `📦 Estoque ≥${filters.minStock}`,
            () => setFilters({ ...filters, minStock: 0 }),
            'min-stock',
          )}

        {/* Vendas fornecedor */}
        {filters.minSupplierSales90d > 0 &&
          rmBadge(
            `📊 Vendas forn. ≥${filters.minSupplierSales90d}`,
            () => setFilters({ ...filters, minSupplierSales90d: 0 }),
            'supplier-sales',
          )}

        {/* Vendas promo */}
        {filters.minPromoSales90d > 0 &&
          rmBadge(
            `📈 Vendas promo ≥${filters.minPromoSales90d}`,
            () => setFilters({ ...filters, minPromoSales90d: 0 }),
            'promo-sales',
          )}

        {/* Booleanos */}
        {filters.featured &&
          rmBadge('⭐ Destaques', () => setFilters({ ...filters, featured: false }), 'featured')}
        {filters.isKit &&
          rmBadge('📦 KITs', () => setFilters({ ...filters, isKit: false }), 'is-kit')}
        {filters.inStock && (
          <Badge
            key="in-stock"
            variant="secondary"
            className="cursor-pointer border-success/30 text-success-foreground hover:bg-destructive/10"
            onClick={() => setFilters({ ...filters, inStock: false })}
          >
            ✅ Em estoque<span className="ml-1">×</span>
          </Badge>
        )}
        {filters.isNew &&
          rmBadge('🆕 Lançamentos', () => setFilters({ ...filters, isNew: false }), 'is-new')}
        {filters.hasPersonalization &&
          rmBadge(
            '✏️ Personalizável',
            () => setFilters({ ...filters, hasPersonalization: false }),
            'has-personalization',
          )}
        {filters.onSale &&
          rmBadge('🔥 Em promoção', () => setFilters({ ...filters, onSale: false }), 'on-sale')}
        {filters.hasCommercialPackaging &&
          rmBadge(
            '🎁 Emb. comercial',
            () => setFilters({ ...filters, hasCommercialPackaging: false }),
            'commercial-packaging',
          )}
      </div>
    );
  },
);
