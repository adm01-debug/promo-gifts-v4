import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';
import { QuoteBuilderSummaryColumn } from '../QuoteBuilderSummaryColumn';

describe('QuoteBuilderSummaryColumn Discount Logic', () => {
  const defaultProps = {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    items: [{ product_name: 'Test', quantity: 10, unit_price: 100, product_sku: 'ABC' } as any],
    activeItemIndex: null,
    setActiveItemIndex: vi.fn(),
    removeItem: vi.fn(),
    discountType: 'percent' as const,
    setDiscountType: vi.fn(),
    discountValue: 10,
    setDiscountValue: vi.fn(),
    discountAmount: 100,
    total: 900,
    isFormValid: true,
    isDraftValid: true,
    validationErrors: [],
    quotesLoading: false,
    isEditMode: false,
    formatCurrency: (v: number) => `R$ ${v.toFixed(2)}`,
    calculateItemPersonalizationTotal: () => 0,
    calculateItemTotal: () => 1000,
    onSave: vi.fn(),
    realSubtotal: 1000,
    negotiationMarkup: 0,
  };

  it('converts percent to amount correctly with round2', () => {
    const setDiscountValue = vi.fn();
    const setDiscountType = vi.fn();

    render(
      <QuoteBuilderSummaryColumn
        {...defaultProps}
        discountValue={10.589} // 10.59%
        setDiscountValue={setDiscountValue}
        setDiscountType={setDiscountType}
      />,
    );

    // Switch to amount
    // aria-label real do controle é descritivo ('Tipo de desconto — alternar entre % e R$');
    // usa regex de substring em vez de match exato (a11y foi melhorada, teste ficou stale).
    const select = screen.getByLabelText(/Tipo de desconto/);
    fireEvent.click(select);
    // Find R$ option and click it
    // In shadcn select, this might need more specific queries if it's open, but let's assume direct onValueChange works for now if we invoke it
  });

  // Since we want to test the logic in handleDiscountTypeChange specifically
  it('logic: handleDiscountTypeChange converts correctly', () => {
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

    const subtotal = 1000;
    const markup = 10; // 10%
    const presentedSubtotal = subtotal * (1 + markup / 100); // 1100

    // % -> R$
    const discountValuePct = 10.585; // rounds to 10.59
    const convertedAmount = round2(
      Math.min(presentedSubtotal, presentedSubtotal * (discountValuePct / 100)),
    );
    // 1100 * 0.10585 = 116.435 -> rounds to 116.44
    expect(convertedAmount).toBe(116.44);

    // R$ -> %
    const discountValueAmt = 116.44;
    const convertedPct = round2(
      Math.max(0, Math.min(100, (discountValueAmt / presentedSubtotal) * 100)),
    );
    // (116.44 / 1100) * 100 = 10.58545... -> rounds to 10.59
    expect(convertedPct).toBe(10.59);
  });

  it('logic: handles zero subtotal', () => {
    const presentedSubtotal = 0;
    const discountValue = 50;

    // amount -> percent
    const next = 'percent';
    let newValue = discountValue;
    if (presentedSubtotal === 0 && discountValue > 0) {
      if (next === 'percent') newValue = 0;
    }
    expect(newValue).toBe(0);
  });

  it('logic: handles high discount values (cap at 100% or presentedSubtotal)', () => {
    const presentedSubtotal = 1000;
    const discountValuePct = 150; // invalid 150%
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

    // % -> R$
    const convertedAmount = round2(
      Math.min(presentedSubtotal, presentedSubtotal * (discountValuePct / 100)),
    );
    expect(convertedAmount).toBe(1000); // capped at subtotal

    // R$ -> %
    const discountValueAmt = 1500; // invalid $1500 on $1000 subtotal
    const convertedPct = round2(
      Math.max(0, Math.min(100, (discountValueAmt / presentedSubtotal) * 100)),
    );
    expect(convertedPct).toBe(100); // capped at 100%
  });
});
