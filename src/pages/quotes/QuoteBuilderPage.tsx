/**
 * QuoteBuilderPage — Módulo de criação/edição de orçamentos
 * Refatorado: lógica em useQuoteBuilderState, UI em sub-componentes.
 */

import { useState } from 'react';
import { PageSEO } from '@/components/seo/PageSEO';
import { cn } from '@/lib/utils';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import {
  FileText,
  Plus,
  Package,
  
  AlertTriangle,
  Calendar as CalendarIcon,
  Sparkles,
  ExternalLink,
  Info,
  MessageSquare,
  
} from 'lucide-react';
// FIX-C01: adicionado startOfDay para corrigir Calendar disabled — hoje sempre era bloqueado
import { format, addDays, startOfDay } from 'date-fns';

import { QuoteProductCustomization } from '@/components/quotes/QuoteProductCustomization';
import { CompanyContactSelector } from '@/components/quotes/CompanyContactSelector';
import { QuoteAutoSave } from '@/components/quotes/QuoteAutoSave';
import { QuoteConcurrencyAlert } from '@/components/quotes/QuoteConcurrencyAlert';
import { DraggableQuoteItems } from '@/components/quotes/DraggableQuoteItems';
import { QuoteBuilderStepper } from '@/components/quotes/QuoteBuilderStepper';
import { QuoteBuilderSummaryColumn } from '@/components/quotes/QuoteBuilderSummaryColumn';
import { QuoteBuilderSkeleton } from '@/components/quotes/QuoteBuilderSkeleton';


import { QuoteBuilderProductSearch } from '@/components/quotes/QuoteBuilderProductSearch';
import { useQuoteBuilderState } from '@/hooks/quotes';
import { useUnsavedChangesGuard } from '@/hooks/common';
import { UnsavedChangesDialog } from '@/components/common/UnsavedChangesDialog';

export default function QuoteBuilderPage() {
  const s = useQuoteBuilderState();
  const { conflictInfo, dismissConflict, overwriteAndSave } = s;
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  // FIX-E04: tracks the last successful server save so QuoteAutoSave can reset its baseline.
  const [serverSavedAt, setServerSavedAt] = useState<number | undefined>(undefined);
  const { showDialog, confirmLeave, cancelLeave, message } = useUnsavedChangesGuard({
    hasUnsavedChanges,
  });

  if (s.loadingQuote) {
    return <QuoteBuilderSkeleton />;
  }

  // FIX-E04: wrap handleSaveQuote to signal QuoteAutoSave when a server save succeeds.
  const handleSaveQuoteWithSignal = async (
    ...args: Parameters<typeof s.handleSaveQuote>
  ) => {
    const result = await s.handleSaveQuote(...args);
    // handleSaveQuote returns updated_at string on success, undefined on failure/early-return
    if (result !== undefined) setServerSavedAt(Date.now());
    return result;
  };

  return (
    <>
      <PageSEO
        title={s.quoteId ? 'Editar Orçamento' : 'Novo Orçamento'}
        description="Crie e edite orçamentos com seleção de produtos e personalização."
        path="/orcamentos/novo"
        noIndex
      />

      <QuoteAutoSave
        quoteId={s.quoteId}
        data={{
          clientId: s.clientId,
          contactId: s.contactId,
          validUntil: s.validUntil,
          discountType: s.discountType,
          discountValue: s.discountValue,
          // Inclui a margem de negociação na detecção de alterações para que
          // ajustar SÓ o markup também dispare o aviso de "alterações não salvas".
          negotiationMarkup: s.negotiationMarkup,
          paymentMethod: s.paymentMethod,
          paymentTerms: s.paymentTerms,
          deliveryTime: s.deliveryTime,
          shippingType: s.shippingType,
          shippingCost: s.shippingCost,
          notes: s.notes,
          items: s.items,
        }}
        onChange={setHasUnsavedChanges}
        serverSavedAt={serverSavedAt}
        className="fixed right-4 top-20 z-40"
      />

      {conflictInfo && (
        <div className="px-4 pt-4 lg:px-6 xl:px-8">
          <QuoteConcurrencyAlert
            conflict={conflictInfo}
            onReload={() => {
              dismissConflict();
              window.location.reload();
            }}
            onOverwrite={() => overwriteAndSave()}
          />
        </div>
      )}

      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 pb-[calc(6rem+env(safe-area-inset-bottom))] pt-3 sm:space-y-4 sm:px-4 sm:pb-24 sm:pt-4 lg:px-6 lg:pb-28 xl:px-8">
        <div aria-live="polite" className="sr-only" role="status" id="quote-builder-announcer" />
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-xl bg-primary/10 p-2.5">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1
                data-testid={
                  s.isEditMode ? 'page-title-orcamento-editar' : 'page-title-orcamento-novo'
                }
                className="font-display text-xl font-bold leading-tight sm:text-2xl"
              >
                {s.isEditMode ? 'Editar Orçamento' : 'Novo Orçamento'}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                {s.isEditMode
                  ? 'Atualize os produtos, condições e personalizações do orçamento'
                  : 'Crie um orçamento com produtos e personalizações'}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2" />
        </div>

        <QuoteBuilderStepper
          completedSteps={s.completedSteps}
          activeStep={s.activeStep}
          onStepClick={s.goToStep}
        />


        <div data-testid="quote-builder-grid" className="grid min-w-0 gap-4 lg:grid-cols-12">
          {/* COL 1 — Cliente + Condições */}
          <div className="min-w-0 lg:col-span-3">
            <div className="space-y-3 pr-1">
              <div
                className={cn(
                  'space-y-4 rounded-2xl border bg-card p-4',
                  s.validationErrors.includes('empresa') || s.validationErrors.includes('contato')
                    ? 'border-destructive/50'
                    : 'border-border/50',
                )}
              >
                <CompanyContactSelector
                  companyId={s.clientId}
                  contactId={s.contactId}
                  onCompanyChange={s.setClientId}
                  onContactChange={s.setContactId}
                  onCompanyInfoChange={s.setCompanyInfo}
                  onContactInfoChange={s.setContactInfo}
                />
                {(s.validationErrors.includes('empresa') ||
                  s.validationErrors.includes('contato')) && (
                  <p className="flex items-center gap-1 text-xs text-destructive">
                    <AlertTriangle className="h-3 w-3 shrink-0" />
                    {s.validationErrors.includes('empresa')
                      ? 'Selecione uma empresa'
                      : 'Selecione um contato'}
                  </p>
                )}
              </div>

              {/* Validade */}
              <div className="space-y-3 rounded-2xl border border-border/50 bg-card p-4">
                <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
                  <span className="text-primary">📅</span>Validade | Proposta
                </h3>
                <Select
                  value={s.validityDays}
                  onValueChange={(val) => {
                    s.setValidityDays(val);
                    s.setValidUntil(
                      format(addDays(new Date(), parseInt(val, 10) || 1), 'yyyy-MM-dd'),
                    );
                  }}
                >
                  <SelectTrigger className="h-8 text-xs">
                    <SelectValue placeholder="Selecione" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">1 dia</SelectItem>
                    <SelectItem value="3">3 dias</SelectItem>
                    <SelectItem value="7">7 dias</SelectItem>
                    <SelectItem value="15">15 dias</SelectItem>
                    <SelectItem value="30">30 dias</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Condições Comerciais */}
              <div
                className={cn(
                  'space-y-3 rounded-2xl border bg-card p-4',
                  s.validationErrors.includes('prazo_pagamento') ||
                    s.validationErrors.includes('prazo_entrega') ||
                    s.validationErrors.includes('frete') ||
                    s.validationErrors.includes('valor_frete')
                    ? 'border-destructive/50'
                    : 'border-border/50',
                )}
              >
                <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
                  <Package className="h-4 w-4 text-primary" />
                  Condições
                </h3>

                <div className="space-y-1.5">
                  <Label
                    className={cn(
                      'text-xs',
                      s.validationErrors.includes('forma_pagamento')
                        ? 'text-destructive'
                        : 'text-muted-foreground',
                    )}
                  >
                    Forma | Pagamento{' '}
                    {s.validationErrors.includes('forma_pagamento') && (
                      <span className="ml-1">*</span>
                    )}
                  </Label>
                  <Select
                    data-testid="payment-method-select-root"
                    value={s.paymentMethod}
                    onValueChange={s.setPaymentMethod}
                  >
                    <SelectTrigger
                      data-testid="payment-method-select"
                      className={cn(
                        'h-8 text-xs',
                        s.validationErrors.includes('forma_pagamento') && 'border-destructive',
                      )}
                    >
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="boleto">Boleto Bancário</SelectItem>
                      <SelectItem value="pix_transferencia">
                        Transferência Bancária / Pix
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <Label
                    className={cn(
                      'text-xs',
                      s.validationErrors.includes('prazo_pagamento')
                        ? 'text-destructive'
                        : 'text-muted-foreground',
                    )}
                  >
                    Prazo | Pagamento{' '}
                    {s.validationErrors.includes('prazo_pagamento') && (
                      <span className="ml-1">*</span>
                    )}
                  </Label>
                  <Select
                    data-testid="payment-terms-select-root"
                    value={s.paymentTerms}
                    onValueChange={s.setPaymentTerms}
                  >
                    <SelectTrigger
                      data-testid="payment-terms-select"
                      className={cn(
                        'h-8 text-xs',
                        s.validationErrors.includes('prazo_pagamento') && 'border-destructive',
                      )}
                    >
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="7_dias">7 dias a partir da entrega</SelectItem>
                      <SelectItem value="14_dias">14 dias a partir da entrega</SelectItem>
                      <SelectItem value="21_dias">21 dias a partir da entrega</SelectItem>
                      <SelectItem value="28_dias">28 dias a partir da entrega</SelectItem>
                      <SelectItem value="7_14_dias">7 e 14 dias a partir da entrega</SelectItem>
                      <SelectItem value="50_50">50/50 | 50% entrada / 50% após entrega</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Entrega */}
                <div className="mt-1 space-y-1.5 border-t border-border/30 pt-3">
                  <div className="flex items-center gap-1.5" data-testid="delivery-label-container">
                    <Label
                      data-testid="delivery-label"
                      className={cn(
                        'text-xs',
                        s.validationErrors.includes('prazo_entrega')
                          ? 'text-destructive'
                          : 'text-muted-foreground',
                      )}
                    >
                      Prazo | Entrega{' '}
                      {s.validationErrors.includes('prazo_entrega') && (
                        <span className="ml-1">*</span>
                      )}
                    </Label>
                    <TooltipProvider>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span
                            data-testid="delivery-info-tooltip-trigger"
                            className="inline-flex cursor-help align-middle text-muted-foreground/60 transition-colors hover:text-primary"
                          >
                            <Info
                              className="h-3 w-3"
                              aria-label="Informação sobre prazo de entrega"
                            />
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          data-testid="delivery-info-tooltip-content"
                          side="top"
                          className="max-w-xs text-[11px] leading-relaxed"
                        >
                          Antes de assumir o compromisso com seu Cliente, valide com todo o time
                          (Fornecedores, Coordenador de Compras, Coordenador de Logística) a
                          viabilidade do prazo.
                        </TooltipContent>
                      </Tooltip>
                    </TooltipProvider>
                  </div>

                  <div className="flex flex-col gap-1.5 rounded-xl border border-border/40 bg-muted/30 p-1.5">
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => s.handleDeliveryModeChange('prazo')}
                        className={cn(
                          'flex-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-all',
                          s.deliveryMode === 'prazo'
                            ? 'bg-background text-primary shadow-sm ring-1 ring-border/50'
                            : 'text-muted-foreground hover:bg-muted/50',
                        )}
                      >
                        Contar dias
                      </button>
                      <button
                        type="button"
                        onClick={() => s.handleDeliveryModeChange('data')}
                        className={cn(
                          'flex-1 rounded-lg px-2 py-1 text-[11px] font-semibold transition-all',
                          s.deliveryMode === 'data'
                            ? 'bg-background text-primary shadow-sm ring-1 ring-border/50'
                            : 'text-muted-foreground hover:bg-muted/50',
                        )}
                      >
                        Data fixa
                      </button>
                    </div>
                  </div>
                  {s.deliveryMode === 'prazo' ? (
                    <Select
                      data-testid="delivery-time-select-root"
                      value={s.deliveryTime}
                      onValueChange={s.setDeliveryTime}
                    >
                      <SelectTrigger
                        data-testid="delivery-time-select"
                        className={cn(
                          'h-8 text-xs',
                          s.validationErrors.includes('prazo_entrega') && 'border-destructive',
                        )}
                      >
                        <SelectValue placeholder="Selecione" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="7_dias">7 dias | Após aprovação</SelectItem>
                        <SelectItem value="14_dias">14 dias | Após aprovação</SelectItem>
                        <SelectItem value="21_dias">21 dias | Após aprovação</SelectItem>
                        <SelectItem value="28_dias">28 dias | Após aprovação</SelectItem>
                        <SelectItem value="45_dias">45 dias | Após aprovação</SelectItem>
                      </SelectContent>
                    </Select>
                  ) : (
                    <Popover>
                      <PopoverTrigger asChild>
                        <Button
                          data-testid="delivery-date-picker"
                          variant="outline"
                          className={cn(
                            'h-8 w-full justify-start text-left text-xs font-normal',
                            !s.deliveryDate && 'text-muted-foreground',
                            s.validationErrors.includes('prazo_entrega') && 'border-destructive',
                          )}
                        >
                          <CalendarIcon className="mr-2 h-3.5 w-3.5" />
                          {s.deliveryDate
                            ? format(s.deliveryDate, 'dd/MM/yyyy')
                            : 'Selecione a data'}
                        </Button>
                      </PopoverTrigger>
                      <PopoverContent className="w-auto p-0" align="start">
                        <Calendar
                          mode="single"
                          selected={s.deliveryDate}
                          onSelect={s.handleDeliveryDateChange}
                          disabled={(date) => date < startOfDay(new Date())}
                          initialFocus
                        />
                      </PopoverContent>
                    </Popover>
                  )}
                </div>

                {/* Frete */}
                <div className="mt-1 space-y-1.5 border-t border-border/30 pt-3">
                  <Label
                    className={cn(
                      'text-xs',
                      s.validationErrors.includes('frete')
                        ? 'text-destructive'
                        : 'text-muted-foreground',
                    )}
                  >
                    Frete {s.validationErrors.includes('frete') && <span className="ml-1">*</span>}
                  </Label>
                  <Select
                    data-testid="shipping-type-select-root"
                    value={s.shippingType}
                    onValueChange={s.setShippingType}
                  >
                    <SelectTrigger
                      data-testid="shipping-type-select"
                      className={cn(
                        'h-8 text-xs',
                        s.validationErrors.includes('frete') && 'border-destructive',
                      )}
                    >
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cif">CIF | Frete grátis</SelectItem>
                      <SelectItem value="fob">FOB | Repassado ao cliente</SelectItem>
                      <SelectItem value="fob_pre">FOB | Valor pré negociado</SelectItem>
                    </SelectContent>
                  </Select>
                  {s.validationErrors.includes('frete') && (
                    <p className="mt-0.5 flex items-center gap-1 text-[10px] text-destructive">
                      <AlertTriangle className="h-3 w-3" />
                      Selecione a modalidade de frete
                    </p>
                  )}
                  {s.shippingType === 'fob_pre' && (
                    <div className="mt-1.5 space-y-1">
                      <Label
                        className={cn(
                          'text-xs',
                          s.validationErrors.includes('valor_frete')
                            ? 'text-destructive'
                            : 'text-muted-foreground',
                        )}
                      >
                        Valor R${' '}
                        {s.validationErrors.includes('valor_frete') && (
                          <span className="ml-1">*</span>
                        )}
                      </Label>
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs text-muted-foreground">R$</span>
                        <CurrencyInput
                          data-testid="shipping-cost-input"
                          value={s.shippingCost || 0}
                          onChange={(n) => s.setShippingCost(Math.max(0, n))}
                          className={cn(
                            'h-8 text-xs',
                            s.validationErrors.includes('valor_frete') && 'border-destructive',
                          )}
                        />
                      </div>
                    </div>
                  )}
                </div>

                {s.companyInfo?.id && (
                  <a
                    href={`/ferramentas/bi?clientId=${s.companyInfo.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-3 transition-colors hover:border-primary/50 hover:bg-primary/10"
                  >
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10">
                      <Sparkles className="h-4 w-4 text-primary" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="font-display text-sm font-semibold leading-tight">
                        Inteligência completa deste cliente
                      </p>
                      <p className="mt-0.5 text-[11px] leading-tight text-muted-foreground">
                        Histórico, afinidade, sazonalidade e tendência do setor
                      </p>
                    </div>
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
                  </a>
                )}
              </div>

              {/* BUG-K FIX: Notes UI — previously only populated via templates */}
              <div className="space-y-3 rounded-2xl border border-border/50 bg-card p-4">
                <h3 className="flex items-center gap-2 font-display text-sm font-semibold">
                  <MessageSquare className="h-4 w-4 text-primary" />
                  Observações
                </h3>
                <div className="space-y-1.5">
                  <Label className="text-xs text-muted-foreground">Para o cliente</Label>
                  <Textarea
                    data-testid="quote-notes-input"
                    value={s.notes || ''}
                    onChange={(e) => s.setNotes(e.target.value)}
                    placeholder="Observações visíveis na proposta..."
                    rows={3}
                    maxLength={2000}
                    className="resize-none text-xs"
                  />
                  {s.notes && (
                    <p className="text-right text-[10px] text-muted-foreground">
                      {s.notes.length}/2000
                    </p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* COL 2 — Item ativo + Personalização */}
          <div className="min-w-0 lg:col-span-5">
            <div className="flex flex-col">
              <div className="flex flex-col rounded-2xl border border-border/50 bg-card">
                <div className="flex shrink-0 items-center justify-between p-4 pb-3">
                  <div>
                    <h3 className="font-display text-sm font-semibold">Itens do Orçamento</h3>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {s.items.length} item(ns) adicionado(s)
                    </p>
                  </div>
                  <Button
                    size="sm"
                    data-testid="quote-add-product-button"
                    onClick={() => s.setProductSearchOpen(true)}
                  >
                    <Plus className="mr-1.5 h-3.5 w-3.5" />
                    Produto
                  </Button>
                </div>
                <div className="px-4 pb-4">
                  {s.items.length === 0 ? (
                    <div className="py-12 text-center text-muted-foreground">
                      <Package className="mx-auto mb-3 h-10 w-10 opacity-30" />
                      <p className="text-sm font-medium">Nenhum item adicionado</p>
                      <p className="mt-1 text-xs">Pesquise e adicione produtos ao orçamento</p>
                    </div>
                  ) : s.activeItemIndex !== null && s.items[s.activeItemIndex] ? (
                    (() => {
                      const item = s.items[s.activeItemIndex];
                      const idx = s.activeItemIndex;
                      return (
                        <div className="space-y-3">
                          <DraggableQuoteItems
                            items={[item]}
                            onReorder={() => {}}
                            onUpdateQuantity={(_, qty) => s.updateItemQuantity(idx, qty)}
                            onUpdatePrice={(_, price) => s.updateItemPrice(idx, price)}
                            onRemove={() => {
                              s.removeItem(idx);
                              s.setActiveItemIndex(null);
                            }}
                            onConfirmPrice={() => s.confirmItemPrice(idx)}
                            onTogglePersonalization={() => s.toggleExpanded(idx)}
                            expandedItems={new Set(s.expandedItems.has(idx) ? [0] : [])}
                            renderPersonalization={() => (
                              <QuoteProductCustomization
                                productId={item.product_id}
                                quantity={item.quantity}
                                existingPersonalizations={item.personalizations}
                                onPersonalizationsChange={(p) =>
                                  s.handlePersonalizationsChange(idx, p)
                                }
                              />
                            )}
                            formatCurrency={s.formatCurrency}
                          />
                        </div>
                      );
                    })()
                  ) : (
                    <div className="py-12 text-center text-muted-foreground">
                      <Package className="mx-auto mb-3 h-10 w-10 opacity-30" />
                      <p className="text-sm font-medium">Selecione um item no resumo</p>
                      <p className="mt-1 text-xs">Ou adicione um novo produto</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* COL 3 — Resumo */}
          <QuoteBuilderSummaryColumn
            items={s.items}
            activeItemIndex={s.activeItemIndex}
            setActiveItemIndex={s.setActiveItemIndex}
            removeItem={s.removeItem}
            discountType={s.discountType}
            setDiscountType={s.setDiscountType}
            discountValue={s.discountValue}
            setDiscountValue={s.setDiscountValue}
            discountAmount={s.discountAmount}
            total={s.total}
            shippingType={s.shippingType}
            shippingCost={s.shippingCost}
            isFormValid={s.isFormValid}
            isDraftValid={s.isDraftValid}
            validationErrors={s.validationErrors}
            quotesLoading={s.quotesLoading}
            isEditMode={s.isEditMode}
            formatCurrency={s.formatCurrency}
            calculateItemPersonalizationTotal={s.calculateItemPersonalizationTotal}
            calculateItemTotal={s.calculateItemTotal}
            onSave={handleSaveQuoteWithSignal}
            maxDiscountPercent={s.maxDiscountPercent}
            isDiscountExceeded={s.isDiscountExceeded}
            negotiationMarkup={s.negotiationMarkup}
            setNegotiationMarkup={s.setNegotiationMarkup}
            realSubtotal={s.realSubtotal}
            realDiscountPercent={s.realDiscountPercent}
            confirmItemPrice={s.confirmItemPrice}
            confirmAllStalePrices={s.confirmAllStalePrices}
          />
        </div>
      </div>

      <QuoteBuilderProductSearch
        open={s.productSearchOpen}
        onOpenChange={s.setProductSearchOpen}
        productSearch={s.productSearch}
        setProductSearch={s.setProductSearch}
        filteredProducts={s.filteredProducts}
        selectedProductForColor={s.selectedProductForColor}
        setSelectedProductForColor={s.setSelectedProductForColor}
        onProductClick={s.handleProductClick}
        onAddWithColor={s.addProductWithColor}
        formatCurrency={s.formatCurrency}
      />

      <UnsavedChangesDialog
        open={showDialog}
        onConfirm={confirmLeave}
        onCancel={cancelLeave}
        message={message}
      />
    </>
  );
}
