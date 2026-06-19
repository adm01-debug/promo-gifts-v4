/**
 * ProductMarketingSection — Seletores de classificação de marketing (padrão Super Filtro)
 * Público-Alvo, Datas Comemorativas e Endomarketing
 * Gradientes, badges, color dots, contadores hierárquicos
 */

import { useState, useEffect, useCallback } from 'react';
import { untypedFrom } from '@/lib/supabase-untyped';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { Input } from '@/components/ui/input';
import { X, Users, Calendar, Megaphone, ChevronDown, Search, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { PUBLICO_ALVO, DATAS_COMEMORATIVAS, ENDOMARKETING } from '@/data/mockData';
import { dbInvoke } from '@/lib/db/postgrest';

interface ProductMarketingSectionProps {
  productId: string;
}

interface ProductTags {
  publicoAlvo: string[];
  datasComemorativas: string[];
  endomarketing: string[];
}

function toArray(value: unknown): string[] {
  if (!value) return [];
  if (Array.isArray(value))
    return value.filter((v): v is string => typeof v === 'string' && !!v.trim());
  if (typeof value === 'string')
    return value
      .split(/[,;|]/)
      .map((v) => v.trim())
      .filter(Boolean);
  return [];
}

async function fetchProductTags(productId: string): Promise<ProductTags> {
  // FIX-BRIDGE-01: migrated from bridge to dbInvoke
  const result = await dbInvoke({
    table: 'products',
    operation: 'select',
    filters: { id: productId },
    limit: 1,
  });
  const product = result.records?.[0] as Record<string, unknown> | undefined;
  const raw = product?.tags;
  const tags =
    typeof raw === 'string'
      ? (() => {
          try {
            return JSON.parse(raw);
          } catch {
            return {};
          }
        })()
      : (raw ?? {});

  return {
    publicoAlvo: toArray(tags.publicoAlvo ?? tags.publico_alvo),
    datasComemorativas: toArray(tags.datasComemorativas ?? tags.datas_comemorativas),
    endomarketing: toArray(tags.endomarketing),
  };
}

async function saveProductTags(productId: string, tags: ProductTags): Promise<void> {
  const payload = {
    publicoAlvo: tags.publicoAlvo,
    datasComemorativas: tags.datasComemorativas,
    endomarketing: tags.endomarketing,
    publico_alvo: tags.publicoAlvo,
    datas_comemorativas: tags.datasComemorativas,
  };

  // FIX-BRIDGE-01: migrated from bridge to dbInvoke (REST native write)
  // v_products_public view doesn't have 'tags' in its generated types, so use untypedFrom.
  const { error } = await untypedFrom('v_products_public')
    .update({ tags: payload })
    .eq('id', productId);
  if (error) throw new Error(error.message);
}

type CategoryKey = keyof ProductTags;

const CATEGORY_COLORS: Record<CategoryKey, string> = {
  publicoAlvo: '#3B82F6',
  datasComemorativas: '#EF4444',
  endomarketing: '#8B5CF6',
};

const CATEGORIES: Array<{
  key: CategoryKey;
  label: string;
  icon: React.ElementType;
  options: string[];
}> = [
  {
    key: 'publicoAlvo',
    label: 'Público-Alvo',
    icon: Users,
    options: [...PUBLICO_ALVO].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  },
  {
    key: 'datasComemorativas',
    label: 'Datas Comemorativas',
    icon: Calendar,
    options: [...DATAS_COMEMORATIVAS].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  },
  {
    key: 'endomarketing',
    label: 'Endomarketing',
    icon: Megaphone,
    options: [...ENDOMARKETING].sort((a, b) => a.localeCompare(b, 'pt-BR')),
  },
];

export function ProductMarketingSection({ productId }: ProductMarketingSectionProps) {
  const [tags, setTags] = useState<ProductTags>({
    publicoAlvo: [],
    datasComemorativas: [],
    endomarketing: [],
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [togglingKeys, setTogglingKeys] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  useEffect(() => {
    fetchProductTags(productId)
      .then((t) => {
        setTags(t);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [productId]);

  const toggleItem = useCallback(
    async (category: CategoryKey, item: string) => {
      const toggleKey = `${category}::${item}`;
      if (togglingKeys.has(toggleKey)) return;
      setTogglingKeys((prev) => new Set(prev).add(toggleKey));

      const current = tags[category] ?? [];
      const isSelected = current.includes(item);
      const updated = isSelected ? current.filter((i) => i !== item) : [...current, item];

      const newTags = { ...tags, [category]: updated };
      setTags(newTags);

      setSaving(true);
      try {
        await saveProductTags(productId, newTags);
        toast.success(isSelected ? 'Removido' : 'Adicionado');
      } catch {
        setTags(tags);
        toast.error('Erro ao salvar');
      } finally {
        setSaving(false);
        setTogglingKeys((prev) => {
          const next = new Set(prev);
          next.delete(toggleKey);
          return next;
        });
      }
    },
    [productId, tags, togglingKeys],
  );

  const toggleGroup = (key: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const clearAll = useCallback(async () => {
    const newTags: ProductTags = { publicoAlvo: [], datasComemorativas: [], endomarketing: [] };
    setTags(newTags);
    setSaving(true);
    try {
      await saveProductTags(productId, newTags);
      toast.success('Todas as classificações removidas');
    } catch {
      toast.error('Erro ao limpar');
    } finally {
      setSaving(false);
    }
  }, [productId]);

  if (loading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    );
  }

  const totalSelected = CATEGORIES.reduce((sum, cat) => sum + (tags[cat.key]?.length ?? 0), 0);
  const totalOptions = CATEGORIES.reduce((sum, cat) => sum + cat.options.length, 0);
  const searchLower = search.toLowerCase();

  return (
    <div className="space-y-3">
      {totalSelected > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Megaphone className="h-3 w-3" />
              Selecionados
              {saving && <span className="h-2 w-2 animate-pulse rounded-full bg-primary" />}
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-[10px] text-muted-foreground transition-colors hover:text-destructive"
            >
              Limpar todos
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {CATEGORIES.flatMap((cat) =>
              (tags[cat.key] ?? [])
                .sort((a, b) => a.localeCompare(b, 'pt-BR'))
                .map((item) => (
                  <span
                    key={`${cat.key}-${item}`}
                    className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground transition-all duration-200 hover:bg-muted/50"
                    onClick={() => toggleItem(cat.key, item)}
                  >
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: CATEGORY_COLORS[cat.key] }}
                    />
                    <span className="max-w-[100px] truncate">{item}</span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        toggleItem(cat.key, item);
                      }}
                      className="ml-0.5 rounded-full p-0.5 transition-all duration-150 hover:bg-destructive/20 hover:text-destructive"
                    >
                      <X className="h-2.5 w-2.5" />
                    </button>
                  </span>
                )),
            )}
          </div>
        </div>
      )}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar classificação..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="h-8 pl-8 pr-8 text-sm"
        />
        {search && (
          <button
            type="button"
            onClick={() => setSearch('')}
            className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
      <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span>{CATEGORIES.length} categorias</span>
        <span>•</span>
        <span>{totalOptions} opções</span>
        <span>•</span>
        <span className={cn('font-medium', totalSelected > 0 && 'text-primary')}>
          {totalSelected} selecionados
        </span>
      </div>
      <ScrollArea className="h-56">
        <div className="space-y-1.5 pr-3">
          {CATEGORIES.map(({ key, label, icon: Icon, options }) => {
            const selected = tags[key] ?? [];
            const color = CATEGORY_COLORS[key];
            const filteredOptions = search
              ? options.filter((o) => o.toLowerCase().includes(searchLower))
              : options;
            if (
              search &&
              filteredOptions.length === 0 &&
              !label.toLowerCase().includes(searchLower)
            )
              return null;
            const linkedInCat = selected.length;
            const isOpen = openGroups.has(key) || !!search;
            const hasAnySelection = linkedInCat > 0;
            return (
              <div
                key={key}
                className={cn(
                  'overflow-hidden rounded-lg transition-all duration-200',
                  hasAnySelection
                    ? 'bg-gradient-to-r from-primary/10 to-primary/5 ring-1 ring-primary/30'
                    : 'bg-muted/30 hover:bg-muted/50',
                )}
              >
                <div className="flex items-center gap-2 p-2.5">
                  <button
                    type="button"
                    onClick={() => toggleGroup(key)}
                    className={cn(
                      'rounded-md p-1 transition-all duration-200',
                      isOpen ? 'bg-primary/10' : 'bg-muted hover:bg-muted/80',
                    )}
                  >
                    <ChevronDown
                      className={cn(
                        'h-3.5 w-3.5 transition-transform duration-200',
                        isOpen ? 'rotate-180 text-primary' : 'text-muted-foreground',
                      )}
                    />
                  </button>
                  <div
                    className={cn(
                      'h-4 w-4 flex-shrink-0 rounded-full ring-2 ring-offset-1 ring-offset-background transition-all',
                      hasAnySelection ? 'scale-110 ring-primary/50' : 'ring-border/50',
                    )}
                    style={{ backgroundColor: color, boxShadow: `0 2px 8px ${color}40` }}
                  />
                  <Icon
                    className={cn(
                      'h-3.5 w-3.5 flex-shrink-0 transition-colors',
                      hasAnySelection ? 'text-primary' : 'text-muted-foreground',
                    )}
                  />
                  <span
                    className={cn(
                      'flex-1 truncate text-sm font-medium transition-colors',
                      hasAnySelection ? 'text-primary' : 'text-foreground',
                    )}
                  >
                    {label}
                  </span>
                  <div className="flex flex-shrink-0 items-center gap-1.5">
                    {linkedInCat > 0 && (
                      <span className="min-w-[18px] rounded-full bg-primary px-1.5 py-0.5 text-center text-[10px] font-bold text-primary-foreground">
                        {linkedInCat}
                      </span>
                    )}
                    <span
                      className={cn(
                        'rounded-full px-1.5 py-0.5 text-[11px]',
                        hasAnySelection
                          ? 'bg-primary/20 font-medium text-primary'
                          : 'bg-muted text-muted-foreground',
                      )}
                    >
                      {filteredOptions.length}
                    </span>
                  </div>
                </div>
                {isOpen && filteredOptions.length > 0 && (
                  <div className="space-y-0.5 px-2.5 pb-2.5">
                    <div className="ml-8 border-t border-border/30 pt-2">
                      {filteredOptions.map((opt) => {
                        const isSelected = selected.includes(opt);
                        return (
                          <label
                            key={opt}
                            className={cn(
                              'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-all duration-150',
                              isSelected
                                ? 'bg-primary/15 font-medium text-foreground shadow-sm'
                                : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                            )}
                          >
                            {togglingKeys.has(`${key}::${opt}`) ? (
                              <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-primary" />
                            ) : (
                              <Checkbox
                                checked={isSelected}
                                onCheckedChange={() => toggleItem(key, opt)}
                                className="data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                              />
                            )}
                            <span
                              className="h-2 w-2 flex-shrink-0 rounded-full"
                              style={{ backgroundColor: color }}
                            />
                            <span className="flex-1 truncate">{opt}</span>
                            {isSelected && (
                              <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                            )}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                )}
                {isOpen && filteredOptions.length === 0 && (
                  <div className="px-2.5 pb-2.5">
                    <div className="ml-8 border-t border-border/30 pt-2">
                      <p className="py-2 text-xs italic text-muted-foreground">
                        Nenhuma opção encontrada
                      </p>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
