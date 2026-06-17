import { dbInvoke } from '@/lib/db/postgrest';
import { useState, useEffect, useCallback } from 'react';
import confetti from 'canvas-confetti';
import { useSearchParams } from 'react-router-dom';
import {
  transformToKitItem,
  useCustomKitPersistence,
  useDuplicateKitDetector,
  useKitAutoSave,
  useKitBuilder,
  useKitUndoRedo,
  useTemplateSnapshot,
} from '@/hooks/kit-builder';
import { useKitBuilderQuote } from '@/pages/kit-builder/useKitBuilderQuote';
import { calculateTotalKitPrice, type ExternalProductForKit } from '@/lib/kit-builder';
import { logger } from '@/lib/logger';

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
    setBoxFilters,
    setItemFilters,
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
    restoreKitSnapshot,
  } = useKitBuilder();

  const { isSaving } = useCustomKitPersistence();
  useTemplateSnapshot();
  const { handleAddToQuote, isCreatingQuote } = useKitBuilderQuote();
  const {
    lastSavedAt,
    isSaving: isAutoSaving,
    autoSavedKitId,
  } = useKitAutoSave(kitState, kitQuantity, currentKitId, (id) => setCurrentKitId(id));
  const {
    pushSnapshot,
    undo: undoSnapshot,
    redo: redoSnapshot,
    canUndo,
    canRedo,
    isRestoring,
  } = useKitUndoRedo();
  useDuplicateKitDetector();

  // Captura snapshot a cada mudança significativa do kit. O pushSnapshot
  // deduplica snapshots idênticos e respeita isRestoring (o próprio undo/redo
  // não gera novo snapshot). Isto liga o undo/redo, que antes era inerte
  // (pushSnapshot nunca era chamado → canUndo sempre false).
  useEffect(() => {
    if (isRestoring.current) return;
    pushSnapshot({
      name: kitState.name,
      kitType: kitState.kitType,
      box: kitState.box,
      items: kitState.items,
      personalization: kitState.personalization,
      kitQuantity,
      identity: kitState.identity,
    });
  }, [
    kitState.name,
    kitState.kitType,
    kitState.box,
    kitState.items,
    kitState.personalization,
    kitState.identity,
    kitQuantity,
    pushSnapshot,
    isRestoring,
  ]);

  // undo/redo aplicam o snapshot retornado de volta no estado do kit.
  const undo = useCallback(() => {
    const snap = undoSnapshot();
    if (snap) restoreKitSnapshot(snap);
  }, [undoSnapshot, restoreKitSnapshot]);

  const redo = useCallback(() => {
    const snap = redoSnapshot();
    if (snap) restoreKitSnapshot(snap);
  }, [redoSnapshot, restoreKitSnapshot]);

  // Load Logic (Simplified for the pattern example)
  useEffect(() => {
    if (productIdParam && !kitIdParam) {
      (async () => {
        try {
          const result = await dbInvoke<ExternalProductForKit>({
            table: 'products',
            operation: 'select',
            filters: { id: productIdParam },
            limit: 1,
          });
          if (result.records?.length > 0) {
            addItem(transformToKitItem(result.records[0]));
            setKitName(result.records[0].name ?? '');
          }
        } catch (err) {
          logger.warn('[kit-builder] Failed to load product:', err);
        }
      })();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [productIdParam, kitIdParam]);

  // Effects (Confetti, Title, etc.)
  useEffect(() => {
    if (kitState.isValid && kitState.items.length > 0) {
      confetti({ particleCount: 60, spread: 70, origin: { y: 0.85, x: 0.5 }, colors: ['#f97316'] });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
      setBoxFilters,
      setItemFilters,
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
