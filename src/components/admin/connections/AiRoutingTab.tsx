/**
 * AiRoutingTab — aba "Routing" da Zona AI Router em /admin/conexoes
 *
 * Lista o roteamento por function_name (expert-chat, generate-mockup, ai-search…)
 * com primary_model + cadeia de fallbacks ordenados. Mostra capacidades
 * requeridas e badges de provider em cada modelo.
 *
 * SCHEMA REAL: required_capabilities é Record<string,boolean> (jsonb), não array.
 * UI usa array internamente (mais natural pra tag-list); converte no save.
 */

import { useState, useMemo } from 'react';
import { Plus, Pencil, Trash2, ArrowUp, ArrowDown, X, Brain, ListOrdered } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
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
import {
  useAiModels,
  useAiRouting,
  useAiRoutingMutations,
  capabilitiesToArray,
  capabilitiesFromArray,
  type AiFunctionRouting,
  type RoutingInput,
} from '@/hooks/intelligence';

const KNOWN_CAPABILITIES = [
  'chat',
  'streaming',
  'tools',
  'json_mode',
  'vision_in',
  'image_out',
  'audio_in',
  'audio_out',
];

/**
 * Form interno usa array de strings (mais ergonômico para tag-list).
 * Converte para/de Record<string,boolean> ao ler/gravar no banco.
 */
interface RoutingFormState {
  function_name: string;
  primary_model_id: string;
  fallback_model_ids: string[];
  required_capabilities: string[]; // ← array no form, jsonb no banco
  request_overrides: Record<string, unknown>;
  is_active: boolean;
  notes: string | null;
}

const EMPTY_FORM: RoutingFormState = {
  function_name: '',
  primary_model_id: '',
  fallback_model_ids: [],
  required_capabilities: ['chat'],
  request_overrides: {},
  is_active: true,
  notes: null,
};

function rowToForm(r: AiFunctionRouting): RoutingFormState {
  return {
    function_name: r.function_name,
    primary_model_id: r.primary_model_id,
    fallback_model_ids: [...r.fallback_model_ids],
    required_capabilities: capabilitiesToArray(r.required_capabilities),
    request_overrides: r.request_overrides,
    is_active: r.is_active,
    notes: r.notes,
  };
}

function formToInput(f: RoutingFormState): RoutingInput {
  return {
    function_name: f.function_name,
    primary_model_id: f.primary_model_id,
    fallback_model_ids: f.fallback_model_ids,
    required_capabilities: capabilitiesFromArray(f.required_capabilities),
    request_overrides: f.request_overrides,
    is_active: f.is_active,
    notes: f.notes,
    updated_by: null, // será setado pelo trigger no banco se houver
  };
}

export function AiRoutingTab() {
  const { data: models } = useAiModels();
  const { data: routings, isLoading, error } = useAiRouting();
  const { createRouting, updateRouting, deleteRouting } = useAiRoutingMutations();

  const [editing, setEditing] = useState<{ mode: 'create' } | { mode: 'edit'; id: string } | null>(
    null,
  );
  const [form, setForm] = useState<RoutingFormState>(EMPTY_FORM);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [pendingFallback, setPendingFallback] = useState<string>('');
  const [pendingCapability, setPendingCapability] = useState<string>('');

  const modelById = useMemo(() => new Map((models ?? []).map((m) => [m.id, m])), [models]);

  const openCreate = () => {
    setForm({ ...EMPTY_FORM, fallback_model_ids: [], required_capabilities: ['chat'] });
    setEditing({ mode: 'create' });
  };
  const openEdit = (r: AiFunctionRouting) => {
    setForm(rowToForm(r));
    setEditing({ mode: 'edit', id: r.id });
  };
  const close = () => {
    setEditing(null);
    setPendingFallback('');
    setPendingCapability('');
  };

  const submit = async () => {
    if (!editing) return;
    const input = formToInput(form);
    if (editing.mode === 'create') {
      await createRouting.mutateAsync(input);
    } else {
      // updateRouting espera Partial<AiFunctionRouting> & { id }, mas formToInput
      // já produz a forma jsonb correta para required_capabilities.
      await updateRouting.mutateAsync({ id: editing.id, ...input });
    }
    close();
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    await deleteRouting.mutateAsync(deletingId);
    setDeletingId(null);
  };

  const addFallback = () => {
    if (!pendingFallback) return;
    if (form.fallback_model_ids.includes(pendingFallback)) return;
    if (pendingFallback === form.primary_model_id) return;
    setForm({ ...form, fallback_model_ids: [...form.fallback_model_ids, pendingFallback] });
    setPendingFallback('');
  };
  const removeFallback = (idx: number) => {
    const next = form.fallback_model_ids.filter((_, i) => i !== idx);
    setForm({ ...form, fallback_model_ids: next });
  };
  const moveFallback = (idx: number, dir: -1 | 1) => {
    const next = [...form.fallback_model_ids];
    const target = idx + dir;
    if (target < 0 || target >= next.length) return;
    [next[idx], next[target]] = [next[target], next[idx]];
    setForm({ ...form, fallback_model_ids: next });
  };

  const addCapability = () => {
    if (!pendingCapability) return;
    if (form.required_capabilities.includes(pendingCapability)) return;
    setForm({ ...form, required_capabilities: [...form.required_capabilities, pendingCapability] });
    setPendingCapability('');
  };
  const removeCapability = (cap: string) => {
    setForm({
      ...form,
      required_capabilities: form.required_capabilities.filter((c) => c !== cap),
    });
  };

  const renderModelRef = (id: string) => {
    const m = modelById.get(id);
    if (!m) return <code className="text-xs">{id.slice(0, 8)}…</code>;
    return (
      <span className="inline-flex items-center gap-1">
        <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{m.model_id}</code>
        {m.provider && (
          <Badge variant="outline" className="h-4 py-0 text-[10px]">
            {m.provider.display_name}
          </Badge>
        )}
      </span>
    );
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <ListOrdered className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Roteamento por função</CardTitle>
                <CardDescription>
                  Cada edge function aponta para 1 modelo primário + cadeia de fallbacks.
                  Capacidades requeridas filtram quais modelos qualificam.
                </CardDescription>
              </div>
            </div>
            <Button
              size="sm"
              onClick={openCreate}
              disabled={!models || models.length === 0}
              className="shrink-0"
            >
              <Plus className="mr-1 h-4 w-4" /> Novo roteamento
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando roteamentos…</p>}
          {error && <p className="text-sm text-destructive">Erro ao carregar: {String(error)}</p>}
          {!isLoading && routings && routings.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum roteamento cadastrado.</p>
          )}

          <div className="divide-y divide-border/50">
            {(routings ?? []).map((r) => {
              const reqCaps = capabilitiesToArray(r.required_capabilities);
              return (
                <div key={r.id} className="flex items-start gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <code className="rounded bg-muted px-2 py-0.5 text-sm font-medium">
                        {r.function_name}
                      </code>
                      {!r.is_active && (
                        <Badge variant="outline" className="text-xs">
                          inativo
                        </Badge>
                      )}
                    </div>
                    <div className="mt-1.5 space-y-1 text-xs">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <Brain className="h-3 w-3 text-primary" />
                        <span className="text-muted-foreground">primário:</span>
                        {renderModelRef(r.primary_model_id)}
                      </div>
                      {r.fallback_model_ids.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-muted-foreground">fallbacks:</span>
                          {r.fallback_model_ids.map((id, i) => (
                            <span key={id} className="inline-flex items-center gap-1">
                              {i > 0 && <span className="text-muted-foreground">→</span>}
                              {renderModelRef(id)}
                            </span>
                          ))}
                        </div>
                      )}
                      {reqCaps.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1.5">
                          <span className="text-muted-foreground">requer:</span>
                          {reqCaps.map((c) => (
                            <Badge key={c} variant="outline" className="h-4 py-0 text-[10px]">
                              {c}
                            </Badge>
                          ))}
                        </div>
                      )}
                      {r.notes && <p className="italic text-muted-foreground">{r.notes}</p>}
                    </div>
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={r.is_active}
                      onCheckedChange={(v) => updateRouting.mutate({ id: r.id, is_active: v })}
                      aria-label={r.is_active ? 'Desativar roteamento' : 'Ativar roteamento'}
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(r)}
                      aria-label="Editar roteamento"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeletingId(r.id)}
                      aria-label="Excluir roteamento"
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
              {editing?.mode === 'create' ? 'Novo roteamento' : 'Editar roteamento'}
            </DialogTitle>
            <DialogDescription>
              O modelo primário é tentado primeiro. Se falhar (timeout, erro retentativável, cota),
              o router percorre os fallbacks na ordem.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="space-y-1">
              <Label htmlFor="rt-fn">Function name</Label>
              <Input
                id="rt-fn"
                value={form.function_name}
                onChange={(e) => setForm({ ...form, function_name: e.target.value })}
                placeholder="expert-chat"
              />
              <p className="text-xs text-muted-foreground">
                Nome exato da edge function (ex: expert-chat, generate-mockup).
              </p>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rt-primary">Modelo primário</Label>
              <Select
                value={form.primary_model_id}
                onValueChange={(v) => setForm({ ...form, primary_model_id: v })}
              >
                <SelectTrigger id="rt-primary">
                  <SelectValue placeholder="Selecione um modelo" />
                </SelectTrigger>
                <SelectContent>
                  {(models ?? [])
                    .filter((m) => m.is_active)
                    .map((m) => (
                      <SelectItem key={m.id} value={m.id}>
                        <div className="flex items-center gap-2">
                          <code className="text-xs">{m.model_id}</code>
                          {m.provider && (
                            <span className="text-xs text-muted-foreground">
                              ({m.provider.display_name})
                            </span>
                          )}
                        </div>
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label>Fallbacks (em ordem)</Label>
              <div className="flex gap-2">
                <Select value={pendingFallback} onValueChange={setPendingFallback}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Adicionar fallback…" />
                  </SelectTrigger>
                  <SelectContent>
                    {(models ?? [])
                      .filter(
                        (m) =>
                          m.is_active &&
                          m.id !== form.primary_model_id &&
                          !form.fallback_model_ids.includes(m.id),
                      )
                      .map((m) => (
                        <SelectItem key={m.id} value={m.id}>
                          <code className="text-xs">{m.model_id}</code>
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addFallback}
                  disabled={!pendingFallback}
                >
                  Adicionar
                </Button>
              </div>
              {form.fallback_model_ids.length > 0 && (
                <div className="mt-2 space-y-1">
                  {form.fallback_model_ids.map((id, idx) => {
                    const m = modelById.get(id);
                    return (
                      <div
                        key={id}
                        className="flex items-center gap-2 rounded border bg-muted/30 px-2 py-1"
                      >
                        <span className="w-6 font-mono text-xs text-muted-foreground">
                          {idx + 1}.
                        </span>
                        <code className="text-xs">{m?.model_id ?? `${id.slice(0, 8)}…`}</code>
                        {m?.provider && (
                          <Badge variant="outline" className="h-4 py-0 text-[10px]">
                            {m.provider.display_name}
                          </Badge>
                        )}
                        <div className="ml-auto flex items-center gap-0.5">
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            disabled={idx === 0}
                            onClick={() => moveFallback(idx, -1)}
                            aria-label="Mover para cima"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            disabled={idx === form.fallback_model_ids.length - 1}
                            onClick={() => moveFallback(idx, 1)}
                            aria-label="Mover para baixo"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            size="sm"
                            variant="ghost"
                            className="h-6 w-6 p-0"
                            onClick={() => removeFallback(idx)}
                            aria-label="Remover fallback"
                          >
                            <X className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label>Capacidades requeridas</Label>
              <div className="flex gap-2">
                <Select value={pendingCapability} onValueChange={setPendingCapability}>
                  <SelectTrigger className="flex-1">
                    <SelectValue placeholder="Adicionar capacidade…" />
                  </SelectTrigger>
                  <SelectContent>
                    {KNOWN_CAPABILITIES.filter((c) => !form.required_capabilities.includes(c)).map(
                      (c) => (
                        <SelectItem key={c} value={c}>
                          {c}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCapability}
                  disabled={!pendingCapability}
                >
                  Adicionar
                </Button>
              </div>
              {form.required_capabilities.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {form.required_capabilities.map((c) => (
                    <Badge key={c} variant="secondary" className="gap-1">
                      {c}
                      <button
                        type="button"
                        onClick={() => removeCapability(c)}
                        aria-label={`Remover ${c}`}
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>Ativo</Label>
            </div>
            <div className="space-y-1">
              <Label htmlFor="rt-notes">Notas</Label>
              <Textarea
                id="rt-notes"
                rows={2}
                value={form.notes ?? ''}
                onChange={(e) => setForm({ ...form, notes: e.target.value || null })}
                placeholder="Anotações sobre este roteamento"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={close}>
              Cancelar
            </Button>
            <Button
              onClick={submit}
              disabled={
                !form.function_name ||
                !form.primary_model_id ||
                createRouting.isPending ||
                updateRouting.isPending
              }
            >
              {editing?.mode === 'create' ? 'Criar' : 'Salvar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deletingId} onOpenChange={(o) => !o && setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir roteamento</AlertDialogTitle>
            <AlertDialogDescription>
              A function_name correspondente passará a usar fallback global no router (Lovable
              Gateway). Confirmar?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
