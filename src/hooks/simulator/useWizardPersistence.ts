/**
 * useWizardPersistence - localStorage session management for simulator wizard
 */

import { useEffect } from 'react';
import type { SimulatorWizardState } from '@/types/domain/simulator-wizard';

const STORAGE_KEY = 'simulator_wizard_session';
const SESSION_TTL = 2 * 60 * 60 * 1000; // 2 hours

export function saveSession(state: SimulatorWizardState) {
  try {
    const toSave = {
      selectedProduct: state.selectedProduct,
      quantity: state.quantity,
      personalizations: state.personalizations,
      currentStep: state.currentStep,
      savedAt: Date.now(),
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(toSave));
  } catch {
    /* quota exceeded or private mode */
  }
}

export function loadSession(): Partial<SimulatorWizardState> | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const saved = JSON.parse(raw);
    if (Date.now() - saved.savedAt > SESSION_TTL) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return {
      selectedProduct: saved.selectedProduct,
      quantity: saved.quantity,
      personalizations: saved.personalizations ?? [],
      currentStep: saved.selectedProduct ? saved.currentStep || 'location' : 'product',
    };
  } catch {
    return null;
  }
}

export function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
}

/**
 * Hook to auto-save wizard state to localStorage on relevant changes
 */
export function useWizardPersistence(state: SimulatorWizardState) {
  useEffect(() => {
    if (state.selectedProduct) {
      saveSession(state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.selectedProduct, state.quantity, state.personalizations, state.currentStep]);
}
