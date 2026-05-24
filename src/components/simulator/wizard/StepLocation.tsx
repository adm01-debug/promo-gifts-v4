/**
 * StepLocation - Passo 2: Seleção do Local de Gravação
 *
 * Design: Cards elegantes com visual hierárquico premium
 */

import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  MapPin,
  Ruler,
  Palette,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Layers,
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { UseSimulatorWizardReturn } from '@/hooks/simulator/useSimulatorWizard';

interface StepLocationProps {
  wizard: UseSimulatorWizardReturn;
}

export function StepLocation({ wizard }: StepLocationProps) {
  // Usa locais filtrados (exclui locais já usados em personalizações)
  const { availableLocationsFiltered, selectedLocation, locationsLoading, personalizations } =
    wizard;

  return (
    <div className="mx-auto max-w-5xl space-y-8">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 p-3">
          <MapPin className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h3 className="font-display text-xl font-bold">Onde personalizar?</h3>
          <p className="text-muted-foreground">Escolha a área de aplicação</p>
        </div>
      </div>

      {/* Locations Grid */}
      {locationsLoading ? (
        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : availableLocationsFiltered.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center py-20 text-center"
        >
          <div className="mb-5 rounded-full bg-primary/10 p-5">
            <CheckCircle2 className="h-10 w-10 text-primary" />
          </div>
          <p className="mb-2 text-xl font-bold">
            {personalizations.length > 0
              ? 'Todos os locais já foram personalizados!'
              : 'Nenhuma área cadastrada'}
          </p>
          <p className="max-w-md text-muted-foreground">
            {personalizations.length > 0
              ? `Você já configurou ${personalizations.length} personalização(ões). Finalize a simulação ou remova uma gravação existente.`
              : 'Este produto ainda não possui áreas de personalização configuradas. Solicite o cadastro ao time de operações ou escolha outro produto do catálogo.'}
          </p>
          {personalizations.length > 0 ? (
            <Button className="mt-6 gap-2" onClick={() => wizard.setStep('comparison')}>
              <CheckCircle2 className="h-4 w-4" />
              Ver Resultado Final
            </Button>
          ) : (
            <div className="mt-6 flex flex-col gap-3 sm:flex-row">
              <Button variant="outline" className="gap-2" onClick={wizard.previousStep}>
                <ChevronLeft className="h-4 w-4" />
                Escolher outro produto
              </Button>
              <Button
                variant="secondary"
                className="gap-2"
                onClick={() => {
                  const msg = encodeURIComponent(
                    `Olá! Preciso do cadastro de áreas de personalização para o produto: ${wizard.selectedProduct?.name} (${wizard.selectedProduct?.sku})`,
                  );
                  window.open(`https://wa.me/?text=${msg}`, '_blank');
                }}
              >
                📩 Solicitar Cadastro
              </Button>
            </div>
          )}
        </motion.div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {availableLocationsFiltered.map((location, idx) => {
              const isSelected = selectedLocation?.id === location.id;

              return (
                <motion.button
                  key={location.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -12 }}
                  transition={{ delay: idx * 0.04 }}
                  onClick={() => wizard.selectLocation(location)}
                  className={cn(
                    'group w-full rounded-xl p-4 text-left transition-all duration-200',
                    isSelected
                      ? 'bg-primary/10 shadow-lg shadow-primary/10 ring-2 ring-primary'
                      : 'border bg-card hover:border-primary/30 hover:shadow-md',
                  )}
                >
                  {/* Top: Name + Check */}
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <h4 className="truncate text-base font-bold">{location.componentName}</h4>
                    {isSelected && (
                      <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }}>
                        <CheckCircle2 className="h-4.5 w-4.5 shrink-0 text-primary" />
                      </motion.div>
                    )}
                  </div>

                  {/* Location badge + Dimensions inline */}
                  <div className="mb-3 flex items-center gap-2 text-xs text-muted-foreground">
                    <Badge variant="secondary" className="h-5 text-[10px] font-normal">
                      {location.locationName}
                    </Badge>
                    <span className="flex items-center gap-1">
                      <Ruler className="h-3 w-3" />
                      {location.maxWidthCm || '–'}×{location.maxHeightCm || '–'}cm
                    </span>
                  </div>

                  {/* Techniques as compact pills with dimensions */}
                  <div className="flex flex-wrap gap-1">
                    {location.availableTechniques.slice(0, 3).map((tech) => {
                      const techMaxW = tech.efetivaLarguraMax || tech.areaMaxWidth;
                      const techMaxH = tech.efetivaAlturaMax || tech.areaMaxHeight;
                      const hasDims = techMaxW && techMaxH;
                      return (
                        <span
                          key={tech.id}
                          className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground"
                        >
                          <Palette className="h-2.5 w-2.5" />
                          {tech.techniqueName}
                          {hasDims && (
                            <span className="ml-0.5 text-muted-foreground/70">
                              ({techMaxW}×{techMaxH}cm)
                            </span>
                          )}
                        </span>
                      );
                    })}
                    {location.availableTechniques.length > 3 && (
                      <span className="inline-flex items-center rounded-full bg-muted/60 px-2 py-0.5 text-[10px] text-muted-foreground">
                        +{location.availableTechniques.length - 3}
                      </span>
                    )}
                  </div>

                  {location.isFromGroup && (
                    <Badge variant="secondary" className="mt-2 gap-1 text-[9px]">
                      <Layers className="h-2.5 w-2.5" />
                      Grupo
                    </Badge>
                  )}
                </motion.button>
              );
            })}
          </AnimatePresence>
        </div>
      )}

      {/* Navigation */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.3 }}
        className="flex justify-between pt-6"
      >
        <Button variant="ghost" size="lg" onClick={wizard.previousStep} className="gap-2">
          <ChevronLeft className="h-5 w-5" />
          Voltar
        </Button>
        <Button
          disabled={!wizard.canProceed}
          onClick={wizard.nextStep}
          size="lg"
          className="min-w-[180px] gap-2 rounded-xl shadow-lg shadow-primary/20"
        >
          Configurar Especificações
          <ChevronRight className="h-5 w-5" />
        </Button>
      </motion.div>
    </div>
  );
}
