/**
 * FlowFilterSections — Section content renderers for FlowFilterPanel.
 */
import { Switch } from '@/components/ui/switch';
import { cn } from '@/lib/utils';
import { MultiChipGrid } from './FlowFilterPrimitives';
import type { FlowFilterState, FlowFilterOptions } from './FlowFilterPanel';

const PRICE_PRESETS = [
  { label: 'Até R$10', min: '', max: '10' },
  { label: 'R$10–50', min: '10', max: '50' },
  { label: 'R$50–100', min: '50', max: '100' },
  { label: 'R$100+', min: '100', max: '' },
];

const GENDER_OPTIONS = ['Unissex', 'Masculino', 'Feminino', 'Infantil'];

interface SectionContentProps {
  id: string;
  filters: FlowFilterState;
  options: FlowFilterOptions;
  update: (patch: Partial<FlowFilterState>) => void;
  toggleArray: (key: keyof FlowFilterState, value: string) => void;
}

export function SectionContent({ id, filters, options, update, toggleArray }: SectionContentProps) {
  const handlePreset = (min: string, max: string) => {
    if (filters.priceMin === min && filters.priceMax === max)
      update({ priceMin: '', priceMax: '' });
    else update({ priceMin: min, priceMax: max });
  };

  switch (id) {
    case 'preco':
      return (
        <div className="space-y-2">
          <div className="flex flex-wrap gap-1.5">
            {PRICE_PRESETS.map((p) => {
              const isActive = filters.priceMin === p.min && filters.priceMax === p.max;
              return (
                <button
                  key={p.label}
                  onClick={() => handlePreset(p.min, p.max)}
                  className={cn(
                    'rounded-lg border px-2.5 py-1 text-[10px] font-semibold transition-all duration-150',
                    isActive
                      ? 'border-primary/30 bg-primary/15 text-primary shadow-sm shadow-primary/5'
                      : 'border-border/15 bg-muted/5 text-muted-foreground/45 hover:border-primary/20 hover:text-foreground',
                  )}
                >
                  {p.label}
                </button>
              );
            })}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-medium text-muted-foreground/35">
                R$
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={filters.priceMin}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || Number(v) >= 0) update({ priceMin: v });
                }}
                placeholder="Mín"
                className={cn(
                  'h-7 w-full rounded-lg border bg-background/30 pl-6 pr-2 text-[11px] transition-all focus:outline-none focus:ring-1 focus:ring-primary/25',
                  filters.priceMin
                    ? 'border-primary/30 font-medium text-primary'
                    : 'border-border/15 text-foreground/70',
                )}
              />
            </div>
            <div className="h-px w-3 bg-border/25" />
            <div className="relative flex-1">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-[9px] font-medium text-muted-foreground/35">
                R$
              </span>
              <input
                type="number"
                min={0}
                step="0.01"
                value={filters.priceMax}
                onChange={(e) => {
                  const v = e.target.value;
                  if (v === '' || Number(v) >= 0) update({ priceMax: v });
                }}
                placeholder="Máx"
                className={cn(
                  'h-7 w-full rounded-lg border bg-background/30 pl-6 pr-2 text-[11px] transition-all focus:outline-none focus:ring-1 focus:ring-primary/25',
                  filters.priceMax
                    ? 'border-primary/30 font-medium text-primary'
                    : 'border-border/15 text-foreground/70',
                )}
              />
            </div>
          </div>
        </div>
      );
    case 'cores':
      return (
        <MultiChipGrid
          items={options.colors}
          selected={filters.selectedColors}
          onToggle={(v) => toggleArray('selectedColors', v)}
          searchable
          placeholder="Buscar cor…"
        />
      );
    case 'categorias':
      return (
        <MultiChipGrid
          items={options.categories}
          selected={filters.selectedCategories}
          onToggle={(v) => toggleArray('selectedCategories', v)}
          searchable
          placeholder="Buscar categoria…"
          maxVisible={20}
        />
      );
    case 'materiais':
      return (
        <MultiChipGrid
          items={options.materials}
          selected={filters.selectedMaterials}
          onToggle={(v) => toggleArray('selectedMaterials', v)}
          searchable
          placeholder="Buscar material…"
        />
      );
    case 'genero':
      return (
        <MultiChipGrid
          items={GENDER_OPTIONS}
          selected={filters.selectedGenders}
          onToggle={(v) => toggleArray('selectedGenders', v)}
        />
      );
    case 'fornecedores':
      return (
        <MultiChipGrid
          items={options.suppliers}
          selected={filters.selectedSuppliers}
          onToggle={(v) => toggleArray('selectedSuppliers', v)}
          searchable
          placeholder="Buscar fornecedor…"
        />
      );
    case 'tecnicas':
      return (
        <MultiChipGrid
          items={options.techniques}
          selected={filters.selectedTechniques}
          onToggle={(v) => toggleArray('selectedTechniques', v)}
          searchable
          placeholder="Buscar técnica…"
        />
      );
    case 'publico':
      return (
        <MultiChipGrid
          items={options.publicoAlvo}
          selected={filters.selectedPublicos}
          onToggle={(v) => toggleArray('selectedPublicos', v)}
          searchable
          placeholder="Buscar público…"
        />
      );
    case 'datas':
      return (
        <MultiChipGrid
          items={options.datasComemorativas}
          selected={filters.selectedDatasComemorativas}
          onToggle={(v) => toggleArray('selectedDatasComemorativas', v)}
          searchable
          placeholder="Buscar data…"
        />
      );
    case 'endomarketing':
      return (
        <MultiChipGrid
          items={options.endomarketing}
          selected={filters.selectedEndomarketing}
          onToggle={(v) => toggleArray('selectedEndomarketing', v)}
        />
      );
    case 'nichos':
      return (
        <MultiChipGrid
          items={options.nichos}
          selected={filters.selectedNichos}
          onToggle={(v) => toggleArray('selectedNichos', v)}
          searchable
          placeholder="Buscar nicho…"
        />
      );
    case 'tags':
      return (
        <MultiChipGrid
          items={options.tags}
          selected={filters.selectedTags}
          onToggle={(v) => toggleArray('selectedTags', v)}
          searchable
          placeholder="Buscar tag…"
        />
      );
    case 'estoque':
      return (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between py-0.5">
            <span className="text-[11px] text-foreground/70">Apenas com estoque</span>
            <Switch
              checked={filters.onlyInStock}
              onCheckedChange={(v) => update({ onlyInStock: v })}
              className="origin-right scale-[0.75]"
            />
          </div>
        </div>
      );
    case 'rapidas':
      return (
        <div className="space-y-1">
          {[
            { key: 'onlyNew' as const, label: '🆕 Novidades', desc: 'Lançamentos recentes' },
            { key: 'onlyFeatured' as const, label: '⭐ Destaques', desc: 'Produtos em destaque' },
            { key: 'onlyKit' as const, label: '📦 Kits', desc: 'Kits e combos' },
            {
              key: 'onlyBestseller' as const,
              label: '🏆 Mais vendidos',
              desc: 'Campeões de venda',
            },
            {
              key: 'hasPersonalization' as const,
              label: '🎨 Personalização',
              desc: 'Aceita gravação',
            },
          ].map(({ key, label, desc }) => (
            <div key={key} className="group/quick flex items-center justify-between py-1">
              <div>
                <span className="text-[11px] font-medium text-foreground/80">{label}</span>
                <p className="text-[9px] leading-tight text-muted-foreground/30">{desc}</p>
              </div>
              <Switch
                checked={filters[key]}
                onCheckedChange={(v) => update({ [key]: v })}
                className="origin-right scale-[0.75]"
              />
            </div>
          ))}
        </div>
      );
    default:
      return null;
  }
}

// Re-export constants for external use
export { PRICE_PRESETS, GENDER_OPTIONS };
