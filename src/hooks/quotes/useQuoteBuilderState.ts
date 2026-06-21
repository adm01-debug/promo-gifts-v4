/**
 * useQuoteBuilderState — Estado centralizado do QuoteBuilder
 * Extrai toda a lógica de estado, cálculos e ações do QuoteBuilderPage.
 */

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useNavigate, useParams, useSearchParams, useLocation } from 'react-router-dom';
import {
  useAutoSaveQuote,
  useDiscountApproval,
  useQuoteItems,
  useQuotes,
  useQuoteTemplates,
  useSellerDiscountLimits,
  type Quote,
  type QuoteItem,
  type QuoteItemPersonalization,
  type QuoteTemplate,
  type QuoteTemplateItem,
} from '@/hooks/quotes';
import { useQuery } from '@tanstack/react-query';
import Fuse from 'fuse.js';
import { supabase } from '@/integrations/supabase/client';
import type { ConflictInfo } from '@/hooks/quotes/useQuoteConcurrencyGuard';
import { format, addDays } from 'date-fns';
import { toast } from 'sonner';
import { formatCurrency as fmtCurrency } from '@/lib/format';
import { validateQuoteForm, QUOTE_FIELD_LABELS } from '@/lib/validations';
import { useAuth } from '@/contexts/AuthContext';
import { findKnownHex, type ExternalVariantStock } from '@/hooks/products';
import { useDebounce } from '@/hooks/common';
import type {
  SelectedCompanyInfo,
  SelectedContactInfo,
} from '@/components/quotes/CompanyContactSelector';
import type { QuoteBuilderStep } from '@/components/quotes/QuoteBuilderStepper';
import {
  createProductFuseOptions,
  dedupeById,
  rankProductSearchResults,
} from '@/utils/product-search';
import { getPriceFreshness } from '@/utils/price-freshness';
import * as QuoteCalc from '@/logic/quotes/calculations';
import type { PromobrindProduct } from '@/lib/external-db';
import { isValidQuoteTransition, getQuoteStatusLabel } from '@/lib/quote-status-config';
import type { QuoteStatus } from '@/types/quote';

import { logger } from '@/lib/logger';
interface Product {
  id: string;
  name: string;
  sku: string;
  price: number;
  images: string[] | null;
  colors?: { name: string; hex?: string; stock?: number }[];
  minQuantity?: number;
  totalStock?: number;
}

interface RawProductColor {
  name?: string;
  hex?: string;
  stock?: number;
}

function mapQuoteSearchProduct(
  p: PromobrindProduct,
  getProductImageUrl: (product: PromobrindProduct) => string | null,
): Product {
  const imgUrl = getProductImageUrl(p);
  const images = p.images && p.images.length > 0 ? p.images : imgUrl ? [imgUrl] : [];

  return {
    id: p.id,
    name: p.name,
    sku: p.sku,
    price: p.sale_price ?? p.base_price ?? 0,
    images,
    colors: (p.colors || []).map((c: RawProductColor | string) => {
      const name = typeof c === 'string' ? c : c.name || '';
      const hex = (typeof c === 'string' ? undefined : c.hex) || findKnownHex(name) || undefined;
      return { name, hex, stock: typeof c === 'string' ? undefined : c.stock };
    }),
    minQuantity: p.min_quantity ?? 1,
    totalStock:
      p.stock_quantity ??
      (p.colors || []).reduce(
        (sum: number, c: RawProductColor | string) =>
          sum + (typeof c === 'object' ? (c.stock ?? 0) : 0),
        0,
      ),
  };
}

async function loadQuoteSearchProducts(search: string): Promise<Product[]> {
  const { fetchPromobrindProducts, getProductImageUrl } = await import('@/lib/external-db');
  const normalizedSearch = search.trim();

  if (!normalizedSearch) {
    const productsData = await fetchPromobrindProducts({ limit: 20 });
    return productsData.map((p) => mapQuoteSearchProduct(p, getProductImageUrl));
  }

  // Two-layer search: prefix matches (1st layer) + broad matches (2nd layer).
  // allSettled instead of all: one layer failing should not discard the other's results.
  const [prefixResult, broadResult] = await Promise.allSettled([
    fetchPromobrindProducts({ filters: { _name_prefix: normalizedSearch }, limit: 200 }),
    fetchPromobrindProducts({ search: normalizedSearch, limit: 500 }),
  ]);
  const prefixMatches = prefixResult.status === 'fulfilled' ? prefixResult.value : [];
  const broadMatches = broadResult.status === 'fulfilled' ? broadResult.value : [];

  const mergedProducts = dedupeById([...prefixMatches, ...broadMatches]).map((product) =>
    mapQuoteSearchProduct(product, getProductImageUrl),
  );
  const fuse = new Fuse(mergedProducts, createProductFuseOptions<Product>());

  return rankProductSearchResults(mergedProducts, normalizedSearch, fuse);
}

export function useQuoteBuilderState() {
  const navigate = useNavigate();
  const location = useLocation();
  const { id: quoteId } = useParams();
  const [searchParams] = useSearchParams();
  const isEditMode = Boolean(quoteId);

  const { user } = useAuth();
  const { createQuote, updateQuote, fetchQuote, isLoading: quotesLoading } = useQuotes();
  const { templates } = useQuoteTemplates();
  const { myLimit: maxDiscountPercent } = useSellerDiscountLimits();
  const { requestApproval } = useDiscountApproval();

  // ── State ──
  const [clientId, setClientId] = useState('');
  const [contactId, setContactId] = useState('');
  const [companyInfo, setCompanyInfo] = useState<SelectedCompanyInfo | null>(null);
  const [contactInfo, setContactInfo] = useState<SelectedContactInfo | null>(null);

  // ── Detecção de concorrência: armazena updated_at ao abrir o orçamento ──
  const baselineUpdatedAtRef = useRef<string | null>(null);
  // BUG-011: Prevents double-submit when the user clicks "Save" twice rapidly
  // (or two async paths race to call handleSaveQuote simultaneously).
  const isSavingRef = useRef(false);
  const [conflictInfo, setConflictInfo] = useState<ConflictInfo | null>(null);
  // Status que o usuário tentou salvar quando o conflito foi detectado.
  // Preserva a intenção (ex.: finalizar como 'pending') ao escolher "sobrescrever",
  // evitando rebaixar silenciosamente o orçamento para rascunho.
  const pendingSaveStatusRef = useRef<'draft' | 'pending_approval' | 'pending'>('draft');
  // Preserva a justificativa de aprovação digitada pelo vendedor caso um conflito
  // de concorrência interrompa o save: o diálogo de aprovação limpa seu estado local
  // logo após o submit, então sem isto o replay do overwrite enviaria sellerNotes
  // = undefined e o admin perderia o motivo informado.
  const pendingSellerNotesRef = useRef<string | undefined>(undefined);
  const [validityDays, setValidityDays] = useState('7');
  const [validUntil, setValidUntil] = useState(format(addDays(new Date(), 7), 'yyyy-MM-dd'));
  const [discountType, setDiscountType] = useState<'amount' | 'percent'>('percent');
  const [discountValue, setDiscountValue] = useState(0);
  /** Margem de negociação interna 0–50%. Default 0 (desligado). */
  const [negotiationMarkup, setNegotiationMarkup] = useState(0);
  const [notes, setNotes] = useState('');
  const [internalNotes, setInternalNotes] = useState('');
  const {
    items,
    setItems,
    activeItemIndex,
    setActiveItemIndex,
    expandedItems,
    setExpandedItems,
    toggleExpanded,
    addProductWithColor: addProductWithColorInternal,
    updateItemQuantity,
    updateItemPrice,
    removeItem,
    handlePersonalizationsChange,
    confirmItemPrice,
  } = useQuoteItems();

  const [quoteNumber, setQuoteNumber] = useState('');
  const [currentStatus, setCurrentStatus] = useState('draft');

  const [paymentMethod, setPaymentMethod] = useState('');
  const [paymentTerms, setPaymentTerms] = useState('');
  const [deliveryTime, setDeliveryTime] = useState('');
  const [deliveryMode, setDeliveryMode] = useState<'data' | 'prazo'>('prazo');
  const [deliveryDate, setDeliveryDate] = useState<Date | undefined>(undefined);
  const [shippingType, setShippingType] = useState('');
  const [shippingCost, setShippingCost] = useState(0);

  const handleDeliveryModeChange = useCallback((mode: 'data' | 'prazo') => {
    setDeliveryMode(mode);
    setDeliveryTime('');
    setDeliveryDate(undefined);
  }, []);

  const handleDeliveryDateChange = useCallback((date: Date | undefined) => {
    setDeliveryDate(date);
    if (date) {
      setDeliveryTime(`date:${format(date, 'yyyy-MM-dd')}`);
    } else {
      setDeliveryTime('');
    }
  }, []);

  const handleShippingTypeChange = useCallback(
    (value: string) => {
      setShippingType(value);
      if (value !== 'fob_pre' && shippingCost !== 0) {
        setShippingCost(0);
      }
      toast.success(
        `Frete alterado para: ${
          value === 'cif' ? 'CIF' : value === 'fob' ? 'FOB' : 'FOB Pré-negociado'
        }`,
        {
          description:
            value === 'fob_pre'
              ? 'Lembre-se de informar o valor acordado.'
              : 'O custo será zerado no orçamento.',
        },
      );
    },
    [shippingCost],
  );

  const [productSearchOpen, setProductSearchOpen] = useState(false);
  const [productSearch, setProductSearch] = useState('');
  const [selectedProductForColor, setSelectedProductForColor] = useState<Product | null>(null);
  const [templateApplied, setTemplateApplied] = useState<string | null>(null);
  const [loadingQuote, setLoadingQuote] = useState(isEditMode);
  // Removido estado duplicado de items e activeItemIndex (gerenciados pelo useQuoteItems)

  const debouncedProductSearch = useDebounce(productSearch, 400);

  // ── Stepper ──
  const [currentStep, setCurrentStep] = useState<QuoteBuilderStep>('client');

  const activeStep = useMemo((): QuoteBuilderStep => currentStep, [currentStep]);

  const completedSteps = useMemo((): QuoteBuilderStep[] => {
    const steps: QuoteBuilderStep[] = [];
    if (clientId && contactId) steps.push('client');
    if (paymentMethod && paymentTerms && deliveryTime && shippingType) {
      if (shippingType !== 'fob_pre' || shippingCost > 0) {
        // BUG-005: validUntil was missing from the conditions check, causing the
        // stepper to show the "Conditions" step as ✓ even when the validity date
        // is in the past. Save would then fail with a toast error — contradiction.
        // We mark it incomplete when the date is missing or expired so the seller
        // sees a clear signal before attempting to send the quote.
        const validityOk = validUntil && new Date(validUntil) > new Date();
        if (validityOk) steps.push('conditions');
      }
    }
    if (items.length > 0) steps.push('items');
    // Consideramos personalização "concluída" se houver itens e pelo menos um item tiver personalização
    const hasAnyPersonalization = items.some((it) => (it.personalizations?.length ?? 0) > 0);
    if (items.length > 0 && hasAnyPersonalization) steps.push('personalization');
    return steps;
  }, [
    clientId,
    contactId,
    items,
    paymentMethod,
    paymentTerms,
    deliveryTime,
    shippingType,
    shippingCost,
    validUntil,
  ]);

  const announce = useCallback((message: string) => {
    const announcer = document.getElementById('quote-builder-announcer');
    if (announcer) {
      announcer.textContent = message;
    }
  }, []);

  const validateStep = useCallback(
    (step: QuoteBuilderStep): boolean => {
      switch (step) {
        case 'client':
          if (!clientId) {
            toast.error('Selecione um cliente');
            announce('Erro: Selecione um cliente');
            return false;
          }
          if (!contactId) {
            toast.error('Selecione um contato');
            announce('Erro: Selecione um contato');
            return false;
          }
          return true;
        case 'conditions': {
          const errors = validateQuoteForm({
            clientId,
            contactId,
            paymentMethod,
            paymentTerms,
            deliveryTime,
            shippingType,
            shippingCost,
            itemsCount: items.length,
          });

          if (errors.includes('forma_pagamento')) {
            toast.error('Selecione a forma de pagamento');
            return false;
          }
          if (errors.includes('prazo_pagamento')) {
            toast.error('Selecione o prazo de pagamento');
            return false;
          }
          if (errors.includes('prazo_entrega')) {
            toast.error('Defina o prazo de entrega');
            return false;
          }
          if (errors.includes('frete')) {
            toast.error('Selecione a modalidade de frete');
            announce('Erro: Selecione a modalidade de frete');
            return false;
          }
          if (errors.includes('valor_frete')) {
            toast.error('Informe o valor do frete pré-negociado');
            return false;
          }
          return true;
        }
        case 'items':
          if (items.length === 0) {
            toast.error('Adicione pelo menos um item');
            announce('Erro: Adicione pelo menos um item');
            return false;
          }
          return true;
        case 'personalization':
          return true;
        case 'review':
          return true;
        default:
          return true;
      }
    },
    [
      clientId,
      contactId,
      paymentMethod,
      paymentTerms,
      deliveryTime,
      shippingType,
      shippingCost,
      items,
      announce,
    ],
  );

  const nextStep = useCallback(() => {
    const steps: QuoteBuilderStep[] = [
      'client',
      'conditions',
      'items',
      'personalization',
      'review',
    ];
    const currentIndex = steps.indexOf(currentStep);

    if (validateStep(currentStep)) {
      if (currentIndex < steps.length - 1) {
        setCurrentStep(steps[currentIndex + 1]);
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  }, [currentStep, validateStep]);

  const prevStep = useCallback(() => {
    const steps: QuoteBuilderStep[] = [
      'client',
      'conditions',
      'items',
      'personalization',
      'review',
    ];
    const currentIndex = steps.indexOf(currentStep);

    if (currentIndex > 0) {
      setCurrentStep(steps[currentIndex - 1]);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [currentStep]);

  const goToStep = useCallback(
    (step: QuoteBuilderStep) => {
      const steps: QuoteBuilderStep[] = [
        'client',
        'conditions',
        'items',
        'personalization',
        'review',
      ];
      const targetIndex = steps.indexOf(step);
      const currentIndex = steps.indexOf(currentStep);

      if (targetIndex === currentIndex) return;

      // Se estiver tentando ir para uma etapa posterior, validar as anteriores
      if (targetIndex > currentIndex) {
        // Validar cada etapa entre a atual e a alvo (não inclusiva da alvo, pois a alvo é onde queremos chegar)
        for (let i = currentIndex; i < targetIndex; i++) {
          if (!validateStep(steps[i])) return;
        }
      }

      setCurrentStep(step);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    },
    [currentStep, validateStep],
  );
  // ── AutoSave ──
  const { clearAutoSave } = useAutoSaveQuote({
    enabled: (!!clientId || items.length > 0) && !isEditMode,
    data: {
      clientId,
      contactId,
      contactInfo,
      companyInfo,
      items,
      discountType,
      discountValue,
      negotiationMarkup,
      paymentMethod,
      paymentTerms,
      deliveryTime,
      shippingType,
      shippingCost,
      notes,
      internalNotes,
      validUntil,
    },
    onRestore: (saved) => {
      // Para evitar sobrescrever um carregamento de rascunho real (via URL),
      // só restauramos se não estiver em modo edição.
      if (!isEditMode) {
        if (saved.clientId) setClientId(saved.clientId);
        if (saved.contactId) setContactId(saved.contactId);
        if (saved.companyInfo) setCompanyInfo(saved.companyInfo);
        if (saved.contactInfo) setContactInfo(saved.contactInfo);
        if (saved.items) setItems(saved.items);
        if (saved.discountType) setDiscountType(saved.discountType);
        if (typeof saved.discountValue === 'number') setDiscountValue(saved.discountValue);
        if (typeof saved.negotiationMarkup === 'number' && saved.negotiationMarkup > 0)
          setNegotiationMarkup(saved.negotiationMarkup);
        if (saved.paymentMethod) setPaymentMethod(saved.paymentMethod);
        if (saved.paymentTerms) setPaymentTerms(saved.paymentTerms);
        if (saved.deliveryTime) {
          setDeliveryTime(saved.deliveryTime);
          if (saved.deliveryTime.startsWith('date:')) {
            setDeliveryMode('data');
            try {
              setDeliveryDate(new Date(`${saved.deliveryTime.slice(5)}T12:00:00`));
            } catch (e) {
              logger.warn('Failed to restore delivery date', e);
            }
          } else {
            setDeliveryMode('prazo');
          }
        }
        if (saved.shippingType) {
          // Usar setTimeout para garantir que o Radix Select reaja após a montagem do componente
          setTimeout(() => setShippingType(saved.shippingType), 0);
        }
        if (saved.shippingCost) setShippingCost(saved.shippingCost);
        if (saved.validUntil) setValidUntil(saved.validUntil);
        if (saved.notes) setNotes(saved.notes);
        if (saved.internalNotes) setInternalNotes(saved.internalNotes);
      }
    },
  });

  // Note: beforeunload is now handled by useUnsavedChangesGuard in QuoteBuilderPage

  // ── Load existing quote ──
  useEffect(() => {
    if (!isEditMode || !quoteId) return;
    /**
     * BUG-18 FIX: isMounted guard prevents ~15 setState calls on an unmounted
     * component when the user navigates away before fetchQuote resolves.
     *
     * WITHOUT THIS FIX: If the user opens a quote edit page and immediately
     * navigates away (e.g. back button on slow network, ~200ms latency), the
     * .then() callback fires after unmount, calling setClientId, setContactId,
     * setNotes, etc. on a dead component — React warning + potential state
     * corruption on remount.
     *
     * fetchQuote also added to deps array to prevent stale closure.
     */
    let isMounted = true;
    setLoadingQuote(true);
    fetchQuote(quoteId)
      .then((quote) => {
        if (!isMounted) return;
        if (quote) {
          setClientId(quote.client_id || '');
          setContactId(quote.contact_id || '');
          setValidUntil(quote.valid_until || format(addDays(new Date(), 30), 'yyyy-MM-dd'));
          // BUG-007: validityDays Select showed '7 dias' even when the loaded quote had
          // a different expiry. Sync to the closest preset so the UI is honest.
          // If the date doesn't match a preset exactly, '' shows "Selecione" (placeholder).
          if (quote.valid_until) {
            const daysRemaining = Math.round(
              (new Date(quote.valid_until).getTime() - Date.now()) / (1000 * 60 * 60 * 24),
            );
            const PRESETS = ['1', '3', '7', '15', '30'];
            setValidityDays(PRESETS.find((p) => parseInt(p, 10) === daysRemaining) ?? '');
          }
          setNotes(quote.notes || '');
          setInternalNotes(quote.internal_notes || '');
          setQuoteNumber(quote.quote_number || '');
          setCurrentStatus(quote.status);
          if (quote.client_name) {
            setContactInfo({
              id: '',
              name: quote.client_name,
              email: quote.client_email || undefined,
              phone: quote.client_phone || undefined,
            });
          }
          if (quote.client_company) {
            setCompanyInfo({
              id: quote.client_id || '',
              name: quote.client_company,
              cnpj: quote.client_cnpj || undefined,
              ramo_atividade: undefined,
            });
          }
          // BUG-003: Log a warning when both fields are set — indicates data corruption
          // (only one should be > 0 at a time). We pick percent as the canonical value.
          if ((quote.discount_percent ?? 0) > 0 && (quote.discount_amount ?? 0) > 0) {
            logger.warn(
              '[useQuoteBuilderState] Both discount_percent and discount_amount are set on loaded quote — possible data corruption. Picking percent.',
              { quoteId: quote.id },
            );
          }
          if (quote.discount_percent && quote.discount_percent > 0) {
            setDiscountType('percent');
            setDiscountValue(quote.discount_percent);
          } else if (quote.discount_amount && quote.discount_amount > 0) {
            setDiscountType('amount');
            setDiscountValue(quote.discount_amount);
          }
          if (typeof quote.negotiation_markup_percent === 'number')
            setNegotiationMarkup(quote.negotiation_markup_percent);
          if (quote.payment_method) setPaymentMethod(quote.payment_method);
          if (quote.payment_terms) setPaymentTerms(quote.payment_terms);
          if (quote.shipping_type) setShippingType(quote.shipping_type);
          // BUG-004: falsy check skips 0, which is valid for CIF (freight included).
          // Use explicit null/undefined check instead.
          if (quote.shipping_cost !== null && quote.shipping_cost !== undefined)
            setShippingCost(quote.shipping_cost);
          if (quote.delivery_time) {
            if (quote.delivery_time.startsWith('date:')) {
              setDeliveryMode('data');
              setDeliveryDate(new Date(`${quote.delivery_time.slice(5)}T12:00:00`));
            } else {
              setDeliveryMode('prazo');
            }
            setDeliveryTime(quote.delivery_time);
          }
          if (quote.items) setItems(quote.items);
          // Salva o updated_at como baseline para detecção de conflito
          baselineUpdatedAtRef.current = quote.updated_at ?? null;
        }
        setLoadingQuote(false);
      })
      .catch((err) => {
        if (!isMounted) return;
        logger.error('[useQuoteBuilderState] fetchQuote failed:', err);
        setLoadingQuote(false);
      });
    return () => {
      isMounted = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEditMode, quoteId, fetchQuote]);

  // ── Pre-fill from simulator ──
  useEffect(() => {
    const state = location.state as {
      fromSimulator?: boolean;
      simulationData?: {
        product?: { id: string; name: string; sku?: string; imageUrl?: string; price?: number };
        quantity?: number;
        personalizations?: Array<{
          technique?: { id: string; name: string };
          specs?: { colors?: number; width?: number; height?: number };
          pricing?: { setupPrice?: number; unitPrice?: number; totalPrice?: number };
        }>;
      };
    } | null;
    if (!state?.fromSimulator || !state.simulationData) return;
    const { product, quantity, personalizations } = state.simulationData;
    if (!product) return;
    const quotePersonalizations: QuoteItemPersonalization[] = (personalizations || []).map((p) => ({
      technique_id: p.technique?.id ?? '',
      technique_name: p.technique?.name ?? '',
      colors_count: p.specs?.colors || 1,
      positions_count: 1,
      width_cm: p.specs?.width || undefined,
      height_cm: p.specs?.height || undefined,
      area_cm2: (p.specs?.width || 0) * (p.specs?.height || 0),
      setup_cost: p.pricing?.setupPrice || 0,
      unit_cost: p.pricing?.unitPrice || 0,
      total_cost: p.pricing?.totalPrice || 0,
    }));
    const newItem: QuoteItem = {
      product_id: product.id,
      product_name: product.name,
      product_sku: product.sku || '',
      product_image_url: product.imageUrl || undefined,
      quantity: quantity || 1,
      unit_price: product.price || 0,
      personalizations: quotePersonalizations,
    };
    setItems([newItem]);
    setActiveItemIndex(0);
    if (quotePersonalizations.length > 0) setExpandedItems(new Set([0]));
    toast.success(
      `Produto "${product.name}" importado do simulador com ${quotePersonalizations.length} gravação(ões)`,
    );
    window.history.replaceState({}, document.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // ── Pre-fill from cart ──
  useEffect(() => {
    const state = location.state as {
      fromCart?: boolean;
      companyId?: string;
      companyName?: string;
      companyLocation?: string;
      items?: Array<{
        product_id: string;
        product_name: string;
        product_sku?: string;
        product_image_url?: string;
        quantity: number;
        unit_price: number;
        color_name?: string;
        color_hex?: string;
      }>;
    } | null;
    if (!state?.fromCart || !state.items?.length) return;
    if (state.companyId) setClientId(state.companyId);
    const cartItems: QuoteItem[] = state.items.map((i) => ({
      product_id: i.product_id,
      product_name: i.product_name,
      product_sku: i.product_sku || '',
      product_image_url: i.product_image_url || undefined,
      quantity: i.quantity,
      unit_price: i.unit_price,
      color_name: i.color_name || undefined,
      color_hex: i.color_hex || undefined,
      personalizations: [],
    }));
    setItems(cartItems);
    const companyLabel = state.companyName
      ? state.companyLocation
        ? `${state.companyName} – ${state.companyLocation}`
        : state.companyName
      : '';
    toast.success(`${cartItems.length} item(ns) importado(s) do carrinho`, {
      description: companyLabel || undefined,
    });
    window.history.replaceState({}, document.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // ── Pre-fill from collection ──
  useEffect(() => {
    const state = location.state as {
      fromCollection?: string;
      preloadProducts?: Array<{
        product_id: string;
        product_name: string;
        product_sku?: string;
        product_image_url?: string | null;
        unit_price: number;
        quantity: number;
        color_name?: string | null;
        color_hex?: string | null;
      }>;
    } | null;
    if (!state?.fromCollection || !state.preloadProducts?.length) return;
    const collectionItems: QuoteItem[] = state.preloadProducts.map((p) => ({
      product_id: p.product_id,
      product_name: p.product_name,
      product_sku: p.product_sku || '',
      product_image_url: p.product_image_url || undefined,
      quantity: p.quantity || 1,
      unit_price: p.unit_price || 0,
      color_name: p.color_name || undefined,
      color_hex: p.color_hex || undefined,
      personalizations: [],
    }));
    setItems(collectionItems);
    toast.success(
      `${collectionItems.length} produto(s) importado(s) da coleção "${state.fromCollection}"`,
    );
    window.history.replaceState({}, document.title);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state]);

  // ── Pre-fill from URL params (single product or bulk items[]) ──
  useEffect(() => {
    if (isEditMode) return;
    // Avoid duplicating if items already exist (e.g. restored draft)
    if (items.length > 0) return;

    // ── Bulk: items[] JSON array from catalog/filter selection ──
    const rawItems = searchParams.getAll('items[]');
    if (rawItems.length > 0) {
      try {
        const parsedItems: QuoteItem[] = rawItems.map((raw) => {
          const p = JSON.parse(raw);
          return {
            product_id: p.product_id || '',
            product_name: p.product_name || '',
            product_sku: p.product_sku || '',
            product_image_url: p.product_image || undefined,
            quantity: Math.max(1, p.quantity || 1),
            unit_price: parseFloat(p.product_price) || 0,
            color_name: p.color_name || undefined,
            color_hex: p.color_hex || undefined,
            personalizations: [],
          };
        });
        if (parsedItems.length > 0) {
          setItems(parsedItems);
          setActiveItemIndex(0);
          toast.success(
            `${parsedItems.length} produto${parsedItems.length > 1 ? 's' : ''} adicionado${parsedItems.length > 1 ? 's' : ''} ao orçamento`,
          );
          window.history.replaceState({}, document.title, location.pathname);
          return;
        }
      } catch {
        logger.warn('Failed to parse items[] params');
      }
    }

    // ── Single product: product_id param ──
    const productId = searchParams.get('product_id') || searchParams.get('productId');
    if (!productId) return;
    const productName = searchParams.get('product_name') || '';
    const colorName = searchParams.get('color_name') || undefined;
    const colorHex = searchParams.get('color_hex') || undefined;
    const newItem: QuoteItem = {
      product_id: productId,
      product_name: productName,
      product_sku: searchParams.get('product_sku') || '',
      product_image_url: searchParams.get('product_image') || undefined,
      quantity: Math.max(1, parseInt(searchParams.get('min_quantity') || '1', 10)),
      unit_price: parseFloat(searchParams.get('product_price') ?? '') || 0,
      color_name: colorName,
      color_hex: colorHex,
      personalizations: [],
    };
    setItems([newItem]);
    setActiveItemIndex(0);
    if (productName) {
      toast.success(
        `Produto "${productName}" adicionado ao orçamento${colorName ? ` — ${colorName}` : ''}`,
      );
    }
    // Clean URL params without triggering React Router re-render
    window.history.replaceState({}, document.title, location.pathname);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const { data: products } = useQuery({
    queryKey: ['quote-products-promobrind-search', debouncedProductSearch],
    queryFn: () => loadQuoteSearchProducts(debouncedProductSearch),
    enabled: productSearchOpen,
    staleTime: 5 * 60 * 1000,
    placeholderData: (previousData) => previousData,
  });

  /**
   * BUG-05 FIX: removida dependência fantasma `productSearch`.
   *
   * PROBLEMA ORIGINAL: productSearch estava na lista de deps mas nunca era usado
   * no corpo do useMemo — causava re-computações desnecessárias a cada keystroke.
   */
  const filteredProducts = useMemo(() => {
    return products || [];
  }, [products]);

  // ── Calculations ──
  const formatCurrency = useCallback((value: number) => {
    return fmtCurrency(value);
  }, []);

  const calculateItemPersonalizationTotal = useCallback((item: QuoteItem) => {
    return QuoteCalc.calculateItemPersonalizationTotal(item);
  }, []);

  const calculateItemTotal = useCallback((item: QuoteItem) => {
    return QuoteCalc.calculateItemTotal({
      quantity: item.quantity,
      unitPrice: item.unit_price,
      personalizations: item.personalizations,
    });
  }, []);

  // ── Subtotal real (sem markup) e apresentado (com markup) ──
  const realSubtotal = useMemo(
    () =>
      QuoteCalc.calculateSubtotal(
        items.map((item) => ({
          quantity: item.quantity,
          unitPrice: item.unit_price,
          personalizations: item.personalizations,
        })),
      ),
    [items],
  );

  const subtotal = useMemo(
    () => QuoteCalc.applyMarkup(realSubtotal, negotiationMarkup),
    [realSubtotal, negotiationMarkup],
  );

  const discountAmount = useMemo(
    () => QuoteCalc.calculateDiscountAmount(subtotal, discountType, discountValue),
    [subtotal, discountType, discountValue],
  );

  const total = useMemo(() => {
    const baseTotal = QuoteCalc.round2(subtotal - discountAmount);
    const shipping = shippingType === 'fob_pre' ? QuoteCalc.round2(shippingCost) : 0;
    return QuoteCalc.round2(baseTotal + shipping);
  }, [subtotal, discountAmount, shippingCost, shippingType]);

  // ── Desconto REAL (sobre subtotal real) — usado para alçada ──
  const realDiscountPercent = useMemo(
    () => QuoteCalc.calculateRealDiscountPercent(realSubtotal, subtotal, discountAmount),
    [realSubtotal, subtotal, discountAmount],
  );

  // BUG-032: Clamp amount-mode discount when markup decreases below discountValue.
  // Without this, the UI input keeps showing the stale R$ value while discountAmount
  // is silently clamped by calculateDiscountAmount — confusing the seller.
  // FIX: use functional updater so discountValue is NOT in deps — the effect must
  // fire only when subtotal or discountType changes, not on every user keystroke.
  // The functional form reads the latest discountValue at update time (no stale closure).
  useEffect(() => {
    if (discountType !== 'amount') return;
    setDiscountValue((prev) => (prev > subtotal ? QuoteCalc.round2(subtotal) : prev));
  }, [subtotal, discountType]);

  const handleProductClick = useCallback((product: Product) => {
    setSelectedProductForColor(product);
  }, []);

  // ── Item actions ──
  const addProductWithColor = useCallback(
    (product: Product, variant: ExternalVariantStock | null) => {
      addProductWithColorInternal(product, variant);
      setSelectedProductForColor(null);
      setProductSearchOpen(false);
      setProductSearch('');
    },
    [addProductWithColorInternal],
  );

  const confirmAllStalePrices = useCallback(() => {
    const ts = new Date().toISOString();
    setItems((prev) =>
      prev.map((item) => {
        if (item.price_confirmed_at) return item;
        const f = getPriceFreshness(item.price_updated_at, item.price_freshness_threshold_days);
        return f.shouldWarn ? { ...item, price_confirmed_at: ts } : item;
      }),
    );
  }, [setItems]);

  // ── Template ──
  const applyTemplate = useCallback((template: QuoteTemplate) => {
    const newItems: QuoteItem[] = template.items.map((item) => ({
      product_id: item.productId || '',
      product_name: item.productName,
      product_sku: item.productSku,
      product_image_url: item.productImageUrl,
      quantity: item.quantity,
      unit_price: item.unitPrice,
      color_name: item.colorName,
      color_hex: item.colorHex,
      personalizations: item.personalizations?.map((p) => ({
        technique_id: p.techniqueId,
        technique_name: p.techniqueName,
        location_code: p.locationCode,
        location_name: p.locationName,
        personalized_quantity: p.personalizedQuantity,
        colors_count: p.colorsCount,
        positions_count: p.positionsCount,
        area_cm2: p.areaCm2,
        width_cm: p.widthCm,
        height_cm: p.heightCm,
        unit_cost: p.unitCost,
        setup_cost: p.setupCost,
        total_cost: p.totalCost,
        notes: p.notes,
      })),
    }));
    setItems(newItems);
    if (template.discount_percent > 0) {
      setDiscountType('percent');
      setDiscountValue(template.discount_percent);
    } else if (template.discount_amount > 0) {
      setDiscountType('amount');
      setDiscountValue(template.discount_amount);
    } else {
      // Template has no discount — reset any previously applied discount.
      setDiscountType('percent');
      setDiscountValue(0);
    }
    if (template.notes) setNotes(template.notes);
    if (template.internal_notes) setInternalNotes(template.internal_notes);
    if (template.validity_days)
      setValidUntil(format(addDays(new Date(), template.validity_days), 'yyyy-MM-dd'));
    setTemplateApplied(template.name);
    toast.success(`Template "${template.name}" aplicado!`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const getTemplateItems = useCallback((): QuoteTemplateItem[] => {
    return items.map((item) => ({
      productId: item.product_id,
      productSku: item.product_sku,
      productName: item.product_name,
      productImageUrl: item.product_image_url,
      quantity: item.quantity,
      unitPrice: item.unit_price,
      colorName: item.color_name,
      colorHex: item.color_hex,
      personalizations: item.personalizations?.map((p) => ({
        techniqueId: p.technique_id,
        techniqueName: p.technique_name || '',
        locationCode: p.location_code,
        locationName: p.location_name,
        personalizedQuantity: p.personalized_quantity,
        colorsCount: p.colors_count,
        positionsCount: p.positions_count,
        areaCm2: p.area_cm2,
        widthCm: p.width_cm,
        heightCm: p.height_cm,
        unitCost: p.unit_cost,
        setupCost: p.setup_cost,
        totalCost: p.total_cost,
        notes: p.notes,
      })),
    }));
  }, [items]);

  // ── Validation ──
  const validationErrors = useMemo(
    () =>
      validateQuoteForm({
        clientId,
        contactId,
        paymentMethod,
        paymentTerms,
        deliveryTime,
        shippingType,
        shippingCost,
        itemsCount: items.length,
      }),
    [
      clientId,
      contactId,
      paymentMethod,
      paymentTerms,
      deliveryTime,
      shippingType,
      shippingCost,
      items,
    ],
  );

  const isFormValid = validationErrors.length === 0;
  const isDraftValid = !!clientId;

  // ── Discount limit check ──
  // Compara contra o DESCONTO REAL (sobre o subtotal real, sem markup) — exatamente
  // a métrica que o trigger server-side `fn_quotes_validate_discount` enforce via
  // `real_discount_percent`. Usar o desconto APARENTE aqui (discountValue ou
  // discountValue/subtotal) divergia da regra do banco quando havia margem de
  // negociação: o markup dilui o desconto real, então um desconto aparente acima
  // do limite podia estar, na verdade, dentro da alçada. O gate antigo empurrava
  // esses casos para aprovação desnecessariamente — anulando o propósito do markup.
  const isDiscountExceeded = useMemo(() => {
    if (maxDiscountPercent === null) return false;
    return realDiscountPercent > maxDiscountPercent;
  }, [maxDiscountPercent, realDiscountPercent]);

  // ── Save ──
  const handleSaveQuote = useCallback(
    async (status: 'draft' | 'pending_approval' | 'pending' = 'draft', sellerNotes?: string) => {
      // BUG-011: Prevent double-save from rapid clicks or concurrent async callers.
      if (isSavingRef.current) {
        toast.error('Salvamento em andamento. Aguarde.');
        return;
      }
      isSavingRef.current = true;
      try {
        if (status === 'draft') {
          if (!isDraftValid) {
            toast.error('Selecione uma empresa para salvar o rascunho.');
            return;
          }
        } else if (!isFormValid) {
          const missing = validationErrors.map((e) => QUOTE_FIELD_LABELS[e] || e).join(', ');
          toast.error(`Preencha os campos obrigatórios: ${missing}`);
          return;
        }

        // BUG-015: Block sending a quote whose validity date is already in the past.
        // Drafts are exempt — sellers legitimately archive old drafts with expired dates.
        if (status !== 'draft' && validUntil && new Date(validUntil) < new Date()) {
          toast.error(
            'A data de validade da proposta está no passado. Atualize a validade antes de enviar.',
          );
          return;
        }

        // BUG-008: Validate that the status transition is allowed before hitting the DB.
        // Without this guard, the app could attempt illegal transitions (e.g. approved→draft,
        // converted→anything) that the DB CHECK constraint would reject with a cryptic error.
        // Same-status saves (e.g. re-saving a draft) are always allowed (not a transition).
        // Only applies in edit mode — new quotes always start at the requested status.
        if (isEditMode && quoteId && currentStatus && currentStatus !== status) {
          if (!isValidQuoteTransition(currentStatus as QuoteStatus, status as QuoteStatus)) {
            toast.error(
              `Não é possível alterar o status de "${getQuoteStatusLabel(currentStatus)}" para "${getQuoteStatusLabel(status)}".`,
            );
            return;
          }
        }

        // ── Bloqueio de fechamento: itens com preço defasado precisam de confirmação ──
        // Só validamos ao fechar (pending / pending_approval). Rascunho permanece livre.
        if (status !== 'draft') {
          const staleUnconfirmed = items.filter((item) => {
            if (item.price_confirmed_at) return false;
            const f = getPriceFreshness(item.price_updated_at, item.price_freshness_threshold_days);
            return f.isStale;
          });
          if (staleUnconfirmed.length > 0) {
            const names = staleUnconfirmed
              .slice(0, 3)
              .map((i) => i.product_name)
              .filter(Boolean)
              .join(', ');
            const extra =
              staleUnconfirmed.length > 3 ? ` e mais ${staleUnconfirmed.length - 3}` : '';
            toast.error('Confirme os preços defasados antes de fechar o orçamento', {
              description: `${staleUnconfirmed.length} ${staleUnconfirmed.length === 1 ? 'item está' : 'itens estão'} com preço possivelmente defasado: ${names}${extra}. Use o botão "Confirmar com fornecedor" em cada item ou "Confirmar todos" no resumo.`,
              duration: 8000,
            });
            return;
          }
        }

        const effectiveStatus = status === 'pending_approval' ? 'pending_approval' : status;

        const quoteData: Partial<Quote> = {
          client_id: clientId || undefined,
          contact_id: contactId || undefined,
          client_name: contactInfo?.name || undefined,
          client_company: companyInfo?.name || undefined,
          client_cnpj: companyInfo?.cnpj || undefined,
          client_email: contactInfo?.email || undefined,
          client_phone: contactInfo?.phone || undefined,
          status: effectiveStatus,
          discount_percent: discountType === 'percent' ? discountValue : 0,
          discount_amount: discountType === 'amount' ? discountAmount : 0,
          negotiation_markup_percent: Math.min(50, Math.max(0, negotiationMarkup || 0)),
          notes: notes || undefined,
          internal_notes: internalNotes || undefined,
          valid_until: validUntil || undefined,
          payment_method: paymentMethod || undefined,
          payment_terms: paymentTerms || undefined,
          delivery_time: deliveryTime || undefined,
          shipping_type: shippingType || undefined,
          shipping_cost: shippingType === 'fob_pre' ? shippingCost || 0 : 0,
        };
        let result;
        if (isEditMode && quoteId) {
          // ── Detecção de concorrência ──
          // Compara updated_at atual do banco com o baseline registrado ao abrir o orçamento.
          // Se outro usuário/sessão salvou enquanto estava aberto, exibe alerta.
          if (baselineUpdatedAtRef.current) {
            const { data: remoteQuote } = await supabase
              // rls-allow: RLS scopes quotes to seller; concurrency check reads specific quote by id
              .from('quotes')
              .select('updated_at')
              .eq('id', quoteId)
              .single();

            const remoteTs = remoteQuote?.updated_at;
            if (remoteTs && new Date(remoteTs) > new Date(baselineUpdatedAtRef.current)) {
              const label = new Date(remoteTs).toLocaleString('pt-BR', {
                day: '2-digit',
                month: '2-digit',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
                timeZone: 'America/Sao_Paulo',
              });
              pendingSaveStatusRef.current = status; // preserva a intenção do save
              pendingSellerNotesRef.current = sellerNotes; // preserva a justificativa de aprovação
              setConflictInfo({ modifiedAt: remoteTs, label });
              return; // Bloqueia o save — usuário decide no banner
            }
          }
          result = await updateQuote(quoteId, quoteData, items);
        } else {
          result = await createQuote(quoteData, items);
        }

        // If pending_approval, create approval request usando desconto REAL (não aparente)
        if (result?.id && status === 'pending_approval' && maxDiscountPercent !== null) {
          await requestApproval(result.id, realDiscountPercent, maxDiscountPercent, sellerNotes);
        }

        if (result?.id) {
          clearAutoSave();
          navigate(`/orcamentos/${result.id}`);
        }

        return result?.updated_at ?? undefined;
      } finally {
        isSavingRef.current = false;
      }
    },
    [
      isDraftValid,
      isFormValid,
      validationErrors,
      clientId,
      contactId,
      contactInfo,
      companyInfo,
      discountType,
      discountValue,
      discountAmount,
      negotiationMarkup,
      realDiscountPercent,
      notes,
      internalNotes,
      validUntil,
      paymentMethod,
      paymentTerms,
      deliveryTime,
      shippingType,
      shippingCost,
      isEditMode,
      quoteId,
      currentStatus,
      items,
      navigate,
      updateQuote,
      createQuote,
      maxDiscountPercent,
      requestApproval,
      clearAutoSave,
    ],
  );

  const defaultTemplate = useMemo(() => templates.find((t) => t.is_default), [templates]);

  return {
    // Navigation
    navigate,
    quoteId,
    isEditMode,
    loadingQuote,
    currentStep,
    setCurrentStep,
    // Auth
    user,
    // State setters
    clientId,
    setClientId,
    contactId,
    setContactId,
    companyInfo,
    setCompanyInfo,
    contactInfo,
    setContactInfo,
    validityDays,
    setValidityDays,
    validUntil,
    setValidUntil,
    discountType,
    setDiscountType,
    discountValue,
    setDiscountValue,
    negotiationMarkup,
    setNegotiationMarkup,
    notes,
    setNotes,
    internalNotes,
    setInternalNotes,
    items,
    setItems,
    quoteNumber,
    currentStatus,
    paymentMethod,
    setPaymentMethod,
    paymentTerms,
    setPaymentTerms,
    deliveryTime,
    setDeliveryTime,
    deliveryMode,
    handleDeliveryModeChange,
    deliveryDate,
    handleDeliveryDateChange,
    shippingType,
    setShippingType: handleShippingTypeChange,
    shippingCost,
    setShippingCost,
    productSearchOpen,
    setProductSearchOpen,
    productSearch,
    setProductSearch,
    selectedProductForColor,
    setSelectedProductForColor,
    templateApplied,
    setTemplateApplied,
    expandedItems,
    setExpandedItems,
    activeItemIndex,
    setActiveItemIndex,
    // Computed
    completedSteps,
    activeStep,
    filteredProducts,
    subtotal,
    realSubtotal,
    discountAmount,
    total,
    realDiscountPercent,
    validationErrors,
    isFormValid,
    isDraftValid,
    quotesLoading,
    templates,
    defaultTemplate,
    // Discount limits
    maxDiscountPercent,
    isDiscountExceeded,
    // Actions
    validateStep,
    nextStep,
    prevStep,
    goToStep,
    formatCurrency,
    calculateItemPersonalizationTotal,
    calculateItemTotal,
    toggleExpanded,
    handlePersonalizationsChange,
    handleProductClick,
    addProductWithColor,
    updateItemQuantity,
    updateItemPrice,
    removeItem,
    confirmItemPrice,
    confirmAllStalePrices,
    applyTemplate,
    getTemplateItems,
    handleSaveQuote,
    conflictInfo,
    dismissConflict: () => setConflictInfo(null),
    /**
     * Ignora o conflito detectado e salva mesmo assim (overwrite consciente).
     * Preserva o status que o usuário tentou salvar (não rebaixa para rascunho).
     * Após o save, atualiza o baseline para evitar falsos positivos futuros.
     */
    overwriteAndSave: async (status?: 'draft' | 'pending_approval' | 'pending') => {
      const effectiveStatus = status ?? pendingSaveStatusRef.current;
      // Repassa a justificativa preservada para que o requestApproval no replay
      // não perca o motivo informado pelo vendedor.
      const sellerNotes =
        effectiveStatus === 'pending_approval' ? pendingSellerNotesRef.current : undefined;
      setConflictInfo(null);
      // Clear baseline BEFORE calling handleSaveQuote so the conflict check inside is
      // bypassed. Without this, handleSaveQuote would re-detect the same conflict
      // (baseline still points to the old timestamp) and abort again — the user would
      // be permanently stuck in the conflict dialog.
      const previousBaseline = baselineUpdatedAtRef.current;
      baselineUpdatedAtRef.current = null;
      try {
        const savedUpdatedAt = await handleSaveQuote(effectiveStatus, sellerNotes);
        // Re-arm baseline to the server's updated_at to avoid clock-skew false conflicts.
        baselineUpdatedAtRef.current = savedUpdatedAt ?? new Date().toISOString();
      } catch (err) {
        // Restore previous baseline so the next save attempt still performs
        // conflict detection — without this, a failed overwrite leaves baseline
        // null permanently and all subsequent saves bypass concurrency checks.
        baselineUpdatedAtRef.current = previousBaseline;
        throw err;
      }
    },
  };
}
