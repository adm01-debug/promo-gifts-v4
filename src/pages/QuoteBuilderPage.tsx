/**
 * QuoteBuilderPage — Módulo de criação/edição de orçamentos
 * Refatorado: lógica em useQuoteBuilderState, UI em sub-componentes.
 */

import { PageSEO } from '@/components/seo/PageSEO';
import { cn } from '@/lib/utils';

import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { CurrencyInput } from '@/components/ui/currency-input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
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
  Loader2,
  BookTemplate,
  ArrowLeft,
  Edit,
  AlertTriangle,
  Calendar as CalendarIcon,
  Sparkles,
  ExternalLink,
  Info,
  Building2,
  CreditCard,
  FileCheck,
} from 'lucide-react';
import { toast } from 'sonner';
import { format, addDays } from 'date-fns';

import { QuoteTemplateSelector } from '@/components/quotes/QuoteTemplateSelector';
import { SaveAsTemplateButton } from '@/components/quotes/SaveAsTemplateButton';
import { QuoteProductCustomization } from '@/components/quotes/QuoteProductCustomization';
import { CompanyContactSelector } from '@/components/quotes/CompanyContactSelector';
import { QuoteAutoSave } from '@/components/quotes/QuoteAutoSave';
import { DraggableQuoteItems } from '@/components/quotes/DraggableQuoteItems';
import { QuoteBuilderStepper } from '@/components/quotes/QuoteBuilderStepper';
import { QuoteBuilderSummaryColumn } from '@/components/quotes/QuoteBuilderSummaryColumn';

import { QuoteBuilderProductSearch } from '@/components/quotes/QuoteBuilderProductSearch';
import { useQuoteBuilderState } from '@/hooks/useQuoteBuilderState';
import { useUnsavedChangesGuard } from '@/hooks/useUnsavedChangesGuard';
import { UnsavedChangesDialog } from '@/components/common/UnsavedChangesDialog';

export default function QuoteBuilderPage() {
  const s = useQuoteBuilderState();
  const { showDialog, guardNavigation, confirmLeave, cancelLeave, message } =
    useUnsavedChangesGuard({
      hasUnsavedChanges: s.hasUnsavedData,
    });

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
          paymentMethod: s.paymentMethod,
          paymentTerms: s.paymentTerms,
          deliveryTime: s.deliveryTime,
          shippingType: s.shippingType,
          shippingCost: s.shippingCost,
          notes: s.notes,
          internalNotes: s.internalNotes,
          items: s.items,
        }}
        className="fixed right-4 top-20 z-40"
      />

      <div className="w-full max-w-[1920px] mx-auto px-3 sm:px-4 lg:px-6 xl:px-8 pt-3 sm:pt-4 space-y-3 sm:space-y-4 pb-6 animate-fade-in">
        <div aria-live="polite" className="sr-only" role="status" id="quote-builder-announcer"></div>
        {/* Header */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="flex items-start gap-3">
            <div className="shrink-0 rounded-xl bg-primary/10 p-2.5">
              <FileText className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1
                data-testid={s.isEditMode ? "page-title-orcamento-editar" : "page-title-orcamento-novo"}
                className="font-display text-xl font-bold leading-tight sm:text-2xl"
              >
                {s.isEditMode ? 'Editar Orçamento' : 'Novo Orçamento'}
              </h1>
              <p className="mt-0.5 text-xs text-muted-foreground sm:text-sm">
                Crie um orçamento com produtos e personalizações
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!s.isEditMode && (
              <QuoteTemplateSelector
                onSelectTemplate={s.applyTemplate}
                trigger={
                  <Button variant="outline">
                    <BookTemplate className="mr-2 h-4 w-4" />
                    Usar Template
                    {s.templates.length > 0 && (
                      <Badge variant="secondary" className="ml-2">
                        {s.templates.length}
                      </Badge>
                    )}
                  </Button>
                }
              />
            )}
            {s.items.length > 0 && (
              <SaveAsTemplateButton
                items={s.getTemplateItems()}
                discountPercent={s.discountType === 'percent' ? s.discountValue : 0}
                discountAmount={s.discountType === 'amount' ? s.discountValue : 0}
                notes={s.notes}
                internalNotes={s.internalNotes}
              />
            )}
          </div>
        </div>


        {/* Stepper */}
        <QuoteBuilderStepper 
          completedSteps={s.completedSteps} 
          activeStep={s.activeStep} 
          onStepClick={s.goToStep}
        />

        {/* Template notifications */}
        {s.templateApplied && (
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="flex items-center justify-between py-3">
              <div className="flex items-center gap-2">
                <BookTemplate className="h-4 w-4 text-primary" />
                <span className="text-sm">
                  Template <strong>"{s.templateApplied}"</strong> aplicado
                </span>
              </div>
              <Button variant="ghost" size="sm" onClick={() => s.setTemplateApplied(null)}>
                Fechar
              </Button>
            </CardContent>
          </Card>
        )}

        {!s.isEditMode && s.defaultTemplate && s.items.length === 0 && !s.templateApplied && (
          <Card className="border-dashed bg-muted/50">
            <CardContent className="flex items-center justify-between py-4">
              <div className="flex items-center gap-3">
                <BookTemplate className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="font-medium">Template padrão disponível</p>
                  <p className="text-sm text-muted-foreground">
                    Use "{s.defaultTemplate.name}" para começar rapidamente
                  </p>
                </div>
              </div>
              <Button variant="outline" onClick={() => s.applyTemplate(s.defaultTemplate!)}>
                Aplicar Template
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Wizard Steps */}
        <div className="grid gap-4 lg:grid-cols-12">
          <div className={cn(
            "space-y-4",
            s.activeStep === 'review' ? "lg:col-span-12" : "lg:col-span-8"
          )}>
            {/* Step 1: CLIENTE */}
            {s.activeStep === 'client' && (
              <div
                className={cn(
                  'space-y-6 rounded-2xl border bg-card p-6 shadow-sm animate-in fade-in slide-in-from-bottom-2 duration-500',
                  s.validationErrors.includes('empresa') || s.validationErrors.includes('contato')
                    ? 'border-destructive/50'
                    : 'border-border/50',
                )}
              >
                <div className="flex items-center gap-3 border-b border-border/50 pb-4">
                  <div className="rounded-lg bg-primary/10 p-2">
                    <Building2 className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-bold">Identificação do Cliente</h2>
                    <p className="text-xs text-muted-foreground">Selecione a empresa e o contato para este orçamento</p>
                  </div>
                </div>
                
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
                  <p className="flex items-center gap-1.5 text-sm text-destructive font-medium">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    {s.validationErrors.includes('empresa')
                      ? 'Selecione uma empresa'
                      : 'Selecione um contato'}
                  </p>
                )}
              </div>
            )}

            {/* Step 2: CONDIÇÕES */}
            {s.activeStep === 'conditions' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className={cn(
                  'rounded-2xl border bg-card p-6 shadow-sm',
                  s.validationErrors.length > 0 ? 'border-destructive/30' : 'border-border/50'
                )}>
                  <div className="flex items-center gap-3 border-b border-border/50 pb-4 mb-6">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <CreditCard className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-bold">Condições Comerciais</h2>
                      <p className="text-xs text-muted-foreground">Defina prazos e modalidades de pagamento e entrega</p>
                    </div>
                  </div>

                  <div className="grid gap-6 md:grid-cols-2">
                    {/* Pagamento Form */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Forma de Pagamento</Label>
                        <Select value={s.paymentMethod} onValueChange={s.setPaymentMethod}>
                          <SelectTrigger className={cn(s.validationErrors.includes('forma_pagamento') && 'border-destructive')}>
                            <SelectValue placeholder="Selecione a forma" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="boleto">Boleto Bancário</SelectItem>
                            <SelectItem value="pix_transferencia">Transferência Bancária / Pix</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Prazo de Pagamento</Label>
                        <Select value={s.paymentTerms} onValueChange={s.setPaymentTerms}>
                          <SelectTrigger className={cn(s.validationErrors.includes('prazo_pagamento') && 'border-destructive')}>
                            <SelectValue placeholder="Selecione o prazo" />
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
                    </div>

                    {/* Entrega e Frete */}
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <div className="flex items-center gap-2">
                          <Label className="text-sm font-semibold">Prazo de Entrega</Label>
                          <TooltipProvider delayDuration={150}>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                <Info className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
                              </TooltipTrigger>
                              <TooltipContent side="top" className="max-w-xs text-xs">
                                Valide com o time a viabilidade do prazo antes de assumir o compromisso.
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        </div>
                        
                        <div className="flex p-1 bg-muted rounded-lg mb-2">
                          <button
                            type="button"
                            onClick={() => s.handleDeliveryModeChange('prazo')}
                            className={cn(
                              'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                              s.deliveryMode === 'prazo' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                            )}
                          >
                            Contar dias
                          </button>
                          <button
                            type="button"
                            onClick={() => s.handleDeliveryModeChange('data')}
                            className={cn(
                              'flex-1 rounded-md px-3 py-1.5 text-xs font-medium transition-all',
                              s.deliveryMode === 'data' ? 'bg-background shadow-sm' : 'text-muted-foreground'
                            )}
                          >
                            Data fixa
                          </button>
                        </div>

                        {s.deliveryMode === 'prazo' ? (
                          <Select value={s.deliveryTime} onValueChange={s.setDeliveryTime}>
                            <SelectTrigger className={cn(s.validationErrors.includes('prazo_entrega') && 'border-destructive')}>
                              <SelectValue placeholder="Selecione o prazo de entrega" />
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
                                variant="outline"
                                className={cn('w-full justify-start text-left font-normal', !s.deliveryDate && 'text-muted-foreground', s.validationErrors.includes('prazo_entrega') && 'border-destructive')}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {s.deliveryDate ? format(s.deliveryDate, 'dd/MM/yyyy') : 'Selecione a data'}
                              </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-auto p-0" align="start">
                              <Calendar mode="single" selected={s.deliveryDate} onSelect={s.handleDeliveryDateChange} disabled={(date) => date < new Date()} initialFocus />
                            </PopoverContent>
                          </Popover>
                        )}
                      </div>

                      <div className="space-y-2">
                        <Label className="text-sm font-semibold">Modalidade de Frete</Label>
                        <Select value={s.shippingType} onValueChange={s.setShippingType}>
                          <SelectTrigger className={cn(s.validationErrors.includes('frete') && 'border-destructive')}>
                            <SelectValue placeholder="Selecione o frete" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="cif">CIF | Frete grátis</SelectItem>
                            <SelectItem value="fob">FOB | Repassado ao cliente</SelectItem>
                            <SelectItem value="fob_pre">FOB | Valor pré-negociado</SelectItem>
                          </SelectContent>
                        </Select>
                        {s.shippingType === 'fob_pre' && (
                          <div className="pt-2 animate-in slide-in-from-top-2 duration-300">
                            <Label className="text-xs text-muted-foreground mb-1 block">Valor do Frete (R$)</Label>
                            <CurrencyInput
                              value={s.shippingCost || 0}
                              onChange={(n) => s.setShippingCost(n)}
                              className={cn(s.validationErrors.includes('valor_frete') && 'border-destructive')}
                            />
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Validade da Proposta */}
                  <div className="mt-8 pt-6 border-t border-border/50">
                    <div className="flex items-center gap-4">
                      <div className="flex-1 space-y-2">
                        <Label className="text-sm font-semibold">Validade da Proposta</Label>
                        <Select
                          value={s.validityDays}
                          onValueChange={(val) => {
                            s.setValidityDays(val);
                            s.setValidUntil(format(addDays(new Date(), parseInt(val)), 'yyyy-MM-dd'));
                          }}
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Selecione a validade" />
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
                      <div className="flex-1 p-3 rounded-xl bg-primary/5 border border-primary/10">
                        <p className="text-[10px] uppercase tracking-wider text-primary font-bold mb-1">Data de Expiração</p>
                        <p className="text-lg font-display font-bold text-primary">{format(new Date(s.validUntil), 'dd/MM/yyyy')}</p>
                      </div>
                    </div>
                  </div>
                </div>

                {/* BI Shortcut */}
                {s.companyInfo?.id && (
                  <a
                    href={`/ferramentas/bi?clientId=${s.companyInfo.id}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group flex items-center gap-4 rounded-2xl border border-dashed border-primary/30 bg-primary/5 p-4 transition-all hover:border-primary/50 hover:bg-primary/10 hover:shadow-md"
                  >
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 transition-transform group-hover:scale-110">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-display font-bold text-foreground">Inteligência de Mercado</p>
                      <p className="text-xs text-muted-foreground">Analise o perfil deste cliente e tendências do setor</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary" />
                  </a>
                )}
              </div>
            )}

            {/* Step 3: ÍTENS */}
            {s.activeStep === 'items' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden flex flex-col min-h-[500px]">
                  <div className="flex items-center justify-between p-6 border-b border-border/50 bg-muted/5">
                    <div className="flex items-center gap-3">
                      <div className="rounded-lg bg-primary/10 p-2">
                        <Package className="h-5 w-5 text-primary" />
                      </div>
                      <div>
                        <h2 className="font-display text-lg font-bold">Produtos Selecionados</h2>
                        <p className="text-xs text-muted-foreground">{s.items.length} item(ns) no orçamento</p>
                      </div>
                    </div>
                    <Button onClick={() => s.setProductSearchOpen(true)} className="shadow-sm">
                      <Plus className="mr-2 h-4 w-4" />
                      Adicionar Produto
                    </Button>
                  </div>

                  <div className="p-6 flex-1">
                    {s.items.length === 0 ? (
                      <div className="flex flex-col items-center justify-center py-20 text-center space-y-4">
                        <div className="p-4 rounded-full bg-muted/50">
                          <Package className="h-10 w-10 text-muted-foreground/30" />
                        </div>
                        <div className="max-w-xs">
                          <p className="text-sm font-semibold">Nenhum produto adicionado</p>
                          <p className="text-xs text-muted-foreground mt-1">Busque em nosso catálogo os brindes ideais para o seu cliente.</p>
                        </div>
                        <Button variant="outline" onClick={() => s.setProductSearchOpen(true)}>
                          Abrir Catálogo
                        </Button>
                      </div>
                    ) : (
                      <div className="space-y-4">
                        <DraggableQuoteItems
                          items={s.items}
                          onReorder={s.setItems}
                          onUpdateQuantity={s.updateItemQuantity}
                          onUpdatePrice={s.updateItemPrice}
                          onRemove={s.removeItem}
                          onTogglePersonalization={s.toggleExpanded}
                          expandedItems={s.expandedItems}
                          renderPersonalization={(item, idx) => (
                            <div className="p-4 bg-muted/30 border-t border-border/50 rounded-b-xl">
                              <p className="text-[10px] font-bold text-muted-foreground uppercase tracking-widest mb-3">Configuração Rápida</p>
                              <div className="grid gap-4 sm:grid-cols-2">
                                <div className="space-y-1.5">
                                  <Label className="text-[11px] font-bold">Quantidade</Label>
                                  <Input 
                                    type="number" 
                                    value={item.quantity} 
                                    onChange={(e) => s.updateItemQuantity(idx, parseInt(e.target.value) || 0)}
                                    className="h-8 text-xs"
                                  />
                                </div>
                                <div className="space-y-1.5">
                                  <Label className="text-[11px] font-bold">Preço Unitário</Label>
                                  <CurrencyInput 
                                    value={item.unit_price} 
                                    onChange={(val) => s.updateItemPrice(idx, val)}
                                    className="h-8 text-xs"
                                  />
                                </div>
                              </div>
                              <div className="mt-4 flex justify-end">
                                <Button 
                                  variant="secondary" 
                                  size="sm" 
                                  className="text-[11px] h-7 gap-1.5"
                                  onClick={() => s.goToStep('personalization')}
                                >
                                  <Sparkles className="h-3 w-3" />
                                  Personalização Detalhada
                                </Button>
                              </div>
                            </div>
                          )}
                          formatCurrency={s.formatCurrency}
                        />
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Step 4: PERSONALIZAÇÃO */}
            {s.activeStep === 'personalization' && (
              <div className="space-y-4 animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="rounded-2xl border border-border/50 bg-card shadow-sm overflow-hidden min-h-[600px] flex flex-col">
                  <div className="flex items-center gap-3 p-6 border-b border-border/50 bg-muted/5">
                    <div className="rounded-lg bg-primary/10 p-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <h2 className="font-display text-lg font-bold">Personalização Detalhada</h2>
                      <p className="text-xs text-muted-foreground">Configure as gravações e acabamentos de cada item</p>
                    </div>
                  </div>

                  {s.items.length === 0 ? (
                    <div className="flex-1 flex flex-col items-center justify-center p-12 text-center">
                      <Package className="h-12 w-12 text-muted-foreground/20 mb-4" />
                      <p className="text-sm font-medium text-muted-foreground">Adicione itens primeiro para personalizá-los</p>
                      <Button variant="link" onClick={() => s.goToStep('items')}>Voltar para Itens</Button>
                    </div>
                  ) : (
                    <div className="flex flex-1 min-h-0">
                      {/* Item Selector Sidebar */}
                      <div className="w-64 border-r border-border/50 overflow-y-auto bg-muted/5 hidden md:block">
                        <div className="p-3 space-y-2">
                          {s.items.map((item, idx) => (
                            <button
                              key={idx}
                              onClick={() => s.setActiveItemIndex(idx)}
                              className={cn(
                                "w-full text-left p-2.5 rounded-xl transition-all border flex gap-3",
                                s.activeItemIndex === idx 
                                  ? "bg-primary/10 border-primary/20 shadow-sm" 
                                  : "bg-transparent border-transparent hover:bg-muted/50"
                              )}
                            >
                              <div className="w-10 h-10 rounded-lg bg-muted shrink-0 overflow-hidden border border-border/50">
                                {item.product_image_url ? (
                                  <img src={item.product_image_url} alt="" className="w-full h-full object-cover" />
                                ) : (
                                  <div className="w-full h-full flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground/40" /></div>
                                )}
                              </div>
                              <div className="min-w-0 flex-1 py-0.5">
                                <p className={cn("text-[11px] font-bold truncate", s.activeItemIndex === idx ? "text-primary" : "text-foreground")}>
                                  {item.product_name}
                                </p>
                                <p className="text-[10px] text-muted-foreground mt-0.5">{item.quantity} pçs</p>
                              </div>
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Customization Area */}
                      <div className="flex-1 overflow-y-auto p-6">
                        {s.activeItemIndex !== null && s.items[s.activeItemIndex] ? (
                          <div className="max-w-2xl mx-auto space-y-6">
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-3">
                                <Badge variant="outline" className="text-[10px] font-bold px-2 h-5 border-primary/20 bg-primary/5 text-primary">Item {s.activeItemIndex + 1}</Badge>
                                <h3 className="font-display font-bold">{s.items[s.activeItemIndex].product_name}</h3>
                              </div>
                              <div className="md:hidden">
                                <Select 
                                  value={s.activeItemIndex.toString()} 
                                  onValueChange={(v) => s.setActiveItemIndex(parseInt(v))}
                                >
                                  <SelectTrigger className="w-32 h-8 text-[10px]">
                                    <SelectValue placeholder="Trocar item" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    {s.items.map((_, i) => (
                                      <SelectItem key={i} value={i.toString()}>Item {i + 1}</SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>

                            <QuoteProductCustomization
                              productId={s.items[s.activeItemIndex].product_id}
                              quantity={s.items[s.activeItemIndex].quantity}
                              existingPersonalizations={s.items[s.activeItemIndex].personalizations}
                              onPersonalizationsChange={(p) => s.handlePersonalizationsChange(s.activeItemIndex!, p)}
                            />
                          </div>
                        ) : (
                          <div className="h-full flex flex-col items-center justify-center text-center p-8">
                            <Sparkles className="h-10 w-10 text-muted-foreground/20 mb-3" />
                            <p className="text-sm font-medium text-muted-foreground">Selecione um produto para personalizar</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Step 5: REVISÃO */}
            {s.activeStep === 'review' && (
              <div className="animate-in fade-in slide-in-from-bottom-2 duration-500">
                <div className="grid gap-6 lg:grid-cols-12">
                  <div className="lg:col-span-8 space-y-6">
                    <div className="rounded-2xl border border-border/50 bg-card p-6 shadow-sm">
                      <div className="flex items-center gap-3 border-b border-border/50 pb-4 mb-6">
                        <div className="rounded-lg bg-primary/10 p-2">
                          <FileCheck className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h2 className="font-display text-lg font-bold">Revisão Final</h2>
                          <p className="text-xs text-muted-foreground">Confira os detalhes antes de gerar a proposta</p>
                        </div>
                      </div>

                      <div className="grid gap-8 md:grid-cols-2">
                        <div className="space-y-6">
                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Cliente & Contato</h3>
                            <div className="p-4 rounded-xl bg-muted/30 border border-border/40 space-y-2">
                              <p className="font-bold text-sm">{s.companyInfo?.name || 'Não selecionado'}</p>
                              {s.companyInfo?.cnpj && <p className="text-xs text-muted-foreground">CNPJ: {s.companyInfo.cnpj}</p>}
                              <div className="pt-2 border-t border-border/30 mt-2">
                                <p className="text-xs font-medium">{s.contactInfo?.name || 'Não selecionado'}</p>
                                {s.contactInfo?.email && <p className="text-[11px] text-muted-foreground">{s.contactInfo.email}</p>}
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Prazos & Logística</h3>
                            <div className="p-4 rounded-xl bg-muted/30 border border-border/40 space-y-3">
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Pagamento:</span>
                                <span className="text-xs font-bold">{s.paymentMethod === 'boleto' ? 'Boleto' : 'Pix/Transf.'} ({s.paymentTerms})</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Entrega:</span>
                                <span className="text-xs font-bold">{s.deliveryTime.startsWith('date:') ? format(new Date(s.deliveryTime.slice(5)), 'dd/MM/yyyy') : s.deliveryTime.replace('_', ' ')}</span>
                              </div>
                              <div className="flex justify-between items-center">
                                <span className="text-xs text-muted-foreground">Frete:</span>
                                <span className="text-xs font-bold uppercase">{s.shippingType}</span>
                              </div>
                            </div>
                          </div>
                        </div>

                        <div className="space-y-4">
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase">Observações na Proposta</Label>
                            <Textarea 
                              value={s.notes} 
                              onChange={(e) => s.setNotes(e.target.value)}
                              placeholder="Informações que o cliente verá na proposta PDF..."
                              className="min-h-[100px] text-xs resize-none"
                            />
                          </div>
                          <div className="space-y-2">
                            <Label className="text-xs font-bold text-muted-foreground uppercase">Notas Internas</Label>
                            <Textarea 
                              value={s.internalNotes} 
                              onChange={(e) => s.setInternalNotes(e.target.value)}
                              placeholder="Apenas para controle interno da equipe..."
                              className="min-h-[100px] text-xs resize-none bg-amber-500/5 border-amber-500/10"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <QuoteBuilderSummaryColumn
                    className="lg:col-span-4"
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
                </div>
              </div>
            )}

            {/* Wizard Navigation Buttons */}
            <div className="flex items-center justify-between pt-6 border-t border-border/30">
              <Button
                variant="ghost"
                onClick={s.prevStep}
                disabled={s.activeStep === 'client'}
                className="gap-2"
              >
                <ArrowLeft className="h-4 w-4" />
                Voltar
              </Button>
              
              {s.activeStep !== 'review' ? (
                <Button
                  onClick={s.nextStep}
                  className="min-w-[140px] gap-2 shadow-md"
                >
                  {s.activeStep === 'personalization' ? 'Revisar Orçamento' : 'Próximo Passo'}
                  <ArrowLeft className="h-4 w-4 rotate-180" />
                </Button>
              ) : (
                <div className="flex gap-3">
                   {/* Botão de salvar já existe dentro do SummaryColumn em modo mobile/desktop, 
                       mas aqui podemos ter um botão principal de "Gerar Proposta" */}
                </div>
              )}
            </div>
          </div>

          {/* Persistent Summary Sidebar for Steps 1-4 */}
          {s.activeStep !== 'review' && (
            <QuoteBuilderSummaryColumn
              className="lg:col-span-4 hidden lg:block"
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
          )}
        </div>


      </div>

      {/* Product Search Dialog */}
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
