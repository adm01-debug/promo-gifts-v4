/**
 * ProductTagsSection — Seletor de tags do produto (padrão Super Filtro)
 * Gradientes, badges removíveis, color dots, contadores
 */

import { useState, useCallback, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { dbInvoke, dbInvokeSingle, dbInvokeDelete } from '@/lib/db/postgrest';
import { untypedFrom } from '@/lib/supabase-untyped';
import { Checkbox } from '@/components/ui/checkbox';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { X, Search, Tag, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

interface ProductTagsSectionProps {
  productId: string;
}

interface ExternalTag {
  id: string;
  name: string;
  slug?: string;
  color?: string;
}

interface ProductTag {
  id: string;
  product_id: string;
  tag_id: string;
}

async function fetchTags(): Promise<ExternalTag[]> {
  const { records } = await dbInvoke<ExternalTag>({
    table: 'tags',
    operation: 'select',
    limit: 500,
    orderBy: { column: 'name', ascending: true },
    countMode: 'none',
  });
  return records;
}

async function fetchProductTags(productId: string): Promise<ProductTag[]> {
  const { records } = await dbInvoke<ProductTag>({
    table: 'product_tags',
    operation: 'select',
    filters: { product_id: productId },
    limit: 500,
  });
  return records;
}

export function ProductTagsSection({ productId }: ProductTagsSectionProps) {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [togglingIds, setTogglingIds] = useState<Set<string>>(new Set());

  const { data: tags = [], isLoading: loadingTags } = useQuery({
    queryKey: ['external-tags-admin'],
    queryFn: fetchTags,
    staleTime: 5 * 60 * 1000,
  });

  const { data: productTags = [], isLoading: loadingLinks } = useQuery({
    queryKey: ['product-tags', productId],
    queryFn: () => fetchProductTags(productId),
    enabled: !!productId,
  });

  const linkedTagIds = useMemo(() => new Set(productTags.map((pt) => pt.tag_id)), [productTags]);

  const toggleTag = useCallback(
    async (tagId: string, isLinked: boolean) => {
      if (togglingIds.has(tagId)) return;
      setTogglingIds((prev) => new Set(prev).add(tagId));
      try {
        if (isLinked) {
          const record = productTags.find((pt) => pt.tag_id === tagId);
          if (!record?.id) {
            const found = await dbInvokeSingle<ProductTag>({
              table: 'product_tags',
              operation: 'select',
              filters: { product_id: productId, tag_id: tagId },
            });
            if (!found?.id) {
              toast.error('Registro não encontrado');
              return;
            }
            await dbInvokeDelete({ table: 'product_tags', id: found.id });
          } else {
            await dbInvokeDelete({ table: 'product_tags', id: record.id });
          }
          toast.success('Tag removida');
        } else {
          const { error } = await untypedFrom('product_tags').insert({
            product_id: productId,
            tag_id: tagId,
          });
          if (error) throw new Error(error.message);
          toast.success('Tag adicionada');
        }
        queryClient.invalidateQueries({ queryKey: ['product-tags', productId] });
      } catch {
        toast.error('Erro ao alterar tag');
      } finally {
        setTogglingIds((prev) => {
          const next = new Set(prev);
          next.delete(tagId);
          return next;
        });
      }
    },
    [productId, productTags, queryClient, togglingIds],
  );

  const clearAll = useCallback(async () => {
    const linked = tags.filter((t) => linkedTagIds.has(t.id));
    for (const t of linked) {
      await toggleTag(t.id, true);
    }
  }, [tags, linkedTagIds, toggleTag]);

  const isLoading = loadingTags || loadingLinks;

  if (isLoading) {
    return (
      <div className="space-y-2">
        <Skeleton className="h-12 w-full rounded-lg" />
        <Skeleton className="h-12 w-full rounded-lg" />
      </div>
    );
  }

  if (tags.length === 0) {
    return (
      <div className="py-8 text-center">
        <Tag className="mx-auto mb-2 h-8 w-8 text-muted-foreground/50" />
        <p className="text-sm text-muted-foreground">Nenhuma tag disponível</p>
      </div>
    );
  }

  const linkedCount = linkedTagIds.size;
  const searchLower = search.toLowerCase();

  const filtered = tags
    .filter((t) => !search || t.name.toLowerCase().includes(searchLower))
    .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));

  return (
    <div className="space-y-3">
      {/* Badges dos selecionados */}
      {linkedCount > 0 && (
        <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-primary">
              <Tag className="h-3 w-3" />
              Selecionadas
            </span>
            <button
              type="button"
              onClick={clearAll}
              className="text-[10px] text-muted-foreground transition-colors hover:text-destructive"
            >
              Limpar todas
            </button>
          </div>
          <div className="flex flex-wrap gap-1.5">
            {tags
              .filter((t) => linkedTagIds.has(t.id))
              .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'))
              .map((t) => (
                <span
                  key={t.id}
                  className="inline-flex cursor-pointer items-center gap-1 rounded-full border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground transition-all duration-200 hover:bg-muted/50"
                  onClick={() => toggleTag(t.id, true)}
                >
                  {t.color && (
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: t.color }}
                    />
                  )}
                  <span className="max-w-[100px] truncate">{t.name}</span>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleTag(t.id, true);
                    }}
                    className="ml-0.5 rounded-full p-0.5 transition-all duration-150 hover:bg-destructive/20 hover:text-destructive"
                  >
                    <X className="h-2.5 w-2.5" />
                  </button>
                </span>
              ))}
          </div>
        </div>
      )}

      {/* Busca */}
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar tags..."
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

      {/* Estatísticas */}
      <div className="flex items-center justify-between px-1 text-[11px] text-muted-foreground">
        <span>{tags.length} tags</span>
        <span>•</span>
        <span className={cn('font-medium', linkedCount > 0 && 'text-primary')}>
          {linkedCount} selecionadas
        </span>
      </div>

      {/* Lista */}
      <ScrollArea className="h-56">
        <div className="space-y-0.5 pr-3">
          {filtered.length === 0 && search ? (
            <div className="py-6 text-center">
              <Search className="mx-auto mb-2 h-6 w-6 text-muted-foreground/50" />
              <p className="text-sm text-muted-foreground">
                Nenhuma tag encontrada para "<span className="font-medium">{search}</span>"
              </p>
            </div>
          ) : (
            filtered.map((tag) => {
              const isLinked = linkedTagIds.has(tag.id);
              return (
                <label
                  key={tag.id}
                  className={cn(
                    'flex cursor-pointer items-center gap-2.5 rounded-md px-2.5 py-1.5 text-sm transition-all duration-150',
                    isLinked
                      ? 'bg-primary/15 font-medium text-foreground shadow-sm'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground',
                  )}
                >
                  {togglingIds.has(tag.id) ? (
                    <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-primary" />
                  ) : (
                    <Checkbox
                      checked={isLinked}
                      onCheckedChange={() => toggleTag(tag.id, isLinked)}
                      className="data-[state=checked]:border-primary data-[state=checked]:bg-primary"
                    />
                  )}
                  {tag.color && (
                    <span
                      className="h-2 w-2 flex-shrink-0 rounded-full"
                      style={{ backgroundColor: tag.color }}
                    />
                  )}
                  <span className="flex-1 truncate">{tag.name}</span>
                  {isLinked && (
                    <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                  )}
                </label>
              );
            })
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
