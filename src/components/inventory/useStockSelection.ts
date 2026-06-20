/**
 * useStockSelection — Estado de seleção em lote + ações variant-aware para
 * a tabela de estoque. Paridade total com o catálogo, mas como cada linha
 * já é uma variação SKU, NÃO precisamos do BulkVariantWizard: aplicamos
 * direto sobre os SKUs marcados.
 */
import { useCallback, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';

import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
import type { ProductStockSummary, VariantStock } from '@/types/stock';

export interface StockSelectionRow {
  product: ProductStockSummary;
  variant: VariantStock;
}

/**
 * Constrói o payload canônico (single-row) usado pelo Quote Builder a partir
 * de uma linha de estoque. SSOT — qualquer mudança de schema do payload
 * deve passar por aqui para não dar drift entre bulk e single-row.
 */
export function buildQuoteItemPayload(r: StockSelectionRow) {
  return {
    product_id: r.product.productId,
    product_name: r.product.productName,
    product_sku: r.variant.variantSku,
    variant_id: r.variant.variantId,
    quantity: r.variant.minStock || 1,
    color_name: r.variant.colorName ?? null,
    color_hex: r.variant.colorHex ?? null,
    size_code: r.variant.sizeCode ?? null,
    product_image: r.variant.imageUrl ?? r.product.productImageUrl ?? '',
  };
}

/** `items[]=<encoded-json>` para uma linha. */
export function buildQuoteParam(r: StockSelectionRow): string {
  return `items[]=${encodeURIComponent(JSON.stringify(buildQuoteItemPayload(r)))}`;
}

/** Chave estável por SKU (product+variant) usada no Set de seleção. */
export const rowKey = (r: { productId: string; variantId: string }) =>
  `${r.productId}::${r.variantId}`;

export function useStockSelection(rows: StockSelectionRow[]) {
  const navigate = useNavigate();
  const favStore = useFavoritesStore();
  const compStore = useComparisonStore();

  const [enabled, setEnabled] = useState(false);
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const rowByKey = useMemo(() => {
    const map = new Map<string, StockSelectionRow>();
    for (const r of rows) {
      map.set(rowKey({ productId: r.product.productId, variantId: r.variant.variantId }), r);
    }
    return map;
  }, [rows]);

  const selectedRows = useMemo(
    () =>
      Array.from(selectedKeys)
        .map((k) => rowByKey.get(k))
        .filter(Boolean) as StockSelectionRow[],
    [selectedKeys, rowByKey],
  );

  const isSelected = useCallback((k: string) => selectedKeys.has(k), [selectedKeys]);

  const toggle = useCallback((k: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(k)) next.delete(k);
      else next.add(k);
      return next;
    });
  }, []);

  const selectAllVisible = useCallback((visibleRows: StockSelectionRow[]) => {
    setSelectedKeys(
      new Set(
        visibleRows.map((r) =>
          rowKey({ productId: r.product.productId, variantId: r.variant.variantId }),
        ),
      ),
    );
  }, []);

  const clear = useCallback(() => setSelectedKeys(new Set()), []);

  const setMode = useCallback((on: boolean) => {
    setEnabled(on);
    if (!on) setSelectedKeys(new Set());
  }, []);

  const buildVariantInfo = (r: StockSelectionRow) => ({
    color_name: r.variant.colorName,
    color_hex: r.variant.colorHex,
    size_code: r.variant.sizeCode,
    variant_id: r.variant.variantId,
    thumbnail: r.variant.imageUrl ?? r.product.productImageUrl,
  });

  // ── Ações em lote ──────────────────────────────────────────────────────────

  const bulkFavorite = useCallback(() => {
    if (selectedRows.length === 0) return;
    let added = 0;
    try {
      for (const r of selectedRows) {
        if (!favStore.isFavorite(r.product.productId)) {
          favStore.addFavorite(r.product.productId, buildVariantInfo(r));
          added++;
        }
      }
      toast.success(`${added} ${added === 1 ? 'item favoritado' : 'itens favoritados'}`);
      clear();
    } catch {
      toast.error('Não foi possível favoritar todos os itens. Tente novamente.');
    }
  }, [selectedRows, favStore, clear]);

  const bulkCompare = useCallback(() => {
    if (selectedRows.length === 0) return;
    const slots = Math.max(0, 4 - compStore.compareItems.length);
    if (slots === 0) {
      toast.error('Limite de 4 itens para comparação já atingido');
      return;
    }
    const slice = selectedRows.slice(0, slots);
    try {
      let added = 0;
      for (const r of slice) {
        if (compStore.addToCompare(r.product.productId, buildVariantInfo(r))) added++;
      }
      const skipped = selectedRows.length - added;
      toast.success(
        `${added} ${added === 1 ? 'item adicionado' : 'itens adicionados'} à comparação${skipped > 0 ? ` (${skipped} ignorado${skipped > 1 ? 's' : ''} — limite de 4)` : ''}`,
      );
      clear();
    } catch {
      toast.error('Não foi possível atualizar a comparação. Tente novamente.');
    }
  }, [selectedRows, compStore, clear]);

  const bulkQuote = useCallback(() => {
    if (selectedRows.length === 0) return;
    try {
      const params = selectedRows.map((r) => buildQuoteParam(r)).join('&');
      navigate(`/orcamentos/novo?${params}`);
      toast.success(
        `${selectedRows.length} ${selectedRows.length === 1 ? 'item enviado' : 'itens enviados'} para orçamento`,
      );
      clear();
    } catch {
      toast.error('Não foi possível abrir o orçamento. Tente novamente.');
    }
  }, [selectedRows, navigate, clear]);

  return {
    enabled,
    setMode,
    selectedKeys,
    selectedRows,
    selectedCount: selectedKeys.size,
    isSelected,
    toggle,
    selectAllVisible,
    clear,
    bulkFavorite,
    bulkCompare,
    bulkQuote,
  };
}
