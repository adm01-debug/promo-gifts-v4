import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ArrowLeft, Copy, CreditCard, Edit2, Eye, FileText, History, Loader2, Monitor, MoreHorizontal, Package, RefreshCw, Shield, Truck, Undo2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { PageSEO } from "@/components/seo/PageSEO";
import { formatPaymentTerms, formatDeliveryTime, ProposalHtmlTemplate } from "@/components/pdf/ProposalHtmlTemplate";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { QuoteHistoryPanel } from "@/components/quotes/QuoteHistoryPanel";
import { toast } from "sonner";
import { QuoteStatusTimeline } from "@/components/quotes/QuoteStatusTimeline";
import { QuoteValidityBanner } from "@/components/quotes/QuoteValidityBanner";
import { QuoteMobileActionBar } from "@/components/quotes/QuoteMobileActionBar";
import { QuoteCommentsSection } from "@/components/quotes/QuoteCommentsSection";
import { QuoteVersionHistory } from "@/components/quotes/QuoteVersionHistory";
import { PresentationMode } from "@/components/presentation/PresentationMode";
import { QuoteClientInfo } from "@/components/quotes/QuoteClientInfo";
import { QuoteItemsTable } from "@/components/quotes/QuoteItemsTable";
import { QuoteTotalsSummary } from "@/components/quotes/QuoteTotalsSummary";
import { PdfGenerationDialog } from "@/components/quotes/PdfGenerationDialog";
import { QUOTE_STATUS_CONFIG } from "@/lib/quote-status-config";
import { useQuoteViewData } from "./quote-view/useQuoteViewData";
import { useDiscountApproval, type DiscountApprovalRequest } from "@/hooks/useDiscountApproval";

const statusConfig = Object.fromEntries(
  Object.entries(QUOTE_STATUS_CONFIG).map(([k, v]) => [k, { label: v.label, variant: v.badgeVariant }])
) as Record<string, { label: string; variant: "default" | "secondary" | "destructive" | "outline" }>;

export default function QuoteViewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { getApprovalStatus } = useDiscountApproval();
  const [approvalRequest, setApprovalRequest] = useState<DiscountApprovalRequest | null>(null);

  const {
    quote, setQuote, isLoadingQuote, clientCnpj,
    isGeneratingPDF, isSyncing, approvalLink,
    showPresentation, setShowPresentation, proposalData,
    handleDownloadPDF, handleWhatsAppShare, handleShareLink,
    handleSyncBitrix, logQuoteHistory, duplicateQuote,
  } = useQuoteViewData(id);

  useEffect(() => {
    if (id && quote?.status === "pending_approval") {
      getApprovalStatus(id).then(setApprovalRequest);
    }
  }, [id, quote?.status, getApprovalStatus]);

  if (isLoadingQuote) {
    return (
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
          <Skeleton className="h-10 w-48" />
          <Skeleton className="h-[600px] w-full" />
        </div>
    );
  }

  if (!quote) {
    return (
        <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
          <div className="text-center py-12">
            <FileText className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h2 className="font-display text-xl font-semibold">Orçamento não encontrado</h2>
            <p className="text-muted-foreground mt-2">O orçamento solicitado não existe ou foi removido.</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate("/orcamentos")}>
              <ArrowLeft className="h-4 w-4 mr-2" /> Voltar para Orçamentos
            </Button>
          </div>
        </div>
    );
  }

  const status = statusConfig[quote.status] || statusConfig.draft;

  return (
    <>
      <PageSEO title={`Orçamento ${quote.quote_number}`} description={`Visualização do orçamento ${quote.quote_number}`} path={`/orcamentos/${id}`} noIndex />
      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 py-3 sm:py-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in print:py-0 print:max-w-none print:px-0">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 print:hidden">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" aria-label="Voltar" onClick={() => navigate("/orcamentos")}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <div className="flex items-center gap-3">
                <h1 data-testid="page-title-quote-view" className="font-display text-2xl font-bold">Orçamento {quote.quote_number}</h1>
                <Badge variant={status.variant}>{status.label}</Badge>
              </div>
              <p className="text-muted-foreground">
                Criado em {quote.created_at ? format(new Date(quote.created_at), "dd 'de' MMMM 'de' yyyy", { locale: ptBR }) : "-"}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {quote.status !== "pending_approval" && (
            <div className="hidden md:flex items-center gap-2">
              <Button onClick={handleSyncBitrix} disabled={isSyncing} className="gap-2 bg-primary hover:bg-primary/90 text-primary-foreground">
                {isSyncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                {isSyncing ? "Sincronizando..." : "Sincronizar"}
              </Button>
            </div>
            )}

            {quote.status !== "pending_approval" && (
            <PdfGenerationDialog
              proposalData={proposalData}
              quoteNumber={quote.quote_number}
              quoteStatus={quote.status}
              clientPhone={quote.client_phone}
              approvalLink={approvalLink}
              onWhatsApp={handleWhatsAppShare}
              onShareLink={handleShareLink}
              trigger={<Button className="gap-2"><Eye className="h-4 w-4" /> Preview Proposta</Button>}
            />
            )}

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="icon" aria-label="Mais opções"><MoreHorizontal className="h-4 w-4" /></Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {(quote.status === "sent" || isSyncing) && (
                  <DropdownMenuItem
                    onClick={async () => {
                      try {
                        // rls-allow: lookup por id; RLS valida ownership
                        await supabase.from("quotes").update({ status: "pending" } as Record<string, unknown>).eq("id", quote.id);
                        await logQuoteHistory(quote.id, "status_change", "Status revertido para Pendente", { oldValue: "sent", newValue: "pending" });
                        setQuote((prev) => prev ? { ...prev, status: "pending" } : prev);
                        toast.success("Sincronização cancelada");
                      } catch (err: unknown) {
                        const msg = err instanceof Error ? err.message : "Erro";
                        toast.error("Erro ao cancelar", { description: msg });
                      }
                    }}
                    className="text-destructive focus:text-destructive"
                  >
                    <Undo2 className="h-4 w-4 mr-2" /> Cancelar Sincronização
                  </DropdownMenuItem>
                )}
                <DropdownMenuItem onClick={() => navigate(`/orcamentos/${id}/editar`)}>
                  <Edit2 className="h-4 w-4 mr-2" /> Editar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={async () => {
                  const newQuote = await duplicateQuote(id!);
                  if (newQuote?.id) navigate(`/orcamentos/${newQuote.id}`);
                }}>
                  <Copy className="h-4 w-4 mr-2" /> Duplicar
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setShowPresentation(true)}>
                  <Monitor className="h-4 w-4 mr-2" /> Modo Apresentação
                </DropdownMenuItem>
                <Sheet>
                  <SheetTrigger asChild>
                    <DropdownMenuItem onSelect={(e) => e.preventDefault()}>
                      <History className="h-4 w-4 mr-2" /> Histórico
                    </DropdownMenuItem>
                  </SheetTrigger>
                  <SheetContent>
                    <SheetHeader><SheetTitle>Histórico de Alterações</SheetTitle></SheetHeader>
                    <div className="mt-6"><QuoteHistoryPanel quoteId={id!} /></div>
                  </SheetContent>
                </Sheet>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Status Timeline + Validity Banner */}
        <div className="flex flex-col md:flex-row gap-4 items-start print:hidden">
          <div className="flex-1 bg-card border rounded-lg p-4">
            <QuoteStatusTimeline status={quote.status} createdAt={quote.created_at} updatedAt={quote.updated_at} clientResponseAt={quote.client_response_at} isSyncing={isSyncing} />
          </div>
          <QuoteValidityBanner validUntil={quote.valid_until} status={quote.status} />
        </div>

        {/* Discount Approval Banner */}
        {quote.status === "pending_approval" && (
          <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.06] px-4 py-3 flex items-center gap-3 print:hidden">
            <div className="p-2 rounded-lg bg-amber-500/15 shrink-0">
              <Shield className="h-5 w-5 text-amber-500" />
            </div>
            <div className="flex-1">
              <p className="font-semibold text-sm text-amber-600">Aguardando aprovação de desconto</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {approvalRequest
                  ? `Desconto de ${approvalRequest.requested_discount_percent}% solicitado (limite: ${approvalRequest.max_allowed_percent}%). Aguardando decisão do administrador.`
                  : "Este orçamento está aguardando a aprovação do administrador para o desconto aplicado."}
              </p>
            </div>
            <Badge variant="secondary" className="bg-amber-500/15 text-amber-600 border-amber-500/30 gap-1 shrink-0">
              <Shield className="h-3 w-3" /> Pendente
            </Badge>
          </div>
        )}

        {/* Quote Content */}
        <Card className="print:hidden">
          <Separator />
          <CardContent className="pt-6 space-y-6">
            <QuoteClientInfo
              clientCompany={quote.client_company}
              clientName={quote.client_name}
              clientEmail={quote.client_email}
              clientPhone={quote.client_phone}
              clientCnpj={clientCnpj}
            />
            <Separator />
            <QuoteItemsTable items={quote.items || []} />
            <QuoteTotalsSummary
              items={quote.items || []}
              discountPercent={quote.discount_percent}
              discountAmount={quote.discount_amount}
              shippingType={quote.shipping_type}
              shippingCost={quote.shipping_cost}
            />

            {(quote.payment_terms || quote.delivery_time) && (
              <>
                <Separator />
                <div>
                  <h3 className="font-display font-semibold mb-4">Condições Comerciais</h3>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    {quote.payment_terms && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                        <CreditCard className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Pagamento</p>
                          <p className="text-sm font-medium mt-0.5">{formatPaymentTerms(quote.payment_terms) || quote.payment_terms}</p>
                        </div>
                      </div>
                    )}
                    {quote.delivery_time && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                        <Package className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Prazo de Entrega</p>
                          <p className="text-sm font-medium mt-0.5">{formatDeliveryTime(quote.delivery_time) || quote.delivery_time}</p>
                        </div>
                      </div>
                    )}
                    {quote.shipping_method && (
                      <div className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border/50">
                        <Truck className="h-5 w-5 text-primary mt-0.5 shrink-0" />
                        <div>
                          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Frete</p>
                          <p className="text-sm font-medium mt-0.5">{quote.shipping_method}</p>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </>
            )}

            {quote.notes && (
              <>
                <Separator />
                <div>
                  <h3 className="font-display font-semibold mb-2">Observações</h3>
                  <p className="text-muted-foreground whitespace-pre-line">{quote.notes}</p>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {id && <QuoteVersionHistory quoteId={id} currentQuoteId={id} />}
        {id && <QuoteCommentsSection quoteId={id} />}

        {proposalData && (
          <div className="hidden print:block print:p-0">
            <ProposalHtmlTemplate data={proposalData} />
          </div>
        )}
      </div>

      <QuoteMobileActionBar
        onDownloadPDF={handleDownloadPDF}
        onWhatsApp={handleWhatsAppShare}
        onSync={handleSyncBitrix}
        isSyncing={isSyncing}
        onShare={handleShareLink}
        isGeneratingPDF={isGeneratingPDF}
      />

    {showPresentation && quote?.items && quote.items.length > 0 && (
      <PresentationMode
        title={`Proposta ${quote.quote_number || ""}`}
        subtitle={quote.client_company || quote.client_name || undefined}
        brandName="Promo Brindes"
        onClose={() => setShowPresentation(false)}
        slides={quote.items.map((item) => ({
          id: item.id || item.product_id,
          title: item.product_name,
          subtitle: item.product_sku ? `SKU: ${item.product_sku}` : undefined,
          imageUrl: item.product_image_url || null,
          badge: item.kit_name || (item.color_name || null),
          details: [
            ...(item.quantity ? [{ label: "Quantidade", value: String(item.quantity) }] : []),
            ...(item.color_name ? [{ label: "Cor", value: item.color_name }] : []),
            ...(item.personalizations?.length ? [{ label: "Personalização", value: item.personalizations.map(p => p.technique_name).filter(Boolean).join(", ") || "Sim" }] : []),
          ],
        }))}
      />
    )}
    </>
  );
}
