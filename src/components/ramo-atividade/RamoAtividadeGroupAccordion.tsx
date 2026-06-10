import { useState } from 'react';
import { ChevronDown, Check } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import type { RamoAtividadeGroup, SegmentoComplete } from '@/types/ramo-atividade';
import { SegmentoCheckbox } from './SegmentoCheckbox';

interface RamoAtividadeGroupAccordionProps {
  group: RamoAtividadeGroup;
  segmentos: SegmentoComplete[];
  isRamoSelected: boolean;
  selectedSegmentos: string[];
  onRamoToggle: (ramoSlug: string) => void;
  onSegmentoToggle: (segmentoSlug: string) => void;
  defaultOpen?: boolean;
  showProductCounts?: boolean;
  compact?: boolean;
  productCountsByRamo?: {
    ramoCounts: Map<string, number>;
    segmentoCounts: Map<string, number>;
  };
}

export function RamoAtividadeGroupAccordion({
  group,
  segmentos,
  isRamoSelected,
  selectedSegmentos,
  onRamoToggle,
  onSegmentoToggle,
  defaultOpen = false,
  showProductCounts: _showProductCounts = true,
  compact = false,
  productCountsByRamo,
}: RamoAtividadeGroupAccordionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  const selectedCount = segmentos.filter((s) => selectedSegmentos.includes(s.segmento_slug)).length;
  const hasSelection = selectedCount > 0 || isRamoSelected;
  const allSegmentosSelected =
    segmentos.length > 0 && segmentos.every((s) => selectedSegmentos.includes(s.segmento_slug));

  if (compact) {
    return (
      <div
        className={cn(
          'overflow-hidden rounded-md transition-all duration-200',
          hasSelection ? 'bg-primary/5' : 'bg-muted/20',
        )}
      >
        {/* Header compacto */}
        <div className="flex items-center gap-2 p-2">
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="rounded p-0.5 transition-colors hover:bg-muted"
            aria-label={`${isOpen ? 'Recolher' : 'Expandir'} segmentos de ${group.group_name}`}
          >
            <ChevronDown
              className={cn(
                'h-3 w-3 text-muted-foreground transition-transform duration-200',
                isOpen && 'rotate-180',
              )}
            />
          </button>

          <label className="flex flex-1 cursor-pointer items-center gap-2">
            <Checkbox
              checked={isRamoSelected || allSegmentosSelected}
              onCheckedChange={() => onRamoToggle(group.group_slug)}
              className="data-[state=checked]:bg-primary"
            />

            <span
              className={cn(
                'text-sm',
                hasSelection ? 'font-medium text-primary' : 'text-foreground',
              )}
            >
              {group.group_name}
            </span>
          </label>

          {(() => {
            const ramoCount =
              productCountsByRamo?.ramoCounts.get(group.group_name.toLowerCase()) || 0;
            return (
              <span className="flex items-center gap-1 text-[10px] text-muted-foreground">
                {selectedCount > 0 && `${selectedCount}/`}
                {group.total_segmentos}
                {ramoCount > 0 && <span className="text-primary/70">· {ramoCount}</span>}
              </span>
            );
          })()}
        </div>

        {/* Lista compacta */}
        {isOpen && segmentos.length > 0 && (
          <div className="ml-6 space-y-0.5 border-l-2 border-muted px-2 pb-2">
            {segmentos.map((segmento) => (
              <SegmentoCheckbox
                key={segmento.segmento_id}
                segmento={segmento}
                isSelected={selectedSegmentos.includes(segmento.segmento_slug)}
                onToggle={onSegmentoToggle}
                ramoHexCode={group.group_hex_code}
                compact
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-xl transition-all duration-300',
        hasSelection
          ? 'bg-gradient-to-br from-primary/10 via-primary/5 to-transparent shadow-sm ring-1 ring-primary/25'
          : 'bg-muted/30 hover:bg-muted/40',
      )}
    >
      {/* Header do grupo */}
      <div className="flex items-center gap-3 p-3">
        {/* Botão de expandir */}
        <button
          type="button"
          onClick={() => setIsOpen(!isOpen)}
          className={cn(
            'rounded-lg p-1.5 transition-all duration-200',
            isOpen
              ? 'bg-primary/15 text-primary'
              : 'bg-muted/50 text-muted-foreground hover:bg-muted',
          )}
          aria-label={`${isOpen ? 'Recolher' : 'Expandir'} segmentos de ${group.group_name}`}
        >
          <ChevronDown
            className={cn('h-4 w-4 transition-transform duration-300', isOpen && 'rotate-180')}
          />
        </button>

        {/* Checkbox do grupo */}
        <div className="relative">
          <Checkbox
            checked={isRamoSelected || allSegmentosSelected}
            onCheckedChange={() => onRamoToggle(group.group_slug)}
            className={cn(
              'h-5 w-5 transition-all duration-200',
              'data-[state=checked]:border-primary data-[state=checked]:bg-primary',
            )}
          />
          {/* Indicador de seleção parcial */}
          {selectedCount > 0 && !isRamoSelected && !allSegmentosSelected && (
            <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-primary" />
          )}
        </div>

        {/* Info do grupo */}
        <div className="min-w-0 flex-1">
          <span
            className={cn(
              'text-sm font-medium transition-colors duration-200',
              hasSelection ? 'text-primary' : 'text-foreground',
            )}
          >
            {group.group_name}
          </span>

          {/* Descrição se houver */}
          {group.group_description && !isOpen && (
            <p className="truncate text-xs text-muted-foreground">{group.group_description}</p>
          )}
        </div>

        {/* Contadores */}
        <div className="flex flex-shrink-0 items-center gap-2">
          {/* Badge de selecionados */}
          {selectedCount > 0 && (
            <span className="min-w-[22px] rounded-full bg-primary px-2 py-0.5 text-center text-[11px] font-bold text-primary-foreground shadow-sm">
              {selectedCount}
            </span>
          )}

          {/* Total de segmentos + product count */}
          <div
            className={cn(
              'flex items-center gap-1 rounded-full px-2 py-0.5 text-xs transition-colors',
              hasSelection ? 'bg-primary/15 text-primary' : 'bg-muted text-muted-foreground',
            )}
          >
            <span className="font-medium">{group.total_segmentos}</span>
            <span className="text-[10px]">seg.</span>
            {(() => {
              const ramoCount =
                productCountsByRamo?.ramoCounts.get(group.group_name.toLowerCase()) || 0;
              return ramoCount > 0 ? (
                <span className="ml-0.5 text-[10px] text-primary/70">· {ramoCount}</span>
              ) : null;
            })()}
          </div>
        </div>
      </div>

      {/* Lista de segmentos - Animada */}
      <div
        className={cn(
          'overflow-hidden transition-all duration-300',
          isOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0',
        )}
      >
        {segmentos.length > 0 && (
          <div className="space-y-1 px-3 pb-3">
            <div className="ml-10 space-y-0.5 border-t border-border/30 pt-2">
              {/* Selecionar todos */}
              {segmentos.length > 2 && (
                <button
                  type="button"
                  onClick={() => {
                    if (allSegmentosSelected) {
                      segmentos.forEach((s) => onSegmentoToggle(s.segmento_slug));
                    } else {
                      segmentos
                        .filter((s) => !selectedSegmentos.includes(s.segmento_slug))
                        .forEach((s) => onSegmentoToggle(s.segmento_slug));
                    }
                  }}
                  className={cn(
                    'mb-1 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-xs transition-colors',
                    allSegmentosSelected
                      ? 'bg-primary/10 text-primary'
                      : 'text-muted-foreground hover:bg-muted/50',
                  )}
                >
                  <Check
                    className={cn('h-3 w-3', allSegmentosSelected ? 'opacity-100' : 'opacity-30')}
                  />
                  <span>{allSegmentosSelected ? 'Desmarcar todos' : 'Selecionar todos'}</span>
                </button>
              )}

              {/* Lista de segmentos */}
              {segmentos.map((segmento) => (
                <SegmentoCheckbox
                  key={segmento.segmento_id}
                  segmento={segmento}
                  isSelected={selectedSegmentos.includes(segmento.segmento_slug)}
                  onToggle={onSegmentoToggle}
                  ramoHexCode={group.group_hex_code}
                />
              ))}
            </div>
          </div>
        )}

        {/* Mensagem se não houver segmentos */}
        {segmentos.length === 0 && (
          <div className="px-3 pb-3">
            <div className="ml-10 border-t border-border/30 pt-3">
              <p className="py-2 text-center text-xs italic text-muted-foreground">
                Nenhum segmento neste ramo
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
