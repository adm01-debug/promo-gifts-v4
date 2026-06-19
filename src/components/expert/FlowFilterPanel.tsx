import { useState } from 'react';
import { m as motion, AnimatePresence } from 'framer-motion';
import {
  X,
  DollarSign,
  Layers,
  Volume2,
  Tag,
  SlidersHorizontal,
  RotateCcw,
  Palette,
  Package,
  Sparkles,
  Users,
  Calendar,
  Briefcase,
  Building2,
  Paintbrush,
  Truck,
  Zap,
  Target,
  TrendingUp,
  Filter,
  Gem,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { ScrollArea } from '@/components/ui/scroll-area';
import { GroupSeparator, SectionRow, CollapsibleContent } from './FlowFilterPrimitives';
import { SectionContent, GENDER_OPTIONS } from './FlowFilterSections';

// ─── Types & utils (imported from flow-filter-types to break circular dep) ──
import {
  type FlowFilterState,
  type FlowFilterOptions,
  defaultFlowFilters,
  countActiveFilters,
  getActiveFilterLabels,
} from './flow-filter-types';

// Re-export for backward compatibility (useExpertChat, ChatHeader import from here)
export {
  type FlowFilterState,
  type FlowFilterOptions,
  defaultFlowFilters,
  countActiveFilters,
  getActiveFilterLabels,
};

// ─── Section definitions ────────────────────────────────
const SECTION_GROUPS: Array<{
  label: string;
  icon: React.ElementType;
  sections: Array<{ id: string; label: string; icon: React.ElementType }>;
}> = [
  {
    label: 'PRODUTO',
    icon: Package,
    sections: [
      { id: 'cores', label: 'Cores', icon: Palette },
      { id: 'categorias', label: 'Categorias', icon: Layers },
      { id: 'materiais', label: 'Materiais', icon: Gem },
      { id: 'genero', label: 'Gênero', icon: Users },
      { id: 'preco', label: 'Faixa de Preço', icon: DollarSign },
      { id: 'estoque', label: 'Estoque & Status', icon: Package },
    ],
  },
  {
    label: 'COMERCIAL',
    icon: TrendingUp,
    sections: [
      { id: 'fornecedores', label: 'Fornecedores', icon: Truck },
      { id: 'tecnicas', label: 'Técnicas de Gravação', icon: Paintbrush },
    ],
  },
  {
    label: 'MARKETING',
    icon: Target,
    sections: [
      { id: 'publico', label: 'Público-Alvo', icon: Users },
      { id: 'datas', label: 'Datas Comemorativas', icon: Calendar },
      { id: 'endomarketing', label: 'Endomarketing', icon: Briefcase },
      { id: 'nichos', label: 'Nichos/Segmentos', icon: Building2 },
    ],
  },
  {
    label: 'ATALHOS',
    icon: Zap,
    sections: [
      { id: 'tags', label: 'Tags', icon: Tag },
      { id: 'rapidas', label: 'Opções Rápidas', icon: Sparkles },
    ],
  },
];

const PRICE_PRESETS_COUNT = 4;

// ─── Props ──────────────────────────────────────────────
interface FlowFilterPanelProps {
  isOpen: boolean;
  onClose: () => void;
  filters: FlowFilterState;
  onFiltersChange: (f: FlowFilterState) => void;
  options: FlowFilterOptions;
  autoPlayTts: boolean;
  onAutoPlayTtsChange: (v: boolean) => void;
  activeFiltersCount: number;
  onReset: () => void;
}

// ─── Main Component ─────────────────────────────────────
export function FlowFilterPanel({
  isOpen,
  onClose,
  filters,
  onFiltersChange,
  options,
  autoPlayTts,
  onAutoPlayTtsChange,
  activeFiltersCount,
  onReset,
}: FlowFilterPanelProps) {
  const [openSections, setOpenSections] = useState<Set<string>>(new Set(['preco']));
  const [globalSearch, setGlobalSearch] = useState('');

  const toggle = (id: string) =>
    setOpenSections((prev) => {
      const n = new Set(prev);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const update = (patch: Partial<FlowFilterState>) => onFiltersChange({ ...filters, ...patch });
  const toggleArray = (key: keyof FlowFilterState, value: string) => {
    const arr = filters[key] as string[];
    update({ [key]: arr.includes(value) ? arr.filter((v) => v !== value) : [...arr, value] });
  };

  const shouldShow = (id: string) => {
    const q = globalSearch.toLowerCase();
    const match = (sId: string, label: string) =>
      !q || label.toLowerCase().includes(q) || sId.includes(q);
    const optMap: Record<string, string[]> = {
      cores: options.colors,
      categorias: options.categories,
      materiais: options.materials,
      fornecedores: options.suppliers,
      tecnicas: options.techniques,
      publico: options.publicoAlvo,
      datas: options.datasComemorativas,
      endomarketing: options.endomarketing,
      nichos: options.nichos,
      tags: options.tags,
    };
    if (optMap[id]) return optMap[id].length > 0 && match(id, id);
    return match(id, id);
  };

  const getCount = (id: string): number => {
    const map: Record<string, number> = {
      preco: filters.priceMin || filters.priceMax ? 1 : 0,
      cores: filters.selectedColors.length,
      categorias: filters.selectedCategories.length,
      materiais: filters.selectedMaterials.length,
      genero: filters.selectedGenders.length,
      fornecedores: filters.selectedSuppliers.length,
      tecnicas: filters.selectedTechniques.length,
      publico: filters.selectedPublicos.length,
      datas: filters.selectedDatasComemorativas.length,
      endomarketing: filters.selectedEndomarketing.length,
      nichos: filters.selectedNichos.length,
      tags: filters.selectedTags.length,
      estoque: [filters.onlyInStock].filter(Boolean).length,
      rapidas: [
        filters.onlyNew,
        filters.onlyKit,
        filters.onlyBestseller,
        filters.onlyFeatured,
        filters.hasPersonalization,
      ].filter(Boolean).length,
    };
    return map[id] ?? 0;
  };

  const getTotalOptions = (id: string): number => {
    const map: Record<string, number> = {
      cores: options.colors.length,
      categorias: options.categories.length,
      materiais: options.materials.length,
      genero: GENDER_OPTIONS.length,
      fornecedores: options.suppliers.length,
      tecnicas: options.techniques.length,
      publico: options.publicoAlvo.length,
      datas: options.datasComemorativas.length,
      endomarketing: options.endomarketing.length,
      nichos: options.nichos.length,
      tags: options.tags.length,
      estoque: 1,
      rapidas: 5,
      preco: PRICE_PRESETS_COUNT,
    };
    return map[id] ?? 0;
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="absolute inset-0 z-20 rounded-2xl bg-black/50 backdrop-blur-[3px]"
            onClick={onClose}
          />
          <motion.div
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="bg-card/98 absolute bottom-0 left-0 top-0 z-30 flex w-[310px] max-w-[90%] flex-col rounded-l-2xl border-r border-border/20 shadow-2xl shadow-black/20 backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border/10 px-4 pb-2.5 pt-3.5">
              <div className="flex items-center gap-2.5">
                <div className="flex h-7 w-7 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 shadow-sm shadow-primary/5">
                  <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                </div>
                <div>
                  <span className="text-sm font-semibold tracking-tight">Filtros</span>
                  {activeFiltersCount > 0 && (
                    <p className="text-[9px] font-bold leading-tight text-primary">
                      {activeFiltersCount} ativo{activeFiltersCount > 1 ? 's' : ''}
                    </p>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1">
                {activeFiltersCount > 0 && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onReset}
                    className="h-6 gap-1 rounded-lg px-2 text-[9px] text-muted-foreground hover:text-destructive"
                  >
                    <RotateCcw className="h-2.5 w-2.5" />
                    Limpar
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={onClose}
                  className="h-6 w-6 rounded-lg p-0"
                >
                  <X className="h-3.5 w-3.5" />
                </Button>
              </div>
            </div>
            {/* Search */}
            <div className="px-3 pb-1 pt-2">
              <div className="relative">
                <Filter className="absolute left-2.5 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground/30" />
                <input
                  value={globalSearch}
                  onChange={(e) => setGlobalSearch(e.target.value)}
                  placeholder="Buscar seção de filtro…"
                  className="h-7 w-full rounded-lg border border-border/15 bg-muted/10 pl-7 pr-2 text-[11px] transition-all placeholder:text-muted-foreground/25 focus:outline-none focus:ring-1 focus:ring-primary/20"
                />
              </div>
            </div>
            {/* Sections */}
            <ScrollArea className="flex-1 px-3">
              <div className="pb-3">
                {SECTION_GROUPS.map((group) => {
                  const vis = group.sections.filter((s) => shouldShow(s.id));
                  if (vis.length === 0) return null;
                  return (
                    <div key={group.label}>
                      <GroupSeparator label={group.label} icon={group.icon} />
                      {vis.map((sec) => (
                        <div key={sec.id}>
                          <SectionRow
                            icon={sec.icon}
                            label={sec.label}
                            isOpen={openSections.has(sec.id)}
                            onToggle={() => toggle(sec.id)}
                            count={getCount(sec.id)}
                            totalOptions={getTotalOptions(sec.id)}
                          />
                          <CollapsibleContent isOpen={openSections.has(sec.id)}>
                            <SectionContent
                              id={sec.id}
                              filters={filters}
                              options={options}
                              update={update}
                              toggleArray={toggleArray}
                            />
                          </CollapsibleContent>
                        </div>
                      ))}
                    </div>
                  );
                })}
                {/* Audio */}
                <div className="mt-4 border-t border-border/10 pt-3">
                  <div className="flex items-center justify-between px-1 py-1">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-muted/20">
                        <Volume2 className="h-3 w-3 text-muted-foreground/40" />
                      </div>
                      <div>
                        <span className="text-[11px] font-medium text-foreground/70">
                          Auto-play por voz
                        </span>
                        <p className="text-[9px] leading-tight text-muted-foreground/30">
                          Reproduzir respostas automaticamente
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={autoPlayTts}
                      onCheckedChange={onAutoPlayTtsChange}
                      className="origin-right scale-[0.75]"
                    />
                  </div>
                </div>
              </div>
            </ScrollArea>
            {/* Footer */}
            <div className="border-t border-border/10 px-3 py-2.5">
              <Button
                size="sm"
                onClick={onClose}
                className="h-9 w-full gap-1.5 rounded-xl text-[11px] font-semibold shadow-sm"
              >
                <Sparkles className="h-3 w-3" />
                Aplicar filtros
                {activeFiltersCount > 0 && (
                  <span className="h-4.5 ml-1 flex min-w-5 items-center justify-center rounded-full bg-primary-foreground/20 px-1.5 text-[10px] font-bold">
                    {activeFiltersCount}
                  </span>
                )}
              </Button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
