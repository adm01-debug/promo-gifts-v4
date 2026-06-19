/**
 * AiProvidersTab — aba "Providers" da Zona AI Router em /admin/conexoes
 *
 * Lista todos os providers cadastrados (OpenAI, Anthropic, Google, DeepSeek, Lovable…)
 * com botões para criar / editar / desativar / excluir. Mostra status do último
 * teste e botão quick-action para alternar is_active.
 *
 * SCHEMA REAL: api_format usa underscore. Notes/observações ficam em metadata.
 */

import { useState } from 'react';
import { Plus, Pencil, Trash2, CheckCircle, XCircle, AlertCircle, Brain } from 'lucide-react';
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
  useAiProviders,
  useAiProviderMutations,
  type AiProvider,
  type AiApiFormat,
  type ProviderInput,
} from '@/hooks/intelligence';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const API_FORMATS: Array<{ value: AiApiFormat; label: string; help: string }> = [
  {
    value: 'openai_compatible',
    label: 'OpenAI-compatible',
    help: 'OpenAI, DeepSeek, Lovable Gateway, Groq, OpenRouter',
  },
  {
    value: 'anthropic_native',
    label: 'Anthropic native',
    help: 'API direta da Anthropic (api.anthropic.com)',
  },
  {
    value: 'google_native',
    label: 'Google GenAI',
    help: 'generativelanguage.googleapis.com (Gemini)',
  },
  {
    value: 'custom',
    label: 'Custom',
    help: 'Provider proprietário; configurar auth_header/auth_format manualmente',
  },
];

const EMPTY_INPUT: ProviderInput = {
  slug: '',
  display_name: '',
  api_base_url: '',
  api_format: 'openai_compatible',
  auth_header: 'Authorization',
  auth_format: 'Bearer {key}',
  secret_name: '',
  is_active: true,
  priority: 100,
  timeout_ms: 30000,
  max_retries: 2,
  metadata: {},
};

function toInput(p: AiProvider): ProviderInput {
  return {
    slug: p.slug,
    display_name: p.display_name,
    api_base_url: p.api_base_url,
    api_format: p.api_format,
    auth_header: p.auth_header,
    auth_format: p.auth_format,
    secret_name: p.secret_name,
    is_active: p.is_active,
    priority: p.priority,
    timeout_ms: p.timeout_ms,
    max_retries: p.max_retries,
    metadata: p.metadata,
  };
}

/** Lê notes da metadata (campo de texto livre que sobreviveu ao schema real). */
function getNotes(metadata: Record<string, unknown>): string {
  return typeof metadata?.notes === 'string' ? metadata.notes : '';
}

/** Atualiza notes preservando o resto da metadata. */
function setNotes(metadata: Record<string, unknown>, notes: string): Record<string, unknown> {
  const next = { ...metadata };
  if (notes) next.notes = notes;
  else delete next.notes;
  return next;
}

export function AiProvidersTab() {
  const { data: providers, isLoading, error } = useAiProviders();
  const { createProvider, updateProvider, deleteProvider } = useAiProviderMutations();

  const [editing, setEditing] = useState<{ mode: 'create' } | { mode: 'edit'; id: string } | null>(
    null,
  );
  const [form, setForm] = useState<ProviderInput>(EMPTY_INPUT);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const openCreate = () => {
    setForm({ ...EMPTY_INPUT });
    setEditing({ mode: 'create' });
  };
  const openEdit = (p: AiProvider) => {
    setForm(toInput(p));
    setEditing({ mode: 'edit', id: p.id });
  };
  const close = () => setEditing(null);

  const submit = async () => {
    if (!editing) return;
    if (editing.mode === 'create') {
      await createProvider.mutateAsync(form);
    } else {
      await updateProvider.mutateAsync({ id: editing.id, ...form });
    }
    close();
  };

  const confirmDelete = async () => {
    if (!deletingId) return;
    await deleteProvider.mutateAsync(deletingId);
    setDeletingId(null);
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <Brain className="h-5 w-5 text-primary" />
              <div>
                <CardTitle>Providers</CardTitle>
                <CardDescription>
                  Provedores de IA cadastrados. O router escolhe entre eles para cada função.
                </CardDescription>
              </div>
            </div>
            <Button size="sm" onClick={openCreate} className="shrink-0">
              <Plus className="mr-1 h-4 w-4" /> Novo provider
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          {isLoading && <p className="text-sm text-muted-foreground">Carregando providers…</p>}
          {error && <p className="text-sm text-destructive">Erro ao carregar: {String(error)}</p>}
          {!isLoading && providers?.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum provider cadastrado.</p>
          )}
          <div className="divide-y divide-border/50">
            {(providers ?? []).map((p) => {
              const notes = getNotes(p.metadata);
              return (
                <div key={p.id} className="flex items-center gap-3 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium">{p.display_name}</span>
                      <code className="rounded bg-muted px-1.5 py-0.5 text-xs">{p.slug}</code>
                      {!p.is_active && (
                        <Badge variant="outline" className="text-xs">
                          inativo
                        </Badge>
                      )}
                      <Badge variant="secondary" className="text-xs">
                        {p.api_format}
                      </Badge>
                      {p.last_test_ok === true && (
                        <span className="inline-flex items-center gap-1 text-xs text-emerald-600">
                          <CheckCircle className="h-3 w-3" /> teste ok
                          {p.last_latency_ms !== null && <span>({p.last_latency_ms}ms)</span>}
                        </span>
                      )}
                      {p.last_test_ok === false && (
                        <span className="inline-flex items-center gap-1 text-xs text-destructive">
                          <XCircle className="h-3 w-3" /> teste falhou
                        </span>
                      )}
                      {p.last_test_ok === null && p.last_test_at === null && (
                        <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                          <AlertCircle className="h-3 w-3" /> nunca testado
                        </span>
                      )}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-muted-foreground">
                      {p.api_base_url}
                      {p.secret_name && (
                        <>
                          {' '}
                          · secret <code>{p.secret_name}</code>
                        </>
                      )}
                      {p.last_test_at && (
                        <>
                          {' '}
                          · testado{' '}
                          {formatDistanceToNow(new Date(p.last_test_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </>
                      )}
                    </div>
                    {p.last_test_message && p.last_test_ok === false && (
                      <p className="mt-0.5 text-xs text-destructive">{p.last_test_message}</p>
                    )}
                    {notes && (
                      <p className="mt-0.5 text-xs italic text-muted-foreground">{notes}</p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Switch
                      checked={p.is_active}
                      onCheckedChange={(v) => updateProvider.mutate({ id: p.id, is_active: v })}
                      aria-label={
                        p.is_active ? `Desativar ${p.display_name}` : `Ativar ${p.display_name}`
                      }
                    />
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => openEdit(p)}
                      aria-label="Editar provider"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setDeletingId(p.id)}
                      aria-label="Excluir provider"
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
        <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {editing?.mode === 'create' ? 'Novo provider' : 'Editar provider'}
            </DialogTitle>
            <DialogDescription>
              Provedores ativos são candidatos a roteamento. Mantenha a prioridade baixa para os
              preferidos.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-3 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="prov-slug">Slug</Label>
                <Input
                  id="prov-slug"
                  value={form.slug}
                  onChange={(e) => setForm({ ...form, slug: e.target.value })}
                  placeholder="openai"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="prov-name">Nome de exibição</Label>
                <Input
                  id="prov-name"
                  value={form.display_name}
                  onChange={(e) => setForm({ ...form, display_name: e.target.value })}
                  placeholder="OpenAI"
                />
              </div>
            </div>
            <div className="space-y-1">
              <Label htmlFor="prov-format">Formato da API</Label>
              <Select
                value={form.api_format}
                onValueChange={(v) => setForm({ ...form, api_format: v as AiApiFormat })}
              >
                <SelectTrigger id="prov-format">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {API_FORMATS.map((f) => (
                    <SelectItem key={f.value} value={f.value}>
                      <div className="flex flex-col">
                        <span>{f.label}</span>
                        <span className="text-xs text-muted-foreground">{f.help}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="prov-url">URL base da API</Label>
              <Input
                id="prov-url"
                value={form.api_base_url}
                onChange={(e) => setForm({ ...form, api_base_url: e.target.value })}
                placeholder="https://api.openai.com/v1"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="prov-secret">Nome do secret</Label>
              <Input
                id="prov-secret"
                value={form.secret_name}
                onChange={(e) => setForm({ ...form, secret_name: e.target.value })}
                placeholder="OPENAI_API_KEY"
              />
              <p className="text-xs text-muted-foreground">
                Nome no Supabase Secrets Manager. Obrigatório.
              </p>
            </div>

            {/* Auth (avançado, mas necessário pois define como a key é enviada) */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="prov-authh">Header de auth</Label>
                <Input
                  id="prov-authh"
                  value={form.auth_header}
                  onChange={(e) => setForm({ ...form, auth_header: e.target.value })}
                  placeholder="Authorization"
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="prov-authf">Formato do header</Label>
                <Input
                  id="prov-authf"
                  value={form.auth_format}
                  onChange={(e) => setForm({ ...form, auth_format: e.target.value })}
                  placeholder="Bearer {key}"
                />
                <p className="text-[10px] text-muted-foreground">
                  {`{key}`} é substituído pelo secret. Anthropic usa só {`{key}`}.
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <div className="space-y-1">
                <Label htmlFor="prov-priority">Prioridade</Label>
                <Input
                  id="prov-priority"
                  type="number"
                  value={form.priority}
                  onChange={(e) => setForm({ ...form, priority: Number(e.target.value) || 0 })}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="prov-timeout">Timeout (ms)</Label>
                <Input
                  id="prov-timeout"
                  type="number"
                  value={form.timeout_ms}
                  onChange={(e) =>
                    setForm({ ...form, timeout_ms: Number(e.target.value) || 30000 })
                  }
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="prov-retries">Max retries</Label>
                <Input
                  id="prov-retries"
                  type="number"
                  value={form.max_retries}
                  onChange={(e) => setForm({ ...form, max_retries: Number(e.target.value) || 0 })}
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Switch
                checked={form.is_active}
                onCheckedChange={(v) => setForm({ ...form, is_active: v })}
              />
              <Label>Ativo</Label>
            </div>

            <div className="space-y-1">
              <Label htmlFor="prov-notes">Notas</Label>
              <Textarea
                id="prov-notes"
                rows={2}
                value={getNotes(form.metadata)}
                onChange={(e) =>
                  setForm({ ...form, metadata: setNotes(form.metadata, e.target.value) })
                }
                placeholder="Anotações livres sobre este provider (salvas em metadata.notes)"
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
                !form.slug ||
                !form.display_name ||
                !form.api_base_url ||
                !form.secret_name ||
                createProvider.isPending ||
                updateProvider.isPending
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
            <AlertDialogTitle>Excluir provider</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação também exclui modelos vinculados (ON DELETE CASCADE). Roteamentos que usem
              esses modelos serão quebrados (FK RESTRICT). Não pode ser desfeita.
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
