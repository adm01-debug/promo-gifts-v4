/**
 * PersonalizationSummary - Resumo lateral das personalizações v4
 * 
 * UX: preços nunca truncados, nomes abreviados, agrupamento por local,
 * ações compactas (ícones), código orçamento discreto, CTA premium.
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { 
  ShoppingCart, 
  MapPin, 
  Plus,
  Sparkles,
  Pencil,
  FileText,
  Copy,
  Trash2,
} from 'lucide-react';
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
import { motion, AnimatePresence } from 'framer-motion';
import type { UseSimulatorWizardReturn } from '@/hooks/simulator/useSimulatorWizard';
import { formatCurrency } from '@/lib/format';
import { RemovePersonalizationDialog } from './RemovePersonalizationDialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import type { Personalization } from '@/types/domain/simulator-wizard';
import { useMemo } from 'react';

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
  const groups: { locationName: string; componentName: string; items: { pers: Personalization; originalIndex: number }[] }[] = [];
  
  personalizations.forEach((pers, idx) => {
    const key = pers.location.locationName;
    let group = groups.find(g => g.locationName === key);
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

  const usedLocationIds = new Set(personalizations.map(p => p.location.id));
  const unusedLocations = availableLocations.filter(loc => !usedLocationIds.has(loc.id));
  const locationGroups = useMemo(() => groupByLocation(personalizations), [personalizations]);

  if (!selectedProduct) return null;

  return (
    <div className="flex flex-col h-full p-4 overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3 shrink-0">
        <div className="p-2 rounded-lg bg-primary/10">
          <ShoppingCart className="h-4 w-4 text-primary" />
        </div>
        <h3 className="font-display font-semibold text-base">Resumo</h3>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="space-y-3 pr-2">
            {/* Produto */}
            <div className="p-3 rounded-lg bg-muted/50">
              <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
                Produto
              </span>
              <p className="text-sm font-medium leading-tight mb-1.5 mt-1">
                {selectedProduct.name}
              </p>
              <div className="flex items-baseline justify-between text-xs text-muted-foreground gap-2">
                <span className="shrink-0">{quantity} un. × {formatCurrency(effectivePrice)}</span>
                <span className="font-semibold text-foreground whitespace-nowrap">
                  {formatCurrency(totals.productTotal)}
                </span>
              </div>
            </div>

            {/* Gravações — agrupadas por local */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <span className="text-[11px] font-medium text-muted-foreground uppercase tracking-wide">
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
                               aria-label="Excluir"><Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </AlertDialogTrigger>
                          </span>
                        </TooltipTrigger>
                        <TooltipContent side="bottom" className="text-xs">Remover todas</TooltipContent>
                      </Tooltip>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle className="flex items-center gap-2">
                            <Trash2 className="h-5 w-5 text-destructive" />
                            Remover todas as gravações?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Todas as <strong>{personalizations.length} gravações</strong> serão removidas. 
                            Você precisará configurá-las novamente se quiser adicioná-las de volta.
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
                    <span className="font-semibold text-sm text-primary whitespace-nowrap">
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
                    className="p-4 rounded-lg border border-dashed border-muted-foreground/30 text-center"
                  >
                    <Sparkles className="h-5 w-5 mx-auto mb-2 text-muted-foreground/40" />
                    <p className="text-xs text-muted-foreground">
                      Nenhuma gravação adicionada
                    </p>
                  </motion.div>
                ) : (
                  <div className="space-y-2">
                    {locationGroups.map((group) => (
                      <div key={group.locationName} className="space-y-1">
                        {/* Location header — shown once per group */}
                        {locationGroups.length > 1 && (
                          <div className="flex items-center gap-1.5 px-1 pt-1">
                            <MapPin className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
                              {group.locationName}
                            </span>
                          </div>
                        )}

                        {group.items.map(({ pers, originalIndex: idx }) => {
                          const isActive = isEditingPersonalization && currentPersonalizationIndex === idx;
                          const { group: techGroup, variation } = shortTechniqueName(pers.technique.name);

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
                              onDuplicate={(locId) => wizard.duplicatePersonalization(pers.id, locId)}
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
              <Button
                variant="outline"
                size="sm"
                className="w-full gap-2"
                onClick={onAddNew}
              >
                <Plus className="h-4 w-4" />
                Outro Local
              </Button>
            )}
          </div>
        </ScrollArea>
      </div>

      {/* Footer fixo — separado visualmente */}
      <div className="shrink-0 pt-3 mt-3 border-t border-border/50 space-y-3">
        {/* Total */}
        <div className="flex items-baseline justify-between gap-2">
          <div>
            <span className="font-bold text-base">Total</span>
            <p className="text-[11px] text-muted-foreground">
              ≈{formatCurrency(totals.grandTotalPerUnit)}/un.
            </p>
          </div>
          <span className="font-bold text-xl text-primary whitespace-nowrap">
            {formatCurrency(totals.grandTotal)}
          </span>
        </div>

        {/* CTA Premium */}
        {onGenerateQuote && personalizations.length > 0 && (
          <Button
            size="lg"
            className="w-full gap-2 h-12 text-sm font-bold bg-gradient-to-r from-primary to-primary/80 shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 transition-all"
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
  unusedLocations: { id: string; locationName: string }[];
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
      className={`
        p-2.5 rounded-xl border transition-all
        ${isActive
          ? 'border-primary bg-primary/5 shadow-sm shadow-primary/10' 
          : 'bg-card hover:bg-muted/30 border-border/60'
        }
      `}
    >
      {/* Row 1: Number + Technique + Price (never truncated) */}
      <div className="flex items-start gap-1.5 mb-1">
        <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-5 shrink-0 font-bold mt-0.5">
          {idx + 1}
        </Badge>
        <div className="flex-1 min-w-0">
          <span className="text-xs font-semibold text-primary block leading-tight">
            {techGroup}
          </span>
          {techVariation && (
            <span className="text-[10px] text-muted-foreground leading-tight">
              {techVariation}
            </span>
          )}
        </div>
        {/* Price — always visible, never truncated */}
        <span className="font-bold text-sm text-foreground whitespace-nowrap shrink-0 tabular-nums">
          {formatCurrency(pers.pricing.totalPrice)}
        </span>
      </div>

      {/* Row 2: Location (only if single group) + Specs */}
      <div className="flex flex-wrap items-center gap-1 ml-7">
        {showLocation && (
          <span className="text-[10px] text-muted-foreground mr-1">
            {componentName === locationName ? locationName : `${componentName} • ${locationName}`}
          </span>
        )}
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
          {pers.specs.colors} {pers.specs.colors === 1 ? 'cor' : 'cores'}
        </Badge>
        <Badge variant="outline" className="text-[9px] px-1 py-0 h-3.5">
          {pers.specs.width}×{pers.specs.height}cm
        </Badge>
        {/* Budget code — discrete tooltip */}
        {pers.pricing.budgetCode && (
          <Tooltip>
            <TooltipTrigger asChild>
              <Badge variant="ghost" className="text-[9px] font-mono px-1 py-0 h-3.5 cursor-help text-muted-foreground/60 hover:text-muted-foreground">
                ⌘
              </Badge>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs font-mono">
              {pers.pricing.budgetCode}
            </TooltipContent>
          </Tooltip>
        )}
      </div>

      {/* Row 3: Compact icon actions via ⋯ menu */}
      <div className="flex items-center gap-0.5 ml-7 mt-1.5">
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground hover:text-foreground"
              onClick={onEdit}
             aria-label="Editar"><Pencil className="h-3 w-3" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom" className="text-xs">Editar</TooltipContent>
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
                     aria-label="Copiar"><Copy className="h-3 w-3" />
                    </Button>
                  </DropdownMenuTrigger>
                </span>
              </TooltipTrigger>
              <TooltipContent side="bottom" className="text-xs">Duplicar</TooltipContent>
            </Tooltip>
            <DropdownMenuContent align="end" className="min-w-[160px]">
              {unusedLocations.map(loc => (
                <DropdownMenuItem
                  key={loc.id}
                  onClick={() => onDuplicate(loc.id)}
                >
                  <MapPin className="h-3 w-3 mr-2" />
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
