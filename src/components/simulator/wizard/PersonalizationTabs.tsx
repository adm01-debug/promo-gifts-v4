/**
 * PersonalizationTabs - Abas para alternar entre personalizações v2
 */

import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Plus, X } from 'lucide-react';
import { motion } from 'framer-motion';
import type { UseSimulatorWizardReturn } from '@/hooks/simulator/useSimulatorWizard';
import { RemovePersonalizationDialog } from './RemovePersonalizationDialog';
import { formatCurrency } from '@/lib/format';

interface PersonalizationTabsProps {
  wizard: UseSimulatorWizardReturn;
  onAddNew: () => void;
}

export function PersonalizationTabs({ wizard, onAddNew }: PersonalizationTabsProps) {
  const {
    personalizations,
    currentPersonalizationIndex,
    isEditingPersonalization,
    selectedLocation,
    currentStep,
    hasAvailableLocations,
  } = wizard;

  const isCreatingNew =
    !isEditingPersonalization &&
    hasAvailableLocations &&
    (currentStep === 'location' || currentStep === 'specs' || currentStep === 'comparison');

  return (
    <div className="flex items-center gap-2 overflow-x-auto pb-2">
      {personalizations.map((pers, idx) => (
        <motion.div
          key={pers.id}
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="relative"
        >
          <Button
            variant={
              isEditingPersonalization && currentPersonalizationIndex === idx
                ? 'default'
                : 'outline'
            }
            size="sm"
            className="gap-2 pr-8"
            onClick={() => wizard.editPersonalization(idx)}
          >
            <span className="font-bold">{idx + 1}.</span>
            <span className="max-w-[80px] truncate">{pers.location.locationName}</span>
            <Badge variant="secondary" className="h-4 gap-0.5 px-1 text-[9px]">
              {pers.technique.name.split(' ')[0]} • {formatCurrency(pers.pricing.totalPrice)}
            </Badge>
          </Button>
          <RemovePersonalizationDialog
            techniqueName={pers.technique.name}
            locationName={pers.location.locationName}
            onConfirm={() => wizard.removePersonalization(pers.id)}
            trigger={
              <Button
                variant="ghost"
                size="icon"
                aria-label="Fechar"
                className="absolute right-0.5 top-1/2 h-6 w-6 -translate-y-1/2 text-muted-foreground hover:text-destructive"
                onClick={(e) => e.stopPropagation()}
              >
                <X className="h-3 w-3" />
              </Button>
            }
          />
        </motion.div>
      ))}

      {isCreatingNew && (
        <Button variant="default" size="sm" className="gap-1 text-xs font-semibold uppercase">
          {personalizations.length > 0 && <Plus className="h-4 w-4" />}
          {selectedLocation ? selectedLocation.locationName : 'Personalização'}
        </Button>
      )}

      {personalizations.length > 0 && !isCreatingNew && hasAvailableLocations && (
        <Button
          variant="ghost"
          size="sm"
          className="shrink-0 gap-1 text-xs font-semibold uppercase text-muted-foreground hover:text-primary"
          onClick={onAddNew}
        >
          <Plus className="h-4 w-4" />
          Personalização
        </Button>
      )}
    </div>
  );
}
