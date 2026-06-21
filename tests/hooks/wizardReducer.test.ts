/**
 * Tests for the simulator wizard reducer (src/hooks/simulator/wizardReducer.ts).
 *
 * Focus on regressions fixed in the Simulador audit:
 *  - LOAD_DRAFT restores personalizations (previously saved but never restored,
 *    because the load path went through SELECT_PRODUCT which wipes them).
 *  - ADD_PERSONALIZATION re-indexes from the reducer array, so confirming several
 *    techniques in one synchronous loop yields 1..N indices (not duplicates).
 */
import { describe, it, expect } from 'vitest';
import { wizardReducer, initialState } from '@/hooks/simulator/wizardReducer';
import type {
  Personalization,
  SelectedProduct,
  SimulatorWizardState,
} from '@/types/domain/simulator-wizard';

const product: SelectedProduct = { id: 'p1', name: 'Caneta', sku: '12638', price: 1.5 };

const makePers = (id: string, techId: string): Personalization =>
  ({
    id,
    index: 99, // deliberately wrong — reducer must re-index
    location: { id: `loc-${techId}`, locationName: 'Lado A' },
    technique: { id: techId, code: techId, name: techId },
    specs: { colors: 1, width: 5, height: 5 },
    pricing: {
      unitPrice: 1,
      setupPrice: 0,
      subtotal: 1,
      totalPrice: 10,
      costPerUnit: 0.1,
      budgetCode: 'X',
      productionDays: null,
    },
  }) as unknown as Personalization;

describe('wizardReducer — LOAD_DRAFT', () => {
  it('restores product, quantity AND personalizations atomically', () => {
    const pers = [makePers('a', 't1'), makePers('b', 't2')];
    const next = wizardReducer(initialState, {
      type: 'LOAD_DRAFT',
      payload: { product, quantity: 250, personalizations: pers },
    });
    expect(next.selectedProduct).toEqual(product);
    expect(next.quantity).toBe(250);
    expect(next.personalizations).toHaveLength(2);
    // re-indexed 1..N regardless of the saved index
    expect(next.personalizations.map((p) => p.index)).toEqual([1, 2]);
    expect(next.currentStep).toBe('comparison'); // has personalizations → summary view
    expect(next.currentPersonalizationIndex).toBe(1);
  });

  it('lands on the location step when the draft has no personalizations', () => {
    const next = wizardReducer(initialState, {
      type: 'LOAD_DRAFT',
      payload: { product, quantity: 100, personalizations: [] },
    });
    expect(next.currentStep).toBe('location');
    expect(next.personalizations).toEqual([]);
  });
});

describe('wizardReducer — ADD_PERSONALIZATION', () => {
  it('re-indexes appended personalizations to 1..N (no duplicate indices)', () => {
    let state: SimulatorWizardState = initialState;
    state = wizardReducer(state, { type: 'ADD_PERSONALIZATION', payload: makePers('a', 't1') });
    state = wizardReducer(state, { type: 'ADD_PERSONALIZATION', payload: makePers('b', 't2') });
    state = wizardReducer(state, { type: 'ADD_PERSONALIZATION', payload: makePers('c', 't3') });
    expect(state.personalizations.map((p) => p.index)).toEqual([1, 2, 3]);
    expect(state.currentPersonalizationIndex).toBe(2);
    expect(state.currentStep).toBe('comparison');
  });
});
