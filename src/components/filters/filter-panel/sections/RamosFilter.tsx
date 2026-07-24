import { Search, X, Building2 } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Skeleton } from '@/components/ui/skeleton';
import { ScrollArea } from '@/components/ui/scroll-area';
import { RamoAtividadeBadge } from '@/components/ramo-atividade/RamoAtividadeBadge';
import { RamoAtividadeGroupAccordion } from '@/components/ramo-atividade/RamoAtividadeGroupAccordion';
import type { FilterState } from '../types';
import type { RamoAtividadeGroup, SegmentoComplete } from '@/types/ramo-atividade';

interface RamosFilterProps {
  filters: FilterState;
  onFilterChange: (filters: FilterState) => void;
  ramoSearch: string;
  setRamoSearch: (v: string) => void;
  ramoGroups: RamoAtividadeGroup[];
  allSegmentos: SegmentoComplete[];
  ramosLoading: boolean;
  totalRamoGroups: number;
  totalRamoSegmentos: number;
  getSegmentosForRamo: (slug: string) => SegmentoComplete[];
  productCountsByRamo: { ramoCounts: Map<string, number>; segmentoCounts: Map<string, number> };
}

export function RamosFilter({
  filters,
  onFilterChange,
  ramoSearch,
  setRamoSearch,
  ramoGroups,
  allSegmentos,
  ramosLoading,
  totalRamoGroups,
  totalRamoSegmentos,
  getSegmentosForRamo,
  productCountsByRamo,
}: RamosFilterProps) {
  return (
    <div className="space-y-3">
      {(filters.ramosAtividade.length > 0 || filters.segmentosAtividade.length > 0) && (
        <div className="rounded-lg border border-brand-primary/20 bg-brand-primary/5 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-brand-primary">
              <Building2 className="h-3 w-3" />
              Selecionados
            </span>
            <button
              type="button"
              onClick={() =>
                onFilterChange({ ...filters, ramosAtividade: [], segmentosAtividade: [] })
              }
              className="text-[10px] text-muted-foreground transition-colors hover:text-destructive"
              aria-label="Limpar todos os nichos e segmentos selecionados"
            >
              Limpar todos
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {filters.ramosAtividade.map((slug) => {
              const group = ramoGroups.find((g) => g.group_slug === slug);
              return group ? (
                <RamoAtividadeBadge
                  key={`ramo-${slug}`}
                  name={group.group_name}
                  hexCode={group.group_hex_code}
                  size="sm"
                  variant="solid"
                  onRemove={() => {
                    const segmentosNoRamo = getSegmentosForRamo(slug).map((s) => s.segmento_slug);
                    onFilterChange({
                      ...filters,
                      ramosAtividade: filters.ramosAtividade.filter((r) => r !== slug),
                      segmentosAtividade: filters.segmentosAtividade.filter(
                        (s) => !segmentosNoRamo.includes(s),
                      ),
                    });
                  }}
                />
              ) : null;
            })}
            {filters.segmentosAtividade.map((slug) => {
              const segmento = allSegmentos.find((s) => s.segmento_slug === slug);
              const group = segmento
                ? ramoGroups.find((g) => g.group_slug === segmento.ramo_slug)
                : null;
              return segmento ? (
                <RamoAtividadeBadge
                  key={`seg-${slug}`}
                  name={segmento.segmento_name}
                  hexCode={group?.group_hex_code}
                  size="sm"
                  variant="outline"
                  onRemove={() => {
                    onFilterChange({
                      ...filters,
                      segmentosAtividade: filters.segmentosAtividade.filter((s) => s !== slug),
                    });
                  }}
                />
              ) : null;
            })}
          </div>
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar nicho/segmento..."
          value={ramoSearch}
          onChange={(e) => setRamoSearch(e.target.value)}
          className="h-8 pl-8 pr-8 text-sm"
          aria-label="Buscar nicho ou segmento de atividade"
        />
        {ramoSearch && (
          <button
            type="button"
            onClick={() => setRamoSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            aria-label="Limpar busca de nicho/segmento"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span>{totalRamoGroups} ramos</span>
        <span>•</span>
        <span>{totalRamoSegmentos} segmentos</span>
        <span>•</span>
        <span className="font-medium text-brand-primary">
          {filters.ramosAtividade.length + filters.segmentosAtividade.length} selecionados
        </span>
      </div>
      {ramosLoading ? (
        <div className="space-y-2">
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
          <Skeleton className="h-10 w-full rounded-lg" />
        </div>
      ) : (
        <ScrollArea className="h-48">
          <div className="space-y-1.5 pr-3">
            {[...ramoGroups]
              .sort((a, b) => a.group_name.localeCompare(b.group_name, 'pt-BR'))
              .filter(
                (g) =>
                  !ramoSearch ||
                  g.group_name.toLowerCase().includes(ramoSearch.toLowerCase()) ||
                  getSegmentosForRamo(g.group_slug).some((s) =>
                    s.segmento_name.toLowerCase().includes(ramoSearch.toLowerCase()),
                  ),
              )
              .map((group) => {
                const segmentos = getSegmentosForRamo(group.group_slug);
                const isRamoSelected = filters.ramosAtividade.includes(group.group_slug);
                return (
                  <RamoAtividadeGroupAccordion
                    key={group.group_slug}
                    group={group}
                    segmentos={segmentos}
                    isRamoSelected={isRamoSelected}
                    selectedSegmentos={filters.segmentosAtividade}
                    productCountsByRamo={productCountsByRamo}
                    onRamoToggle={(ramoSlug) => {
                      if (filters.ramosAtividade.includes(ramoSlug)) {
                        const segmentosNoRamo = getSegmentosForRamo(ramoSlug).map(
                          (s) => s.segmento_slug,
                        );
                        onFilterChange({
                          ...filters,
                          ramosAtividade: filters.ramosAtividade.filter((r) => r !== ramoSlug),
                          segmentosAtividade: filters.segmentosAtividade.filter(
                            (s) => !segmentosNoRamo.includes(s),
                          ),
                        });
                      } else {
                        onFilterChange({
                          ...filters,
                          ramosAtividade: [...filters.ramosAtividade, ramoSlug],
                        });
                      }
                    }}
                    onSegmentoToggle={(segmentoSlug) => {
                      const currentSelected = filters.segmentosAtividade.includes(segmentoSlug);
                      if (currentSelected) {
                        onFilterChange({
                          ...filters,
                          segmentosAtividade: filters.segmentosAtividade.filter(
                            (s) => s !== segmentoSlug,
                          ),
                        });
                      } else {
                        onFilterChange({
                          ...filters,
                          segmentosAtividade: [...filters.segmentosAtividade, segmentoSlug],
                        });
                      }
                    }}
                    defaultOpen={
                      isRamoSelected ||
                      segmentos.some((s) => filters.segmentosAtividade.includes(s.segmento_slug))
                    }
                    compact
                  />
                );
              })}
            {ramoGroups.filter(
              (g) =>
                !ramoSearch ||
                g.group_name.toLowerCase().includes(ramoSearch.toLowerCase()) ||
                getSegmentosForRamo(g.group_slug).some((s) =>
                  s.segmento_name.toLowerCase().includes(ramoSearch.toLowerCase()),
                ),
            ).length === 0 && (
              <p className="py-2 text-center text-sm text-muted-foreground">
                Nenhum nicho/segmento encontrado
              </p>
            )}
          </div>
        </ScrollArea>
      )}
    </div>
  );
}
