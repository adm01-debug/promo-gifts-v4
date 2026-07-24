/**
 * Orquestrador do módulo de Gestão de Badges (aba "Badges" em Cadastros).
 * Registro canônico de TODAS as badges de produto: nome, cores, ícone,
 * onde/como são usadas, regra de negócio, prioridade e configuração.
 */
import { useMemo, useState } from 'react';
import { Loader2, Plus, Search, Tags } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { useBadgesManager } from './useBadgesManager';
import { BadgeTable } from './BadgeTable';
import { BadgeFormDialog, type BadgeFormValues } from './BadgeFormDialog';
import {
  BADGE_CATEGORIES,
  CATEGORY_LABELS,
  SOURCE_KINDS,
  SOURCE_KIND_LABELS,
  type BadgeDefinition,
  type BadgeDefinitionInsert,
} from './types';

type StatusFilter = 'all' | 'disabled' | 'enabled';

function buildWritePayload(
  values: BadgeFormValues,
): Omit<BadgeDefinitionInsert, 'badge_key' | 'is_system'> {
  return {
    name: values.name,
    short_label: values.short_label,
    description: values.description,
    business_rule: values.business_rule,
    category: values.category,
    source_kind: values.source_kind,
    data_source: values.data_source,
    color_token: values.color_token,
    icon_lucide: values.icon_lucide,
    icon_emoji: values.icon_emoji,
    placements: values.placements,
    surfaces: values.surfaces,
    priority: values.priority,
    sort_order: values.sort_order,
    supports_expiration: values.supports_expiration,
    is_enabled: values.is_enabled,
    notes: values.notes,
    config: values.config,
  };
}

function StatTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card px-4 py-3">
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

export function BadgesManager() {
  const { badges, isLoading, isError, updateBadge, toggleBadge, createBadge, deleteBadge } =
    useBadgesManager();

  const [search, setSearch] = useState('');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sourceFilter, setSourceFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBadge, setEditingBadge] = useState<BadgeDefinition | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<BadgeDefinition | null>(null);

  const stats = useMemo(() => {
    const total = badges.length;
    const enabled = badges.filter((b) => b.is_enabled).length;
    const custom = badges.filter((b) => !b.is_system).length;
    const categories = new Set(badges.map((b) => b.category)).size;
    return { total, enabled, custom, categories };
  }, [badges]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return badges.filter((b) => {
      if (categoryFilter !== 'all' && b.category !== categoryFilter) return false;
      if (sourceFilter !== 'all' && b.source_kind !== sourceFilter) return false;
      if (statusFilter === 'enabled' && !b.is_enabled) return false;
      if (statusFilter === 'disabled' && b.is_enabled) return false;
      if (q) {
        const haystack = [b.badge_key, b.name, b.short_label ?? '', b.description, b.data_source]
          .join(' ')
          .toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      return true;
    });
  }, [badges, search, categoryFilter, sourceFilter, statusFilter]);

  const openCreate = () => {
    setEditingBadge(null);
    setDialogOpen(true);
  };

  const openEdit = (badge: BadgeDefinition) => {
    setEditingBadge(badge);
    setDialogOpen(true);
  };

  const handleSave = (values: BadgeFormValues) => {
    const payload = buildWritePayload(values);
    if (editingBadge) {
      updateBadge.mutate(
        { id: editingBadge.id, patch: payload },
        { onSuccess: () => setDialogOpen(false) },
      );
    } else {
      const insert: BadgeDefinitionInsert = { ...payload, badge_key: values.badge_key };
      createBadge.mutate(insert, { onSuccess: () => setDialogOpen(false) });
    }
  };

  const confirmDelete = () => {
    if (!deleteTarget) return;
    deleteBadge.mutate(deleteTarget.id, { onSuccess: () => setDeleteTarget(null) });
  };

  const saving = updateBadge.isPending || createBadge.isPending;
  const busy = toggleBadge.isPending || deleteBadge.isPending;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="rounded-lg bg-primary/10 p-2 text-primary">
            <Tags className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-lg font-semibold">Badges de produto</h2>
            <p className="text-sm text-muted-foreground">
              Cadastro central de cores, ícones, posicionamento e regras de todas as badges.
            </p>
          </div>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-1.5 h-4 w-4" />
          Nova badge
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Total" value={stats.total} />
        <StatTile label="Ativas" value={stats.enabled} />
        <StatTile label="Customizadas" value={stats.custom} />
        <StatTile label="Categorias" value={stats.categories} />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome, chave, descrição..."
            className="pl-8"
          />
        </div>
        <Select value={categoryFilter} onValueChange={setCategoryFilter}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as categorias</SelectItem>
            {BADGE_CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c] ?? c}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={sourceFilter} onValueChange={setSourceFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Origem" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as origens</SelectItem>
            {SOURCE_KINDS.map((s) => (
              <SelectItem key={s} value={s}>
                {SOURCE_KIND_LABELS[s] ?? s}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as StatusFilter)}>
          <SelectTrigger className="w-[140px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="enabled">Ativas</SelectItem>
            <SelectItem value="disabled">Inativas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" />
          Carregando badges...
        </div>
      ) : isError ? (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 py-12 text-center text-sm text-destructive">
          Não foi possível carregar as badges. Tente novamente.
        </div>
      ) : (
        <BadgeTable
          badges={filtered}
          onEdit={openEdit}
          onToggle={(badge, enabled) => toggleBadge.mutate({ id: badge.id, enabled })}
          onDelete={(badge) => setDeleteTarget(badge)}
          busy={busy}
        />
      )}

      <BadgeFormDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        badge={editingBadge}
        saving={saving}
        onSave={handleSave}
      />

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        variant="destructive"
        title="Excluir badge?"
        description={
          deleteTarget
            ? `A badge "${deleteTarget.name}" será removida permanentemente. Esta ação não pode ser desfeita.`
            : ''
        }
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={confirmDelete}
        loading={deleteBadge.isPending}
        testId="badges-delete-dialog"
      />
    </div>
  );
}
