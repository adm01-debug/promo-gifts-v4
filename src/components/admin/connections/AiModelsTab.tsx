/**
 * AiModelsTab — aba "Models" da Zona AI Router em /admin/conexoes
 *
 * Lista todos os modelos cadastrados (gpt-5-mini, claude-sonnet-4-6, gemini-2.5-flash…)
 * com filtro por provider e busca livre. Permite editar custos, capabilities e
 * limites de tokens.
 *
 * SCHEMA REAL: model_id (não slug), max_input_tokens (não context_window).
 */

import { useMemo, useState } from 'react';
import { Plus, Pencil, Trash2, Brain, Search } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from '@/components/ui/select';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import {
  useAiProviders,
  useAiModels,
  useAiModelMutations,
  type AiModel,
  type ModelInput,
} from '@/hooks/intelligence';

/**
 * Capacidades canônicas usadas no router. Bate com a list em
 * supabase/functions/_shared/ai-router/index.ts (ground truth).
 */
const CAPABILITY_KEYS = [
  { key: 'chat', label: 'Chat' },
  { key: 'streaming', label: 'Streaming' },
  { key: 'tools', label: 'Tools' },
  { key: 'json_mode', label: 'JSON mode' },
  { key: 'vision_in', label: 'Visão (input)' },
  { key: 'image_out', label: 'Imagem (output)' },
  { key: 'audio_in', label: 'Áudio (input)' },
  { key: 'audio_out', label: 'Áudio (output)' },
] as const;

function emptyInput(providerId: string): ModelInput {
  return {
    provider_id: providerId,
    model_id: '',
    display_name: '',
    capabilities: { chat: true, streaming: true },
    cost_input_per_1m: 0,
    cost_output_per_1m: 0,
    cost_per_image: 0,
    max_input_tokens: null,
    max_output_tokens: null,
    is_active: true,
    metadata: {},
  };
}

function toInput(m: AiModel): ModelInput {
  return {
    provider_id: m.provider_id,
    model_id: m.model_id,
    display_name: m.display_name,
    capabilities: m.capabilities,
    cost_input_per_1m: m.cost_input_per_1m,
    cost_output_per_1m: m.cost_output_per_1m,
    cost_per_image: m.cost_per_image,
    max_input_tokens: m.max_input_tokens,
    max_output_tokens: m.max_output_tokens,
    is_active: m.is_active,
    metadata: m.metadata,
  };
}

export function AiModelsTab() {
  const { data: providers } = useAiProviders();
  const { data: models, isLoading, error } = useAiModels();
  const { createModel, updateModel, deleteModel } = useAiModelMutations();

  const [filterProvider, setFilterProvider] = useState<string>('all');
  const [search, setSearch] = useState('');

  const [editing, setEditing] = useState<{ mode: 'create' } | { mode: 'edit'; id: string } | null>(
    null,
  );
  const [form, setForm] = useState<ModelInput>(emptyInput(''));
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const all = models ?? [];
    return all.filter((m) => {
      if (filterProvider !== 'all' && m.provider_id !== filterProvider) return false;
      if (search) {
        const s = search.toLowerCase();
        if (!m.model_id.toLowerCase().includes(s) && !m.display_name.toLowerCase().includes(s))
          return false;
      }
      return true;
    });
  }, [models, filterProvider, search]);

  const openCreate = () => {
    const firstProvider = providers?.[0]?.id ?? '';
    setForm(emptyInput(firstProvider));
    setEditing({ mode: 'create' });
  };
  const openEdit = (m: AiModel) => {
    setForm(toInput(m));
    setEditing({ mode: 'edit', id: m.id });
  };
  const close = () => setEditing(null);

  const submit = async () => {
    if (!editing) return;
    if (editing.mode === 'create') {
      await createModel.mutateAsync(form);
    } else {
      await updateModel.mutateAsync({ id: editing.id, ...form });
    }
    close();
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    await deleteModel.mutateAsync(deletingId);
    setDeletingId(null);
  };

  const toggleCapability = (key: string, value: boolean) => {
    setForm((prev) => ({ ...prev, capabilities: { ...prev.capabilities, [key]: value } }));
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Modelos</CardTitle>
                <CardDescription>
                  Modelos disponíveis em cada provider, com custos e capacidades.
                </CardDescription>
              </div>
            </div>
            <Button
              size="sm"
              onClick={openCreate}
              disabled={!providers || providers.length === 0}
              className="shrink-0"
            >
              <Plus className="mr-1 h-4 w-4" /> Novo modelo
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Select value={filterProvider} onValueChange={setFilterProvider}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Provider" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos providers</SelectItem>
                {(providers ?? []).map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <div className="relative min-w-[200px] flex-1">
              <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                className="pl-8"
                placeholder="Buscar model_id ou nome…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
            <span className="ml-auto text-xs text-muted-foreground">
              {filtered.length} de {models?.length ?? 0}
            </span>
          </div>

          {isLoading && <p className="text-sm text-muted-foreground">Carregando modelos…</p>}
          {error && <p className="text-sm text-destructive">Erro ao carregar: {String(error)}</p>}
          {!isLoading && filtered.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum modelo encontrado.</p>
          )}

          <div className="divide-y divide-border/50">
            {filtered.map((m) => {
              const caps = Object.entries(m.capabilities)
                .filter(([, v]) => v)
                .map(([k]) => k);
              return (
                <div key={m.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{m.display_name}</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{m.model_id}</code>
                      {!m.is_active && (
                        <Badge variant="outline" className="text-xs">
                          inativo
                        </Badge>
                      )}
                      {m.provider && (
                        <Badge variant="secondary" className="text-xs">
                          {m.provider.display_name}
                        </Badge>
                      )}
                    </div>
                    <div className="mt-0.5 text-xs text-muted-foreground">
                      {(m.cost_input_per_1m > 0 || m.cost_output_per_1m > 0) && (
                        <>
                          ${m.cost_input_per_1m}/M in · ${m.cost_output_per_1m}/M out
                        </>
                      )}
                      {m.cost_per_image > 0 && <> · ${m.cost_per_image}/imagem</>}
                      {m.max_input_tokens && <> · ctx in {m.max_input_tokens.toLocaleString()}</>}
                      {m.max_output_tokens && (
                        <> · max out {m.max_output_tokens.toLocaleString()}</>
                      )}
                    </div>
                    {caps.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {caps.map((c) => (
                          <Badge key={c} variant="outline" className="h-4 py-0 text-[10px]">
                            {c}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={m.is_active}
                      onCheckedChange={(v) => updateModel.mutate({ id: m.id, is_active: v })}
                      aria-label={m.is_active ? 'Desativar modelo' : 'Ativar modelo'}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(m)}
                      aria-label="Editar modelo"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeletingId(m.id)}
                      aria-label="Excluir modelo"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>

      <Dialog open={!!editing} onOpenChange={(o) => !o && close()}>
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editing?.mode === 'create' ? 'Novo modelo' : 'Editar modelo'}
            </DialogTitle>
            <DialogDescription>
              Custos são usados no log de uso (ai_usage_logs). Capacidades determinam quais modelos
              podem servir cada função (filtragem por required_capabilities).
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="mod-provider">Provider</Label>
              <Select
                value={form.provider_id}
                onValueChange={(v) => setForm({ ...form, provider_id: v })}
              >
                <SelectTrigger id="mod-provider">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(providers ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.display_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="mod-id">Model ID</Label>
                <Input
                  id="mod-id"
                  value={form.model_id}
                  onChange={(e) => setForm({ ...form, model_id: e.target.value })}
                  placeholder="gpt-5-mini"
                />
                <p className="text-[10px] text-muted-foreground">ID exato do modelo no provider.</p>
              </div>
              <div className="space-y-1">
                <Label htmlFor="mod-name">Nome de exibição</Label>
                <Input
                  id="mod-name"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  placeholder="GPT-5 mini"
                />
              </div>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="mod-ci">$/M tokens (input)</Label>
                <Input
                  id="mod-ci"
                  type="number"
                  step="0.01"
                  value={form.cost_input_per_1m}
                  onChange={(e) =>
                    setForm({ ...form, cost_input_per_1m: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mod-co">$/M tokens (output)</Label>
                <Input
                  id="mod-co"
                  type="number"
                  step="0.01"
                  value={form.cost_output_per_1m}
                  onChange={(e) =>
                    setForm({ ...form, cost_output_per_1m: Number(e.target.value) || 0 })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mod-cimg">$/imagem</Label>
                <Input
                  id="mod-cimg"
                  type="number"
                  step="0.001"
                  value={form.cost_per_image}
                  onChange={(e) =>
                    setForm({ ...form, cost_per_image: Number(e.target.value) || 0 })
                  }
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="mod-mit">Max input tokens</Label>
                <Input
                  id="mod-mit"
                  type="number"
                  value={form.max_input_tokens ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      max_input_tokens: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="mod-mot">Max output tokens</Label>
                <Input
                  id="mod-mot"
                  type="number"
                  value={form.max_output_tokens ?? ''}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      max_output_tokens: e.target.value === '' ? null : Number(e.target.value),
                    })
                  }
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label>Capacidades</Label>
              <div className="grid grid-cols-2 gap-2 rounded border bg-muted/30 p-3">
                {CAPABILITY_KEYS.map((c) => (
                  <label key={c.key} className="flex cursor-pointer items-center gap-2 text-sm">
                    <Checkbox
                      checked={!!form.capabilities[c.key]}
                      onCheckedChange={(v) => toggleCapability(c.key, v === true)}
                    />
                    <span>{c.label}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>Ativo</Label>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={
                !form.provider_id ||
                !form.model_id ||
                !form.display_name ||
                createModel.isPending ||
                updateModel.isPending
              }
            >
              {editing?.mode === 'create' ? 'Criar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={!!deletingId}
        onOpenChange={(o) => !o && setDeletingId(null)}
        variant="destructive"
        title="Excluir modelo?"
        description="Roteamentos que usam este modelo como primário serão quebrados (FK ON DELETE RESTRICT). Verifique antes de continuar."
        confirmLabel="Excluir"
        cancelLabel="Cancelar"
        onConfirm={confirmDelete}
        testId="ai-model-delete"
      />
    </div>
  );
}
