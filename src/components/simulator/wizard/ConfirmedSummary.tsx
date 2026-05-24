/**
 * ConfirmedSummary — Resumo pós-confirmação do simulador
 * Extraído de StepComparison.tsx
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Check, Plus, FileText, Copy, MapPin, MessageCircle,
  Repeat, Undo2, Redo2, AlertCircle,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { formatCurrency } from '@/lib/format';
import { toast } from 'sonner';
import type { UseSimulatorWizardReturn } from '@/hooks/simulator/useSimulatorWizard';
import { QuantityRangeComparison } from './QuantityRangeComparison';
import { WizardMockupPreview } from './WizardMockupPreview';

interface ConfirmedSummaryProps {
  wizard: UseSimulatorWizardReturn;
  onAddAnother: () => void;
  onGenerateQuote: () => void;
  onCopy: () => void;
}

export function ConfirmedSummary({ wizard, onAddAnother, onGenerateQuote, onCopy }: ConfirmedSummaryProps) {
  const [showDuplicateQty, setShowDuplicateQty] = useState(false);
  const [duplicateQty, setDuplicateQty] = useState(wizard.quantity);

  const handleShareWhatsApp = () => {
    const persText = wizard.personalizations.map((p, idx) =>
      `${idx + 1}. ${p.technique.name} | ${p.location.locationName} | ${formatCurrency(p.pricing.totalPrice)}`
    ).join('\n');

    const text = `📦 *SIMULAÇÃO DE PERSONALIZAÇÃO*\n\n🏷️ ${wizard.selectedProduct?.name} (${wizard.selectedProduct?.sku})\n📊 ${wizard.quantity}un × ${formatCurrency(wizard.effectivePrice)}\n\n🎨 *Gravações:*\n${persText}\n\n💰 *TOTAL: ${formatCurrency(wizard.totals.grandTotal)}* (${formatCurrency(wizard.totals.grandTotalPerUnit)}/un)\n⏱️ Prazo: ${wizard.totals.maxDays > 0 ? `~${wizard.totals.maxDays} dias úteis` : 'A consultar'}`;
    window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank');
  };

  const handleDuplicate = () => {
    if (duplicateQty > 0 && duplicateQty !== wizard.quantity) {
      wizard.setQuantity(duplicateQty);
      toast.success(`Quantidade alterada para ${duplicateQty}un. Recalcule os preços.`);
      setShowDuplicateQty(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <motion.div className="relative w-10 h-10 shrink-0" initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ type: "spring", delay: 0.1, stiffness: 200 }}>
            <div className="absolute inset-0 bg-primary/20 rounded-full blur-lg" />
            <div className="relative w-full h-full rounded-full bg-gradient-to-br from-primary to-primary/90 flex items-center justify-center shadow-md">
              <Check className="h-5 w-5 text-primary-foreground" />
            </div>
          </motion.div>
          <div>
            <h2 className="font-display text-lg font-bold leading-tight">
              {wizard.personalizations.length} {wizard.personalizations.length === 1 ? 'gravação pronta' : 'gravações prontas'}
            </h2>
            <p className="text-xs text-muted-foreground">Revise abaixo e gere o orçamento</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" disabled={!wizard.canUndo} onClick={wizard.undo}><Undo2 className="h-3 w-3" /> Desfazer</Button>
          <Button variant="ghost" size="sm" className="gap-1.5 text-xs h-7" disabled={!wizard.canRedo} onClick={wizard.redo}><Redo2 className="h-3 w-3" /> Refazer</Button>
        </div>
      </motion.div>

      {/* Personalizations list */}
      <div className="rounded-xl border overflow-hidden divide-y divide-border">
        {wizard.personalizations.map((pers, idx) => (
          <motion.div key={pers.id} initial={{ opacity: 0, x: -20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * idx }} className="flex items-center gap-4 px-4 py-3 bg-card hover:bg-muted/30 transition-colors">
            <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center font-bold text-sm text-primary shrink-0">{idx + 1}</div>
            {wizard.selectedProduct && <WizardMockupPreview personalization={pers} product={wizard.selectedProduct} />}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-sm truncate">{pers.technique.name}</span>
                {pers.pricing.budgetCode && (
                  <Badge variant="secondary" className="text-[10px] font-mono px-1.5 py-0 h-4 shrink-0">{pers.pricing.budgetCode}</Badge>
                )}
              </div>
              <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
                <span className="flex items-center gap-1"><MapPin className="h-3 w-3" />
                  {pers.location.componentName === pers.location.locationName ? pers.location.locationName : `${pers.location.componentName} • ${pers.location.locationName}`}
                </span>
                <span>{pers.specs.colors} {pers.specs.colors === 1 ? 'cor' : 'cores'}</span>
                <span>{pers.specs.width}×{pers.specs.height}cm</span>
              </div>
            </div>
            <div className="text-right shrink-0">
              <p className="font-bold text-base text-primary">{formatCurrency(pers.pricing.totalPrice)}</p>
              <p className="text-[11px] text-muted-foreground">{formatCurrency(pers.pricing.costPerUnit)}/un</p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Totals */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="rounded-2xl overflow-hidden shadow-xl">
        <div className="bg-gradient-to-br from-primary via-primary to-primary/90 p-5 text-primary-foreground">
          <div className="grid grid-cols-[2fr_1.5fr_1fr] gap-3 items-stretch">
            <div className="p-4 rounded-xl bg-black/25 backdrop-blur-sm border border-white/10 shadow-lg shadow-black/20">
              <p className="text-xs font-semibold tracking-wider text-primary-foreground/70 mb-1.5">Total geral</p>
              <p className="text-4xl font-extrabold tracking-tight text-primary-foreground">{formatCurrency(wizard.totals.grandTotal)}</p>
            </div>
            <div className="p-4 rounded-xl bg-black/15 backdrop-blur-sm border border-white/10">
              <p className="text-xs font-semibold tracking-wider text-primary-foreground/70 mb-0.5">Por unidade</p>
              <p className="text-[11px] text-primary-foreground/50 mb-1.5">(produto + gravação)</p>
              <p className="text-2xl font-bold text-primary-foreground">{formatCurrency(wizard.totals.grandTotalPerUnit)}</p>
            </div>
            <div className="p-4 rounded-xl bg-black/15 backdrop-blur-sm border border-white/10 flex flex-col justify-between">
              <p className="text-xs font-semibold tracking-wider text-primary-foreground/70 mb-1.5">Prazo máx.</p>
              {wizard.totals.maxDays > 0 ? (
                <p className="text-2xl font-bold text-primary-foreground">~{wizard.totals.maxDays}d</p>
              ) : (
                <div className="group relative flex items-center gap-2 cursor-help">
                  <AlertCircle className="h-4 w-4 text-primary-foreground/70 shrink-0" />
                  <p className="text-lg font-bold text-primary-foreground">A consultar</p>
                  <div className="absolute bottom-full left-0 mb-2 px-3 py-2 rounded-lg bg-black/90 text-primary-foreground text-xs w-48 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-xl z-10">
                    Prazo depende da confirmação do fornecedor para esta técnica e quantidade.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* CTAs */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }} className="space-y-3 pt-2">
        <Button size="lg" className="w-full gap-3 h-14 text-base font-bold rounded-xl shadow-xl shadow-primary/30 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
          onClick={onGenerateQuote}><FileText className="h-5 w-5" />Gerar Orçamento</Button>
        <div className="flex gap-2 justify-center">
          {wizard.hasAvailableLocations && (
            <Button size="sm" variant="outline" className="gap-1.5 text-xs h-9 rounded-lg" onClick={onAddAnother}><Plus className="h-3.5 w-3.5" /> Outro Local</Button>
          )}
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground h-9" onClick={onCopy}><Copy className="h-3.5 w-3.5" /> Copiar</Button>
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground h-9" onClick={handleShareWhatsApp}><MessageCircle className="h-3.5 w-3.5" /> WhatsApp</Button>
          <Button size="sm" variant="ghost" className="gap-1.5 text-xs text-muted-foreground h-9" onClick={() => setShowDuplicateQty(!showDuplicateQty)}><Repeat className="h-3.5 w-3.5" /> Outra Qtd.</Button>
        </div>
      </motion.div>

      {/* Duplicate qty */}
      {showDuplicateQty && (
        <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}
          className="flex items-center justify-center gap-3 p-4 rounded-xl bg-muted/50 border">
          <span className="text-sm text-muted-foreground">Nova quantidade:</span>
          <Input type="number" value={duplicateQty} onChange={(e) => setDuplicateQty(parseInt(e.target.value) || 1)}
            min={1} className="w-28 h-9 text-center font-bold rounded-lg" />
          <Button size="sm" onClick={handleDuplicate} disabled={duplicateQty === wizard.quantity || duplicateQty <= 0}>Recalcular</Button>
        </motion.div>
      )}

      {/* Quantity Range Comparison */}
      {wizard.personalizations.length > 0 && wizard.selectedProduct && (
        <QuantityRangeComparison personalizations={wizard.personalizations} currentQuantity={wizard.quantity} productPrice={wizard.effectivePrice} />
      )}

      {/* New Simulation */}
      <div className="text-center pt-2">
        <Button variant="link-secondary" className="text-muted-foreground" onClick={wizard.resetWizard}>Iniciar nova simulação</Button>
      </div>
    </div>
  );
}
