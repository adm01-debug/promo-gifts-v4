/**
 * Kit Library — Biblioteca unificada de kits do vendedor + sugeridos pelo sistema.
 * 3 abas (Meus / Sugeridos / Favoritos) com busca, filtros visuais, categorias e ordenação.
 * Inclui pin/destaque, ordenação por uso recente e badge de adoção (admin-only).
 */
import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Plus, Search, Library, Sparkles, Star, Pin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { PageSEO } from '@/components/seo/PageSEO';
import { KitCard, type KitCardData } from '@/components/kit-library/KitCard';
import { KitCardSkeletonGrid } from '@/components/kit-library/KitCardSkeleton';
import { KitLibraryFilters, type SortOption } from '@/components/kit-library/KitLibraryFilters';
import { KitTemplatePreviewDialog } from '@/components/kit-library/KitTemplatePreviewDialog';
import { KitCategoryChips } from '@/components/kit-library/KitCategoryChips';
import {
  useCustomKitPersistence,
  useKitTemplates,
  type CustomKitRow,
  type KitTemplateRow,
} from '@/hooks/kit-builder';
import { buildCustomKitInsert } from '@/lib/kit-library/buildCustomKitInsert';

function getItemsCount(items: unknown): number {
  if (!Array.isArray(items)) return 0;
  return items.reduce((sum: number, it: unknown) => {
    const obj = it as { quantity?: number };
    return sum + (obj?.quantity ?? 1);
  }, 0);
}

function applySort<
  T extends {
    name: string;
    total_price: number;
    updated_at?: string;
    usage_count?: number;
    last_used_at?: string | null;
  },
>(list: T[], sort: SortOption): T[] {
  const arr = [...list];
  switch (sort) {
    case 'price-desc':
      arr.sort((a, b) => Number(b.total_price) - Number(a.total_price));
      break;
    case 'name-asc':
      arr.sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
      break;
    case 'usage-desc':
      arr.sort((a, b) => (b.usage_count ?? 0) - (a.usage_count ?? 0));
      break;
    case 'last-used':
      arr.sort((a, b) => (b.last_used_at ?? '').localeCompare(a.last_used_at ?? ''));
      break;
    case 'recent':
    default:
      arr.sort((a, b) => (b.updated_at ?? '').localeCompare(a.updated_at ?? ''));
  }
  return arr;
}

export default function KitLibraryPage() {
  const { user, isAdmin } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { togglePinned } = useCustomKitPersistence();
  const [search, setSearch] = useState('');
  const [tab, setTab] = useState<'mine' | 'suggested' | 'favorites'>('mine');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [sort, setSort] = useState<SortOption>('recent');
  const [previewTemplate, setPreviewTemplate] = useState<KitTemplateRow | null>(null);

  // Mine
  const { data: myKits = [], isLoading: loadingMine } = useQuery({
    queryKey: ['custom-kits', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from('custom_kits')
        .select('*')
        .order('updated_at', { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as CustomKitRow[];
    },
    enabled: !!user?.id,
  });

  // Suggested
  const { templates, isLoading: loadingTemplates, cloneTemplate, isCloning } = useKitTemplates();

  // Mutations
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('custom_kits').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-kits'] });
      toast.success('Kit excluído');
      setDeleteId(null);
    },
    onError: () => toast.error('Erro ao excluir'),
  });

  const favoriteMutation = useMutation({
    mutationFn: async ({ id, value }: { id: string; value: boolean }) => {
      const { error } = await supabase
        .from('custom_kits')
        .update({ is_favorite: value } as never)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['custom-kits'] }),
  });

  const duplicateMutation = useMutation({
    mutationFn: async (kit: CustomKitRow) => {
      if (!user?.id) throw new Error('Não autenticado');
      const payload = buildCustomKitInsert(kit, {
        user_id: user.id,
        name: `${kit.name} (cópia)`,
        status: 'draft',
        is_pinned: false,
        last_used_at: null,
      });
      const { error } = await supabase.from('custom_kits').insert(payload as never);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['custom-kits'] });
      toast.success('Kit duplicado');
    },
    onError: () => toast.error('Erro ao duplicar'),
  });

  // Derived
  const availableTags = useMemo(() => {
    const set = new Set<string>();
    myKits.forEach((k) => {
      if (k.tag) set.add(k.tag);
    });
    templates.forEach((t) => {
      if (t.tag) set.add(t.tag);
    });
    return [...set].sort();
  }, [myKits, templates]);

  const availableColors = useMemo(() => {
    const set = new Set<string>();
    myKits.forEach((k) => {
      if (k.color) set.add(k.color);
    });
    return [...set];
  }, [myKits]);

  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    templates.forEach((t) => {
      if (t.category) set.add(t.category);
    });
    return [...set].sort();
  }, [templates]);

  // Filters
  const q = search.trim().toLowerCase();
  const matchKit = (k: CustomKitRow) => {
    if (q && !(k.name.toLowerCase().includes(q) || (k.tag ?? '').toLowerCase().includes(q)))
      return false;
    if (selectedTag && k.tag !== selectedTag) return false;
    if (selectedColor && k.color !== selectedColor) return false;
    return true;
  };
  const matchTpl = (t: KitTemplateRow) => {
    if (
      q &&
      !(
        t.name.toLowerCase().includes(q) ||
        (t.tag ?? '').toLowerCase().includes(q) ||
        t.category.toLowerCase().includes(q)
      )
    )
      return false;
    if (selectedTag && t.tag !== selectedTag) return false;
    if (selectedCategory && t.category !== selectedCategory) return false;
    return true;
  };

  const pinnedKit = useMemo(
    () => myKits.find((k) => k.is_pinned && matchKit(k)) ?? null,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myKits, q, selectedTag, selectedColor],
  );

  const filteredMine = useMemo(
    () =>
      applySort(
        myKits.filter((k) => !k.is_pinned && matchKit(k)),
        sort,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myKits, q, selectedTag, selectedColor, sort],
  );
  const filteredFavs = useMemo(
    () =>
      applySort(
        myKits.filter((k) => k.is_favorite && matchKit(k)),
        sort,
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [myKits, q, selectedTag, selectedColor, sort],
  );
  const filteredTpls = useMemo(
    () => applySort(templates.filter(matchTpl), sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [templates, q, selectedTag, selectedCategory, sort],
  );

  const toCard = (k: CustomKitRow): KitCardData => {
    return {
      id: k.id,
      name: k.name,
      description: k.description,
      tag: k.tag,
      color: k.color || '#3B82F6',
      icon: k.icon || 'Package',
      totalPrice: Number(k.total_price),
      itemsCount: getItemsCount(k.items_data),
      isFavorite: k.is_favorite,
      isPinned: k.is_pinned,
    };
  };

  const tplToCard = (t: KitTemplateRow): KitCardData => ({
    id: t.id,
    name: t.name,
    description: t.description,
    tag: t.tag,
    color: t.color,
    icon: t.icon,
    totalPrice: Number(t.total_price),
    itemsCount: getItemsCount(t.items_data),
    badge: t.usage_count >= 5 ? 'Popular' : t.category,
    usageBadge: isAdmin ? `${t.usage_count} uso${t.usage_count === 1 ? '' : 's'}` : undefined,
  });

  const handleClone = async (template: KitTemplateRow) => {
    const created = await cloneTemplate(template);
    setPreviewTemplate(null);
    if (created && typeof created === 'object' && 'id' in created) {
      navigate(`/montar-kit?kit=${(created as { id: string }).id}`);
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
      <PageSEO
        title="Biblioteca de Kits — Seus kits salvos e templates do sistema"
        description="Acesse seu banco pessoal de kits e clone templates curados pelo sistema para acelerar a montagem de propostas."
        path="/meus-kits"
        noIndex
      />

      {/* Header */}
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h1
            data-testid="page-title-kits"
            className="flex items-center gap-2 font-display text-3xl font-bold tracking-tight"
          >
            <Library className="h-7 w-7 text-primary" />
            Biblioteca de Kits
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Acesse seus kits salvos ou clone um template do sistema para acelerar sua rotina.
          </p>
        </div>
        <Button onClick={() => navigate('/montar-kit')} className="gap-2">
          <Plus className="h-4 w-4" /> Montar novo kit
        </Button>
      </div>

      {/* Search */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Buscar por nome, etiqueta ou categoria…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      {/* Filters */}
      <KitLibraryFilters
        tags={availableTags}
        colors={tab === 'mine' || tab === 'favorites' ? availableColors : []}
        selectedTag={selectedTag}
        selectedColor={selectedColor}
        sort={sort}
        onTagChange={setSelectedTag}
        onColorChange={setSelectedColor}
        onSortChange={setSort}
        showUsageSort={tab === 'suggested'}
        showLastUsedSort={tab === 'mine' || tab === 'favorites'}
      />

      {tab === 'suggested' && (
        <KitCategoryChips
          categories={availableCategories}
          selected={selectedCategory}
          onSelect={setSelectedCategory}
        />
      )}

      <Tabs value={tab} onValueChange={(v) => setTab(v as typeof tab)} className="space-y-4">
        <TabsList>
          <TabsTrigger value="mine" className="gap-2">
            <Library className="h-4 w-4" /> Meus Kits
            <span className="ml-1 text-[10px] opacity-60">({myKits.length})</span>
          </TabsTrigger>
          <TabsTrigger value="suggested" className="gap-2">
            <Sparkles className="h-4 w-4" /> Sugeridos
            <span className="ml-1 text-[10px] opacity-60">({templates.length})</span>
          </TabsTrigger>
          <TabsTrigger value="favorites" className="gap-2">
            <Star className="h-4 w-4" /> Favoritos
            <span className="ml-1 text-[10px] opacity-60">
              ({myKits.filter((k) => k.is_favorite).length})
            </span>
          </TabsTrigger>
        </TabsList>

        {/* MINE */}
        <TabsContent value="mine" className="space-y-4">
          {loadingMine ? (
            <KitCardSkeletonGrid count={8} />
          ) : !pinnedKit && filteredMine.length === 0 ? (
            <EmptyState
              icon={<Library className="h-10 w-10" />}
              title={
                q || selectedTag || selectedColor
                  ? 'Nenhum kit encontrado'
                  : 'Você ainda não criou kits'
              }
              description={
                q || selectedTag || selectedColor
                  ? 'Tente ajustar os filtros ou a busca.'
                  : 'Comece montando o seu primeiro kit personalizado ou explore os templates do sistema.'
              }
              action={
                <div className="flex flex-wrap items-center justify-center gap-2">
                  <Button onClick={() => navigate('/montar-kit')} className="gap-2">
                    <Plus className="h-4 w-4" /> Montar kit
                  </Button>
                  <Button variant="outline" onClick={() => setTab('suggested')} className="gap-2">
                    <Sparkles className="h-4 w-4" /> Ver templates
                  </Button>
                </div>
              }
            />
          ) : (
            <>
              {pinnedKit && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Pin className="h-3.5 w-3.5 text-primary" />
                    <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                      Kit em destaque
                    </span>
                  </div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    <KitCard
                      key={pinnedKit.id}
                      variant="mine"
                      data={toCard(pinnedKit)}
                      onEdit={() => navigate(`/montar-kit?kit=${pinnedKit.id}`)}
                      onDuplicate={() => duplicateMutation.mutate(pinnedKit)}
                      onDelete={() => setDeleteId(pinnedKit.id)}
                      onToggleFavorite={() =>
                        favoriteMutation.mutate({ id: pinnedKit.id, value: !pinnedKit.is_favorite })
                      }
                      onTogglePin={() => togglePinned(pinnedKit.id, false)}
                    />
                  </div>
                </div>
              )}

              {filteredMine.length > 0 && (
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredMine.map((k) => (
                    <KitCard
                      key={k.id}
                      variant="mine"
                      data={toCard(k)}
                      onEdit={() => navigate(`/montar-kit?kit=${k.id}`)}
                      onDuplicate={() => duplicateMutation.mutate(k)}
                      onDelete={() => setDeleteId(k.id)}
                      onToggleFavorite={() =>
                        favoriteMutation.mutate({ id: k.id, value: !k.is_favorite })
                      }
                      onTogglePin={() => togglePinned(k.id, true)}
                    />
                  ))}
                </div>
              )}
            </>
          )}
        </TabsContent>

        {/* SUGGESTED */}
        <TabsContent value="suggested">
          {loadingTemplates ? (
            <KitCardSkeletonGrid count={8} />
          ) : filteredTpls.length === 0 ? (
            <EmptyState
              icon={<Sparkles className="h-10 w-10" />}
              title="Nenhum template encontrado"
              description="Tente outra busca ou aguarde novos templates do sistema."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredTpls.map((t) => (
                <KitCard
                  key={t.id}
                  variant="template"
                  data={tplToCard(t)}
                  isBusy={isCloning}
                  onUseTemplate={() => setPreviewTemplate(t)}
                />
              ))}
            </div>
          )}
        </TabsContent>

        {/* FAVORITES */}
        <TabsContent value="favorites">
          {filteredFavs.length === 0 ? (
            <EmptyState
              icon={<Star className="h-10 w-10" />}
              title="Sem favoritos ainda"
              description="Marque seus kits favoritos com a estrela para acessá-los rapidamente."
            />
          ) : (
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {filteredFavs.map((k) => (
                <KitCard
                  key={k.id}
                  variant="mine"
                  data={toCard(k)}
                  onEdit={() => navigate(`/montar-kit?kit=${k.id}`)}
                  onDuplicate={() => duplicateMutation.mutate(k)}
                  onDelete={() => setDeleteId(k.id)}
                  onToggleFavorite={() =>
                    favoriteMutation.mutate({ id: k.id, value: !k.is_favorite })
                  }
                  onTogglePin={() => togglePinned(k.id, !k.is_pinned)}
                />
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Preview template */}
      <KitTemplatePreviewDialog
        template={previewTemplate}
        allTemplates={templates}
        open={!!previewTemplate}
        onOpenChange={(o) => !o && setPreviewTemplate(null)}
        onClone={() => previewTemplate && handleClone(previewTemplate)}
        onSelectRelated={(t) => setPreviewTemplate(t)}
        isCloning={isCloning}
      />

      {/* Delete dialog */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir kit?</AlertDialogTitle>
            <AlertDialogDescription>Esta ação não pode ser desfeita.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="space-y-3 py-16 text-center">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-muted/60 text-muted-foreground">
          {icon}
        </div>
        <h3 className="font-display text-lg font-semibold">{title}</h3>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{description}</p>
        {action && <div className="pt-2">{action}</div>}
      </CardContent>
    </Card>
  );
}
