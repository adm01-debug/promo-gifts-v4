import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Webhook, Plus, Trash2, Copy } from 'lucide-react';
import { supabase, SUPABASE_URL } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { sanitizeError } from '@/lib/security/sanitize-error';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from '@/components/ui/dialog';
import { FailedDeliveriesPanel } from './FailedDeliveriesPanel';
import { InboundEventsPanel } from './InboundEventsPanel';
import { EventsMultiSelect } from './EventsMultiSelect';
import { WebhookPlaygroundPanel } from './WebhookPlaygroundPanel';
import { ConnectionTestHistoryPanel } from './ConnectionTestHistoryPanel';

interface OutboundHook {
  id: string;
  name: string;
  url: string;
  events: string[];
  active: boolean;
  total_success: number;
  total_failure: number;
  last_triggered_at: string | null;
  secret_ref: string | null;
}

interface InboundEp {
  id: string;
  slug: string;
  name: string;
  source_system: string;
  is_active: boolean;
  total_received: number;
  total_invalid: number;
  hmac_secret_ref: string;
}

export function WebhooksTab() {
  const [outbound, setOutbound] = useState<OutboundHook[]>([]);
  const [inbound, setInbound] = useState<InboundEp[]>([]);
  const [open, setOpen] = useState(false);
  const [openIn, setOpenIn] = useState(false);
  const [form, setForm] = useState({ name: '', url: '', events: [] as string[] });
  const [formIn, setFormIn] = useState({ name: '', source_system: '' });

  const baseUrl = `${SUPABASE_URL}/functions/v1/webhook-inbound`;

  const load = async () => {
    const [{ data: o }, { data: i }] = await Promise.all([
      supabase.from('outbound_webhooks').select('*').order('created_at', { ascending: false }),
      supabase
        .from('inbound_webhook_endpoints')
        .select('*')
        .order('created_at', { ascending: false }),
    ]);
    setOutbound((o ?? []) as OutboundHook[]);
    setInbound(i ?? []);
  };
  useEffect(() => {
    load();
  }, []);

  const createOutbound = async () => {
    if (!form.name || !form.url || form.events.length === 0) {
      toast.error('Preencha nome, URL e ao menos um evento');
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    // Generate secret ref name
    const secretRef = `OUTBOUND_WEBHOOK_SECRET_${Date.now().toString(36).toUpperCase()}`;
    const { error } = await supabase.from('outbound_webhooks').insert({
      name: form.name,
      url: form.url,
      events: form.events,
      secret_ref: secretRef,
      created_by: u.user.id,
    });
    if (error) {
      toast.error('Erro ao criar webhook', { description: sanitizeError(error) });
      return;
    }
    toast.success('Webhook criado', {
      description: `Configure o secret ${secretRef} no painel de Secrets do Lovable para assinar payloads.`,
    });
    setForm({ name: '', url: '', events: [] });
    setOpen(false);
    load();
  };

  const createInbound = async () => {
    if (!formIn.name || !formIn.source_system) {
      toast.error('Preencha nome e sistema');
      return;
    }
    const { data: u } = await supabase.auth.getUser();
    if (!u.user) return;
    const slug = `${formIn.source_system.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).slice(2, 8)}`;
    const secretRef = `INBOUND_WEBHOOK_HMAC_${slug.toUpperCase().replace(/-/g, '_')}`;
    const { error } = await supabase.from('inbound_webhook_endpoints').insert({
      slug,
      name: formIn.name,
      source_system: formIn.source_system,
      hmac_secret_ref: secretRef,
      created_by: u.user.id,
    });
    if (error) {
      toast.error('Erro ao criar endpoint', { description: sanitizeError(error) });
      return;
    }
    toast.success('Endpoint criado', {
      description: `URL: ${baseUrl}?slug=${slug}. Configure ${secretRef} para validar HMAC.`,
    });
    setFormIn({ name: '', source_system: '' });
    setOpenIn(false);
    load();
  };

  const remove = async (table: 'outbound_webhooks' | 'inbound_webhook_endpoints', id: string) => {
    const { error } = await supabase.from(table).delete().eq('id', id);
    if (error) toast.error('Erro ao remover webhook', { description: sanitizeError(error) });
    else {
      toast.success('Removido');
      load();
    }
  };

  const copy = (s: string) => {
    navigator.clipboard.writeText(s);
    toast.success('Copiado!');
  };

  return (
    <Tabs defaultValue="outbound">
      <TabsList>
        <TabsTrigger value="outbound">Saída</TabsTrigger>
        <TabsTrigger value="inbound">Entrada</TabsTrigger>
        <TabsTrigger value="events">Eventos recebidos</TabsTrigger>
        <TabsTrigger value="failed">Entregas falhas</TabsTrigger>
      </TabsList>

      <TabsContent value="outbound" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5" /> Webhooks de saída
                </CardTitle>
                <CardDescription>
                  Notifique sistemas externos quando eventos acontecem aqui.
                </CardDescription>
              </div>
              <Dialog open={open} onOpenChange={setOpen}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1 h-4 w-4" /> Novo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar webhook de saída</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Nome</Label>
                      <Input
                        value={form.name}
                        onChange={(e) => setForm({ ...form, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>URL</Label>
                      <Input
                        value={form.url}
                        onChange={(e) => setForm({ ...form, url: e.target.value })}
                        placeholder="https://…"
                      />
                    </div>
                    <div>
                      <Label className="mb-2 block">Eventos</Label>
                      <EventsMultiSelect
                        value={form.events}
                        onChange={(events) => setForm((f) => ({ ...f, events }))}
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={createOutbound}>Criar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {outbound.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum webhook configurado.</p>
            ) : (
              <div className="space-y-2">
                {outbound.map((h) => (
                  <div key={h.id} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 font-medium">
                          {h.name}
                          {!h.active && (
                            <Badge
                              variant="outline"
                              className="border-destructive/20 bg-destructive/10 text-[10px] text-destructive"
                            >
                              Desativado
                              {(h as OutboundHook & { auto_disabled_at?: string }).auto_disabled_at
                                ? ' (auto)'
                                : ''}
                            </Badge>
                          )}
                        </div>
                        <div className="truncate font-mono text-xs text-muted-foreground">
                          {h.url}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-1">
                          {h.events.map((e) => (
                            <Badge key={e} variant="secondary" className="text-xs">
                              {e}
                            </Badge>
                          ))}
                        </div>
                        <div className="mt-1 text-xs text-muted-foreground">
                          ✓ {h.total_success} · ✗ {h.total_failure}
                          {(h as OutboundHook & { consecutive_failures?: number })
                            .consecutive_failures ? (
                            <span className="ml-2 text-destructive">
                              ·{' '}
                              {
                                (h as OutboundHook & { consecutive_failures: number })
                                  .consecutive_failures
                              }{' '}
                              falhas seguidas
                            </span>
                          ) : null}
                        </div>
                        {(h as OutboundHook & { auto_disabled_reason?: string })
                          .auto_disabled_reason && (
                          <p className="mt-1 text-[11px] text-destructive">
                            {
                              (h as OutboundHook & { auto_disabled_reason: string })
                                .auto_disabled_reason
                            }
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-1">
                        {!h.active && (
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-7 text-xs"
                            onClick={async () => {
                              const { error } = await supabase
                                .from('outbound_webhooks')
                                .update({
                                  active: true,
                                  consecutive_failures: 0,
                                  auto_disabled_at: null,
                                  auto_disabled_reason: null,
                                })
                                .eq('id', h.id);
                              if (error) {
                                toast.error('Erro ao reativar webhook', {
                                  description: sanitizeError(error),
                                });
                              } else {
                                toast.success('Reativado');
                                load();
                              }
                            }}
                          >
                            Reativar
                          </Button>
                        )}
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => remove('outbound_webhooks', h.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <ConnectionTestHistoryPanel
                      type="webhook_outbound"
                      connectionId={h.id}
                      label={h.name}
                    />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <WebhookPlaygroundPanel
          webhooks={outbound.map((h) => ({ id: h.id, name: h.name, url: h.url, events: h.events }))}
        />
      </TabsContent>

      <TabsContent value="inbound" className="space-y-4">
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle className="flex items-center gap-2">
                  <Webhook className="h-5 w-5" /> Endpoints de entrada
                </CardTitle>
                <CardDescription>
                  Receba webhooks de outros sistemas (com validação HMAC obrigatória).
                </CardDescription>
              </div>
              <Dialog open={openIn} onOpenChange={setOpenIn}>
                <DialogTrigger asChild>
                  <Button size="sm">
                    <Plus className="mr-1 h-4 w-4" /> Novo
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <DialogHeader>
                    <DialogTitle>Criar endpoint de entrada</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-3">
                    <div>
                      <Label>Nome</Label>
                      <Input
                        value={formIn.name}
                        onChange={(e) => setFormIn({ ...formIn, name: e.target.value })}
                      />
                    </div>
                    <div>
                      <Label>Sistema de origem</Label>
                      <Input
                        value={formIn.source_system}
                        onChange={(e) => setFormIn({ ...formIn, source_system: e.target.value })}
                        placeholder="Ex: lovable-projeto-x"
                      />
                    </div>
                  </div>
                  <DialogFooter>
                    <Button onClick={createInbound}>Criar</Button>
                  </DialogFooter>
                </DialogContent>
              </Dialog>
            </div>
          </CardHeader>
          <CardContent>
            {inbound.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhum endpoint configurado.</p>
            ) : (
              <div className="space-y-2">
                {inbound.map((ep) => (
                  <div key={ep.id} className="rounded-md border border-border p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="font-medium">
                          {ep.name}{' '}
                          <span className="text-xs text-muted-foreground">
                            ({ep.source_system})
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <code className="truncate rounded bg-muted px-2 py-0.5 text-xs">
                            {baseUrl}?slug={ep.slug}
                          </code>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => copy(`${baseUrl}?slug=${ep.slug}`)}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Secret HMAC: <code>{ep.hmac_secret_ref}</code> · Recebidos:{' '}
                          {ep.total_received} · Inválidos: {ep.total_invalid}
                        </div>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => remove('inbound_webhook_endpoints', ep.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="events" className="space-y-4">
        <InboundEventsPanel />
      </TabsContent>

      <TabsContent value="failed" className="space-y-4">
        <FailedDeliveriesPanel />
      </TabsContent>
    </Tabs>
  );
}
