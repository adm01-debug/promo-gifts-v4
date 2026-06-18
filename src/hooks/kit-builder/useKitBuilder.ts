/**
 * Kit Builder Hook
 * Gerencia o estado completo do montador de kits
 * Queries are isolated in useKitBuilderQueries to prevent React fiber corruption.
 */

import { useState, useCallback, useMemo } from 'react';
import { toast } from 'sonner';
import {
  type KitBox,
  type KitItem,
  type KitState,
  type KitType,
  type KitIdentity,
  type KitPersonalization,
  type KitItemPersonalization,
  type KitBuilderStep,
  type KitBuilderWizardState,
  type CompatibilityResult,
  calculateTotalItemsVolume,
  calculateVolumeUsagePercent,
  calculateUsableVolume,
  checkItemFits,
  calculateTotalKitPrice,
} from '@/lib/kit-builder';
import { useKitBuilderQueries } from '@/hooks/kit-builder/useKitBuilderQueries';
import type { KitSnapshot } from '@/hooks/kit-builder/useKitUndoRedo';

// ============================================
// HOOK PRINCIPAL
// ============================================

export function useKitBuilder() {
  // Estado do kit
  const [kitName, setKitName] = useState('');
  const [kitType, setKitType] = useState<KitType>('montado');
  const [selectedBox, setSelectedBox] = useState<KitBox | null>(null);
  const [selectedItems, setSelectedItems] = useState<KitItem[]>([]);
  const [personalization, setPersonalization] = useState<KitPersonalization>({
    box: { enabled: false },
    items: {},
  });
  const [kitQuantity, setKitQuantity] = useState(1);
  const [identity, setIdentity] = useState<KitIdentity>({
    color: '#3B82F6',
    icon: 'Package',
    tag: '',
    description: '',
    isFavorite: false,
  });

  // Estado do wizard
  const [currentStep, setCurrentStep] = useState<KitBuilderStep>('box');

  // Queries isoladas em hook separado
  const {
    availableBoxes,
    availableItems,
    isLoadingBoxes,
    isLoadingItems,
    boxFilters,
    itemFilters,
    setBoxFilters,
    setItemFilters,
  } = useKitBuilderQueries();

  // ============================================
  // CÁLCULOS DERIVADOS
  // ============================================

  const kitState = useMemo((): KitState => {
    const totalItemsVolume = calculateTotalItemsVolume(selectedItems);
    const boxVolume = selectedBox?.internalVolume ?? 0;
    const usableVolume = selectedBox ? calculateUsableVolume(selectedBox) : 0;
    const availableVolume = Math.max(0, usableVolume - totalItemsVolume);
    const volumeUsagePercent = calculateVolumeUsagePercent(totalItemsVolume, boxVolume);

    const boxWeight = selectedBox?.weight ?? 0;
    const itemsWeight = selectedItems.reduce(
      (sum, item) => sum + (item.weight ?? 0) * item.quantity,
      0,
    );
    const totalWeight = boxWeight + itemsWeight;

    const pricing = calculateTotalKitPrice(
      selectedBox,
      selectedItems,
      personalization,
      kitQuantity,
    );

    const validationErrors: string[] = [];
    if (!selectedBox) validationErrors.push('Selecione uma caixa');
    if (selectedItems.length === 0) validationErrors.push('Adicione pelo menos um item ao kit');
    if (volumeUsagePercent > 100)
      validationErrors.push('Volume dos itens excede a capacidade da caixa');

    // Weight validation
    if (selectedBox?.maxWeight && itemsWeight > selectedBox.maxWeight) {
      validationErrors.push(
        `Peso dos itens (${(itemsWeight / 1000).toFixed(1)}kg) excede o limite da caixa (${(selectedBox.maxWeight / 1000).toFixed(1)}kg)`,
      );
    }

    return {
      name: kitName,
      kitType,
      box: selectedBox,
      items: selectedItems,
      personalization,
      identity,
      totalItemsVolume,
      availableVolume,
      volumeUsagePercent,
      totalWeight,
      boxPrice: pricing.boxPrice,
      itemsPrice: pricing.itemsPrice,
      personalizationPrice: pricing.personalizationPrice,
      totalPrice: pricing.total,
      isValid: validationErrors.length === 0,
      validationErrors,
    };
  }, [kitName, kitType, selectedBox, selectedItems, personalization, kitQuantity, identity]);

  const wizardState = useMemo((): KitBuilderWizardState => {
    const completedSteps: KitBuilderStep[] = [];

    if (selectedBox) completedSteps.push('box');
    if (selectedItems.length > 0) completedSteps.push('items');

    const hasPersonalizationConfig =
      Object.keys(personalization.items).length > 0 || personalization.box.enabled;
    if (hasPersonalizationConfig || currentStep === 'summary') {
      completedSteps.push('personalization');
    }

    let canProceed = false;
    switch (currentStep) {
      case 'box':
        canProceed = selectedBox !== null;
        break;
      case 'items':
        canProceed = selectedItems.length > 0 && kitState.volumeUsagePercent <= 100;
        break;
      case 'personalization':
        canProceed = true;
        break;
      case 'summary':
        canProceed = kitState.isValid;
        break;
    }

    return {
      currentStep,
      completedSteps,
      canProceed,
    };
  }, [currentStep, selectedBox, selectedItems, personalization, kitState]);

  // ============================================
  // AÇÕES
  // ============================================

  const selectBox = useCallback((box: KitBox) => {
    setSelectedBox(box);
  }, []);

  const clearBox = useCallback(() => {
    setSelectedBox(null);
    setSelectedItems([]);
    setPersonalization({ box: { enabled: false }, items: {} });
  }, []);

  const addItem = useCallback(
    (item: KitItem): CompatibilityResult => {
      if (!selectedBox) {
        return { fits: false, reason: 'Selecione uma caixa primeiro' };
      }

      const existingIndex = selectedItems.findIndex((i) => i.id === item.id);
      if (existingIndex >= 0) {
        const updatedItems = [...selectedItems];
        const newQuantity = updatedItems[existingIndex].quantity + 1;

        const result = checkItemFits(
          { ...item, quantity: 1 },
          selectedBox,
          selectedItems.filter((_, i) => i !== existingIndex),
          newQuantity,
        );

        if (result.fits) {
          updatedItems[existingIndex] = {
            ...updatedItems[existingIndex],
            quantity: newQuantity,
          };
          setSelectedItems(updatedItems);
        }

        return result;
      }

      const result = checkItemFits(item, selectedBox, selectedItems, 1);

      if (result.fits) {
        setSelectedItems((prev) => [...prev, { ...item, quantity: 1 }]);
      }

      return result;
    },
    [selectedBox, selectedItems],
  );

  const removeItem = useCallback((itemId: string) => {
    setSelectedItems((prev) => prev.filter((i) => i.id !== itemId));
    setPersonalization((prev) => {
      const { [itemId]: _, ...rest } = prev.items;
      return { ...prev, items: rest };
    });
  }, []);

  const updateItemQuantity = useCallback(
    (itemId: string, quantity: number) => {
      if (quantity <= 0) {
        removeItem(itemId);
        return;
      }

      if (selectedBox) {
        const item = selectedItems.find((i) => i.id === itemId);
        if (item && quantity > item.quantity) {
          const otherItems = selectedItems.filter((i) => i.id !== itemId);
          const result = checkItemFits(item, selectedBox, otherItems, quantity);
          if (!result.fits) {
            toast.warning('Volume excedido', {
              description: result.reason || 'Essa quantidade não cabe na caixa selecionada.',
            });
            return;
          }
        }
      }

      setSelectedItems((prev) =>
        prev.map((item) => (item.id === itemId ? { ...item, quantity } : item)),
      );
    },
    [removeItem, selectedBox, selectedItems],
  );

  const updateItemVariant = useCallback(
    (
      itemId: string,
      variantData: {
        color: { name: string; hex?: string };
        size?: string;
        sku?: string;
        imageUrl?: string | null;
        price?: number;
      },
    ) => {
      setSelectedItems((prev) =>
        prev.map((item) => {
          if (item.id !== itemId) return item;
          return {
            ...item,
            selectedColor: variantData.color,
            selectedSize: variantData.size || undefined,
            ...(variantData.sku && { sku: variantData.sku }),
            ...(variantData.imageUrl !== undefined && { imageUrl: variantData.imageUrl }),
            ...(variantData.price !== undefined && { price: variantData.price }),
          };
        }),
      );
    },
    [],
  );

  const updateItemColor = useCallback((itemId: string, color: { name: string; hex?: string }) => {
    setSelectedItems((prev) =>
      prev.map((item) => (item.id === itemId ? { ...item, selectedColor: color } : item)),
    );
  }, []);

  const toggleOptionalItem = useCallback((itemId: string, item?: KitItem) => {
    setSelectedItems((prev) => {
      const exists = prev.find((i) => i.id === itemId);
      if (exists) {
        return prev.filter((i) => i.id !== itemId);
      }
      if (item) {
        return [...prev, { ...item, quantity: 1 }];
      }
      return prev;
    });
  }, []);

  const setItemPersonalization = useCallback((itemId: string, config: KitItemPersonalization) => {
    setPersonalization((prev) => ({
      ...prev,
      items: {
        ...prev.items,
        [itemId]: config,
      },
    }));
  }, []);

  const setBoxPersonalization = useCallback((config: KitItemPersonalization) => {
    setPersonalization((prev) => ({
      ...prev,
      box: config,
    }));
  }, []);

  const goToStep = useCallback((step: KitBuilderStep) => {
    setCurrentStep(step);
  }, []);

  const nextStep = useCallback(() => {
    const steps: KitBuilderStep[] = ['box', 'items', 'personalization', 'summary'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex < steps.length - 1) {
      setCurrentStep(steps[currentIndex + 1]);
    }
  }, [currentStep]);

  const prevStep = useCallback(() => {
    const steps: KitBuilderStep[] = ['box', 'items', 'personalization', 'summary'];
    const currentIndex = steps.indexOf(currentStep);
    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
    }
  }, [currentStep]);

  const reorderItems = useCallback((fromIndex: number, toIndex: number) => {
    setSelectedItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });
  }, []);

  const resetKit = useCallback(() => {
    setKitName('');
    setKitType('montado');
    setSelectedBox(null);
    setSelectedItems([]);
    setPersonalization({ box: { enabled: false }, items: {} });
    setKitQuantity(1);
    setIdentity({ color: '#3B82F6', icon: 'Package', tag: '', description: '', isFavorite: false });
    setCurrentStep('box');
  }, []);

  /** Load a saved kit (from custom_kits JSONB snapshots) into the wizard */
  const loadKit = useCallback(
    (data: {
      name: string;
      kitType: KitType;
      box: KitBox | null;
      items: KitItem[];
      personalization: KitPersonalization;
      kitQuantity: number;
      identity?: KitIdentity;
    }) => {
      setKitName(data.name);
      setKitType(data.kitType);
      setSelectedBox(data.box);
      setSelectedItems(data.items);
      setPersonalization(data.personalization || { box: { enabled: false }, items: {} });
      setKitQuantity(data.kitQuantity || 1);
      if (data.identity) {
        setIdentity({
          color: data.identity.color || '#3B82F6',
          icon: data.identity.icon || 'Package',
          tag: data.identity.tag ?? '',
          description: data.identity.description ?? '',
          isFavorite: data.identity.isFavorite ?? false,
        });
      }
      setCurrentStep('summary');
    },
    [],
  );

  /**
   * Restaura um snapshot completo (undo/redo). Diferente de `loadKit`, NÃO
   * força o passo "summary" — undo/redo preserva o passo atual do usuário.
   */
  const restoreKitSnapshot = useCallback((snap: KitSnapshot) => {
    setKitName(snap.name);
    setKitType(snap.kitType);
    setSelectedBox(snap.box);
    setSelectedItems(snap.items);
    setPersonalization(snap.personalization ?? { box: { enabled: false }, items: {} });
    setKitQuantity(snap.kitQuantity || 1);
    if (snap.identity) setIdentity(snap.identity);
  }, []);

  // ============================================
  // FILTROS COM COMPATIBILIDADE
  // ============================================

  const itemsWithCompatibility = useMemo(() => {
    if (!selectedBox)
      return availableItems.map((item) => ({
        ...item,
        compatibility: null as CompatibilityResult | null,
      }));

    return availableItems.map((item) => {
      const compatibility = checkItemFits(item, selectedBox, selectedItems, 1);
      return { ...item, compatibility };
    });
  }, [availableItems, selectedBox, selectedItems]);

  const filteredItems = useMemo(() => {
    let items = itemsWithCompatibility;

    if (itemFilters.onlyFitting) {
      items = items.filter((item) => item.compatibility?.fits !== false);
    }

    if (itemFilters.maxVolume) {
      items = items.filter((item) => item.volume <= (itemFilters.maxVolume || Infinity));
    }

    if (itemFilters.category) {
      const categoryFilter = itemFilters.category.toLowerCase();
      items = items.filter((item) => item.category?.toLowerCase().includes(categoryFilter));
    }

    return items;
  }, [itemsWithCompatibility, itemFilters]);

  // ============================================
  // RETURN
  // ============================================

  return {
    kitState,
    wizardState,
    kitQuantity,
    availableBoxes,
    availableItems: filteredItems,
    isLoadingBoxes,
    isLoadingItems,
    boxFilters,
    setBoxFilters,
    itemFilters,
    setItemFilters,
    setKitName,
    setKitType,
    selectBox,
    clearBox,
    addItem,
    removeItem,
    updateItemQuantity,
    updateItemColor,
    updateItemVariant,
    toggleOptionalItem,
    reorderItems,
    setItemPersonalization,
    setBoxPersonalization,
    setKitQuantity,
    setIdentity,
    goToStep,
    nextStep,
    prevStep,
    resetKit,
    loadKit,
    restoreKitSnapshot,
  };
}
