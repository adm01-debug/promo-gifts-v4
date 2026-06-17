/**
 * CatalogBulkModals — Renders BulkActionBar + all bulk modals.
 * Single source instead of 3x duplication.
 */
import { BulkActionBar } from '@/components/products/BulkActionBar';
import { AddToCollectionModal } from '@/components/collections/AddToCollectionModal';
import { BulkAddToCartModal } from '@/components/catalog/BulkAddToCartModal';
import { BulkVariantWizard } from '@/components/catalog/BulkVariantWizard';
import type { useCatalogSelection } from './useCatalogSelection';

type Sel = ReturnType<typeof useCatalogSelection>;

interface CatalogBulkModalsProps {
  sel: Sel;
  selectionMode?: boolean;
  totalCount: number;
}

export function CatalogBulkModals({ sel, selectionMode, totalCount }: CatalogBulkModalsProps) {
  // Guard against undefined sel to prevent crash while loading
  if (!sel) return null;

  return (
    <>
      {selectionMode && (
        <BulkActionBar
          selectedCount={sel.selectedIds?.size || 0}
          totalCount={totalCount}
          onSelectAll={sel.selectAll}
          onClearSelection={sel.clearSelection}
          onBulkFavorite={sel.handleBulkFavorite}
          onBulkCompare={sel.handleBulkCompare}
          onBulkCollection={sel.handleBulkCollection}
          onBulkQuote={sel.handleBulkQuote}
          onBulkCart={sel.handleBulkCart}
          onBulkPDF={sel.handleBulkPDF}
          selectedTotalValue={sel.selectedTotalValue || 0}
        />
      )}

      {sel.firstSelectedProduct && (
        <AddToCollectionModal
          open={sel.collectionModalOpen}
          onOpenChange={(open) => {
            sel.setCollectionModalOpen(open);
            if (!open) sel.clearSelection();
          }}
          productId={sel.firstSelectedId}
          productName={`${sel.selectedIds?.size || 0} produtos selecionados`}
        />
      )}

      <BulkAddToCartModal
        open={sel.cartModalOpen}
        onOpenChange={sel.setCartModalOpen}
        products={sel.bulkCartProducts ?? []}
        variantSelections={sel.wizardSelections ?? []}
        onDone={sel.clearSelection}
      />

      <BulkVariantWizard
        open={sel.variantWizardOpen}
        onOpenChange={sel.setVariantWizardOpen}
        products={sel.bulkCartProducts ?? []}
        mode={sel.wizardMode || 'cart'}
        onComplete={sel.handleWizardComplete}
      />
    </>
  );
}
