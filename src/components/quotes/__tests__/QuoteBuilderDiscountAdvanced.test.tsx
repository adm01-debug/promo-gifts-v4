import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { QuoteBuilderSummaryColumn } from '../QuoteBuilderSummaryColumn';
import type { QuoteItem } from '@/hooks/quotes';

describe('QuoteBuilderSummaryColumn Advanced Discount Scenarios', () => {
  const formatCurrency = (v: number) =>
    `R$ ${v.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;

  const defaultProps = {
    items: [
      {
        id: '1',
        product_name: 'Item 1',
        quantity: 1,
        unit_price: 1000,
        product_sku: 'SKU-1',
      } as unknown as QuoteItem,
    ],
    activeItemIndex: null,
    setActiveItemIndex: vi.fn(),
    removeItem: vi.fn(),
    discountType: 'percent' as const,
    setDiscountType: vi.fn(),
    discountValue: 0,
    setDiscountValue: vi.fn(),
    discountAmount: 0,
    total: 1000,
    isFormValid: true,
    isDraftValid: true,
    validationErrors: [],
    quotesLoading: false,
    isEditMode: false,
    formatCurrency,
    calculateItemPersonalizationTotal: () => 0,
    calculateItemTotal: () => 1000,
    onSave: vi.fn(),
    realSubtotal: 1000,
    negotiationMarkup: 0,
  };

  it('validates % discount exceeds 100% in UI', async () => {
    const setDiscountValue = vi.fn();
    render(<QuoteBuilderSummaryColumn {...defaultProps} setDiscountValue={setDiscountValue} />);

    const input = screen.getByTestId('quote-discount-input');
    fireEvent.change(input, { target: { value: '110' } });

    // CurrencyInput should show range error
    expect(await screen.findByText(/Valor máximo é 100,00/)).toBeInTheDocument();
  });

  it('validates amount discount exceeds subtotal in UI', async () => {
    const setDiscountValue = vi.fn();
    render(
      <QuoteBuilderSummaryColumn
        {...defaultProps}
        discountType="amount"
        setDiscountValue={setDiscountValue}
      />,
    );

    const input = screen.getByTestId('quote-discount-input');
    fireEvent.change(input, { target: { value: '1500' } });

    expect(await screen.findByText(/Valor máximo é/)).toBeInTheDocument();
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes('1.000,00'))).toBe(true);
  });

  it('uses presentedSubtotal (with markup) as limit for amount discount', async () => {
    const setDiscountValue = vi.fn();
    // 1000 subtotal + 10% markup = 1100 presentedSubtotal
    render(
      <QuoteBuilderSummaryColumn
        {...defaultProps}
        negotiationMarkup={10}
        realSubtotal={1000}
        discountType="amount"
        setDiscountValue={setDiscountValue}
      />,
    );

    const input = screen.getByTestId('quote-discount-input');

    // Should allow 1100
    fireEvent.change(input, { target: { value: '1100' } });
    expect(screen.queryByText(/Valor máximo é/)).not.toBeInTheDocument();

    // Should block 1101
    fireEvent.change(input, { target: { value: '1101' } });
    expect(await screen.findByText(/Valor máximo é/)).toBeInTheDocument();
    const alerts = await screen.findAllByRole('alert');
    expect(alerts.some((a) => a.textContent?.includes('1.100,00'))).toBe(true);
  });

  it('maintains rounding stability during conversion % <-> R$', () => {
    const round2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
    const presentedSubtotal = 1234.56;

    // Start with a tricky percentage
    const initialPct = 12.34;

    // % -> R$
    const amountValue = round2(presentedSubtotal * (initialPct / 100));
    // 1234.56 * 0.1234 = 152.344704 -> 152.34
    expect(amountValue).toBe(152.34);

    // R$ -> %
    const backToPct = round2((amountValue / presentedSubtotal) * 100);
    // (152.34 / 1234.56) * 100 = 12.3396... -> 12.34
    expect(backToPct).toBe(12.34);

    // Verify no oscillation after second round-trip
    const againAmount = round2(presentedSubtotal * (backToPct / 100));
    expect(againAmount).toBe(152.34);
  });
});
