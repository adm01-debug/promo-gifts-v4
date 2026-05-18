/**
 * QuoteBuilderPage — Módulo de criação/edição de orçamentos
 * Refatorado: lógica em useQuoteBuilderState, UI em sub-componentes.
 */

import { PageSEO } from '@/components/seo/PageSEO';
import { cn } from '@/lib/utils';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Textarea } from '@/components/ui/textarea';
import { CurrencyInput } from '@/components/ui/currency-input';
import {
  FileText, Plus, Package, Loader2, BookTemplate, ArrowLeft, ArrowRight,
  AlertTriangle, Calendar as CalendarIcon, Sparkles, Info, FileCheck, Send,
  Building2, CreditCard, Search, ExternalLink
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';

import { QuoteTemplateSelector } from '@/components/quotes/QuoteTemplateSelector';
import { SaveAsTemplateButton } from '@/components/quotes/SaveAsTemplateButton';
import { QuoteProductCustomization } from '@/components/quotes/QuoteProductCustomization';
import { CompanyContactSelector } from '@/components/quotes/CompanyContactSelector';
import { QuoteAutoSave } from '@/components/quotes/QuoteAutoSave';
import { ItemsListEditor } from '@/components/quotes/ItemsListEditor';
import { QuoteBuilderStepper } from '@/components/quotes/QuoteBuilderStepper';
import { QuoteBuilderSummaryColumn } from '@/components/quotes/QuoteBuilderSummaryColumn';
import { QuoteBuilderProductSearch } from '@/components/quotes/QuoteBuilderProductSearch';
import { useQuoteBuilderState } from '@/hooks/useQuoteBuilderState';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { UnsavedChangesDialog } from '@/components/common/UnsavedChangesDialog';

export default function QuoteBuilderPage() {
  const s = useQuoteBuilderState();
  const { showDialog, confirmLeave, cancelLeave, message } =
    useUnsavedChangesGuard({ hasUnsavedChanges: s.hasUnsavedData });

  if (s.loadingQuote) {
    return (
        <div className="flex min-h-[60vh] items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
    );
  }

  return (
    <>
      <PageSEO
        title={s.isEditMode ? 'Editar Orçamento' : 'Novo Orçamento'}
        description="Crie e edite orçamentos com seleção de produtos e personalização."
        path="/orcamentos/novo"
        noIndex
      />

      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 pt-3 sm:pt-4 space-y-3 sm:space-y-4 pb-24 md:pb-6 animate-fade-in">
        <div aria-live="polite" className="sr-only" role="status" id="quote-builder-announcer"></div>
        
        {/* Header Section */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="shrink-0 rounded-xl bg-primary/10 p-2.5">
              <FileText className="h-6 w-6 text-primary" />
            </div>
            <div>
              <h1 
                data-testid={s.isEditMode ? "page-title-orcamento-editar" : "page-title-orcamento-novo"}
                className="font-display text-xl font-bold leading-tight sm:text-2xl"
              >
                {s.isEditMode ? 'Editar Orçamento' : 'Novo Orçamento'}
              </h1>
              <p className="text-xs text-muted-foreground">Preencha os dados seguindo as etapas</p>
            </div>
          </div>
          
          <QuoteBuilderStepper 
            completedSteps={s.completedSteps} 
            activeStep={s.currentStep} 
            onStepClick={s.goToStep}
            className="sm:max-w-2xl"
          />
        </div>

        {/* Wizard Grid Layout */}
        <div className="grid gap-6 lg:grid-cols-12">
          {/* Main Content (Wizard Steps) */}
          <div className="lg:col-span-8">
            <div className="space-y-6">
              {/* STEP 1: CLIENTE */}
              {s.currentStep === 'client' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Building2 className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-lg font-display font-bold">Identificação do Cliente</h2>
                    </div>
                    <CompanyContactSelector
                      companyId={s.clientId}
                      contactId={s.contactId}
                      onCompanyChange={s.setClientId}
                      onContactChange={s.setContactId}
                      onCompanyInfoChange={s.setCompanyInfo}
                      onContactInfoChange={s.setContactInfo}
                    />
                  </div>

                  <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
                    <h3 className="flex items-center gap-2 font-display text-base font-semibold mb-4">
                      <CalendarIcon className="h-5 w-5 text-primary" />
                      Validade da Proposta
                    </h3>
                    <div className="max-w-xs">
                      <Select
                        value={s.validityDays}
                        onValueChange={(val) => {
                          s.setValidityDays(val);
                          s.setValidUntil(format(addDays(new Date(), parseInt(val)), 'yyyy-MM-dd'));
                        }}
                      >
                        <SelectTrigger className="h-10">
                          <SelectValue placeholder="Selecione" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1 dia útil</SelectItem>
                          <SelectItem value="3">3 dias úteis</SelectItem>
                          <SelectItem value="7">7 dias corridos</SelectItem>
                          <SelectItem value="15">15 dias corridos</SelectItem>
                          <SelectItem value="30">30 dias corridos</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="flex justify-end pt-4">
                    <Button size="lg" onClick={s.nextStep} className="group gap-2 px-10 font-bold">
                      Próximo: Condições <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 2: CONDIÇÕES */}
              {s.currentStep === 'conditions' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <CreditCard className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-lg font-display font-bold">Condições Comerciais</h2>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Forma de Pagamento</Label>
                        <Select data-testid="payment-method-select-root" value={s.paymentMethod} onValueChange={s.setPaymentMethod}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="boleto">Boleto Bancário</SelectItem>
                            <SelectItem value="pix_transferencia">Transferência / Pix</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Prazo de Pagamento</Label>
                        <Select data-testid="payment-terms-select-root" value={s.paymentTerms} onValueChange={s.setPaymentTerms}>
                          <SelectTrigger className="h-10"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="7_dias">7 dias a partir da entrega</SelectItem>
                            <SelectItem value="14_dias">14 dias a partir da entrega</SelectItem>
                            <SelectItem value="21_dias">21 dias a partir da entrega</SelectItem>
                            <SelectItem value="28_dias">28 dias a partir da entrega</SelectItem>
                            <SelectItem value="7_14_dias">7 e 14 dias a partir da entrega</SelectItem>
                            <SelectItem value="50_50">50/50 | Entrada + Entrega</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="md:col-span-2 space-y-4 pt-4 border-t border-border/30">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-semibold">Prazo de Entrega</Label>
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger><Info className="h-4 w-4 text-muted-foreground/60" /></TooltipTrigger>
                              <TooltipContent className="max-w-xs text-xs">Valide o prazo com o time antes de prometer ao cliente.</TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        
                        <div className="flex gap-2 p-1 bg-muted/40 rounded-xl border border-border/30 max-w-sm">
                          <Button 
                            variant={s.deliveryMode === 'prazo' ? 'default' : 'ghost'} 
                            size="sm" 
                            className="flex-1 text-xs"
                            onClick={() => s.handleDeliveryModeChange('prazo')}
                          >Contar dias</Button>
                          <Button 
                            variant={s.deliveryMode === 'data' ? 'default' : 'ghost'} 
                            size="sm" 
                            className="flex-1 text-xs"
                            onClick={() => s.handleDeliveryModeChange('data')}
                          >Data fixa</Button>
                        </div>

                        {s.deliveryMode === 'prazo' ? (
                          <Select data-testid="delivery-time-select-root" value={s.deliveryTime} onValueChange={s.setDeliveryTime}>
                            <SelectTrigger className="h-10 max-w-xs"><SelectValue placeholder="Selecione o prazo" /></SelectTrigger>
                            <SelectContent>
                              {[7, 10, 15, 20, 28, 45].map(d => (
                                <SelectItem key={d} value={`${d}_dias`}>{d} dias após aprovação</SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        ) : (
                          <Popover>
                            <PopoverTrigger asChild>
                              <Button variant="outline" className="h-10 max-w-xs justify-start text-left font-normal">
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {s.deliveryDate ? format(s.deliveryDate, 'dd/MM/yyyy') : 'Selecione a data'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0"><Calendar mode="single" selected={s.deliveryDate} onSelect={s.handleDeliveryDateChange} disabled={d => d < new Date()} initialFocus /></PopoverContent>
                          </Popover>
                        )}
                      </div>

                      <div className="md:col-span-2 space-y-4 pt-4 border-t border-border/30">
                        <Label className="text-sm font-semibold">Modalidade de Frete</Label>
                        <Select data-testid="shipping-type-select-root" value={s.shippingType} onValueChange={s.handleShippingTypeChange}>
                          <SelectTrigger className="h-10 max-w-xs"><SelectValue placeholder="Selecione" /></SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cif">CIF | Frete grátis</SelectItem>
                            <SelectItem value="fob">FOB | Repassado ao cliente</SelectItem>
                            <SelectItem value="fob_pre">FOB | Valor pré negociado</SelectItem>
                          </SelectContent>
                        </Select>
                        {s.shippingType === 'fob_pre' && (
                          <div className="flex items-center gap-3 animate-in zoom-in-95 duration-200">
                             <Label className="text-xs font-medium">Valor R$</Label>
                             <CurrencyInput value={s.shippingCost} onChange={s.setShippingCost} className="h-10 max-w-[150px]" />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button variant="ghost" onClick={s.prevStep} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
                    <Button size="lg" onClick={s.nextStep} className="group gap-2 px-10 font-bold">
                      Próximo: Itens <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 3: ITENS */}
              {s.currentStep === 'items' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm min-h-[400px]">
                    <div className="flex items-center justify-between mb-6">
                      <div className="flex items-center gap-2">
                        <div className="p-2 rounded-lg bg-primary/10">
                          <Package className="h-5 w-5 text-primary" />
                        </div>
                        <h2 className="text-lg font-display font-bold">Produtos Selecionados</h2>
                      </div>
                      <Button size="sm" onClick={() => s.setProductSearchOpen(true)} className="gap-2 font-bold">
                        <Plus className="h-4 w-4" /> Adicionar Produto
                      </Button>
                    </div>

                    {s.items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed border-muted-foreground/20 rounded-3xl bg-muted/5">
                        <Package className="h-12 w-12 text-muted-foreground/30 mb-4" />
                        <h3 className="font-semibold text-muted-foreground">Nenhum item adicionado</h3>
                        <p className="text-sm text-muted-foreground/60 mt-1">Busque produtos para compor seu orçamento.</p>
                        <Button variant="outline" className="mt-6" onClick={() => s.setProductSearchOpen(true)}>Pesquisar Agora</Button>
                      </div>
                    ) : (
                      <ItemsListEditor
                        items={s.items}
                        activeItemIndex={s.activeItemIndex}
                        setActiveItemIndex={s.setActiveItemIndex}
                        updateItemQuantity={s.updateItemQuantity}
                        updateItemPrice={s.updateItemPrice}
                        removeItem={s.removeItem}
                        expandedItems={s.expandedItems}
                        toggleExpanded={s.toggleExpanded}
                        formatCurrency={s.formatCurrency}
                        renderPersonalization={() => null}
                      />
                    )}
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button variant="ghost" onClick={s.prevStep} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
                    <Button size="lg" onClick={s.nextStep} disabled={s.items.length === 0} className="group gap-2 px-10 font-bold">
                      Próximo: Personalização <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 4: PERSONALIZAÇÃO */}
              {s.currentStep === 'personalization' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <Sparkles className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-lg font-display font-bold">Gravação e Logotipos</h2>
                    </div>

                    <div className="space-y-6">
                      {s.items.map((item, idx) => (
                        <Card key={idx} className="overflow-hidden border-border/40 shadow-sm transition-all hover:shadow-md">
                          <div className="bg-muted/30 px-4 py-3 border-b border-border/40 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              {item.product_image_url ? (
                                <img src={item.product_image_url} alt="" className="w-10 h-10 rounded-lg object-cover border border-border/20" />
                              ) : (
                                <div className="w-10 h-10 rounded-lg bg-muted flex items-center justify-center"><Package className="h-5 w-5 text-muted-foreground/40" /></div>
                              )}
                              <span className="text-sm font-bold truncate max-w-[200px]">{item.product_name}</span>
                            </div>
                            <Badge variant="outline" className="bg-background font-bold">{item.quantity} pçs</Badge>
                          </div>
                          <div className="p-4">
                            <QuoteProductCustomization
                              productId={item.product_id}
                              quantity={item.quantity}
                              existingPersonalizations={item.personalizations}
                              onPersonalizationsChange={(p) => s.handlePersonalizationsChange(idx, p)}
                            />
                          </div>
                        </Card>
                      ))}
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button variant="ghost" onClick={s.prevStep} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
                    <Button size="lg" onClick={s.nextStep} className="group gap-2 px-10 font-bold">
                      Próximo: Revisão <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Button>
                  </div>
                </div>
              )}

              {/* STEP 5: REVISÃO */}
              {s.currentStep === 'review' && (
                <div className="space-y-4 animate-in fade-in slide-in-from-left-4 duration-500">
                  <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
                    <div className="flex items-center gap-2 mb-6">
                      <div className="p-2 rounded-lg bg-primary/10">
                        <FileCheck className="h-5 w-5 text-primary" />
                      </div>
                      <h2 className="text-lg font-display font-bold">Revisão e Finalização</h2>
                    </div>

                    <div className="grid gap-6 md:grid-cols-2">
                       <div className="space-y-4">
                         <div className="p-4 rounded-xl bg-muted/20 border border-border/40 space-y-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Cliente</h4>
                            <p className="text-sm font-bold">{s.companyInfo?.name}</p>
                            <p className="text-xs text-muted-foreground">{s.contactInfo?.name} • {s.contactInfo?.email}</p>
                         </div>
                         <div className="p-4 rounded-xl bg-muted/20 border border-border/40 space-y-2">
                            <h4 className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Logística & Pagamento</h4>
                            <p className="text-xs"><strong>Pagamento:</strong> {s.paymentMethod === 'boleto' ? 'Boleto' : 'Pix'} - {s.paymentTerms.replace(/_/g, ' ')}</p>
                            <p className="text-xs"><strong>Entrega:</strong> {s.deliveryTime.replace(/_/g, ' ')} - {s.shippingType.replace(/_/g, ' ')}</p>
                         </div>
                       </div>
                       
                       <div className="space-y-4">
                         <div className="space-y-2">
                           <Label className="text-xs font-bold uppercase text-muted-foreground">Observações na Proposta</Label>
                           <Textarea 
                             rows={4} 
                             value={s.notes} 
                             onChange={e => s.setNotes(e.target.value)} 
                             placeholder="Mensagem opcional para o cliente..." 
                             className="text-sm resize-none"
                           />
                         </div>
                         <div className="space-y-2">
                           <Label className="text-xs font-bold uppercase text-muted-foreground">Notas Internas</Label>
                           <Textarea 
                             rows={2} 
                             value={s.internalNotes} 
                             onChange={e => s.setInternalNotes(e.target.value)} 
                             placeholder="Anotações privadas..." 
                             className="text-sm resize-none"
                           />
                         </div>
                       </div>
                    </div>
                  </div>

                  <div className="flex justify-between pt-4">
                    <Button variant="ghost" onClick={s.prevStep} className="gap-2"><ArrowLeft className="h-4 w-4" /> Voltar</Button>
                    <Button 
                      size="lg" 
                      onClick={() => s.handleSaveQuote('pending')}
                      disabled={s.quotesLoading || !s.isFormValid}
                      className="gap-2 px-12 font-bold bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20"
                    >
                      {s.quotesLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Send className="h-5 w-5" />}
                      {s.isEditMode ? 'Salvar Alterações' : 'Criar Orçamento'}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Persistent Summary Side Column */}
          <div className="lg:col-span-4">
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
              onSave={s.handleSaveQuote}
              maxDiscountPercent={s.maxDiscountPercent}
              isDiscountExceeded={s.isDiscountExceeded}
              negotiationMarkup={s.negotiationMarkup}
              setNegotiationMarkup={s.setNegotiationMarkup}
              realSubtotal={s.realSubtotal}
              realDiscountPercent={s.realDiscountPercent}
              confirmItemPrice={s.confirmItemPrice}
              confirmAllStalePrices={s.confirmAllStalePrices}
            />
            
            {/* Contextual Intelligence Link */}
            {s.clientId && (
               <a
                href={`/ferramentas/bi?clientId=${s.clientId}`}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-4 group flex items-center gap-3 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 transition-all hover:bg-primary/10 hover:border-primary/50"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold truncate">Inteligência do Cliente</p>
                  <p className="text-[10px] text-muted-foreground">Histórico e tendências comerciais</p>
                </div>
                <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
              </a>
            )}
          </div>
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
