import { useState, useEffect } from 'react';
import confetti from 'canvas-confetti';
import { useSearchParams } from 'react-router-dom';
import { transformToKitItem, useCustomKitPersistence, useDuplicateKitDetector, useKitAutoSave, useKitBuilder, useKitUndoRedo, useTemplateSnapshot } from "@/hooks/kit-builder";
import { useKitBuilderQuote } from '@/pages/kit-builder/useKitBuilderQuote';
import { invokeExternalDb, type PromobrindProduct } from '@/lib/external-db';
import { logger } from '@/lib/logger';
import { calculateTotalKitPrice } from '@/lib/kit-builder';

export function useKitBuilderPageState() {
  const [searchParams] = useSearchParams();
  const kitIdParam = searchParams.get('kit');
  const productIdParam = searchParams.get('product');

  const [currentKitId, setCurrentKitId] = useState<string | undefined>(kitIdParam || undefined);
  const [occasion, setOccasion] = useState<string | null>(null);

  const {
    kitState,
    wizardState,
    kitQuantity,
    availableBoxes,
    availableItems,
    isLoadingBoxes,
    isLoadingItems,
    boxFilters,
    itemFilters,
    setKitName,
    selectBox,
    clearBox,
    addItem,
    removeItem,
    updateItemQuantity,
    updateItemVariant,
    reorderItems,
    setItemPersonalization,
    setBoxPersonalization,
    setKitQuantity,
    setIdentity,
    goToStep,
    nextStep,
    prevStep,
    resetKit,
  } = useKitBuilder();

  const { isSaving } = useCustomKitPersistence();
  useTemplateSnapshot();
  const { handleAddToQuote, isCreatingQuote } = useKitBuilderQuote();
  const {
    lastSavedAt,
    isSaving: isAutoSaving,
    autoSavedKitId,
  } = useKitAutoSave(kitState, kitQuantity, currentKitId, (id) => setCurrentKitId(id));
  const { undo, redo, canUndo, canRedo } = useKitUndoRedo();
  useDuplicateKitDetector();

  // Load Logic (Simplified for the pattern example)
  useEffect(() => {
    if (productIdParam && !kitIdParam) {
      (async () => {
        try {
          const result = await invokeExternalDb<PromobrindProduct>({
            table: 'products',
            operation: 'select',
            filters: { id: productIdParam },
            limit: 1,
          });
          if (result.records?.length > 0) {
            addItem(transformToKitItem(result.records[0]));
            setKitName(result.records[0].name || '');
          }
        } catch (err) {
          logger.warn('[kit-builder] Failed to load product:', err);
        }
      })();
    }
  }, [productIdParam, kitIdParam]);

  // Effects (Confetti, Title, etc.)
  useEffect(() => {
    if (kitState.isValid && kitState.items.length > 0) {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.85, x: 0.5 }, colors: ['#f97316'] });
    }
  }, [kitState.isValid]);

  const pricing = calculateTotalKitPrice(
    kitState.box,
    kitState.items,
    kitState.personalization,
    kitQuantity,
  );

  return {
    state: {
      kitState,
      wizardState,
      kitQuantity,
      currentKitId,
      autoSavedKitId,
      availableBoxes,
      availableItems,
      isLoadingBoxes,
      isLoadingItems,
      boxFilters,
      itemFilters,
      occasion,
      setOccasion,
    },
    actions: {
      setKitName,
      selectBox,
      clearBox,
      addItem,
      removeItem,
      updateItemQuantity,
      updateItemVariant,
      reorderItems,
      setItemPersonalization,
      setBoxPersonalization,
      setKitQuantity,
      setIdentity,
      goToStep,
      nextStep,
      prevStep,
      resetKit,
      undo,
      redo,
      canUndo,
      canRedo,
      handleSaveKit: async () => {
        /* save logic */
      },
      handleAddToQuote,
    },
    meta: {
      isSaving,
      isAutoSaving,
      isCreatingQuote,
      lastSavedAt,
      pricing,
    },
  };
}
