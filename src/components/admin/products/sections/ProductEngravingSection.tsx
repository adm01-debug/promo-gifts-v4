/**
 * ProductEngravingSection — Aba de Gravação com Wizard guiado
 * Refactored: 960 → ~280 lines (orchestrator + steps inline)
 *
 * Sprint 3 fixes (26/05/2026):
 *   BUG-03: engravingFlushRef prop — populated with flushLocalAreas so AdminProductFormPage
 *            can call it before navigate() to persist local areas for new products.
 *   BUG-05 (UI completion): AlertDialog for delete area confirmation (state was already
 *            exposed by useEngravingWizard since Sprint 2, UI rendering added here).
 */
import React, { useEffect } from 'react';
import { SectionCard } from '../ProductFormHelpers';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import {
  Paintbrush,
  MapPin,
  Plus,
  Save,
  Search,
  ChevronRight,
  ChevronLeft,
  Check,
  Ruler,
  Palette,
  DollarSign,
  Layers,
  Zap,
  Info,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { m as motion, AnimatePresence } from 'framer-motion';
import {
  WIZARD_STEPS,
  COMMON_COMPONENTS,
  COMMON_LOCATIONS,
  getTechniqueIcon,
  getTechniqueColor,
} from './engraving/types';
import { useEngravingWizard } from './engraving/useEngravingWizard';
import { EngravingAreaCard } from './engraving/EngravingAreaCard';

interface Props {
  productId?: string;
  isEdit: boolean;
  /** BUG-03: ref that will be populated with flushLocalAreas so the parent page can call it
   *  after product creation and before navigating to edit mode. */
  engravingFlushRef?: React.MutableRefObject<((id: string) => Promise<void>) | null>;
}

export default function ProductEngravingSection({ productId, isEdit, engravingFlushRef }: Props) {
  const w = useEngravingWizard(productId, isEdit);

  // BUG-03 FIX: register flushLocalAreas with the ref so AdminProductFormPage can call it
  useEffect(() => {
    if (engravingFlushRef) {
      engravingFlushRef.current = w.flushLocalAreas;
    }
    return () => {
      if (engravingFlushRef) {
        engravingFlushRef.current = null;
      }
    };
  }, [engravingFlushRef, w.flushLocalAreas]);

  const renderWizardStepper = () => {
    if (w.wizardStep === 'list') return null;
    return (
      <div className="mb-4 flex items-center gap-1">
        {WIZARD_STEPS.map((step, i) => {
          const Icon = step.icon;
          const isActive = step.id === w.wizardStep;
          const isDone = w.wizardStepIndex > i;
          return (
            <React.Fragment key={step.id}>
              {i > 0 && (
                <div
                  className={cn('h-px max-w-8 flex-1', isDone ? 'bg-primary' : 'bg-border/50')}
                />
              )}
              <div
                className={cn(
                  'flex cursor-pointer items-center gap-1.5 rounded-full px-2 py-1 text-[11px] font-medium transition-all',
                  isActive && 'bg-primary text-primary-foreground shadow-sm',
                  isDone && !isActive && 'bg-primary/15 text-primary',
                  !isActive && !isDone && 'text-muted-foreground',
                )}
                onClick={() => {
                  if (isDone) w.setWizardStep(step.id);
                }}
              >
                {isDone ? <Check className="h-3 w-3" /> : <Icon className="h-3 w-3" />}
                <span className="hidden sm:inline">{step.label}</span>
              </div>
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  const renderComponentStep = () => (
    <div className="space-y-3">
      <div className="mb-1 flex items-center gap-2">
        <Layers className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Qual componente do produto?</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        Selecione a parte do produto onde será aplicada a personalização.
      </p>
      <div className="grid grid-cols-3 gap-2">
        {COMMON_COMPONENTS.map((comp) => (
          <button
            key={comp.code}
            type="button"
            onClick={() => w.handleSelectComponent(comp)}
            className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-card/60 p-3 text-left transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
          >
            <span className="text-lg">{comp.icon}</span>
            <span className="text-xs font-medium">{comp.name}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Input
          placeholder="Ou digite um componente personalizado..."
          value={w.customComponent}
          onChange={(e) => w.setCustomComponent(e.target.value)}
          className="h-8 flex-1 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!w.customComponent.trim()}
          onClick={() =>
            w.handleSelectComponent({
              code: w.customComponent.trim().toUpperCase().replace(/\s+/g, '_'),
              name: w.customComponent.trim(),
            })
          }
          className="h-8 text-xs"
        >
          Usar <ChevronRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
    </div>
  );

  const renderLocationStep = () => (
    <div className="space-y-3">
      <div className="mb-1 flex items-center gap-2">
        <MapPin className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Qual local no {w.selectedComponent?.name}?</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        Defina a posição/região onde a técnica será aplicada.
      </p>
      <div className="grid grid-cols-2 gap-2">
        {COMMON_LOCATIONS.map((loc) => (
          <button
            key={loc.code}
            type="button"
            onClick={() => w.handleSelectLocation(loc)}
            className="flex items-center gap-2.5 rounded-lg border border-border/40 bg-card/60 p-3 text-left transition-all duration-200 hover:border-primary/50 hover:bg-primary/5 hover:shadow-sm"
          >
            <MapPin className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">{loc.name}</span>
          </button>
        ))}
      </div>
      <div className="flex items-center gap-2 pt-1">
        <Input
          placeholder="Ou digite um local personalizado..."
          value={w.customLocation}
          onChange={(e) => w.setCustomLocation(e.target.value)}
          className="h-8 flex-1 text-sm"
        />
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!w.customLocation.trim()}
          onClick={() =>
            w.handleSelectLocation({
              code: w.customLocation.trim().toUpperCase().replace(/\s+/g, '-'),
              name: w.customLocation.trim(),
            })
          }
          className="h-8 text-xs"
        >
          Usar <ChevronRight className="ml-1 h-3 w-3" />
        </Button>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => w.setWizardStep('component')}
        className="gap-1 text-xs"
      >
        <ChevronLeft className="h-3 w-3" /> Voltar
      </Button>
    </div>
  );

  const renderTechniqueStep = () => (
    <div className="space-y-3">
      <div className="mb-1 flex items-center gap-2">
        <Paintbrush className="h-4 w-4 text-primary" />
        <h4 className="text-sm font-semibold">Qual técnica de gravação?</h4>
      </div>
      <p className="text-xs text-muted-foreground">
        Aplicação em:{' '}
        <span className="font-medium text-foreground">{w.selectedComponent?.name}</span> →{' '}
        <span className="font-medium text-foreground">{w.selectedLocation?.name}</span>
      </p>
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar técnica..."
          value={w.techSearch}
          onChange={(e) => w.setTechSearch(e.target.value)}
          className="h-8 pl-8 text-sm"
        />
      </div>
      {w.loadingTechs ? (
        <div className="space-y-2">
          <Skeleton className="h-12 w-full rounded-lg" />
          <Skeleton className="h-12 w-full rounded-lg" />
        </div>
      ) : (
        <ScrollArea className="h-60">
          <div className="space-y-3 pr-2">
            {Object.entries(w.groupedTechniques).map(([group, techs]) => (
              <div key={group}>
                <p className="mb-1.5 px-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                  {group}
                </p>
                <div className="grid grid-cols-2 gap-1.5">
                  {techs.map((tech) => {
                    const code = tech.codigo_curto || tech.grupo_tecnica || '';
                    return (
                      <button
                        key={tech.id}
                        type="button"
                        onClick={() => w.handleSelectTechnique(tech)}
                        className={cn(
                          'flex items-center gap-2 rounded-lg border p-2.5 text-left transition-all duration-200 hover:scale-[1.01] hover:shadow-md',
                          `bg-gradient-to-br ${getTechniqueColor(code)}`,
                        )}
                      >
                        <span className="text-base">{getTechniqueIcon(code)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-medium">{tech.nome}</p>
                          <p className="font-mono text-[10px] text-muted-foreground">
                            {tech.codigo_curto || '—'}
                          </p>
                        </div>
                        {tech.max_cores !== null && Number(tech.max_cores) > 0 && (
                          <Palette className="h-3 w-3 shrink-0 text-muted-foreground" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
            {w.filteredTechniques.length === 0 && (
              <div className="py-6 text-center text-muted-foreground">
                <Search className="mx-auto mb-2 h-6 w-6 opacity-40" />
                <p className="text-xs">Nenhuma técnica encontrada</p>
              </div>
            )}
          </div>
        </ScrollArea>
      )}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={() => w.setWizardStep('location')}
        className="gap-1 text-xs"
      >
        <ChevronLeft className="h-3 w-3" /> Voltar
      </Button>
    </div>
  );

  const renderDetailsStep = () => {
    const rawCores = w.selectedTechnique?.max_cores;
    const maxCores = rawCores !== null && rawCores !== undefined ? Number(rawCores) : null;
    const custoSetup = w.selectedTechnique?.custo_setup ?? null;
    return (
      <div className="space-y-4">
        <div className="mb-1 flex items-center gap-2">
          <Ruler className="h-4 w-4 text-primary" />
          <h4 className="text-sm font-semibold">Detalhes da personalização</h4>
        </div>
        <div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-border/30 bg-muted/30 p-2.5 text-xs">
          <Badge variant="outline" className="gap-1 text-[10px]">
            <Layers className="h-2.5 w-2.5" />
            {w.selectedComponent?.name}
          </Badge>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <Badge variant="outline" className="gap-1 text-[10px]">
            <MapPin className="h-2.5 w-2.5" />
            {w.selectedLocation?.name}
          </Badge>
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
          <Badge className="gap-1 border-primary/30 bg-primary/15 text-[10px] text-primary">
            {getTechniqueIcon(w.selectedTechnique?.codigo_curto ?? '')} {w.selectedTechnique?.nome}
          </Badge>
        </div>
        {(maxCores || custoSetup) && (
          <div className="flex items-center gap-4 rounded-md border border-border/20 bg-muted/20 p-2 text-xs">
            <Info className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
            <span className="text-muted-foreground">Dados da técnica:</span>
            {maxCores !== null && (
              <span>
                <Palette className="mr-0.5 inline h-3 w-3" />
                {maxCores} cores máx.
              </span>
            )}
            {custoSetup !== null && custoSetup > 0 && (
              <span>
                <DollarSign className="mr-0.5 inline h-3 w-3" />
                Setup R${custoSetup}
              </span>
            )}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Largura máx. (cm)
            </label>
            <Input
              type="number"
              step="0.1"
              placeholder="Ex: 10"
              value={w.detailForm.max_width ?? ''}
              onChange={(e) =>
                w.setDetailForm((f) => ({
                  ...f,
                  max_width: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="h-8 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Altura máx. (cm)
            </label>
            <Input
              type="number"
              step="0.1"
              placeholder="Ex: 5"
              value={w.detailForm.max_height ?? ''}
              onChange={(e) =>
                w.setDetailForm((f) => ({
                  ...f,
                  max_height: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="h-8 text-sm"
            />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
              Custo unit. sobrescrito (R$)
            </label>
            <Input
              type="number"
              step="0.01"
              placeholder="Só se diferir da tabela"
              value={w.detailForm.unit_cost ?? ''}
              onChange={(e) =>
                w.setDetailForm((f) => ({
                  ...f,
                  unit_cost: e.target.value ? Number(e.target.value) : null,
                }))
              }
              className="h-8 text-sm"
            />
          </div>
          <div className="flex items-end gap-3">
            <div className="flex items-center gap-2 pb-1">
              <Switch
                checked={w.detailForm.is_curved}
                onCheckedChange={(v) => w.setDetailForm((f) => ({ ...f, is_curved: v }))}
              />
              <span className="text-xs text-muted-foreground">Superfície curva</span>
            </div>
          </div>
        </div>
        <div>
          <label className="mb-1 block text-[11px] font-medium text-muted-foreground">
            Observações
          </label>
          <Input
            placeholder="Notas sobre essa personalização..."
            value={w.detailForm.notes}
            onChange={(e) => w.setDetailForm((f) => ({ ...f, notes: e.target.value }))}
            className="h-8 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Switch
            checked={w.detailForm.is_active}
            onCheckedChange={(v) => w.setDetailForm((f) => ({ ...f, is_active: v }))}
          />
          <span className="text-xs text-muted-foreground">Área ativa</span>
        </div>
        <div className="flex items-center justify-between pt-2">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => w.setWizardStep('technique')}
            className="gap-1 text-xs"
          >
            <ChevronLeft className="h-3 w-3" /> Voltar
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={w.handleSaveArea}
            disabled={w.isBusy}
            className="gap-1.5"
          >
            <Save className="h-3.5 w-3.5" />
            Adicionar Área
          </Button>
        </div>
      </div>
    );
  };

  return (
    <>
      <SectionCard
        id="engraving"
        title="Gravação e Personalização"
        icon={Paintbrush}
        subtitle="Configure locais e técnicas de personalização (BD externo)"
      >
        {w.isLoading ? (
          <div className="space-y-2">
            <Skeleton className="h-14 w-full rounded-lg" />
            <Skeleton className="h-14 w-full rounded-lg" />
          </div>
        ) : (
          <AnimatePresence mode="wait">
            {w.wizardStep === 'list' ? (
              <motion.div
                key="list"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                transition={{ duration: 0.2 }}
                className="space-y-3"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-muted-foreground">
                      {w.displayAreas.length} {w.displayAreas.length === 1 ? 'área' : 'áreas'}{' '}
                      configurada{w.displayAreas.length !== 1 ? 's' : ''}
                    </span>
                    {w.displayAreas.filter((a) => a.is_active).length < w.displayAreas.length && (
                      <Badge variant="outline" className="h-4 text-[10px]">
                        {w.displayAreas.filter((a) => a.is_active).length} ativas
                      </Badge>
                    )}
                    {!isEdit && w.localAreas.length > 0 && (
                      <Badge variant="secondary" className="h-4 gap-0.5 text-[10px]">
                        <Info className="h-2.5 w-2.5" /> Serão salvas ao criar o produto
                      </Badge>
                    )}
                  </div>
                  <Button
                    type="button"
                    size="sm"
                    onClick={w.startWizard}
                    className="h-7 gap-1.5 text-xs"
                  >
                    <Plus className="h-3 w-3" /> Nova Personalização
                  </Button>
                </div>
                {w.displayAreas.length === 0 && (
                  <div className="rounded-xl border border-dashed border-border/50 py-10 text-center">
                    <div className="mx-auto mb-3 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10">
                      <Paintbrush className="h-7 w-7 text-primary" />
                    </div>
                    <p className="mb-1 text-sm font-medium">Nenhuma personalização configurada</p>
                    <p className="mx-auto mb-4 max-w-[300px] text-xs text-muted-foreground">
                      Use o assistente para definir componentes, locais e técnicas de gravação do
                      produto.
                    </p>
                    <Button type="button" size="sm" onClick={w.startWizard} className="gap-1.5">
                      <Zap className="h-3.5 w-3.5" /> Iniciar Configuração
                    </Button>
                  </div>
                )}
                {w.displayAreas.length > 0 && (
                  <div className="space-y-1.5">
                    {w.displayAreas.map((area) => (
                      <EngravingAreaCard
                        key={area.id}
                        area={area}
                        isExpanded={w.expandedId === area.id}
                        onToggleExpand={() =>
                          w.setExpandedId(w.expandedId === area.id ? null : area.id)
                        }
                        onToggleActive={() => w.handleToggleActive(area)}
                        onDelete={() => w.handleDeleteArea(area)}
                      />
                    ))}
                  </div>
                )}
              </motion.div>
            ) : (
              <motion.div
                key={w.wizardStep}
                initial={{ opacity: 0, x: 30 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -30 }}
                transition={{ duration: 0.25 }}
              >
                <button
                  type="button"
                  onClick={w.resetWizard}
                  className="mb-3 flex items-center gap-1 text-xs text-muted-foreground transition-colors hover:text-foreground"
                  aria-label="Voltar"
                >
                  <ChevronLeft className="h-3 w-3" /> Voltar à lista
                </button>
                {renderWizardStepper()}
                {w.wizardStep === 'component' && renderComponentStep()}
                {w.wizardStep === 'location' && renderLocationStep()}
                {w.wizardStep === 'technique' && renderTechniqueStep()}
                {w.wizardStep === 'details' && renderDetailsStep()}
              </motion.div>
            )}
          </AnimatePresence>
        )}
      </SectionCard>

      {/* BUG-05 FIX: AlertDialog for area delete confirmation (no more confirm()) */}
      <AlertDialog
        open={!!w.deleteAreaConfirm}
        onOpenChange={(open) => {
          if (!open) w.cancelDeleteArea();
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remover área de personalização</AlertDialogTitle>
            <AlertDialogDescription>
              Deseja remover a área{' '}
              <strong>&quot;{w.deleteAreaConfirm?.location_name}&quot;</strong> com a técnica{' '}
              <strong>&quot;{w.deleteAreaConfirm?.technique_name}&quot;</strong>?
              {!isEdit && ' (A área só existe localmente e não foi salva no banco ainda.)'}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={w.cancelDeleteArea}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={w.confirmDeleteArea}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Remover
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
