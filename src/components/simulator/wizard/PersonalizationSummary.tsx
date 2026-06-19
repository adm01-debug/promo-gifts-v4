/**
 * PersonalizationSummary - Resumo lateral das personalizações v4
 *
 * UX: preços nunca truncados, nomes abreviados, agrupamento por local,
 * ações compactas (ícones), código orçamento discreto, CTA premium.
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { ShoppingCart, MapPin, Plus, Sparkles, Pencil, FileText, Copy, Trash2 } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';
import { m as motion, AnimatePresence } from 'framer-motion';
import type { UseSimulatorWizardReturn } from '@/hooks/simulator/useSimulatorWizard';
import { formatCurrency } from '@/lib/format';
import { RemovePersonalizationDialog } from './RemovePersonalizationDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import type { Personalization } from '@/types/domain/simulator-wizard';
import { useMemo } from 'react';
import { cn } from '@/lib/utils';

interface PersonalizationSummaryProps {
  wizard: UseSimulatorWizardReturn;
  onAddNew?: () => void;
  onGenerateQuote?: () => void;
  showAddButton?: boolean;
}

/** Extrai nome curto do grupo de técnica (antes do " | ") */
function shortTechniqueName(name: string): { group: string; variation?: string } {
  const parts = name.split(/\s*\|\s*/);
  if (parts.length >= 2) {
    return { group: parts[0].trim(), variation: parts.slice(1).join(' | ').trim() };
  }
  return { group: name };
}

/** Agrupa personalizações por locationName */
function groupByLocation(personalizations: Personalization[]) {
  const groups: Array<{
    locationName: string;
    componentName: string;
    items: Array<{ pers: Personalization; originalIndex: number }>;
  }> = [];

  personalizations.forEach((pers, idx) => {
    const key = pers.location.locationName;
    let group = groups.find((g) => g.locationName === key);
    if (!group) {
      group = { locationName: key, componentName: pers.location.componentName, items: [] };
      groups.push(group);
    }
    group.items.push({ pers, originalIndex: idx });
  });

  return groups;
}

export function PersonalizationSummary({
  wizard,
  onAddNew,
  onGenerateQuote,
  showAddButton = true,
}: PersonalizationSummaryProps) {
  const {
    selectedProduct,
    quantity,
    personalizations,
    effectivePrice,
    currentPersonalizationIndex,
    isEditingPersonalization,
    totals,
    availableLocations,
  } = wizard;

  const usedLocationIds = new Set(personalizations.map((p) => p.location.id));
  const unusedLocations = availableLocations.filter((loc) => !usedLocationIds.has(loc.id));
  const locationGroups = useMemo(() => groupByLocation(personalizations), [personalizations]);

  if (!selectedProduct) return null;

  return (
    <div className="flex h-full flex-col overflow-hidden p-4">
      {/* Header */}
      <div className="mb-3 flex shrink-0 items-center gap-2">
        <div className="rounded-lg bg-primary/10 p-2">
          <ShoppingCart className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-display text-base font-semibold">Resumo</h3>
      </div>

      {/* Scrollable Content */}
      <div className="min-h-0 flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-3 pr-2">
            {/* Produto */}
            <div className="rounded-lg bg-muted/50 p-3">
              <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Produto
              </span>
              <p className="mb-1.5 mt-1 text-sm font-medium leading-tight">
                {selectedProduct.name}
              </p>
              <div className="flex items-baseline justify-between gap-2 text-xs text-muted-foreground">
                <span className="shrink-0">
                  {quantity} un. × {formatCurrency(effectivePrice)}
                </span>
                <span className="whitespace-nowrap font-semibold text-foreground">
                  {formatCurrency(totals.productTotal)}
                </span>
              </div>
            </div>

            {/* Gravações — agrupadas por local */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <span className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                  Gravações ({personalizations.length})
                </span>
                <div className="flex items-center gap-1.5">
                  {personalizations.length > 1 && (
                    <AlertDialog>
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="inline-flex">
                            <AlertDialogTrigger asChild>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-6 w-6 text-muted-foreground hover:text-destructive"
                                aria-label="Excluir"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom">Remover todas</TooltipContent>
                      </Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <Trash2 className="h-5 w-5 text-destructive" />
                            Remover todas as gravações?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Todas as <strong>{personalizations.length} gravações</strong> serão
                            removidas. Você precisará configurá-las novamente se quiser adicioná-las
                            de volta.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Cancelar</AlertDialogCancel>
                          <AlertDialogAction
                            className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            onClick={() => wizard.removeAllPersonalizations()}
                          >
                            Remover todas
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                  {personalizations.length > 0 && (
                    <span className="whitespace-nowrap text-sm font-semibold text-primary">
                      {formatCurrency(totals.customizationTotal)}
                    </span>
                  )}
                </div>
              </div>

              <AnimatePresence mode="popLayout">
                {personalizations.length === 0 ? (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="rounded-lg border border-dashed border-muted-foreground/30 p-4 text-center"
                  >
                    <Sparkles className="mx-auto mb-2 h-5 w-5 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">Nenhuma gravação adicionada</p>
                  </motion.div>
                ) : (
                  <div className="space-y-2">
                    {locationGroups.map((group) => (
                      <div key={group.locationName} className="space-y-1">
                        {/* Location header — shown once per group */}
                        {locationGroups.length > 1 && (
                          <div className="flex items-center gap-1.5 px-1 pt-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                              {group.locationName}
                            </span>
                          </div>
                        )}

                        {group.items.map(({ pers, originalIndex: idx }) => {
                          const isActive =
                            isEditingPersonalization && currentPersonalizationIndex === idx;
                          const { group: techGroup, variation } = shortTechniqueName(
                            pers.technique.name,
                          );

                          return (
                            <PersonalizationRow
                              key={pers.id}
                              pers={pers}
                              idx={idx}
                              isActive={isActive}
                              techGroup={techGroup}
                              techVariation={variation}
                              showLocation={locationGroups.length <= 1}
                              locationName={pers.location.locationName}
                              componentName={pers.location.componentName}
                              unusedLocations={unusedLocations}
                              onEdit={() => wizard.editPersonalization(idx)}
                              onDuplicate={(locId) =>
                                wizard.duplicatePersonalization(pers.id, locId)
                              }
                              onRemove={() => wizard.removePersonalization(pers.id)}
                            />
                          );
                        })}
                      </div>
                    ))}
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Botão adicionar */}
            {showAddButton && personalizations.length > 0 && wizard.hasAvailableLocations && (
              <Button variant="outline" size="sm" className="w-full gap-2" onClick={onAddNew}>
                <Plus className="h-4 w-4" />
                Outro Local
              </Button>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Footer fixo — separado visualmente */}
      <div className="mt-3 shrink-0 space-y-3 border-t border-border/50 pt-3">
        {/* Total */}
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <span className="text-base font-bold">Total</span>
            <p className="text-[11px] text-muted-foreground">
              ≈{formatCurrency(totals.grandTotalPerUnit)}/un.
            </p>
          </div>
          <span className="whitespace-nowrap text-xl font-bold text-primary">
            {formatCurrency(totals.grandTotal)}
          </span>
        </div>

        {/* CTA Premium */}
        {onGenerateQuote && personalizations.length > 0 && (
          <Button
            size="lg"
            className="h-12 w-full gap-2 bg-gradient-to-r from-primary to-primary/80 text-sm font-bold shadow-lg shadow-primary/20 transition-all hover:shadow-xl hover:shadow-primary/30"
            onClick={onGenerateQuote}
          >
            <FileText className="h-5 w-5" />
            Gerar Orçamento
          </Button>
        )}
      </div>
    </div>
  );
}

/* ─── Compact Row Component ─── */

interface PersonalizationRowProps {
  pers: Personalization;
  idx: number;
  isActive: boolean;
  techGroup: string;
  techVariation?: string;
  showLocation: boolean;
  locationName: string;
  componentName: string;
  unusedLocations: Array<{ id: string; locationName: string }>;
  onEdit: () => void;
  onDuplicate: (locationId: string) => void;
  onRemove: () => void;
}

function PersonalizationRow({
  pers,
  idx,
  isActive,
  techGroup,
  techVariation,
  showLocation,
  locationName,
  componentName,
  unusedLocations,
  onEdit,
  onDuplicate,
  onRemove,
}: PersonalizationRowProps) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        'rounded-xl border p-2.5 transition-all',
        isActive
          ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10'
          : 'border-border/60 bg-card hover:bg-muted/30',
      )}
    >
      {/* Row 1: Number + Technique + Price (never truncated) */}
      <div className="mb-1 flex items-start gap-1.5">
        <Badge
          variant="secondary"
          className="mt-0.5 h-5 shrink-0 px-1.5 py-0 text-[10px] font-bold"
        >
          {idx + 1}
        </Badge>
        <div className="min-w-0 flex-1">
          <span className="block text-xs font-semibold leading-tight text-primary">
            {techGroup}
          </span>
          {techVariation && (
            <span className="text-[10px] leading-tight text-muted-foreground">{techVariation}</span>
          )}
        </div>
        {/* Price — always visible, never truncated */}
        <span className="shrink-0 whitespace-nowrap text-sm font-bold tabular-nums text-foreground">
          {formatCurrency(pers.pricing.totalPrice)}
        </span>
      </div>

      {/* Row 2: Location (only if single group) + Specs */}
      <div className="ml-7 flex flex-wrap items-center gap-1">
        {showLocation && (
          <span className="mr-1 text-[10px] text-muted-foreground">
            {componentName === locationName ? locationName : `${componentName} • ${locationName}`}
          </span>
        )}
        <Badge variant="outline" className="h-3.5 px-1 py-0 text-[9px]">
          {pers.specs.colors} {pers.specs.colors === 1 ? 'cor' : 'cores'}
        </Badge>
        <Badge variant="outline" className="h-3.5 px-1 py-0 text-[9px]">
          {pers.specs.width}×{pers.specs.height}cm
        </Badge>
        {/* Budget code — discrete tooltip */}
        {pers.pricing.budgetCode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge
                variant="outline"
                className="h-3.5 cursor-help px-1 py-0 font-mono text-[9px] text-muted-foreground/60 hover:text-muted-foreground"
              >
                ⌘
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="font-mono">
              {pers.pricing.budgetCode}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Row 3: Compact icon actions via ⋯ menu */}
      <div className="ml-7 mt-1.5 flex items-center gap-0.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={onEdit}
              aria-label="Editar"
            >
              <Pencil className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Editar</TooltipContent>
        </Tooltip>

        {unusedLocations.length > 0 && (
          <DropdownMenu>
            <Tooltip>
              <TooltipTrigger asChild>
                <span className="inline-flex">
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6 text-muted-foreground hover:text-foreground"
                      aria-label="Copiar"
                    >
                      <Copy className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom">Duplicar</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              {unusedLocations.map((loc) => (
                <DropdownMenuItem key={loc.id} onClick={() => onDuplicate(loc.id)}>
                  <MapPin className="mr-2 h-3 w-3" />
                  {loc.locationName}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}

        <div className="ml-auto">
          <RemovePersonalizationDialog
            techniqueName={techGroup}
            locationName={locationName}
            onConfirm={onRemove}
          />
        </div>
      </div>
    </motion.div>
  );
}
