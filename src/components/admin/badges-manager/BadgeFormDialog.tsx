/**
 * Diálogo de criação/edição de uma badge.
 * - Edição: badge_key é imutável (somente leitura); is_system é protegido.
 * - Criação: badge_key editável (formato a-z0-9_), is_system = false.
 */
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { cn } from '@/lib/utils';
import type { Json } from '@/integrations/supabase/types';
import { BadgePreview } from './BadgePreview';
import {
  BADGE_CATEGORIES,
  CATEGORY_LABELS,
  COLOR_TOKENS,
  COLOR_TOKEN_CLASSES,
  ICON_OPTIONS,
  PLACEMENTS,
  PLACEMENT_LABELS,
  resolveBadgeIcon,
  SOURCE_KINDS,
  SOURCE_KIND_LABELS,
  SURFACES,
  SURFACE_LABELS,
  type BadgeDefinition,
} from './types';

export interface BadgeFormValues {
  badge_key: string;
  name: string;
  short_label: string | null;
  description: string;
  business_rule: string;
  category: string;
  source_kind: string;
  data_source: string;
  color_token: string;
  icon_lucide: string | null;
  icon_emoji: string | null;
  placements: string[];
  surfaces: string[];
  priority: number;
  sort_order: number;
  supports_expiration: boolean;
  is_enabled: boolean;
  notes: string;
  config: Json;
}

interface DraftState {
  badge_key: string;
  name: string;
  short_label: string;
  description: string;
  business_rule: string;
  category: string;
  source_kind: string;
  data_source: string;
  color_token: string;
  icon_lucide: string;
  icon_emoji: string;
  placements: string[];
  surfaces: string[];
  priority: number;
  sort_order: number;
  supports_expiration: boolean;
  is_enabled: boolean;
  notes: string;
  config: string;
}

const EMPTY_DRAFT: DraftState = {
  badge_key: '',
  name: '',
  short_label: '',
  description: '',
  business_rule: '',
  category: 'atributo',
  source_kind: 'computed',
  data_source: '',
  color_token: 'neutral',
  icon_lucide: 'Tag',
  icon_emoji: '',
  placements: ['card_body'],
  surfaces: ['catalog'],
  priority: 50,
  sort_order: 500,
  supports_expiration: false,
  is_enabled: true,
  notes: '',
  config: '{}',
};

function toDraft(badge: BadgeDefinition): DraftState {
  return {
    badge_key: badge.badge_key,
    name: badge.name,
    short_label: badge.short_label ?? '',
    description: badge.description,
    business_rule: badge.business_rule,
    category: badge.category,
    source_kind: badge.source_kind,
    data_source: badge.data_source,
    color_token: badge.color_token,
    icon_lucide: badge.icon_lucide ?? '',
    icon_emoji: badge.icon_emoji ?? '',
    placements: [...badge.placements],
    surfaces: [...badge.surfaces],
    priority: badge.priority,
    sort_order: badge.sort_order,
    supports_expiration: badge.supports_expiration,
    is_enabled: badge.is_enabled,
    notes: badge.notes,
    config: JSON.stringify(badge.config ?? {}, null, 2),
  };
}

interface BadgeFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Badge em edição; null = criação. */
  badge: BadgeDefinition | null;
  saving: boolean;
  onSave: (values: BadgeFormValues) => void;
}

const KEY_RE = /^[a-z][a-z0-9_]*$/;

export function BadgeFormDialog({
  open,
  onOpenChange,
  badge,
  saving,
  onSave,
}: BadgeFormDialogProps) {
  const isEdit = badge !== null;
  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);

  useEffect(() => {
    if (open) setDraft(badge ? toDraft(badge) : EMPTY_DRAFT);
  }, [open, badge]);

  const toggleInArray = (key: 'placements' | 'surfaces', value: string) => {
    setDraft((d) => {
      const has = d[key].includes(value);
      return { ...d, [key]: has ? d[key].filter((v) => v !== value) : [...d[key], value] };
    });
  };

  const handleSave = () => {
    if (!draft.name.trim()) {
      toast.error('Nome obrigatório', { description: 'Informe o nome da badge.' });
      return;
    }
    if (!isEdit && !KEY_RE.test(draft.badge_key)) {
      toast.error('Chave inválida', {
        description: 'Use apenas letras minúsculas, números e _ (iniciando por letra).',
      });
      return;
    }
    let parsedConfig: Json;
    try {
      parsedConfig = JSON.parse(draft.config || '{}') as Json;
    } catch {
      toast.error('Config inválido', { description: 'O campo Config deve ser um JSON válido.' });
      return;
    }
    if (draft.placements.length === 0) {
      toast.error('Posicionamento obrigatório', {
        description: 'Selecione ao menos um local de exibição.',
      });
      return;
    }
    onSave({
      badge_key: draft.badge_key.trim(),
      name: draft.name.trim(),
      short_label: draft.short_label.trim() || null,
      description: draft.description.trim(),
      business_rule: draft.business_rule.trim(),
      category: draft.category,
      source_kind: draft.source_kind,
      data_source: draft.data_source.trim(),
      color_token: draft.color_token,
      icon_lucide: draft.icon_lucide.trim() || null,
      icon_emoji: draft.icon_emoji.trim() || null,
      placements: draft.placements,
      surfaces: draft.surfaces,
      priority: Number.isFinite(draft.priority) ? draft.priority : 50,
      sort_order: Number.isFinite(draft.sort_order) ? draft.sort_order : 500,
      supports_expiration: draft.supports_expiration,
      is_enabled: draft.is_enabled,
      notes: draft.notes.trim(),
      config: parsedConfig,
    });
  };

  const IconPreview = resolveBadgeIcon(draft.icon_lucide);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-2xl overflow-hidden p-0">
        <DialogHeader className="border-b px-6 py-4">
          <DialogTitle>{isEdit ? 'Editar badge' : 'Nova badge'}</DialogTitle>
          <DialogDescription>
            {isEdit
              ? 'Ajuste nome, cores, ícone, posicionamento e regras desta badge.'
              : 'Cadastre uma nova badge de produto com suas regras e aparência.'}
          </DialogDescription>
        </DialogHeader>

        <ScrollArea className="max-h-[64vh]">
          <div className="space-y-6 px-6 py-5">
            {/* Preview */}
            <div className="flex items-center gap-3 rounded-lg border bg-muted/30 p-3">
              <span className="text-xs font-medium text-muted-foreground">Pré-visualização:</span>
              <BadgePreview
                badge={{
                  name: draft.name || 'Badge',
                  short_label: draft.short_label || null,
                  color_token: draft.color_token,
                  icon_lucide: draft.icon_lucide || null,
                  icon_emoji: draft.icon_emoji || null,
                  is_enabled: draft.is_enabled,
                }}
              />
            </div>

            {/* Identidade */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Identidade</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="bf-key">Chave (slug)</Label>
                  <Input
                    id="bf-key"
                    value={draft.badge_key}
                    disabled={isEdit}
                    placeholder="ex: minha_badge"
                    onChange={(e) => setDraft((d) => ({ ...d, badge_key: e.target.value }))}
                  />
                  {isEdit ? (
                    <p className="text-xs text-muted-foreground">A chave é imutável.</p>
                  ) : null}
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bf-name">Nome</Label>
                  <Input
                    id="bf-name"
                    value={draft.name}
                    onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bf-short">Rótulo curto</Label>
                  <Input
                    id="bf-short"
                    value={draft.short_label}
                    placeholder="opcional"
                    onChange={(e) => setDraft((d) => ({ ...d, short_label: e.target.value }))}
                  />
                </div>
              </div>
            </section>

            {/* Aparência */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Aparência</h4>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label htmlFor="bf-color">Cor</Label>
                  <Select
                    value={draft.color_token}
                    onValueChange={(v) => setDraft((d) => ({ ...d, color_token: v }))}
                  >
                    <SelectTrigger id="bf-color">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {COLOR_TOKENS.map((t) => (
                        <SelectItem key={t} value={t}>
                          <span className="flex items-center gap-2">
                            <span
                              className={cn('h-3 w-3 rounded-full', COLOR_TOKEN_CLASSES[t]?.dot)}
                            />
                            {t}
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bf-icon">Ícone</Label>
                  <Select
                    value={draft.icon_lucide}
                    onValueChange={(v) => setDraft((d) => ({ ...d, icon_lucide: v }))}
                  >
                    <SelectTrigger id="bf-icon">
                      <span className="flex items-center gap-2">
                        <IconPreview className="h-4 w-4" aria-hidden />
                        <span className="truncate">{draft.icon_lucide || 'Selecionar'}</span>
                      </span>
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {ICON_OPTIONS.map((name) => {
                        const Ic = resolveBadgeIcon(name);
                        return (
                          <SelectItem key={name} value={name}>
                            <span className="flex items-center gap-2">
                              <Ic className="h-4 w-4" aria-hidden />
                              {name}
                            </span>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bf-emoji">Emoji</Label>
                  <Input
                    id="bf-emoji"
                    value={draft.icon_emoji}
                    placeholder="opcional"
                    onChange={(e) => setDraft((d) => ({ ...d, icon_emoji: e.target.value }))}
                  />
                </div>
              </div>
            </section>

            {/* Classificação */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Classificação</h4>
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="bf-cat">Categoria</Label>
                  <Select
                    value={draft.category}
                    onValueChange={(v) => setDraft((d) => ({ ...d, category: v }))}
                  >
                    <SelectTrigger id="bf-cat">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BADGE_CATEGORIES.map((c) => (
                        <SelectItem key={c} value={c}>
                          {CATEGORY_LABELS[c] ?? c}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bf-src">Origem do dado</Label>
                  <Select
                    value={draft.source_kind}
                    onValueChange={(v) => setDraft((d) => ({ ...d, source_kind: v }))}
                  >
                    <SelectTrigger id="bf-src">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {SOURCE_KINDS.map((s) => (
                        <SelectItem key={s} value={s}>
                          {SOURCE_KIND_LABELS[s] ?? s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bf-prio">Prioridade (maior = mais proeminente)</Label>
                  <Input
                    id="bf-prio"
                    type="number"
                    value={draft.priority}
                    onChange={(e) => setDraft((d) => ({ ...d, priority: Number(e.target.value) }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="bf-sort">Ordem de exibição</Label>
                  <Input
                    id="bf-sort"
                    type="number"
                    value={draft.sort_order}
                    onChange={(e) =>
                      setDraft((d) => ({ ...d, sort_order: Number(e.target.value) }))
                    }
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-6 pt-1">
                <label className="flex items-center gap-2 text-sm" htmlFor="bf-exp">
                  <Switch
                    id="bf-exp"
                    checked={draft.supports_expiration}
                    onCheckedChange={(v) => setDraft((d) => ({ ...d, supports_expiration: v }))}
                  />
                  Suporta expiração
                </label>
                <label className="flex items-center gap-2 text-sm" htmlFor="bf-enabled">
                  <Switch
                    id="bf-enabled"
                    checked={draft.is_enabled}
                    onCheckedChange={(v) => setDraft((d) => ({ ...d, is_enabled: v }))}
                  />
                  Habilitada
                </label>
              </div>
            </section>

            {/* Uso */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Onde e como é usada</h4>
              <div className="space-y-2">
                <Label>Posicionamento no card</Label>
                <div className="flex flex-wrap gap-1.5">
                  {PLACEMENTS.map((p) => {
                    const active = draft.placements.includes(p);
                    return (
                      <button
                        key={p}
                        type="button"
                        onClick={() => toggleInArray('placements', p)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs transition-colors',
                          active
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {PLACEMENT_LABELS[p] ?? p}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-2">
                <Label>Telas (surfaces)</Label>
                <div className="flex flex-wrap gap-1.5">
                  {SURFACES.map((s) => {
                    const active = draft.surfaces.includes(s);
                    return (
                      <button
                        key={s}
                        type="button"
                        onClick={() => toggleInArray('surfaces', s)}
                        className={cn(
                          'rounded-full border px-2.5 py-1 text-xs transition-colors',
                          active
                            ? 'border-primary bg-primary/10 text-primary'
                            : 'border-border text-muted-foreground hover:bg-muted',
                        )}
                      >
                        {SURFACE_LABELS[s] ?? s}
                      </button>
                    );
                  })}
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bf-data">Fonte de dados (coluna/view/MV)</Label>
                <Input
                  id="bf-data"
                  value={draft.data_source}
                  placeholder="ex: products.is_featured"
                  onChange={(e) => setDraft((d) => ({ ...d, data_source: e.target.value }))}
                />
              </div>
            </section>

            {/* Documentação */}
            <section className="space-y-3">
              <h4 className="text-sm font-semibold">Documentação e regras</h4>
              <div className="space-y-1.5">
                <Label htmlFor="bf-desc">Descrição</Label>
                <Textarea
                  id="bf-desc"
                  rows={2}
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bf-rule">Regra de negócio</Label>
                <Textarea
                  id="bf-rule"
                  rows={2}
                  value={draft.business_rule}
                  onChange={(e) => setDraft((d) => ({ ...d, business_rule: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bf-config">Config (JSON)</Label>
                <Textarea
                  id="bf-config"
                  rows={4}
                  className="font-mono text-xs"
                  value={draft.config}
                  onChange={(e) => setDraft((d) => ({ ...d, config: e.target.value }))}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="bf-notes">Notas internas</Label>
                <Textarea
                  id="bf-notes"
                  rows={2}
                  value={draft.notes}
                  onChange={(e) => setDraft((d) => ({ ...d, notes: e.target.value }))}
                />
              </div>
            </section>
          </div>
        </ScrollArea>

        <DialogFooter className="border-t px-6 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)} disabled={saving}>
            Cancelar
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {isEdit ? 'Salvar alterações' : 'Criar badge'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
