/**
 * QuoteViewPage action handlers — extracted for modularity
 */
import { supabase } from '@/integrations/supabase/client';
import { generateProposalPDFv2, downloadPDF } from '@/utils/proposalPdfReactGenerator';
import type { ProposalTemplateData } from '@/components/pdf/ProposalHtmlTemplate';
import type { TablesUpdate } from '@/integrations/supabase/types';
import type { Quote } from '@/hooks/quotes';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { logger } from '@/lib/logger';

export function formatCurrency(value: number): string {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function calcPersTotal(totalCost: number, qty: number): number {
  if (qty <= 0) return totalCost;
  const roundedUnit = Math.round((totalCost / qty) * 100) / 100;
  return Math.round(roundedUnit * qty * 100) / 100;
}

export function formatCNPJ(cnpj: string): string {
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length === 14) {
    return `${digits.slice(0, 2)}.${digits.slice(2, 5)}.${digits.slice(5, 8)}/${digits.slice(8, 12)}-${digits.slice(12, 14)}`;
  }
  return cnpj;
}

export async function handleDownloadPDF(
  proposalData: ProposalTemplateData | null,
  quote: Quote | null,
): Promise<void> {
  if (!proposalData || !quote) return;
  const blob = await generateProposalPDFv2(proposalData, { isDraft: quote.status === 'draft' });
  downloadPDF(blob, `proposta-${(quote.quote_number || 'sem-numero').replace(/\s+/g, '')}.pdf`);
  toast.success('PDF gerado com sucesso!');
}

export function buildWhatsAppUrl(quote: Quote, approvalLink: string | null): string {
  const lines = [
    `📋 *Proposta Comercial ${quote.quote_number ?? ''}*`,
    '',
    `💰 Valor Total: *${formatCurrency(quote.total ?? 0)}*`,
  ];
  if (quote.valid_until) {
    lines.push(
      `📅 Válida até: ${format(new Date(quote.valid_until), 'dd/MM/yyyy', { locale: ptBR })}`,
    );
  }
  if (approvalLink) {
    lines.push('', `✅ Aprovar proposta: ${approvalLink}`);
  }
  lines.push('', 'Qualquer dúvida, estou à disposição! 😊');
  const message = encodeURIComponent(lines.join('\n'));
  const phone = quote.client_phone?.replace(/\D/g, '') ?? '';
  return phone ? `https://wa.me/55${phone}?text=${message}` : `https://wa.me/?text=${message}`;
}

export async function handleSyncBitrix(params: {
  quote: Quote;
  proposalData: ProposalTemplateData;
  bitrixCompanyId: string | null;
  userEmail: string | undefined;
  logQuoteHistory: (
    qId: string,
    action: string,
    desc: string,
    meta?: Record<string, unknown>,
  ) => Promise<void>;
  setQuote: React.Dispatch<React.SetStateAction<Quote | null>>;
  selectCrmById: <T>(table: string, id: string) => Promise<T>;
}): Promise<void> {
  const { quote, proposalData, logQuoteHistory, setQuote, userEmail, selectCrmById } = params;

  if (!quote.id) {
    toast.error('Orçamento sem identificador válido');
    return;
  }
  const quoteId = quote.id;

  let effectiveBitrixCompanyId = params.bitrixCompanyId;
  if (!effectiveBitrixCompanyId && quote.client_id) {
    try {
      const company = await selectCrmById<{ bitrix_company_id?: string; bitrix_id?: string }>(
        'companies',
        quote.client_id,
      );
      const bId = company?.bitrix_company_id ?? company?.bitrix_id;
      if (bId) effectiveBitrixCompanyId = String(bId);
    } catch {
      /* ignore */
    }
  }

  if (!effectiveBitrixCompanyId) {
    toast.error('Empresa sem ID Bitrix24', {
      description: 'Esta empresa não possui um vínculo com o Bitrix24.',
    });
    return;
  }

  const itemsSemBitrixId = quote.items?.filter((item) => !item.bitrix_product_id) ?? [];
  const itensSincronizaveis = quote.items?.filter((item) => !!item.bitrix_product_id) ?? [];

  if (itensSincronizaveis.length === 0) {
    toast.error('Nenhum produto com ID Bitrix24');
    return;
  }

  if (itemsSemBitrixId.length > 0) {
    const nomes = itemsSemBitrixId
      .map((i) => `${i.product_name}${i.color_name ? ` - ${i.color_name}` : ''}`)
      .join(', ');
    toast.warning(`${itemsSemBitrixId.length} produto(s) excluído(s) da sincronização`, {
      description: `Sem ID Bitrix24: ${nomes}`,
      duration: 7000,
    });
  }

  logQuoteHistory(quoteId, 'sync_started', 'Sincronização com Bitrix24 iniciada').catch((err) => {
    logger.warn('logQuoteHistory(sync_started) failed', { err, quoteId });
  });

  // Generate and upload PDF
  let pdfStorageUrl: string | undefined;
  let filename: string | undefined;
  try {
    const blob = await generateProposalPDFv2(proposalData, { isDraft: quote.status === 'draft' });
    filename = `proposta-${(quote.quote_number || quoteId).replace(/\s+/g, '')}.pdf`;
    const storagePath = `quotes/${quoteId}/${filename}`;
    const { error: uploadError } = await supabase.storage
      .from('art-files')
      .upload(storagePath, blob, { contentType: 'application/pdf', upsert: true });
    if (!uploadError) {
      const { data: urlData } = supabase.storage.from('art-files').getPublicUrl(storagePath);
      pdfStorageUrl = urlData.publicUrl;
    }
  } catch (pdfErr) {
    logger.warn('PDF generation failed:', pdfErr);
  }

  const { data, error } = await supabase.functions.invoke('sync-quote-bitrix', {
    body: {
      quote,
      proposalData,
      pdfUrl: pdfStorageUrl,
      filename,
      bitrixCompanyId: effectiveBitrixCompanyId,
      sellerEmail: userEmail,
      shippingType: quote.shipping_type,
      shippingCost: quote.shipping_cost,
    },
  });

  if (error || !data?.success)
    throw new Error(data?.error || error?.message || 'Erro desconhecido');

  const result = data.result;
  const parsedBitrixId = result?.quote_id ? Number(result.quote_id) : null;
  const bitrixQuoteIdFromResponse =
    parsedBitrixId && !Number.isNaN(parsedBitrixId) ? String(parsedBitrixId) : null;

  const crmUpdates: TablesUpdate<'quotes'> = { status: 'sent' };
  if (bitrixQuoteIdFromResponse) crmUpdates.bitrix_quote_id = bitrixQuoteIdFromResponse;

  try {
    // rls-allow: update por id; RLS valida ownership
    await supabase.from('quotes').update(crmUpdates).eq('id', quoteId);
  } catch {
    /* ignore */
  }

  await logQuoteHistory(
    quoteId,
    'sync_success',
    `Sincronizado com Bitrix24${bitrixQuoteIdFromResponse ? ` — ID Bitrix: ${bitrixQuoteIdFromResponse}` : ''}`,
    { newValue: bitrixQuoteIdFromResponse ?? undefined },
  );

  setQuote((prev) =>
    prev
      ? {
          ...prev,
          status: 'sent',
          ...(bitrixQuoteIdFromResponse ? { bitrix_quote_id: bitrixQuoteIdFromResponse } : {}),
        }
      : prev,
  );
  toast.success(result?.message || 'Orçamento sincronizado com Bitrix24!');
}
