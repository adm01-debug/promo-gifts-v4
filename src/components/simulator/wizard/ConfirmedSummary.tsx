/**
 * ConfirmedSummary — Resumo pós-confirmação do simulador
 * Extraído de StepComparison.tsx
 */

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import {
  Check,
  Plus,
  FileText,
  Copy,
  MapPin,
  MessageCircle,
  Repeat,
  Undo2,
  Redo2,
  AlertCircle,
} from 'lucide-react';
import { m as motion } from 'framer-motion';
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

export function ConfirmedSummary({
  wizard,
  onAddAnother,
  onGenerateQuote,
  onCopy,
}: ConfirmedSummaryProps) {
  const [showDuplicateQty, setShowDuplicateQty] = useState(false);
  const [duplicateQty, setDuplicateQty] = useState(wizard.quantity);

  const handleShareWhatsApp = () => {
    const persText = wizard.personalizations
      .map(
        (p, idx) =>
          `${idx + 1}. ${p.technique.name} | ${p.location.locationName} | ${formatCurrency(p.pricing.totalPrice)}`,
      )
      .join('\n');

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
      <motion.div
        initial={{ opacity: 0, scale: 0.9 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center justify-between"
      >
        <div className="flex items-center gap-3">
          <motion.div
            className="relative h-10 w-10 shrink-0"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', delay: 0.1, stiffness: 200 }}
          >
            <div className="absolute inset-0 rounded-full bg-primary/20 blur-lg" />
            <div className="relative flex h-full w-full items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary/90 shadow-md">
              <Check className="h-5 w-5 text-primary-foreground" />
            </div>
          </motion.div>
          <div>
            <h2 className="font-display text-lg font-bold leading-tight">
              {wizard.personalizations.length}{' '}
              {wizard.personalizations.length === 1 ? 'gravação pronta' : 'gravações prontas'}
            </h2>
            <p className="text-xs text-muted-foreground">Revise abaixo e gere o orçamento</p>
          </div>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={!wizard.canUndo}
            onClick={wizard.undo}
          >
            <Undo2 className="h-3 w-3" /> Desfazer
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1.5 text-xs"
            disabled={!wizard.canRedo}
            onClick={wizard.redo}
          >
            <Redo2 className="h-3 w-3" /> Refazer
          </Button>
        </div>
      </motion.div>

      {/* Personalizations list */}
      <div className="divide-y divide-border overflow-hidden rounded-xl border">
        {wizard.personalizations.map((pers, idx) => (
          <motion.div
            key={pers.id}
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.05 * idx }}
            className="flex items-center gap-4 bg-card px-4 py-3 transition-colors hover:bg-muted/30"
          >
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-sm font-bold text-primary">
              {idx + 1}
            </div>
            {wizard.selectedProduct && (
              <WizardMockupPreview personalization={pers} product={wizard.selectedProduct} />
            )}
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2">
                <span className="truncate text-sm font-semibold">{pers.technique.name}</span>
                {pers.pricing.budgetCode && (
                  <Badge
                    variant="secondary"
                    className="h-4 shrink-0 px-1.5 py-0 font-mono text-[10px]"
                  >
                    {pers.pricing.budgetCode}
                  </Badge>
                )}
              </div>
              <div className="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" />
                  {pers.location.componentName === pers.location.locationName
                    ? pers.location.locationName
                    : `${pers.location.componentName} • ${pers.location.locationName}`}
                </span>
                <span>
                  {pers.specs.colors} {pers.specs.colors === 1 ? 'cor' : 'cores'}
                </span>
                <span>
                  {pers.specs.width}×{pers.specs.height}cm
                </span>
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-base font-bold text-primary">
                {formatCurrency(pers.pricing.totalPrice)}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {formatCurrency(pers.pricing.costPerUnit)}/un
              </p>
            </div>
          </motion.div>
        ))}
      </div>

      {/* Totals */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
        className="overflow-hidden rounded-2xl shadow-xl"
      >
        <div className="bg-gradient-to-br from-primary via-primary to-primary/90 p-5 text-primary-foreground">
          <div className="grid grid-cols-[2fr_1.5fr_1fr] items-stretch gap-3">
            <div className="rounded-xl border border-white/10 bg-black/25 p-4 shadow-lg shadow-black/20 backdrop-blur-sm">
              <p className="mb-1.5 text-xs font-semibold tracking-wider text-primary-foreground/70">
                Total geral
              </p>
              <p className="text-4xl font-extrabold tracking-tight text-primary-foreground">
                {formatCurrency(wizard.totals.grandTotal)}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-black/15 p-4 backdrop-blur-sm">
              <p className="mb-0.5 text-xs font-semibold tracking-wider text-primary-foreground/70">
                Por unidade
              </p>
              <p className="mb-1.5 text-[11px] text-primary-foreground/50">(produto + gravação)</p>
              <p className="text-2xl font-bold text-primary-foreground">
                {formatCurrency(wizard.totals.grandTotalPerUnit)}
              </p>
            </div>
            <div className="flex flex-col justify-between rounded-xl border border-white/10 bg-black/15 p-4 backdrop-blur-sm">
              <p className="mb-1.5 text-xs font-semibold tracking-wider text-primary-foreground/70">
                Prazo máx.
              </p>
              {wizard.totals.maxDays > 0 ? (
                <p className="text-2xl font-bold text-primary-foreground">
                  ~{wizard.totals.maxDays}d
                </p>
              ) : (
                <div className="group relative flex cursor-help items-center gap-2">
                  <AlertCircle className="h-4 w-4 shrink-0 text-primary-foreground/70" />
                  <p className="text-lg font-bold text-primary-foreground">A consultar</p>
                  <div className="pointer-events-none absolute bottom-full left-0 z-10 mb-2 w-48 rounded-lg bg-black/90 px-3 py-2 text-xs text-primary-foreground opacity-0 shadow-xl transition-opacity group-hover:opacity-100">
                    Prazo depende da confirmação do fornecedor para esta técnica e quantidade.
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </motion.div>

      {/* CTAs */}
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
        className="space-y-3 pt-2"
      >
        <Button
          size="lg"
          className="h-14 w-full gap-3 rounded-xl bg-gradient-to-r from-primary to-primary/80 text-base font-bold shadow-xl shadow-primary/30 hover:from-primary/90 hover:to-primary/70"
          onClick={onGenerateQuote}
        >
          <FileText className="h-5 w-5" />
          Gerar Orçamento
        </Button>
        <div className="flex justify-center gap-2">
          {wizard.hasAvailableLocations && (
            <Button
              size="sm"
              variant="outline"
              className="h-9 gap-1.5 rounded-lg text-xs"
              onClick={onAddAnother}
            >
              <Plus className="h-3.5 w-3.5" /> Outro Local
            </Button>
          )}
          <Button
            size="sm"
            variant="ghost"
            className="h-9 gap-1.5 text-xs text-muted-foreground"
            onClick={onCopy}
          >
            <Copy className="h-3.5 w-3.5" /> Copiar
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 gap-1.5 text-xs text-muted-foreground"
            onClick={handleShareWhatsApp}
          >
            <MessageCircle className="h-3.5 w-3.5" /> WhatsApp
          </Button>
          <Button
            size="sm"
            variant="ghost"
            className="h-9 gap-1.5 text-xs text-muted-foreground"
            onClick={() => setShowDuplicateQty(!showDuplicateQty)}
          >
            <Repeat className="h-3.5 w-3.5" /> Outra Qtd.
          </Button>
        </div>
      </motion.div>

      {/* Duplicate qty */}
      {showDuplicateQty && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="flex items-center justify-center gap-3 rounded-xl border bg-muted/50 p-4"
        >
          <span className="text-sm text-muted-foreground">Nova quantidade:</span>
          <Input
            type="number"
            value={duplicateQty}
            onChange={(e) => setDuplicateQty(parseInt(e.target.value, 10) || 1)}
            min={1}
            className="h-9 w-28 rounded-lg text-center font-bold"
          />
          <Button
            size="sm"
            onClick={handleDuplicate}
            disabled={duplicateQty === wizard.quantity || duplicateQty <= 0}
          >
            Recalcular
          </Button>
        </motion.div>
      )}

      {/* Quantity Range Comparison */}
      {wizard.personalizations.length > 0 && wizard.selectedProduct && (
        <QuantityRangeComparison
          personalizations={wizard.personalizations}
          currentQuantity={wizard.quantity}
          productPrice={wizard.effectivePrice}
        />
      )}

      {/* New Simulation */}
      <div className="pt-2 text-center">
        <Button
          variant="link-secondary"
          className="text-muted-foreground"
          onClick={wizard.resetWizard}
        >
          Iniciar nova simulação
        </Button>
      </div>
    </div>
  );
}
