/**
 * SimuladorWizard v2 - Produto → Local → Specs → Comparativo
 */

import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { PageSEO } from '@/components/seo/PageSEO';
import { useSimulatorWizard } from '@/hooks/simulator/useSimulatorWizard';
import { useWizardDrafts } from '@/hooks/simulator/useWizardDrafts';
import {
  WizardStepIndicator,
  StepProduct,
  StepLocation,
  StepSpecs,
  StepComparison,
  PersonalizationSummary,
  PersonalizationTabs,
  WizardContextBar,
  SimulatorErrorBoundary,
} from '@/components/simulator/wizard';
import { MobilePersonalizationSummary } from '@/components/simulator/wizard/MobilePersonalizationSummary';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Calculator, Save, FolderOpen, Trash2, Loader2, Clock } from 'lucide-react';
import { m as motion } from 'framer-motion';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import type { SelectedProduct } from '@/types/domain/simulator-wizard';
import { cn } from '@/lib/utils';

interface PreSelectedProductState {
  id: string;
  name: string;
  sku: string;
  price: number;
  imageUrl?: string | null;
  categoryName?: string | null;
}

export default function SimuladorWizard() {
  const location = useLocation();
  const navigate = useNavigate();
  const wizard = useSimulatorWizard();
  const {
    drafts,
    saveDraft,
    saveDraftPending,
    deleteDraft,
    isLoading: draftsLoading,
  } = useWizardDrafts();
  const hasProcessedPreSelection = useRef(false);
  const [saveDialogOpen, setSaveDialogOpen] = useState(false);
  const [draftTitle, setDraftTitle] = useState('');

  useEffect(() => {
    if (hasProcessedPreSelection.current) return;

    const preSelectedProduct = (location.state as { preSelectedProduct?: PreSelectedProductState })
      ?.preSelectedProduct;

    if (preSelectedProduct?.id) {
      hasProcessedPreSelection.current = true;

      const product: SelectedProduct = {
        id: preSelectedProduct.id,
        name: preSelectedProduct.name,
        sku: preSelectedProduct.sku,
        price: preSelectedProduct.price,
        imageUrl: preSelectedProduct.imageUrl,
        categoryName: preSelectedProduct.categoryName,
      };

      wizard.selectProduct(product);

      toast.success(`${preSelectedProduct.name} selecionado`, {
        description: 'Continue configurando a personalização',
        duration: 3000,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [location.state, wizard.selectProduct]);

  const isInPersonalizationFlow =
    wizard.selectedProduct !== null && wizard.currentStep !== 'product';
  const showSidebar = isInPersonalizationFlow && wizard.personalizations.length > 0;

  const handleAddNewPersonalization = () => {
    wizard.startNewPersonalization();
  };

  const handleGenerateQuote = () => {
    const quoteData = {
      product: wizard.selectedProduct,
      quantity: wizard.quantity,
      personalizations: wizard.personalizations,
      totals: wizard.totals,
    };
    navigate('/orcamentos/novo', { state: { fromSimulator: true, simulationData: quoteData } });
    toast.success('Redirecionando para o orçamento...');
  };

  const handleSaveDraft = () => {
    const title =
      draftTitle.trim() || `${wizard.selectedProduct?.name || 'Rascunho'} - ${wizard.quantity}un`;
    saveDraft(title, wizard);
    setSaveDialogOpen(false);
    setDraftTitle('');
  };

  const handleLoadDraft = (draft: (typeof drafts)[0]) => {
    if (draft.product_data) {
      wizard.selectProduct(draft.product_data);
      wizard.setQuantity(draft.quantity);
      // Personalizations will be restored via the product selection flow
      toast.success(`Rascunho "${draft.title}" carregado`);
    }
  };

  return (
    <>
      <PageSEO
        title="Simulador de Personalização"
        description="Simule personalizações de brindes com cálculo automático de custos."
        path="/simulador"
      />
      <div className="mx-auto min-h-[calc(100vh-8rem)] w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        {/* Compact Header */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-4 flex items-center justify-between gap-3 px-1"
        >
          <div className="flex items-center gap-2.5">
            <div className="rounded-lg bg-gradient-to-br from-primary to-primary/80 p-2 shadow-md shadow-primary/25">
              <Calculator className="h-4 w-4 text-primary-foreground" />
            </div>
            <h1
              data-testid="page-title-simulador"
              className="font-display text-lg font-bold tracking-tight"
            >
              Simulador
            </h1>
          </div>

          {/* Draft Actions */}
          <div className="flex items-center gap-1.5">
            {wizard.selectedProduct && (
              <Button
                variant="ghost"
                size="sm"
                className="h-8 gap-1.5 px-2.5"
                onClick={() => {
                  setDraftTitle(`${wizard.selectedProduct?.name} - ${wizard.quantity}un`);
                  setSaveDialogOpen(true);
                }}
              >
                <Save className="h-3.5 w-3.5" />
                <span className="hidden text-xs sm:inline">Salvar</span>
              </Button>
            )}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 gap-1.5 px-2.5">
                  <FolderOpen className="h-3.5 w-3.5" />
                  <span className="hidden text-xs sm:inline">Rascunhos</span>
                  {drafts.length > 0 && (
                    <Badge variant="secondary" className="h-4 px-1.5 text-[10px]">
                      {drafts.length}
                    </Badge>
                  )}
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-72">
                {draftsLoading ? (
                  <div className="flex items-center justify-center p-4">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </div>
                ) : drafts.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">
                    Nenhum rascunho salvo
                  </div>
                ) : (
                  drafts.map((draft) => (
                    <DropdownMenuItem
                      key={draft.id}
                      className="flex items-start justify-between gap-2 p-3"
                      onClick={() => handleLoadDraft(draft)}
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{draft.title}</p>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                          <Clock className="h-3 w-3" />
                          {format(new Date(draft.updated_at), 'dd/MM HH:mm', { locale: ptBR })}
                          <span>• {draft.quantity}un</span>
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label="Excluir"
                        className="h-6 w-6 shrink-0 text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          deleteDraft(draft.id);
                        }}
                      >
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </motion.div>

        {/* Layout com Sidebar */}
        <div className={cn('flex gap-6', showSidebar && 'lg:pr-80')}>
          {/* Main Content */}
          <div className="min-w-0 flex-1">
            {/* Context Bar */}
            {isInPersonalizationFlow && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="mb-4"
              >
                <WizardContextBar wizard={wizard} />
              </motion.div>
            )}

            {/* Step Indicator */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="mb-8"
            >
              <WizardStepIndicator wizard={wizard} />
            </motion.div>

            {/* Tabs de Personalizações */}
            {isInPersonalizationFlow && wizard.personalizations.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.25 }}
                className="mx-auto mb-6 max-w-5xl"
              >
                <PersonalizationTabs wizard={wizard} onAddNew={handleAddNewPersonalization} />
              </motion.div>
            )}

            {/* Step Content */}
            <SimulatorErrorBoundary
              onReset={wizard.resetWizard}
              onGoBack={() => wizard.setStep('product')}
            >
              <motion.div
                key={wizard.currentStep}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                transition={{ duration: 0.3 }}
                className="pb-16"
              >
                {wizard.currentStep === 'product' && <StepProduct wizard={wizard} />}
                {wizard.currentStep === 'location' && <StepLocation wizard={wizard} />}
                {wizard.currentStep === 'specs' && <StepSpecs wizard={wizard} />}
                {wizard.currentStep === 'comparison' && <StepComparison wizard={wizard} />}
              </motion.div>
            </SimulatorErrorBoundary>
          </div>

          {/* Sidebar - Resumo */}
          {showSidebar && (
            <motion.aside
              initial={{ opacity: 0, x: 40 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.3 }}
              className="fixed bottom-8 right-4 top-32 hidden w-72 overflow-hidden rounded-2xl border bg-card shadow-xl lg:block"
            >
              <PersonalizationSummary
                wizard={wizard}
                onAddNew={handleAddNewPersonalization}
                onGenerateQuote={handleGenerateQuote}
                showAddButton={!wizard.isEditingPersonalization}
              />
            </motion.aside>
          )}
        </div>

        {/* Mobile Summary Bottom Bar */}
        {showSidebar && (
          <MobilePersonalizationSummary
            wizard={wizard}
            onAddNew={handleAddNewPersonalization}
            onGenerateQuote={handleGenerateQuote}
          />
        )}
      </div>

      {/* Save Draft Dialog */}
      <Dialog open={saveDialogOpen} onOpenChange={setSaveDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Salvar Rascunho</DialogTitle>
            <DialogDescription>Salve o estado atual para continuar depois.</DialogDescription>
          </DialogHeader>
          <div className="py-4">
            <Input
              placeholder="Nome do rascunho..."
              value={draftTitle}
              onChange={(e) => setDraftTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSaveDraft()}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveDraft} disabled={saveDraftPending} className="gap-2">
              {saveDraftPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <Save className="h-4 w-4" />
              )}
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
