/**
 * useEntitySelectionMode — Generic batch-selection hook for entity grids.
 *
 * Pattern extracted in F1 Onda D (auditoria de duplicação): the previous
 * useNoveltiesSelectionMode and useReplenishmentsSelectionMode were 95%
 * identical (62 linhas duplicadas detectadas pelo jscpd). This generic
 * hook captures the common state machine: selection set, bulk wizard
 * trigger, cart/favorite/compare/quote workflow.
 *
 * Specific hooks (useNoveltiesSelectionMode, useReplenishmentsSelectionMode)
 * remain as thin wrappers that supply the entity-to-Product converter.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Product } from '@/hooks/products';
import type { BulkVariantSelection, BulkWizardMode } from '@/components/catalog/BulkVariantWizard';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { toast } from 'sonner';

/**
 * Minimal contract for entities backed by this hook. Both
 * NoveltyWithDetails and ReplenishmentWithDetails satisfy this.
 */
export interface SelectableEntity {
  product_id: string;
}

export interface UseEntitySelectionModeParams<TEntity extends SelectableEntity> {
  selectionMode: boolean;
  filteredProducts: TEntity[];
  /** Converter from the source entity to the Product shape used by BulkVariantWizard. */
  entityToProduct: (entity: TEntity) => Product;
}

export function useEntitySelectionMode<TEntity extends SelectableEntity>({
  selectionMode,
  filteredProducts,
  entityToProduct,
}: UseEntitySelectionModeParams<TEntity>) {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [variantWizardOpen, setVariantWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<BulkWizardMode>('cart');
  const [wizardSelections, setWizardSelections] = useState<BulkVariantSelection[]>([]);

  const selectedCount = selectedIds.size;

  // Clear selection when leaving selection mode
  useEffect(() => {
    if (!selectionMode) setSelectedIds(new Set());
  }, [selectionMode]);

  // Remove stale IDs when products change
  useEffect(() => {
    setSelectedIds((prev) => {
      if (prev.size === 0) return prev;
      const validIds = new Set(filteredProducts.map((p) => p.product_id));
      const filtered = new Set([...prev].filter((id) => validIds.has(id)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [filteredProducts]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(
    () => setSelectedIds(new Set(filteredProducts.map((p) => p.product_id))),
    [filteredProducts],
  );
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBulkFavorite = useCallback(() => {
    setWizardMode('favorite');
    setVariantWizardOpen(true);
  }, []);
  const handleBulkCompare = useCallback(() => {
    setWizardMode('compare');
    setVariantWizardOpen(true);
  }, []);
  const handleBulkCollection = useCallback(() => {
    setWizardMode('collection');
    setVariantWizardOpen(true);
  }, []);
  const handleBulkCart = useCallback(() => {
    setWizardMode('cart');
    setVariantWizardOpen(true);
  }, []);
  const handleBulkQuote = useCallback(() => {
    setWizardMode('quote');
    setVariantWizardOpen(true);
  }, []);

  const handleWizardComplete = useCallback(
    (selections: BulkVariantSelection[]) => {
      if (wizardMode === 'cart') {
        setWizardSelections(selections);
        setCartModalOpen(true);
      } else if (wizardMode === 'quote') {
        if (selections.length === 0) return;
        const params = selections
          .map(
            (s) =>
              `items[]=${encodeURIComponent(
                JSON.stringify({
                  product_id: s.product.id,
                  product_name: s.product.name,
                  product_sku: s.product.sku || '',
                  product_price: s.product.price,
                  product_image: s.variant?.selected_thumbnail || s.product.images?.[0] || '',
                  quantity: 1,
                  color_name: s.variant?.color_name || null,
                  color_hex: s.variant?.color_hex || null,
                  size_code: s.variant?.size_code || null,
                }),
              )}`,
          )
          .join('&');
        navigate(`/orcamentos/novo?${params}`);
        toast.success(
          `${selections.length} produto${selections.length > 1 ? 's' : ''} enviado${
            selections.length > 1 ? 's' : ''
          } para orçamento`,
        );
        clearSelection();
      } else if (wizardMode === 'favorite') {
        const { addFavorite, isFavorite: isFav } = useFavoritesStore.getState();
        let added = 0;
        selections.forEach((s) => {
          if (!isFav(s.product.id)) {
            addFavorite(
              s.product.id,
              s.variant
                ? {
                    color_name: s.variant.color_name,
                    color_hex: s.variant.color_hex,
                    size_code: s.variant.size_code,
                    variant_id: s.variant.id,
                    thumbnail: s.variant.selected_thumbnail,
                  }
                : undefined,
            );
            added++;
          }
        });
        toast.success(`${added} produto${added > 1 ? 's' : ''} favoritado${added > 1 ? 's' : ''}`);
        clearSelection();
      } else if (wizardMode === 'compare') {
        const { addToCompare, isInCompare: isComp } = useComparisonStore.getState();
        let added = 0;
        selections.slice(0, 4).forEach((s) => {
          if (!isComp(s.product.id)) {
            addToCompare(
              s.product.id,
              s.variant
                ? {
                    color_name: s.variant.color_name,
                    color_hex: s.variant.color_hex,
                    size_code: s.variant.size_code,
                    variant_id: s.variant.id,
                    thumbnail: s.variant.selected_thumbnail,
                  }
                : undefined,
            );
            added++;
          }
        });
        toast.success(
          `${added} produto${added > 1 ? 's' : ''} adicionado${added > 1 ? 's' : ''} à comparação`,
        );
        clearSelection();
      } else if (wizardMode === 'collection') {
        setWizardSelections(selections);
        setCollectionModalOpen(true);
      }
    },
    [wizardMode, navigate, clearSelection],
  );

  // BUG-09 FIX: previously bulkCartProducts and selectedProducts were two
  // separate useMemo calls with identical code and deps — double computation
  // on every render with active selection. Now selectedProducts is the single
  // source of truth and bulkCartProducts is a plain alias with zero overhead.
  const selectedProducts = useMemo(
    () => filteredProducts.filter((p) => selectedIds.has(p.product_id)).map(entityToProduct),
    [selectedIds, filteredProducts, entityToProduct],
  );

  // Alias for backward compatibility with consumers expecting bulkCartProducts
  const bulkCartProducts = selectedProducts;

  const firstSelectedId = selectedIds.size > 0 ? Array.from(selectedIds)[0] : '';
  const firstSelectedProduct = filteredProducts.find((p) => p.product_id === firstSelectedId);

  return {
    selectedIds,
    selectedCount,
    toggleSelect,
    selectAll,
    clearSelection,
    collectionModalOpen,
    setCollectionModalOpen,
    cartModalOpen,
    setCartModalOpen,
    variantWizardOpen,
    setVariantWizardOpen,
    wizardMode,
    wizardSelections,
    handleBulkFavorite,
    handleBulkCompare,
    handleBulkCollection,
    handleBulkCart,
    handleBulkQuote,
    handleWizardComplete,
    bulkCartProducts,
    selectedProducts,
    firstSelectedId,
    firstSelectedProduct,
  };
}
