/**
 * PromptGenerator — Gerador de prompts publicitários com IA
 * Cria prompts otimizados baseados no contexto do produto, cliente e objetivo
 * Inclui seleção de local, técnica e dimensões reais do banco de dados
 */

import { useState, useCallback, useMemo, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Wand2,
  Loader2,
  Sparkles,
  Target,
  Users,
  CalendarDays,
  RefreshCw,
  Check,
  Lightbulb,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';
import type { ScenePrompt } from './PromptBank';
import { OBJECTIVES, TONES, AUDIENCES, SEASONS, getMoodColor } from './promptGeneratorConstants';
import type { PrintAreaWithTechniques } from '@/types/gravacao';
import { PromptCustomizationPanel } from './PromptCustomizationPanel';

import { logger } from '@/lib/logger';
interface GeneratedPrompt {
  title: string;
  prompt: string;
  category: string;
  mood: string;
  bestFor: string;
}

interface PromptGeneratorProps {
  productName?: string;
  productColor?: string;
  clientName?: string;
  clientSegment?: string | null;
  brandColorName?: string | null;
  /** Áreas de gravação do produto selecionado (do usePrintAreas) */
  printAreas?: PrintAreaWithTechniques[];
  onSelectPrompt: (prompt: ScenePrompt) => void;
  selectedPrompt: ScenePrompt | null;
  /** Valor inicial do local selecionado (sync com MagicUp) */
  initialLocationId?: string | null;
  /** Valor inicial da técnica selecionada (sync com MagicUp) */
  initialTechniqueId?: string | null;
  /** Callback para informar local/técnica selecionados ao MagicUp */
  onCustomizationChange?: (info: {
    locationId: string | null;
    locationName: string | null;
    techniqueId: string | null;
    techniqueName: string | null;
    maxWidth: number;
    maxHeight: number;
    unit: string;
  }) => void;
}

// Constants imported from ./promptGeneratorConstants

export function PromptGenerator({
  productName,
  productColor,
  clientName,
  clientSegment,
  brandColorName,
  printAreas,
  onSelectPrompt,
  selectedPrompt,
  initialLocationId,
  initialTechniqueId,
  onCustomizationChange,
}: PromptGeneratorProps) {
  // Campaign settings
  const [objective, setObjective] = useState('');
  const [tone, setTone] = useState('');
  const [audience, setAudience] = useState('');
  const [season, setSeason] = useState('none');

  // Customization from real DB — sync from parent when props change
  const [selectedAreaId, setSelectedAreaId] = useState<string | null>(initialLocationId || null);
  const [selectedTechId, setSelectedTechId] = useState<string | null>(initialTechniqueId || null);

  // Keep in sync when parent changes (e.g. user selects in Step 1 bank mode, then switches to AI tab)
  useEffect(() => {
    setSelectedAreaId(initialLocationId || null);
  }, [initialLocationId]);

  useEffect(() => {
    setSelectedTechId(initialTechniqueId || null);
  }, [initialTechniqueId]);

  // Generation
  const [generating, setGenerating] = useState(false);
  const [generatedPrompts, setGeneratedPrompts] = useState<GeneratedPrompt[]>([]);
  const [hasGenerated, setHasGenerated] = useState(false);

  // ─── Derived from printAreas ───────────────────────────────────

  const selectedArea = useMemo(() => {
    if (!selectedAreaId || !printAreas) return null;
    return printAreas.find((a) => a.area_id === selectedAreaId) || null;
  }, [selectedAreaId, printAreas]);

  const availableTechniques = useMemo(() => {
    if (!selectedArea) return [];
    return selectedArea.techniques ?? [];
  }, [selectedArea]);

  const selectedTech = useMemo(() => {
    if (!selectedTechId) return null;
    return availableTechniques.find((t) => t.id === selectedTechId) || null;
  }, [selectedTechId, availableTechniques]);

  const locationLabel = useMemo(() => {
    if (!selectedArea) return null;
    return [selectedArea.component_name, selectedArea.location_name].filter(Boolean).join(' — ');
  }, [selectedArea]);

  // ─── Sync selections back to MagicUp ───────────────────────────

  const handleAreaChange = (areaId: string) => {
    const isNone = areaId === 'none';
    setSelectedAreaId(isNone ? null : areaId);
    setSelectedTechId(null);
    const area = isNone ? null : printAreas?.find((a) => a.area_id === areaId);
    onCustomizationChange?.({
      locationId: isNone ? null : areaId,
      locationName: area
        ? [area.component_name, area.location_name].filter(Boolean).join(' — ')
        : null,
      techniqueId: null,
      techniqueName: null,
      maxWidth: area?.max_width ?? 0,
      maxHeight: area?.max_height ?? 0,
      unit: area?.unit || 'cm',
    });
  };

  const handleTechChange = (techId: string) => {
    const isNone = techId === 'none';
    setSelectedTechId(isNone ? null : techId);
    const tech = isNone ? null : availableTechniques.find((t) => t.id === techId);
    onCustomizationChange?.({
      locationId: selectedAreaId,
      locationName: locationLabel,
      techniqueId: isNone ? null : techId,
      techniqueName: tech?.nome || null,
      maxWidth: selectedArea?.max_width ?? 0,
      maxHeight: selectedArea?.max_height ?? 0,
      unit: selectedArea?.unit || 'cm',
    });
  };

  // ─── Generate ──────────────────────────────────────────────────

  const handleGenerate = useCallback(async () => {
    if (!productName) {
      toast.error('Selecione um produto primeiro');
      return;
    }

    setGenerating(true);
    try {
      const { data, error } = await supabase.functions.invoke('generate-ad-prompt', {
        body: {
          productName,
          productColor,
          productCategory: null, // Categoria não disponível nas props atuais — requer prop productCategory
          techniqueName: selectedTech?.nome || null,
          locationName: locationLabel || null,
          maxWidth: selectedArea?.max_width || null,
          maxHeight: selectedArea?.max_height || null,
          dimensionUnit: selectedArea?.unit || 'cm',
          isCurved: selectedArea?.is_curved ?? false,
          clientName,
          clientSegment,
          brandColorName,
          objective,
          tone,
          targetAudience: audience,
          season: season === 'none' ? '' : season,
          numberOfPrompts: 4,
        },
      });

      if (error) throw error;

      if (data?.prompts && Array.isArray(data.prompts)) {
        setGeneratedPrompts(data.prompts);
        setHasGenerated(true);
        toast.success(`✨ ${data.prompts.length} prompts gerados pela IA!`);
      } else {
        throw new Error(data?.error || 'Nenhum prompt retornado');
      }
    } catch (err: unknown) {
      logger.error('Prompt generation error:', err);
      toast.error('Erro ao gerar prompts', { description: sanitizeError(err) });
    } finally {
      setGenerating(false);
    }
  }, [
    productName,
    productColor,
    selectedTech,
    locationLabel,
    selectedArea,
    clientName,
    clientSegment,
    brandColorName,
    objective,
    tone,
    audience,
    season,
  ]);

  const handleSelectGenerated = (gp: GeneratedPrompt) => {
    const scenePrompt: ScenePrompt = {
      id: `ai-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: gp.title,
      prompt: gp.prompt,
      category: gp.category,
    };
    onSelectPrompt(scenePrompt);
  };

  // getMoodColor imported from ./promptGeneratorConstants

  const safePrintAreas = printAreas ?? [];
  const hasPrintAreas = safePrintAreas.length > 0;

  return (
    <div className="space-y-4">
      {/* ─── Customization: Location, Technique & Dimensions ──── */}
      {hasPrintAreas && (
        <PromptCustomizationPanel
          printAreas={safePrintAreas}
          selectedAreaId={selectedAreaId}
          selectedTechId={selectedTechId}
          onAreaChange={handleAreaChange}
          onTechChange={handleTechChange}
        />
      )}

      {/* ─── Campaign Configuration ───────────────────────────── */}
      <div className="grid grid-cols-2 gap-2.5">
        <div className="space-y-1">
          <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Target className="h-3 w-3" /> Objetivo
          </Label>
          <Select value={objective} onValueChange={setObjective}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Escolha..." />
            </SelectTrigger>
            <SelectContent>
              {OBJECTIVES.map((o) => (
                <SelectItem key={o.value} value={o.value} className="text-xs">
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3" /> Tom
          </Label>
          <Select value={tone} onValueChange={setTone}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Escolha..." />
            </SelectTrigger>
            <SelectContent>
              {TONES.map((t) => (
                <SelectItem key={t.value} value={t.value} className="text-xs">
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Users className="h-3 w-3" /> Público-alvo
          </Label>
          <Select value={audience} onValueChange={setAudience}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Escolha..." />
            </SelectTrigger>
            <SelectContent>
              {AUDIENCES.map((a) => (
                <SelectItem key={a.value} value={a.value} className="text-xs">
                  {a.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="space-y-1">
          <Label className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <CalendarDays className="h-3 w-3" /> Temporada
          </Label>
          <Select value={season} onValueChange={setSeason}>
            <SelectTrigger className="h-8 text-xs">
              <SelectValue placeholder="Opcional..." />
            </SelectTrigger>
            <SelectContent>
              {SEASONS.map((s) => (
                <SelectItem key={s.value} value={s.value} className="text-xs">
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Context chips */}
      {(clientSegment || productColor) && (
        <div className="flex flex-wrap gap-1.5">
          {productName && (
            <Badge variant="secondary" className="text-[9px]">
              📦 {productName}
            </Badge>
          )}
          {productColor && (
            <Badge variant="secondary" className="text-[9px]">
              🎨 {productColor}
            </Badge>
          )}
          {clientSegment && (
            <Badge variant="secondary" className="text-[9px]">
              🏢 {clientSegment}
            </Badge>
          )}
          {brandColorName && (
            <Badge variant="secondary" className="text-[9px]">
              🖌️ {brandColorName}
            </Badge>
          )}
        </div>
      )}

      {/* Generate button */}
      <Button
        onClick={handleGenerate}
        disabled={generating || !productName}
        className="w-full gap-2"
        variant={hasGenerated ? 'outline' : 'default'}
        size="sm"
      >
        {generating ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" />
            Criando prompts com IA...
          </>
        ) : hasGenerated ? (
          <>
            <RefreshCw className="h-4 w-4" />
            Gerar novos prompts
          </>
        ) : (
          <>
            <Wand2 className="h-4 w-4" />
            Gerar Prompts com IA
          </>
        )}
      </Button>

      {/* Results */}
      {generatedPrompts.length > 0 && (
        <div className="space-y-2">
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Sparkles className="h-3 w-3 text-primary" />
            {generatedPrompts.length} cenários criados pela IA — clique para usar
          </p>
          <div className="grid max-h-[350px] grid-cols-1 gap-2 overflow-y-auto pr-1">
            {generatedPrompts.map((gp, idx) => {
              const isSelected = selectedPrompt?.prompt === gp.prompt;
              return (
                <Card
                  key={`${gp.title}-${idx}`}
                  className={cn(
                    'group cursor-pointer transition-all hover:shadow-md',
                    isSelected
                      ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                      : 'hover:border-primary/40',
                  )}
                  onClick={() => handleSelectGenerated(gp)}
                >
                  <CardContent className="p-3">
                    <div className="mb-1.5 flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2">
                        {isSelected && <Check className="h-4 w-4 shrink-0 text-primary" />}
                        <p
                          className={cn(
                            'truncate text-sm font-semibold',
                            isSelected && 'text-primary',
                          )}
                        >
                          {gp.title}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-1">
                        <Badge
                          variant="outline"
                          className={cn('border px-1.5 py-0 text-[8px]', getMoodColor(gp.mood))}
                        >
                          {gp.mood}
                        </Badge>
                      </div>
                    </div>
                    <p className="mb-2 line-clamp-2 text-[11px] text-muted-foreground">
                      {gp.prompt}
                    </p>
                    {gp.bestFor && (
                      <p className="flex items-center gap-1 text-[10px] text-primary/70">
                        <Lightbulb className="h-3 w-3 shrink-0" />
                        {gp.bestFor}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}

      {/* Empty state */}
      {!hasGenerated && !generating && (
        <div className="py-4 text-center text-muted-foreground">
          <Wand2 className="mx-auto mb-2 h-8 w-8 opacity-30" />
          <p className="text-xs">
            {hasPrintAreas ? (
              <>
                Selecione o <strong>local e técnica</strong> de personalização, configure o objetivo
                e clique em <strong>"Gerar Prompts"</strong>
              </>
            ) : (
              <>
                Configure as opções acima e clique em <strong>"Gerar Prompts"</strong> para que a IA
                crie cenários otimizados
              </>
            )}
          </p>
        </div>
      )}
    </div>
  );
}
