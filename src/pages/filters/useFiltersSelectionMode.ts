import { useState, useCallback, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import type { Product } from "@/hooks/products";
import type { BulkVariantSelection, BulkWizardMode } from "@/components/catalog/BulkVariantWizard";
import { useFavoritesStore } from "@/stores/useFavoritesStore";
import { useComparisonStore } from "@/stores/useComparisonStore";
import { toast } from "sonner";

interface UseFiltersSelectionModeParams {
  selectionMode: boolean;
  filteredProducts: Product[];
}

export function useFiltersSelectionMode({ selectionMode, filteredProducts }: UseFiltersSelectionModeParams) {
  const navigate = useNavigate();
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [collectionModalOpen, setCollectionModalOpen] = useState(false);
  const [cartModalOpen, setCartModalOpen] = useState(false);
  const [variantWizardOpen, setVariantWizardOpen] = useState(false);
  const [wizardMode, setWizardMode] = useState<BulkWizardMode>('cart');
  const [wizardSelections, setWizardSelections] = useState<BulkVariantSelection[]>([]);

  const selectedCount = selectedIds.size;

  // Clear selection when leaving selection mode
  useEffect(() => { if (!selectionMode) setSelectedIds(new Set()); }, [selectionMode]);

  // Remove stale IDs when products change
  useEffect(() => {
    setSelectedIds(prev => {
      if (prev.size === 0) return prev;
      const validIds = new Set(filteredProducts.map(p => p.id));
      const filtered = new Set([...prev].filter(id => validIds.has(id)));
      return filtered.size === prev.size ? prev : filtered;
    });
  }, [filteredProducts]);

  const toggleSelect = useCallback((id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);

  const selectAll = useCallback(() => setSelectedIds(new Set(filteredProducts.map(p => p.id))), [filteredProducts]);
  const clearSelection = useCallback(() => setSelectedIds(new Set()), []);

  const handleBulkFavorite = useCallback(() => { setWizardMode('favorite'); setVariantWizardOpen(true); }, []);
  const handleBulkCompare = useCallback(() => { setWizardMode('compare'); setVariantWizardOpen(true); }, []);
  const handleBulkCollection = useCallback(() => { setWizardMode('collection'); setVariantWizardOpen(true); }, []);
  const handleBulkCart = useCallback(() => { setWizardMode('cart'); setVariantWizardOpen(true); }, []);
  const handleBulkQuote = useCallback(() => { setWizardMode('quote'); setVariantWizardOpen(true); }, []);

  const handleWizardComplete = useCallback((selections: BulkVariantSelection[]) => {
    if (wizardMode === 'cart') {
      setWizardSelections(selections);
      setCartModalOpen(true);
    } else if (wizardMode === 'quote') {
      if (selections.length === 0) return;
      const params = selections.map(s =>
        `items[]=${encodeURIComponent(JSON.stringify({
          product_id: s.product.id,
          product_name: s.product.name,
          product_sku: s.product.sku || '',
          product_price: s.product.price,
          product_image: s.variant?.selected_thumbnail || s.product.images?.[0] || '',
          quantity: 1,
          color_name: s.variant?.color_name || null,
          color_hex: s.variant?.color_hex || null,
          size_code: s.variant?.size_code || null,
        }))}`
      ).join('&');
      navigate(`/orcamentos/novo?${params}`);
      toast.success(`${selections.length} produto${selections.length > 1 ? 's' : ''} enviado${selections.length > 1 ? 's' : ''} para orçamento`);
      clearSelection();
    } else if (wizardMode === 'favorite') {
      const { addFavorite, isFavorite: isFav } = useFavoritesStore.getState();
      let added = 0;
      selections.forEach(s => {
        if (!isFav(s.product.id)) {
          addFavorite(s.product.id, s.variant ? {
            color_name: s.variant.color_name, color_hex: s.variant.color_hex,
            size_code: s.variant.size_code, variant_id: s.variant.id,
            thumbnail: s.variant.selected_thumbnail,
          } : undefined);
          added++;
        }
      });
      toast.success(`${added} produto${added > 1 ? 's' : ''} favoritado${added > 1 ? 's' : ''} com cor selecionada`);
      clearSelection();
    } else if (wizardMode === 'compare') {
      const { addToCompare, isInCompare: isComp } = useComparisonStore.getState();
      let added = 0;
      selections.slice(0, 4).forEach(s => {
        if (!isComp(s.product.id)) {
          addToCompare(s.product.id, s.variant ? {
            color_name: s.variant.color_name, color_hex: s.variant.color_hex,
            size_code: s.variant.size_code, variant_id: s.variant.id,
            thumbnail: s.variant.selected_thumbnail,
          } : undefined);
          added++;
        }
      });
      toast.success(`${added} produto${added > 1 ? 's' : ''} adicionado${added > 1 ? 's' : ''} à comparação`);
      clearSelection();
    } else if (wizardMode === 'collection') {
      setWizardSelections(selections);
      setCollectionModalOpen(true);
    }
  }, [wizardMode, navigate, clearSelection]);

  const bulkCartProducts = useMemo(() => {
    const ids = Array.from(selectedIds);
    return filteredProducts.filter(p => ids.includes(p.id));
  }, [selectedIds, filteredProducts]);

  const firstSelectedId = selectedIds.size > 0 ? Array.from(selectedIds)[0] : "";
  const firstSelectedProduct = filteredProducts.find(p => p.id === firstSelectedId);

  return {
    selectedIds, selectedCount, toggleSelect, selectAll, clearSelection,
    collectionModalOpen, setCollectionModalOpen,
    cartModalOpen, setCartModalOpen,
    variantWizardOpen, setVariantWizardOpen,
    wizardMode, wizardSelections,
    handleBulkFavorite, handleBulkCompare, handleBulkCollection, handleBulkCart, handleBulkQuote,
    handleWizardComplete, bulkCartProducts,
    firstSelectedId, firstSelectedProduct,
  };
}
