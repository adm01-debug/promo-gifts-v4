/**
 * MobilePersonalizationSummary - Resumo fixo no rodapé para mobile
 *
 * Bottom bar compacta com totais + drawer expansível
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { ShoppingCart, ChevronUp, FileText } from 'lucide-react';
import { m as motion } from 'framer-motion';
import { formatCurrency } from '@/lib/format';
import type { UseSimulatorWizardReturn } from '@/hooks/simulator/useSimulatorWizard';
import { PersonalizationSummary } from './PersonalizationSummary';

interface MobilePersonalizationSummaryProps {
  wizard: UseSimulatorWizardReturn;
  onAddNew: () => void;
  onGenerateQuote: () => void;
}

export function MobilePersonalizationSummary({
  wizard,
  onAddNew,
  onGenerateQuote,
}: MobilePersonalizationSummaryProps) {
  const [open, setOpen] = useState(false);
  const { personalizations, totals } = wizard;

  if (personalizations.length === 0) return null;

  // formatCurrency imported from @/lib/format

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 lg:hidden">
      {/* Compact bar */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="safe-bottom border-t bg-card px-4 py-3 shadow-2xl"
      >
        <div className="flex items-center justify-between gap-3">
          {/* Left: Summary trigger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button type="button" className="flex min-w-0 flex-1 items-center gap-3">
                <div className="relative">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <Badge className="absolute -right-2 -top-2 flex h-4 w-4 items-center justify-center p-0 text-[10px]">
                    {personalizations.length}
                  </Badge>
                </div>
                <div className="min-w-0 text-left">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-base font-bold text-primary">
                    {formatCurrency(totals.grandTotal)}
                  </p>
                </div>
                <ChevronUp className="ml-1 h-4 w-4 text-muted-foreground" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Resumo da Simulação</SheetTitle>
              </SheetHeader>
              <PersonalizationSummary
                wizard={wizard}
                onAddNew={() => {
                  setOpen(false);
                  onAddNew();
                }}
                onGenerateQuote={() => {
                  setOpen(false);
                  onGenerateQuote();
                }}
                showAddButton={!wizard.isEditingPersonalization}
              />
            </SheetContent>
          </Sheet>

          {/* Right: CTA */}
          <Button
            size="sm"
            className="shrink-0 gap-2 rounded-xl shadow-lg shadow-primary/20"
            onClick={onGenerateQuote}
          >
            <FileText className="h-4 w-4" />
            Orçamento
          </Button>
        </div>
      </motion.div>
    </div>
  );
}
