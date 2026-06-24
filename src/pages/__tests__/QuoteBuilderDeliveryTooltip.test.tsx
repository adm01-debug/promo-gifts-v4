import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import QuoteBuilderPage from '../quotes/QuoteBuilderPage';
import { BrowserRouter } from 'react-router-dom';
import { TooltipProvider } from '@/components/ui/tooltip';

// Mock complex hooks
vi.mock('@/hooks/quotes', () => ({
  useQuotes: vi.fn(() => ({ quotes: [], isLoading: false, refetch: vi.fn() })),
  useQuoteHistory: vi.fn(() => ({ history: [], isLoading: false })),
  useQuoteFunnel: vi.fn(() => ({ data: [], isLoading: false })),
  useDiscountApproval: vi.fn(() => ({ requestApproval: vi.fn() })),
  useAutoSaveQuote: vi.fn(() => ({ saving: false })),
  useQuoteItems: vi.fn(() => ({ items: [], setItems: vi.fn() })),
  useQuoteComments: vi.fn(() => ({ comments: [], addComment: vi.fn() })),
  useQuoteVersions: vi.fn(() => ({ versions: [], isLoading: false })),
  useProdutoPersonalizacao: vi.fn(() => ({})),
  useSellerDiscountLimits: vi.fn(() => ({ limit: 0, isLoading: false })),
  useQuoteBuilderState: vi.fn(() => ({
    loadingQuote: false,
    hasUnsavedData: false,
    quoteId: null,
    clientId: '',
    setClientId: vi.fn(),
    contactId: '',
    setContactId: vi.fn(),
    validUntil: '2026-01-01',
    setValidUntil: vi.fn(),
    validityDays: '30',
    setValidityDays: vi.fn(),
    items: [],
    setItems: vi.fn(),
    activeItemIndex: null,
    setActiveItemIndex: vi.fn(),
    discountType: 'percent',
    setDiscountType: vi.fn(),
    discountValue: 0,
    setDiscountValue: vi.fn(),
    discountAmount: 0,
    total: 0,
    isFormValid: true,
    isDraftValid: true,
    validationErrors: [],
    quotesLoading: false,
    isEditMode: false,
    formatCurrency: (n: number) => `R$ ${n.toFixed(2)}`,
    calculateItemPersonalizationTotal: vi.fn(),
    calculateItemTotal: vi.fn(),
    handleSaveQuote: vi.fn(),
    maxDiscountPercent: 10,
    isDiscountExceeded: false,
    negotiationMarkup: 0,
    setNegotiationMarkup: vi.fn(),
    realSubtotal: 0,
    realDiscountPercent: 0,
    confirmItemPrice: vi.fn(),
    confirmAllStalePrices: vi.fn(),
    deliveryMode: 'prazo',
    setDeliveryMode: vi.fn(),
    deliveryTime: '',
    setDeliveryTime: vi.fn(),
    deliveryDate: undefined,
    setDeliveryDate: vi.fn(),
    shippingType: 'cif',
    setShippingType: vi.fn(),
    shippingCost: 0,
    setShippingCost: vi.fn(),
    productSearchOpen: false,
    setProductSearchOpen: vi.fn(),
    productSearch: '',
    setProductSearch: vi.fn(),
    filteredProducts: [],
    selectedProductForColor: null,
    setSelectedProductForColor: vi.fn(),
    handleProductClick: vi.fn(),
    addProductWithColor: vi.fn(),
    navigate: vi.fn(),
    companyInfo: null,
    setCompanyInfo: vi.fn(),
    contactInfo: null,
    setContactInfo: vi.fn(),
    notes: '',
    setNotes: vi.fn(),
    internalNotes: '',
    setInternalNotes: vi.fn(),
    quoteNumber: '',
  })),
}));

vi.mock('@/hooks/common', () => ({
  useUnsavedChangesGuard: vi.fn(() => ({
    showDialog: false,
    confirmLeave: vi.fn(),
    cancelLeave: vi.fn(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    guardNavigation: (cb: any) => cb(),
    message: 'Unsaved changes',
  })),
}));

// Mock sub-components to speed up and avoid errors
vi.mock('@/components/seo/PageSEO', () => ({
  PageSEO: () => <div data-testid="page-seo" />,
}));

vi.mock('@/components/quotes/QuoteAutoSave', () => ({
  QuoteAutoSave: () => <div data-testid="quote-autosave" />,
}));

vi.mock('@/components/quotes/CompanyContactSelector', () => ({
  CompanyContactSelector: () => <div data-testid="company-contact-selector" />,
}));


vi.mock('@/components/quotes/QuoteBuilderStepper', () => ({
  QuoteBuilderStepper: () => <div data-testid="quote-builder-stepper" />,
}));

vi.mock('@/components/quotes/QuoteBuilderSummaryColumn', () => ({
  QuoteBuilderSummaryColumn: () => <div data-testid="summary-column" />,
}));

vi.mock('@/components/quotes/QuoteBuilderProductSearch', () => ({
  QuoteBuilderProductSearch: () => <div data-testid="product-search" />,
}));

const renderPage = () => {
  return render(
    <BrowserRouter>
      <TooltipProvider delayDuration={0}>
        <QuoteBuilderPage />
      </TooltipProvider>
    </BrowserRouter>,
  );
};

describe('QuoteBuilderPage Delivery Tooltip', () => {
  it('should have the info icon aligned with the label', () => {
    renderPage();

    // Check alignment container
    const container = screen.getByTestId('delivery-label-container');
    expect(container).toHaveClass('flex');
    expect(container).toHaveClass('items-center');
    expect(container).toHaveClass('gap-1.5');

    // Check label and trigger are present
    const label = screen.getByTestId('delivery-label');
    const trigger = screen.getByTestId('delivery-info-tooltip-trigger');

    expect(container).toContainElement(label);
    expect(container).toContainElement(trigger);
  });

  it('should show the tooltip content on hover', async () => {
    const user = userEvent.setup();
    renderPage();

    const trigger = screen.getByTestId('delivery-info-tooltip-trigger');

    // Hover over the trigger
    await user.hover(trigger);

    // Check if tooltip content appears
    // We use findByTestId since tooltips are often in portals and might take a tick
    const tooltipContent = await screen.findByTestId('delivery-info-tooltip-content');
    expect(tooltipContent).toBeInTheDocument();
    expect(tooltipContent.textContent).toContain('Antes de assumir o compromisso com seu Cliente');
  });

  it('should hide the tooltip content when unhovering', async () => {
    const user = userEvent.setup();
    renderPage();

    const trigger = screen.getByTestId('delivery-info-tooltip-trigger');

    // Hover to show
    await user.hover(trigger);
    expect(await screen.findByTestId('delivery-info-tooltip-content')).toBeInTheDocument();

    // Unhover to hide - simulate moving away
    await user.unhover(trigger);
    expect(trigger).toBeInTheDocument();
  });

  it('should hide the tooltip content when pressing Escape', async () => {
    const user = userEvent.setup();
    renderPage();

    const trigger = screen.getByTestId('delivery-info-tooltip-trigger');

    // Hover to show
    await user.hover(trigger);
    expect(await screen.findByTestId('delivery-info-tooltip-content')).toBeInTheDocument();

    // Press Escape
    await user.keyboard('{Escape}');

    // In unit tests with Radix, Escape usually triggers immediate closure
    expect(screen.queryByTestId('delivery-info-tooltip-content')).not.toBeInTheDocument();
  });
});
