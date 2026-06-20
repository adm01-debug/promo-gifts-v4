/**
 * ProductQuickActionsFAB — Wrapper auto-contido do ProductCardActions para
 * cards "leves" (Novidades, Reposição) que não têm o objeto `Product` completo.
 *
 * Espelha o comportamento do ProductCard:
 *  1 Carrinho · 2 Orçamento · 3 Coleção · 4 Favoritar · 5 Comparar · 6 QuickView · 7 Compartilhar
 *
 * Diálogos pesados (ProductQuickView, SharePreviewDialog) recebem o `Product`
 * carregado sob demanda via useProduct(id) — só dispara o fetch quando o
 * usuário abre uma ação que precisa.
 *
 * FIX 2026-06-15: handleVariantComplete mode='quote' agora espelha ProductCard.tsx:
 * - 0 carrinhos → abre CartCompanyPickerDialog (cria carrinho na hora)
 * - 1+ carrinhos → abre CartSelectorDialog (escolher carrinho ou criar novo)
 * Antes: chamava addToActiveCart diretamente sem carrinho → toast de erro
 * silencioso que o usuário não percebia.
 */
import { memo, useCallback, useState } from 'react';
import { toast } from 'sonner';
import { feedback } from '@/lib/feedback';
import { showUndoToast, showErrorToast } from '@/utils/undoToast';
import { useFavoritesStore } from '@/stores/useFavoritesStore';
import { useComparisonStore } from '@/stores/useComparisonStore';
import { useSellerCartContext } from '@/contexts/SellerCartContext';
import { useProduct } from '@/hooks/products/useProducts';
import type { ExternalVariantStock } from '@/hooks/products/useExternalVariantStock';
import { ProductCardActions } from './ProductCardActions';
import { VariantPickerDialog, type VariantActionMode } from './VariantPickerDialog';
import { AddToCollectionModal } from '@/components/collections/AddToCollectionModal';
import { CartSelectorDialog } from '@/components/cart/CartSelectorDialog';
import { CartCompanyPickerDialog } from '@/components/cart/CartCompanyPickerDialog';
import { ProductQuickView } from './ProductQuickView';
import { SharePreviewDialog } from './share/SharePreviewDialog';

export interface ProductQuickActionsFABProps {
  readonly productId: string;
  readonly productName: string;
  readonly productSku?: string | null;
  readonly productImageUrl?: string | null;
  readonly productPrice: number;
  readonly productMinQuantity?: number;
  readonly isOutOfStock?: boolean;
}

type CollectionVariant = {
  color_name?: string | null;
  color_hex?: string | null;
  variant_id?: string | null;
  thumbnail?: string | null;
};

type ShareVariant = {
  variantName?: string | null;
  colorHex?: string | null;
  thumbnailUrl?: string | null;
} | null;

export const ProductQuickActionsFAB = memo(
  ({
    productId,
    productName,
    productSku,
    productImageUrl,
    productPrice,
    productMinQuantity = 1,
    isOutOfStock = false,
  }: ProductQuickActionsFABProps) => {
    const [actionsOpen, setActionsOpen] = useState(false);
    const [variantPickerOpen, setVariantPickerOpen] = useState(false);
    const [variantPickerMode, setVariantPickerMode] = useState<VariantActionMode>('favorite');
    const [collectionModalOpen, setCollectionModalOpen] = useState(false);
    const [collectionVariant, setCollectionVariant] = useState<CollectionVariant | undefined>();
    const [selectorOpen, setSelectorOpen] = useState(false);
    const [companyPickerOpen, setCompanyPickerOpen] = useState(false);
    const [pendingVariant, setPendingVariant] = useState<ExternalVariantStock | null>(null);
    const [quickViewOpen, setQuickViewOpen] = useState(false);
    const [shareDialogOpen, setShareDialogOpen] = useState(false);
    const [shareVariant, setShareVariant] = useState<ShareVariant>(null);

    // Favoritos & comparação
    const addFavorite = useFavoritesStore((s) => s.addFavorite);
    const removeFavorite = useFavoritesStore((s) => s.removeFavorite);
    const isFavorited = useFavoritesStore((s) => s.isFavorite(productId));
    const addToCompare = useComparisonStore((s) => s.addToCompare);
    const removeFromCompare = useComparisonStore((s) => s.removeFromCompare);
    const isInCompare = useComparisonStore((s) => s.isInCompare(productId));
    const canAddToCompare = useComparisonStore((s) => s.canAddMore);

    // Carrinho (orçamento)
    const { carts, addToActiveCart, canCreateCart } = useSellerCartContext();

    // Produto completo (lazy — só busca quando QuickView/Share abrir)
    const needsFullProduct = quickViewOpen || shareDialogOpen;
    const { data: fullProduct } = useProduct(needsFullProduct ? productId : '');

    const markBusy = useCallback(() => {
      /* placeholder — cards leves não bloqueiam navegação aqui */
    }, []);

    const handleFavorite = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setActionsOpen(false);
        if (isFavorited) {
          removeFavorite(productId);
          showUndoToast({
            title: `"${productName}" removido dos favoritos`,
            onUndo: () => addFavorite(productId),
          });
        } else {
          setVariantPickerMode('favorite');
          setVariantPickerOpen(true);
        }
      },
      [isFavorited, productId, productName, addFavorite, removeFavorite],
    );

    const handleCompare = useCallback(
      (e: React.MouseEvent) => {
        e.stopPropagation();
        setActionsOpen(false);
        if (isInCompare) {
          removeFromCompare(productId);
          showUndoToast({
            title: `"${productName}" removido da comparação`,
            onUndo: () => addToCompare(productId),
          });
        } else {
          setVariantPickerMode('compare');
          setVariantPickerOpen(true);
        }
      },
      [isInCompare, productId, productName, addToCompare, removeFromCompare],
    );

    const handleVariantComplete = useCallback(
      (variant: ExternalVariantStock | null) => {
        const variantInfo = variant
          ? {
              color_name: variant.color_name,
              color_hex: variant.color_hex,
              size_code: variant.size_code,
              variant_id: variant.id,
              thumbnail: variant.selected_thumbnail,
            }
          : undefined;

        if (variantPickerMode === 'favorite') {
          addFavorite(productId, variantInfo);
          feedback.light();
          toast.success(
            `"${productName}" favoritado${variant?.color_name ? ` — ${variant.color_name}` : ''}`,
          );
        } else if (variantPickerMode === 'compare') {
          const ok = addToCompare(productId, variantInfo);
          if (!ok) {
            feedback.error();
            showErrorToast({ title: 'Limite de 4 produtos para comparação atingido' });
          } else {
            feedback.light();
            toast.success(
              `"${productName}" adicionado à comparação${variant?.color_name ? ` — ${variant.color_name}` : ''}`,
            );
          }
        } else if (variantPickerMode === 'collection') {
          setCollectionVariant(variantInfo);
          setCollectionModalOpen(true);
        } else if (variantPickerMode === 'quote') {
          // FIX 2026-06-15: espelha ProductCard.tsx — sempre abre diálogo para
          // permitir criar um carrinho para outro cliente naquele momento.
          // ANTES: addToActiveCart diretamente (toast de erro silencioso se 0 carrinhos)
          // DEPOIS: 0 carrinhos → CartCompanyPickerDialog | 1+ carrinhos → CartSelectorDialog
          setPendingVariant(variant);
          if (carts.length === 0) {
            setCompanyPickerOpen(true);
          } else {
            setSelectorOpen(true);
          }
        } else if (variantPickerMode === 'share') {
          setShareVariant(
            variant
              ? {
                  variantName: variant.color_name,
                  colorHex: variant.color_hex,
                  thumbnailUrl: variant.selected_thumbnail,
                }
              : null,
          );
          setShareDialogOpen(true);
        }
      },
      [variantPickerMode, productId, productName, addFavorite, addToCompare, carts],
    );

    return (
      <>
        <ProductCardActions
          productId={productId}
          productName={productName}
          productSku={productSku}
          productImageUrl={productImageUrl}
          productPrice={productPrice}
          productMinQuantity={productMinQuantity}
          isFavorited={isFavorited}
          isInCompare={isInCompare}
          canAddToCompare={canAddToCompare}
          actionsOpen={actionsOpen}
          isOutOfStock={isOutOfStock}
          onToggleActions={() => setActionsOpen((v) => !v)}
          onFavorite={handleFavorite}
          onCompare={handleCompare}
          onOpenVariantPicker={(mode) => {
            setActionsOpen(false);
            setVariantPickerMode(mode);
            setVariantPickerOpen(true);
          }}
          onQuickView={() => {
            setActionsOpen(false);
            setQuickViewOpen(true);
          }}
          markBusy={markBusy}
        />

        <VariantPickerDialog
          open={variantPickerOpen}
          onOpenChange={setVariantPickerOpen}
          productId={productId}
          productName={productName}
          mode={variantPickerMode}
          onComplete={handleVariantComplete}
        />

        {/* Seletor de carrinho existente (1+ carrinhos) */}
        <CartSelectorDialog
          open={selectorOpen}
          onOpenChange={setSelectorOpen}
          carts={carts}
          productName={productName}
          canCreateMore={canCreateCart}
          onSelect={(cartId) => {
            addToActiveCart(
              {
                product_id: productId,
                product_name: productName,
                product_sku: productSku || undefined,
                product_image_url:
                  pendingVariant?.selected_thumbnail || productImageUrl || undefined,
                product_price: productPrice ?? 0,
                quantity: productMinQuantity,
                color_name: pendingVariant?.color_name || undefined,
                color_hex: pendingVariant?.color_hex || undefined,
              },
              cartId,
            );
            setSelectorOpen(false);
            setPendingVariant(null);
          }}
          onCreateNew={() => {
            // Mantém pendingVariant — será adicionado ao novo carrinho
            setSelectorOpen(false);
            setCompanyPickerOpen(true);
          }}
        />

        {/* Picker de empresa — cria carrinho na hora e adiciona o item pendente
          FIX 2026-06-15: adicionado para paridade com ProductCard.tsx (0-cart case) */}
        <CartCompanyPickerDialog
          open={companyPickerOpen}
          onOpenChange={(o) => {
            setCompanyPickerOpen(o);
            if (!o) setPendingVariant(null);
          }}
          onCreated={(newCartId) => {
            if (newCartId) {
              addToActiveCart(
                {
                  product_id: productId,
                  product_name: productName,
                  product_sku: productSku || undefined,
                  product_image_url:
                    pendingVariant?.selected_thumbnail || productImageUrl || undefined,
                  product_price: productPrice ?? 0,
                  quantity: productMinQuantity,
                  color_name: pendingVariant?.color_name || undefined,
                  color_hex: pendingVariant?.color_hex || undefined,
                },
                newCartId,
              );
            }
            setPendingVariant(null);
          }}
        />

        <AddToCollectionModal
          open={collectionModalOpen}
          onOpenChange={setCollectionModalOpen}
          productId={productId}
          productName={productName}
          variant={collectionVariant}
        />

        {/* QuickView e Share precisam do Product completo — só renderiza quando carregado */}
        {quickViewOpen && (
          <ProductQuickView
            product={fullProduct ?? null}
            open={quickViewOpen}
            onOpenChange={setQuickViewOpen}
            isFavorited={isFavorited}
            onToggleFavorite={(pid) => (isFavorited ? removeFavorite(pid) : addFavorite(pid))}
            isInCompare={isInCompare}
            onToggleCompare={(pid) => (isInCompare ? removeFromCompare(pid) : addToCompare(pid))}
          />
        )}

        {shareDialogOpen && fullProduct && (
          <SharePreviewDialog
            open={shareDialogOpen}
            onOpenChange={setShareDialogOpen}
            product={fullProduct}
            selectedVariant={shareVariant}
          />
        )}
      </>
    );
  },
);
