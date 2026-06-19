import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { type QuoteItem, type QuoteItemPersonalization } from '@/hooks/quotes';
import { type ExternalVariantStock } from '@/hooks/products';

interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  images: string[] | null;
  /** Quantidade mínima de pedido do fornecedor (B2B). Usada como qty inicial. */
  minQuantity?: number;
  priceUpdatedAt?: string;
  priceFreshnessThresholdDays?: number;
}

export function useQuoteItems(initialItems: QuoteItem[] = []) {
  const [items, setItems] = useState<QuoteItem[]>(initialItems);
  const [activeItemIndex, setActiveItemIndex] = useState<number | null>(null);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());

  const toggleExpanded = useCallback((index: number) => {
    setExpandedItems((prev) => {
      const n = new Set(prev);
      if (n.has(index)) {
        n.delete(index);
      } else {
        n.add(index);
      }
      return n;
    });
  }, []);

  const addProductWithColor = useCallback(
    (product: Product, variant: ExternalVariantStock | null) => {
      const colorName = variant?.color_name || undefined;
      const colorHex = variant?.color_hex || undefined;
      const sizeCode = variant?.size_code || undefined;
      const imageUrl =
        variant?.selected_thumbnail ||
        (variant?.images?.length ? variant.images[0] : undefined) ||
        (Array.isArray(product.images) && product.images.length > 0
          ? product.images[0]
          : undefined);

      setItems((prev) => {
        const existingIndex = prev.findIndex(
          (i) =>
            i.product_id === product.id && i.color_name === colorName && i.size_code === sizeCode,
        );
        if (existingIndex >= 0) {
          const newItems = prev.map((item, idx) =>
            idx === existingIndex ? { ...item, quantity: item.quantity + 1 } : item,
          );
          setActiveItemIndex(existingIndex);
          setExpandedItems((p) => new Set(p).add(existingIndex));
          toast.info(`Quantidade de "${product.name}" aumentada.`);
          return newItems;
        }

        // B2B: respeita a quantidade mínima do fornecedor como qty inicial.
        // Antes começava sempre em 1 (mesmo para produtos com mínimo de 50/100),
        // permitindo enviar orçamento com quantidade inviável. Adicionar via busca
        // passa a iniciar no mínimo; cliques subsequentes incrementam de 1 em 1.
        const initialQuantity = Math.max(1, Math.floor(product.minQuantity ?? 1));
        const newItems = [
          ...prev,
          {
            product_id: product.id,
            product_name: product.name,
            product_sku: product.sku,
            product_image_url: imageUrl,
            quantity: initialQuantity,
            unit_price: product.price,
            color_name: colorName,
            color_hex: colorHex,
            size_code: sizeCode,
            bitrix_product_id: variant?.bitrix_product_id ?? null,
            price_updated_at: product.priceUpdatedAt ?? null,
            price_freshness_threshold_days: product.priceFreshnessThresholdDays ?? null,
            personalizations: [],
          },
        ];
        const newIdx = newItems.length - 1;
        setActiveItemIndex(newIdx);
        setExpandedItems((p) => new Set(p).add(newIdx));
        return newItems;
      });
    },
    [],
  );

  const updateItemQuantity = useCallback((index: number, quantity: number) => {
    if (quantity < 1) return;
    setItems((prev) => prev.map((item, idx) => (idx === index ? { ...item, quantity } : item)));
  }, []);

  const updateItemPrice = useCallback((index: number, price: number) => {
    // Clamp defensivo: preço nunca negativo nem NaN (espelha CHECK unit_price >= 0 no banco
    // e evita que um valor inválido só estoure no momento do save).
    const safePrice = Math.max(0, Number.isFinite(price) ? price : 0);
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, unit_price: safePrice } : item)),
    );
  }, []);

  const removeItem = useCallback((index: number) => {
    setItems((prev) => prev.filter((_, idx) => idx !== index));
    setActiveItemIndex((prev) => {
      if (prev === index) return null;
      if (prev !== null && prev > index) return prev - 1;
      return prev;
    });
    /**
     * BUG-03 FIX: reindexar expandedItems após remoção.
     *
     * PROBLEMA ORIGINAL: o Set<number> não era atualizado ao remover um item.
     * Itens em posições > removedIndex ficavam com índices desalinhados com o
     * array real. Resultado visual: painel de personalização aparecia expandido
     * para o item errado após uma remoção no meio da lista.
     */
    setExpandedItems((prev) => {
      const next = new Set<number>();
      prev.forEach((i) => {
        if (i < index) next.add(i);
        else if (i > index) next.add(i - 1); // reindexar índices subsequentes
        // i === index: descartar (item removido)
      });
      return next;
    });
  }, []);

  const handlePersonalizationsChange = useCallback(
    (index: number, personalizations: QuoteItemPersonalization[]) => {
      setItems((prev) =>
        prev.map((item, idx) => (idx === index ? { ...item, personalizations } : item)),
      );
    },
    [],
  );

  const confirmItemPrice = useCallback((index: number) => {
    const ts = new Date().toISOString();
    setItems((prev) =>
      prev.map((item, idx) => (idx === index ? { ...item, price_confirmed_at: ts } : item)),
    );
  }, []);

  return {
    items,
    setItems,
    activeItemIndex,
    setActiveItemIndex,
    expandedItems,
    setExpandedItems,
    toggleExpanded,
    addProductWithColor,
    updateItemQuantity,
    updateItemPrice,
    removeItem,
    handlePersonalizationsChange,
    confirmItemPrice,
  };
}
