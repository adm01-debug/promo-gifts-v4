/**
 * Hook to manage QuoteViewPage state and data fetching.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuotes, type Quote } from '@/hooks/quotes';
import { useAuth } from '@/contexts/AuthContext';
import { selectCrmById } from '@/lib/crm-db';
import { toast } from 'sonner';
import { generateProposalPDFv2, downloadPDF } from '@/utils/proposalPdfReactGenerator';
import { type ProposalTemplateData } from '@/components/pdf/ProposalHtmlTemplate';
import {
  formatCurrency as formatCurrencyHelper,
  calcPersTotal,
  formatCNPJ,
} from '@/pages/quotes/quote-view/QuoteActionHandlers';
import { applyNegotiationMarkup } from '@/hooks/quotes/quoteMarkup';

type QuoteClientCompany = {
  cnpj?: string | null;
  bitrix_company_id?: number | string | null;
  bitrix_id?: number | string | null;
};

export function useQuoteViewData(id: string | undefined) {
  const { fetchQuote, logQuoteHistory, duplicateQuote } = useQuotes();
  const { user, profile } = useAuth();

  const [quote, setQuote] = useState<Quote | null>(null);
  const [isLoadingQuote, setIsLoadingQuote] = useState(true);
  const [clientCnpj, setClientCnpj] = useState<string | undefined>(undefined);
  const [bitrixCompanyId, setBitrixCompanyId] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [showPresentation, setShowPresentation] = useState(false);

  const loadQuote = useCallback(async () => {
    if (!id) return;
    setIsLoadingQuote(true);
    const data = await fetchQuote(id);
    setQuote(data);
    setIsLoadingQuote(false);
    // Prefer CNPJ stored on the quote (snapshot at creation) over live company data.
    if (data?.client_cnpj) setClientCnpj(formatCNPJ(data.client_cnpj));
    if (data?.client_id) {
      try {
        const company = await selectCrmById<QuoteClientCompany>('companies', data.client_id);
        // Only fall back to live company CNPJ if the quote has none stored.
        if (!data.client_cnpj && company?.cnpj) setClientCnpj(formatCNPJ(company.cnpj));
        const bId = company?.bitrix_company_id ?? company?.bitrix_id;
        if (bId) setBitrixCompanyId(String(bId));
      } catch {
        // Company not found
      }
    }
  }, [fetchQuote, id]);

  useEffect(() => {
    if (id) void loadQuote();
  }, [id, loadQuote]);

  const proposalData: ProposalTemplateData | null = useMemo(() => {
    if (!quote) return null;
    // Reaplica a margem de negociação aos valores apresentados ao cliente, para o
    // PDF bater com o total persistido (lista/WhatsApp). No-op quando markup = 0.
    const markedItems = applyNegotiationMarkup(quote.items || [], quote.negotiation_markup_percent);
    const prodSub = markedItems.reduce((s, i) => s + i.quantity * i.unit_price, 0);
    const persSub = markedItems.reduce(
      (s, i) =>
        s +
        (i.personalizations || []).reduce(
          (ps: number, p: { total_cost?: number }) =>
            ps + calcPersTotal(p.total_cost || 0, i.quantity),
          0,
        ),
      0,
    );
    const fullSubtotal = prodSub + persSub;
    const discountValue = quote.discount_percent
      ? Math.round(fullSubtotal * (quote.discount_percent / 100) * 100) / 100
      : quote.discount_amount || 0;
    // Apenas 'fob_pre' (FOB Pré-negociado) tem custo no total. 'fob' = cliente paga, sem cost.
    const shipValue = quote.shipping_type === 'fob_pre' ? quote.shipping_cost || 0 : 0;
    const computedTotal = fullSubtotal - discountValue + shipValue;

    return {
      quoteNumber: (quote.quote_number || '').replace(/\s+/g, ''),
      date: quote.created_at
        ? format(new Date(quote.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
        : '',
      validUntil: quote.valid_until
        ? format(new Date(quote.valid_until), "dd 'de' MMMM 'de' yyyy", { locale: ptBR })
        : '30 dias',
      client: {
        name: quote.client_company || quote.client_name || 'Não especificado',
        phone: quote.client_phone || undefined,
        company: quote.client_company || undefined,
        contactName: quote.client_name || undefined,
        cnpj: clientCnpj,
      },
      seller: {
        name: profile?.full_name || user?.email || 'Vendedor',
        email: user?.email || undefined,
        // Profile has no signature URL field; left undefined until one exists.
        signatureUrl: undefined,
      },
      items: markedItems.map((item) => ({
        name: item.product_name,
        sku: item.product_sku || undefined,
        supplier_sku: item.product_sku || undefined,
        composedCode: item.product_sku
          ? item.color_name
            ? `${item.product_sku}-${item.color_name}`
            : item.product_sku
          : undefined,
        colorHex: item.color_hex || undefined,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        color: item.color_name || undefined,
        imageUrl: item.product_image_url || undefined,
        bitrix_product_id: item.bitrix_product_id ?? null,
        kit_group_id: item.kit_group_id || null,
        kit_name: item.kit_name || null,

        personalizations:
          item.personalizations?.map((p) => ({
            technique_name: p.technique_name || 'Personalizacao',
            colors_count: p.colors_count || 1,
            width_cm: p.width_cm || undefined,
            height_cm: p.height_cm || undefined,
            area_cm2: p.area_cm2 || undefined,
            unit_cost: p.unit_cost || 0,
            setup_cost: p.setup_cost || 0,
            total_cost: p.total_cost || 0,
            notes: p.notes || undefined,
          })) ?? [],
      })),
      subtotal: fullSubtotal,
      discount: discountValue || undefined,
      shippingCost: quote.shipping_cost || undefined,
      shippingType: quote.shipping_type || undefined,
      total: computedTotal,
      notes: quote.notes || undefined,
      paymentTerms: quote.payment_terms || undefined,
      deliveryTime: quote.delivery_time || undefined,
    };
  }, [quote, user, profile, clientCnpj]);

  // ── Action Handlers ──
  const handleDownloadPDF = async () => {
    if (!proposalData) return;
    setIsGeneratingPDF(true);
    try {
      const blob = await generateProposalPDFv2(proposalData, {
        isDraft: quote?.status === 'draft',
      });
      downloadPDF(
        blob,
        `proposta-${(quote?.quote_number || 'sem-numero').replace(/\s+/g, '')}.pdf`,
      );
      toast.success('PDF gerado com sucesso!');
    } catch {
      toast.error('Erro ao gerar PDF');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const approvalLink = useMemo(
    () => (quote ? `${window.location.origin}/orcamentos/${quote.id}` : null),
    [quote],
  );

  const handleShareLink = () => {
    if (!approvalLink) return;
    void navigator.clipboard
      .writeText(approvalLink)
      .then(() => toast.success('Link copiado!'))
      .catch(() => toast.error('Não foi possível copiar o link'));
  };

  const handleWhatsAppShare = () => {
    const lines = [
      `📋 *Proposta Comercial ${quote?.quote_number ?? ''}*`,
      '',
      `💰 Valor Total: *${formatCurrencyHelper(quote?.total || 0)}*`,
    ];
    if (quote?.valid_until) {
      lines.push(
        `📅 Válida até: ${format(new Date(quote.valid_until), 'dd/MM/yyyy', { locale: ptBR })}`,
      );
    }
    lines.push('', 'Qualquer dúvida, estou à disposição! 😊');
    const message = encodeURIComponent(lines.join('\n'));
    const phone = quote?.client_phone?.replace(/\D/g, '') ?? '';
    const url = phone
      ? `https://wa.me/55${phone}?text=${message}`
      : `https://wa.me/?text=${message}`;
    window.open(url, '_blank');
    toast.success('WhatsApp aberto!');
  };

  const handleSyncBitrix = async () => {
    if (!quote || !proposalData) return;
    setIsSyncing(true);
    try {
      const { syncQuoteToBitrix } = await import('./QuoteBitrixSync');
      const result = await syncQuoteToBitrix({
        quote,
        proposalData,
        bitrixCompanyId,
        userEmail: user?.email,
        logQuoteHistory,
        onBitrixCompanyIdFound: (newId) => setBitrixCompanyId(newId),
      });
      if (result.success && result.updatedQuote) {
        setQuote((prev) => (prev ? { ...prev, ...result.updatedQuote } : prev));
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'erro desconhecido';
      toast.error('Erro ao sincronizar', { description: msg });
    } finally {
      setIsSyncing(false);
    }
  };

  return {
    quote,
    setQuote,
    isLoadingQuote,
    clientCnpj,
    bitrixCompanyId,
    isGeneratingPDF,
    isSyncing,
    showPresentation,
    setShowPresentation,
    proposalData,
    approvalLink,
    // Actions
    handleDownloadPDF,
    handleWhatsAppShare,
    handleShareLink,
    handleSyncBitrix,
    // Quotes
    fetchQuote,
    logQuoteHistory,
    duplicateQuote,
  };
}
