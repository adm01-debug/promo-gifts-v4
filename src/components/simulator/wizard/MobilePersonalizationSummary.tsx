/**
 * MobilePersonalizationSummary - Resumo fixo no rodapé para mobile
 * 
 * Bottom bar compacta com totais + drawer expansível
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { 
  ShoppingCart, 
  ChevronUp, 
  FileText,
} from 'lucide-react';
import { motion } from 'framer-motion';
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
    <div className="lg:hidden fixed bottom-0 left-0 right-0 z-50">
      {/* Compact bar */}
      <motion.div
        initial={{ y: 100 }}
        animate={{ y: 0 }}
        className="bg-card border-t shadow-2xl px-4 py-3 safe-bottom"
      >
        <div className="flex items-center justify-between gap-3">
          {/* Left: Summary trigger */}
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger asChild>
              <button className="flex items-center gap-3 flex-1 min-w-0">
                <div className="relative">
                  <ShoppingCart className="h-5 w-5 text-primary" />
                  <Badge 
                    className="absolute -top-2 -right-2 h-4 w-4 p-0 flex items-center justify-center text-[10px]"
                  >
                    {personalizations.length}
                  </Badge>
                </div>
                <div className="text-left min-w-0">
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="font-bold text-primary text-base">
                    {formatCurrency(totals.grandTotal)}
                  </p>
                </div>
                <ChevronUp className="h-4 w-4 text-muted-foreground ml-1" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="h-[80vh] rounded-t-2xl p-0">
              <SheetHeader className="sr-only">
                <SheetTitle>Resumo da Simulação</SheetTitle>
              </SheetHeader>
              <PersonalizationSummary
                wizard={wizard}
                onAddNew={() => { setOpen(false); onAddNew(); }}
                onGenerateQuote={() => { setOpen(false); onGenerateQuote(); }}
                showAddButton={!wizard.isEditingPersonalization}
              />
            </SheetContent>
          </Sheet>

          {/* Right: CTA */}
          <Button
            size="sm"
            className="gap-2 shrink-0 rounded-xl shadow-lg shadow-primary/20"
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
