/**
 * TechniqueCard - Card individual de técnica com:
 * - Badge de recomendação IA
 * - Miniatura de exemplo
 * - Configuração inline
 *
 * Refatorado: helpers/preview/style extraídos para TechniqueCardHelpers.tsx
 */
import { m as motion, AnimatePresence } from 'framer-motion';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { HoverCard, HoverCardContent, HoverCardTrigger } from '@/components/ui/hover-card';
import { Clock, DollarSign, Palette, Ruler, Info, Sparkles, Star, TrendingUp } from 'lucide-react';
import { cn } from '@/lib/utils';
import {
  formatCurrency,
  type ColorOption,
  type SizeOption,
  type TechniqueWithRecommendation,
} from '@/hooks/simulation';
import type { TechniqueSettings } from '@/types/simulation';
import {
  getTechniqueStyle,
  getTechniqueThumbnail,
  getSlaInfo,
  TechniquePreview,
} from './TechniqueCardHelpers';

interface TechniqueCardProps {
  technique: TechniqueWithRecommendation;
  isSelected: boolean;
  settings: TechniqueSettings;
  showColors: boolean;
  showSize: boolean;
  colorOptions: ColorOption[];
  sizeOptions: SizeOption[];
  quantity: number;
  onToggle: () => void;
  onUpdateSetting: (field: keyof TechniqueSettings, value: number) => void;
  viewMode: 'expanded' | 'compact';
}

export function TechniqueCard({
  technique,
  isSelected,
  settings,
  showColors,
  showSize,
  colorOptions,
  sizeOptions,
  quantity,
  onToggle,
  onUpdateSetting,
  viewMode,
}: TechniqueCardProps) {
  const style = getTechniqueStyle(technique.code ?? '');
  const thumbnail = getTechniqueThumbnail(technique.code ?? '');
  const { recommendation } = technique;
  const sla = getSlaInfo(technique.estimated_days);
  const estimatedCost = technique.unit_cost * quantity + technique.setup_cost;
  const needsConfig = showColors || showSize;
  const showInlineConfig = isSelected && needsConfig;

  // COMPACT VIEW
  if (viewMode === 'compact') {
    return (
      <motion.div
        layout
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, x: -20 }}
        transition={{ duration: 0.15 }}
      >
        <div
          onClick={onToggle}
          className={cn(
            'flex cursor-pointer items-center gap-3 rounded-xl border-2 p-3 transition-all',
            isSelected
              ? 'border-primary bg-primary/5 shadow-md ring-2 ring-primary/20'
              : 'border-border bg-card hover:border-primary/50 hover:shadow-sm',
          )}
        >
          <HoverCard openDelay={200}>
            <HoverCardTrigger asChild>
              <div className="relative flex-shrink-0">
                {thumbnail ? (
                  <div className="h-10 w-10 overflow-hidden rounded-lg ring-2 ring-border">
                    <img
                      src={thumbnail}
                      alt={technique.name}
                      className="h-full w-full object-cover"
                      loading="lazy"
                    />
                  </div>
                ) : (
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-lg text-lg',
                      style.color,
                      'text-primary-foreground',
                    )}
                  >
                    {style.icon}
                  </div>
                )}
                {isSelected && (
                  <motion.div
                    className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-primary"
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                  >
                    <span className="text-[8px] font-bold text-primary-foreground">✓</span>
                  </motion.div>
                )}
              </div>
            </HoverCardTrigger>
            <HoverCardContent side="right">
              <TechniquePreview technique={technique} thumbnail={thumbnail} />
            </HoverCardContent>
          </HoverCard>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-medium">{technique.name}</span>
              {recommendation.isRecommended && (
                <Badge className="h-5 gap-0.5 bg-gradient-to-r from-warning to-brand-primary px-1.5 text-[10px] text-primary-foreground">
                  <Sparkles className="h-2.5 w-2.5" />
                  IA
                </Badge>
              )}
              <Badge
                variant="outline"
                className="hidden h-4 px-1 font-mono text-[10px] sm:inline-flex"
              >
                {technique.code}
              </Badge>
            </div>
            {recommendation.isRecommended && (
              <p className="truncate text-[10px] text-warning">
                {recommendation.recommendationReason}
              </p>
            )}
          </div>

          <div className="flex flex-shrink-0 items-center gap-3 text-xs text-muted-foreground">
            <span className={cn('flex items-center gap-1', sla.textColor)}>
              <Clock className="h-3 w-3" />
              {technique.estimated_days}d
            </span>
            <span className="hidden font-mono font-medium sm:inline">
              {formatCurrency(estimatedCost)}
            </span>
          </div>
        </div>

        <AnimatePresence>
          {showInlineConfig && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="ml-6 mt-1 rounded-r-lg border-l-2 border-primary/30 bg-muted/30 p-3">
                <InlineConfigForm
                  technique={technique}
                  settings={settings}
                  showColors={showColors}
                  showSize={showSize}
                  colorOptions={colorOptions}
                  sizeOptions={sizeOptions}
                  onUpdateSetting={onUpdateSetting}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    );
  }

  // EXPANDED VIEW
  return (
    <motion.div
      layout
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.2 }}
      whileHover={{ scale: 1.005 }}
    >
      <div
        className={cn(
          'relative overflow-hidden rounded-xl border-2 transition-all duration-200',
          isSelected
            ? 'border-primary bg-primary/5 shadow-lg ring-2 ring-primary/20'
            : 'border-border bg-card hover:border-primary/50 hover:shadow-md',
        )}
      >
        {recommendation.isRecommended && !isSelected && (
          <div className="absolute right-0 top-0 z-10">
            <div className="flex items-center gap-1 rounded-bl-lg bg-gradient-to-l from-warning to-brand-primary px-2 py-0.5 text-[10px] font-medium text-primary-foreground">
              <Sparkles className="h-3 w-3" />
              Recomendada
            </div>
          </div>
        )}

        <div
          className="cursor-pointer p-4"
          role="button"
          tabIndex={0}
          onClick={onToggle}
          onKeyDown={(e) => {
            if (e.key === 'Enter' || e.key === ' ') {
              e.preventDefault();
              onToggle();
            }
          }}
          aria-label={`Selecionar técnica ${technique.name}`}
        >
          <div className="flex items-start gap-4">
            <HoverCard openDelay={200}>
              <HoverCardTrigger asChild>
                <motion.div
                  className="relative flex-shrink-0"
                  animate={
                    isSelected
                      ? {
                          boxShadow: [
                            '0 0 0 0 rgba(99,102,241,0)',
                            '0 0 0 6px rgba(99,102,241,0.1)',
                            '0 0 0 0 rgba(99,102,241,0)',
                          ],
                        }
                      : {}
                  }
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  {thumbnail ? (
                    <div className="h-14 w-14 overflow-hidden rounded-xl ring-2 ring-border">
                      <img
                        src={thumbnail}
                        alt={technique.name}
                        className="h-full w-full object-cover"
                        loading="lazy"
                      />
                      <div
                        className={cn(
                          'absolute bottom-0 right-0 flex h-6 w-6 items-center justify-center rounded-br-lg rounded-tl-lg text-sm',
                          style.color,
                          'text-primary-foreground',
                        )}
                      >
                        {style.icon}
                      </div>
                    </div>
                  ) : (
                    <div
                      className={cn(
                        'flex h-14 w-14 items-center justify-center rounded-xl text-2xl',
                        style.color,
                        'text-primary-foreground',
                      )}
                    >
                      {style.icon}
                    </div>
                  )}
                  {isSelected && (
                    <motion.div
                      className="absolute -right-1.5 -top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-primary shadow-md"
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                    >
                      <span className="text-xs font-bold text-primary-foreground">✓</span>
                    </motion.div>
                  )}
                </motion.div>
              </HoverCardTrigger>
              <HoverCardContent side="right">
                <TechniquePreview technique={technique} thumbnail={thumbnail} expanded />
              </HoverCardContent>
            </HoverCard>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h4 className="text-base font-semibold">{technique.name}</h4>
                <Badge variant="outline" className="font-mono text-xs">
                  {technique.code}
                </Badge>
                {recommendation.isRecommended && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Badge className="gap-1 bg-gradient-to-r from-warning to-brand-primary text-xs text-primary-foreground">
                          <Sparkles className="h-3 w-3" />
                          Recomendada IA
                        </Badge>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{recommendation.recommendationReason}</p>
                        {recommendation.matchedKeywords.length > 0 && (
                          <p className="mt-1 text-xs text-muted-foreground">
                            Match: {recommendation.matchedKeywords.join(', ')}
                          </p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
                {isSelected && (
                  <Badge className="bg-primary/20 text-xs text-primary">✓ Selecionada</Badge>
                )}
              </div>
              <p className="mt-1 line-clamp-1 text-sm text-muted-foreground">
                {technique.description || 'Técnica de personalização'}
              </p>
              <div className="mt-2 flex items-center gap-4 text-sm">
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1">
                      <Clock className={cn('h-3.5 w-3.5', sla.textColor)} />
                      <span className={cn('font-medium', sla.textColor)}>
                        {technique.estimated_days}d
                      </span>
                      <Badge variant="outline" className={cn('h-4 text-[10px]', sla.textColor)}>
                        {sla.label}
                      </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Prazo: {technique.estimated_days} dias úteis</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger className="flex items-center gap-1 text-muted-foreground">
                      <DollarSign className="h-3.5 w-3.5" />
                      <span className="font-mono">{formatCurrency(technique.unit_cost)}/un</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Setup: {formatCurrency(technique.setup_cost)}</p>
                      <p>Mín: {technique.min_quantity} un</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
                {recommendation.popularityScore >= 70 && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger className="flex items-center gap-1 text-warning">
                        <TrendingUp className="h-3.5 w-3.5" />
                        <span className="text-xs">Popular</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Alta demanda no mercado</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}
              </div>
            </div>

            <div className="flex flex-shrink-0 flex-col items-end gap-1">
              <p className="text-xs text-muted-foreground">Estimativa</p>
              <p className="text-lg font-bold">{formatCurrency(estimatedCost)}</p>
              {recommendation.isRecommended && (
                <div className="flex items-center gap-1 text-warning">
                  <Star className="h-3 w-3 fill-current" />
                  <span className="text-[10px] font-medium">
                    {recommendation.recommendationScore}% match
                  </span>
                </div>
              )}
            </div>
          </div>
        </div>

        <AnimatePresence>
          {showInlineConfig && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="border-t border-border/50 bg-muted/30 p-4 pt-0">
                <InlineConfigForm
                  technique={technique}
                  settings={settings}
                  showColors={showColors}
                  showSize={showSize}
                  colorOptions={colorOptions}
                  sizeOptions={sizeOptions}
                  onUpdateSetting={onUpdateSetting}
                />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

// Formulário de configuração inline
function InlineConfigForm({
  technique: _technique,
  settings,
  showColors,
  showSize,
  colorOptions,
  sizeOptions,
  onUpdateSetting,
}: {
  technique: TechniqueWithRecommendation;
  settings: TechniqueSettings;
  showColors: boolean;
  showSize: boolean;
  colorOptions: ColorOption[];
  sizeOptions: SizeOption[];
  onUpdateSetting: (field: keyof TechniqueSettings, value: number) => void;
}) {
  return (
    <div className="mt-2 grid grid-cols-2 gap-3 md:grid-cols-4">
      {showColors && (
        <div className="space-y-1.5">
          <Label className="flex items-center gap-1 text-xs text-muted-foreground">
            <Palette className="h-3 w-3" />
            Cores
          </Label>
          {colorOptions.length > 0 ? (
            <Select
              value={settings.colors.toString()}
              onValueChange={(val) => onUpdateSetting('colors', parseInt(val, 10))}
            >
              <SelectTrigger className="h-9" onClick={(e) => e.stopPropagation()}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {colorOptions.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value.toString()}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <Input
              type="number"
              min={1}
              max={12}
              value={settings.colors}
              onChange={(e) => onUpdateSetting('colors', parseInt(e.target.value, 10) || 1)}
              className="h-9"
              onClick={(e) => e.stopPropagation()}
            />
          )}
        </div>
      )}
      {showSize && sizeOptions.length > 0 && (
        <div className="col-span-2 space-y-1.5">
          <Label className="flex items-center gap-1 text-xs text-muted-foreground">
            <Ruler className="h-3 w-3" />
            Tamanho
          </Label>
          <Select
            value={`${settings.width}x${settings.height}`}
            onValueChange={(val) => {
              const [w, h] = val.split('x').map(Number);
              onUpdateSetting('width', w);
              setTimeout(() => onUpdateSetting('height', h), 0);
            }}
          >
            <SelectTrigger className="h-9" onClick={(e) => e.stopPropagation()}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {sizeOptions.map((opt) => (
                <SelectItem key={opt.value} value={opt.value}>
                  {opt.label} ({opt.areaCm2} cm²)
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
      {showSize && sizeOptions.length === 0 && (
        <>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Largura (cm)</Label>
            <Input
              type="number"
              min={1}
              value={settings.width}
              onChange={(e) => onUpdateSetting('width', parseInt(e.target.value, 10) || 1)}
              className="h-9"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs text-muted-foreground">Altura (cm)</Label>
            <Input
              type="number"
              min={1}
              value={settings.height}
              onChange={(e) => onUpdateSetting('height', parseInt(e.target.value, 10) || 1)}
              className="h-9"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        </>
      )}
      <div className="space-y-1.5">
        <Label className="flex items-center gap-1 text-xs text-muted-foreground">
          Posições
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger>
                <Info className="h-3 w-3" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Locais de gravação</p>
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </Label>
        <Input
          type="number"
          min={1}
          max={10}
          value={settings.positions}
          onChange={(e) => onUpdateSetting('positions', parseInt(e.target.value, 10) || 1)}
          className="h-9"
          onClick={(e) => e.stopPropagation()}
        />
      </div>
      {showSize && sizeOptions.length === 0 && (
        <div className="col-span-full">
          <p className="text-xs text-muted-foreground">
            Área:{' '}
            <span className="font-mono font-medium">{settings.width * settings.height} cm²</span>
          </p>
        </div>
      )}
    </div>
  );
}
