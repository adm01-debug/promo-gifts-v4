import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { z } from 'zod';
import { supabase } from '@/integrations/supabase/client';
import { PageSEO } from '@/components/seo/PageSEO';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useToast } from '@/hooks/ui';
import {
  Shield,
  Ban,
  AlertTriangle,
  RefreshCw,
  Plus,
  Trash2,
  CheckCircle2,
  Clock,
  Activity,
  BarChart3,
  Siren,
  History,
  KeySquare,
  Network,
  TrendingUp,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { SecurityAnalytics } from '@/components/admin/security/SecurityAnalytics';
import { AnomalyCards } from '@/components/admin/security/AnomalyCards';
import { ForceGlobalLogoutDialog } from '@/components/admin/security/ForceGlobalLogoutDialog';
import { RecentAuditTable } from '@/components/admin/security/RecentAuditTable';
import { HardeningHealthCard } from '@/components/admin/security/HardeningHealthCard';
import { ActiveIpsList } from '@/components/admin/security/ActiveIpsList';
import { AutoDefenseTab } from '@/components/admin/security/AutoDefenseTab';
import { cn } from '@/lib/utils';

interface BotLog {
  id: string;
  ip_address: string;
  user_agent: string | null;
  endpoint: string;
  detection_reason: string;
  blocked: boolean;
  request_count: number | null;
  created_at: string;
}

interface RateLimit {
  id: string;
  identifier: string;
  endpoint: string;
  request_count: number;
  blocked_until: string | null;
  window_start: string;
  updated_at: string;
}

interface IpAccessEntry {
  id: string;
  ip_address: string;
  list_type: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
}

const ipSchema = z.object({
  ip_address: z
    .string()
    .trim()
    .min(3, 'IP inválido')
    .max(45, 'IP muito longo')
    .regex(/^[0-9a-fA-F:./]+$/, 'Use apenas IPv4, IPv6 ou CIDR'),
  list_type: z.enum(['allow', 'block']),
  reason: z.string().trim().max(500, 'Máx 500 caracteres').optional().or(z.literal('')),
  expires_at: z.string().optional().or(z.literal('')),
});

export default function AdminSegurancaAcessoPage() {
  const [botLogs, setBotLogs] = useState<BotLog[]>([]);
  const [rateLimits, setRateLimits] = useState<RateLimit[]>([]);
  const [ipList, setIpList] = useState<IpAccessEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [form, setForm] = useState({
    ip_address: '',
    list_type: 'block' as 'allow' | 'block',
    reason: '',
    expires_at: '',
  });
  const { toast } = useToast();

  // Guarda de montagem: evita setState após o unmount (o fetchAll é chamado
  // pelo effect inicial, pelo polling de 30s e por handlers; sem isso, um await
  // que resolve após o teardown vaza "window is not defined" nos testes).
  const mountedRef = useRef(true);

  const fetchAll = useCallback(async () => {
    if (mountedRef.current) setIsLoading(true);
    try {
      const [botRes, rateRes, ipRes] = await Promise.all([
        supabase
          .from('bot_detection_log')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(200),
        supabase
          .from('request_rate_limits')
          .select('*')
          .order('updated_at', { ascending: false })
          .limit(100),
        supabase.from('ip_access_control').select('*').order('created_at', { ascending: false }),
      ]);
      if (!mountedRef.current) return;
      if (botRes.error) throw botRes.error;
      if (rateRes.error) throw rateRes.error;
      if (ipRes.error) throw ipRes.error;
      // bot_detection_log em prod usa `detection_type` e guarda endpoint/request_count
      // em `metadata` (jsonb). Mapeamos para o shape esperado pela UI, com fallback,
      // para a analise de seguranca nao exibir valores em branco.
      const rawBotLogs = (botRes.data || []) as unknown as Array<Record<string, unknown>>;
      setBotLogs(
        rawBotLogs.map((r) => {
          const meta = (r.metadata ?? {}) as Record<string, unknown>;
          return {
            id: String(r.id),
            ip_address: (r.ip_address as string) ?? '',
            user_agent: (r.user_agent as string | null) ?? null,
            endpoint: (r.endpoint as string) ?? (meta.endpoint as string) ?? '—',
            detection_reason: (r.detection_reason as string) ?? (r.detection_type as string) ?? '—',
            blocked: Boolean(r.blocked),
            request_count:
              (r.request_count as number | null) ?? (meta.request_count as number) ?? null,
            created_at: String(r.created_at),
          } as BotLog;
        }),
      );
      setRateLimits(rateRes.data || []);
      setIpList(ipRes.data || []);
    } catch (err) {
      if (!mountedRef.current) return;
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao carregar', description: msg, variant: 'destructive' });
    } finally {
      if (mountedRef.current) setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    mountedRef.current = true;
    void fetchAll();
    const interval = setInterval(fetchAll, 30000); // 30s polling
    return () => {
      mountedRef.current = false;
      clearInterval(interval);
    };
  }, [fetchAll]);

  const stats = useMemo(() => {
    const blocked = botLogs.filter((l) => l.blocked).length;
    const uniqueIps = new Set(botLogs.map((l) => l.ip_address)).size;
    const activeBlocks = rateLimits.filter(
      (r) => r.blocked_until && new Date(r.blocked_until) > new Date(),
    ).length;
    return { total: botLogs.length, blocked, uniqueIps, activeBlocks };
  }, [botLogs, rateLimits]);

  const submitIpEntry = async () => {
    const parsed = ipSchema.safeParse(form);
    if (!parsed.success) {
      toast({
        title: 'Dados inválidos',
        description: 'Verifique os campos obrigatórios e tente novamente.',
        variant: 'destructive',
      });
      return;
    }
    const { data: userRes } = await supabase.auth.getUser();
    if (!userRes.user) {
      toast({ title: 'Sessão expirada', variant: 'destructive' });
      return;
    }
    const { error } = await supabase.from('ip_access_control').insert({
      ip_address: parsed.data.ip_address,
      list_type: parsed.data.list_type,
      reason: parsed.data.reason || null,
      expires_at: parsed.data.expires_at ? new Date(parsed.data.expires_at).toISOString() : null,
      created_by: userRes.user.id,
    });
    if (error) {
      toast({
        title: 'Erro ao salvar',
        description: 'Não foi possível salvar o registro de IP.',
        variant: 'destructive',
      });
      return;
    }
    toast({
      title: 'IP adicionado',
      description: `${parsed.data.ip_address} → ${parsed.data.list_type}`,
    });
    setDialogOpen(false);
    setForm({ ip_address: '', list_type: 'block', reason: '', expires_at: '' });
    fetchAll();
  };

  const removeIpEntry = async (id: string) => {
    const { error } = await supabase.from('ip_access_control').delete().eq('id', id);
    if (error) {
      toast({
        title: 'Erro ao remover',
        description: 'Não foi possível remover o registro de IP.',
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Removido' });
    fetchAll();
  };

  const quickAddIp = (ip: string, listType: 'allow' | 'block') => {
    setForm({ ip_address: ip, list_type: listType, reason: '', expires_at: '' });
    setDialogOpen(true);
  };

  return (
    <>
      <PageSEO
        title="Segurança e Acesso"
        description="Painel admin para gestão de bot detection, rate limits e allowlist/blocklist de IPs."
        path="/admin/seguranca-acesso"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-4 px-3 py-3 pb-24 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1
              data-testid="page-title-seguranca-acesso"
              className="font-display text-2xl font-bold tracking-tight"
            >
              Segurança e Acesso
            </h1>
            <p className="text-muted-foreground">
              Bot detection, rate limits e controle manual de IPs (atualiza a cada 30s)
            </p>
          </div>
          <div className="flex items-center gap-2">
            <ForceGlobalLogoutDialog />
            <Button variant="outline" size="sm" onClick={fetchAll} disabled={isLoading}>
              <RefreshCw className={cn('mr-2 h-4 w-4', isLoading && 'animate-spin')} />
              Atualizar
            </Button>
          </div>
        </div>

        <HardeningHealthCard />

        <div className="grid gap-3 md:grid-cols-4">
          <StatCard
            label="Detecções (200 últimas)"
            value={stats.total}
            icon={<Activity className="h-4 w-4 text-muted-foreground" />}
          />
          <StatCard
            label="Bloqueadas"
            value={stats.blocked}
            icon={<Ban className="h-4 w-4 text-destructive" />}
            valueClass="text-destructive"
          />
          <StatCard
            label="IPs únicos"
            value={stats.uniqueIps}
            icon={<Shield className="h-4 w-4 text-muted-foreground" />}
          />
          <StatCard
            label="Bloqueios ativos"
            value={stats.activeBlocks}
            icon={<Clock className="h-4 w-4 text-warning" />}
            valueClass="text-warning"
          />
        </div>

        <Tabs defaultValue="anomalias" className="w-full">
          <TabsList className="h-auto flex-wrap">
            <TabsTrigger value="anomalias">
              <Siren className="mr-1.5 h-3.5 w-3.5" /> Anomalias 24h
            </TabsTrigger>
            <TabsTrigger value="audit">
              <History className="mr-1.5 h-3.5 w-3.5" /> Auditoria
            </TabsTrigger>
            <TabsTrigger value="tokens">
              <KeySquare className="mr-1.5 h-3.5 w-3.5" /> Tokens suspeitos
            </TabsTrigger>
            <TabsTrigger value="active-ips">
              <Network className="mr-1.5 h-3.5 w-3.5" /> IPs ativos
            </TabsTrigger>
            <TabsTrigger value="auto-defense">
              <TrendingUp className="mr-1.5 h-3.5 w-3.5" /> Histórico & Auto-defesa
            </TabsTrigger>
            <TabsTrigger value="analytics">
              <BarChart3 className="mr-1.5 h-3.5 w-3.5" /> Analytics
            </TabsTrigger>
            <TabsTrigger value="bots">Bot Detection</TabsTrigger>
            <TabsTrigger value="rate">Rate Limits</TabsTrigger>
            <TabsTrigger value="ips">Allow/Block IPs ({ipList.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="anomalias" className="space-y-3">
            <AnomalyCards />
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Siren className="h-5 w-5" /> Como interpretar
                </CardTitle>
                <CardDescription>
                  Indicadores em vermelho exigem investigação imediata
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-1.5 text-sm text-muted-foreground">
                <p>
                  • <strong>Falhas de login &gt; 50/24h</strong>: possível brute-force — verifique
                  aba "Bot Detection" e use blocklist.
                </p>
                <p>
                  • <strong>Bots bloqueados &gt; 100</strong>: scraping ativo — confirme padrão de
                  IPs e bloqueie em massa.
                </p>
                <p>
                  • <strong>Falhas de token &gt; 20</strong>: tentativa de adivinhação — token é
                  auto-expirado após 5 falhas/hora.
                </p>
                <p>
                  • <strong>IPs distintos em tokens &gt; 30</strong>: possível link vazado — revogue
                  tokens do recurso afetado.
                </p>
                <p className="border-t border-border/50 pt-2">
                  Em caso de comprometimento confirmado, use <strong>Forçar logout global</strong>{' '}
                  no topo da página.
                </p>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="audit">
            <RecentAuditTable />
          </TabsContent>

          <TabsContent value="tokens" />

          <TabsContent value="active-ips">
            <ActiveIpsList />
          </TabsContent>

          <TabsContent value="auto-defense">
            <AutoDefenseTab />
          </TabsContent>

          <TabsContent value="analytics">
            <SecurityAnalytics botLogs={botLogs} onBlockIp={(ip) => quickAddIp(ip, 'block')} />
          </TabsContent>

          <TabsContent value="bots">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5" /> Detecções de bot e scraping
                </CardTitle>
                <CardDescription>
                  Tentativas suspeitas registradas pelo sistema anti-scraping
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>IP</TableHead>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Razão</TableHead>
                        <TableHead>User-Agent</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Quando</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {botLogs.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                            Nenhuma detecção registrada
                          </TableCell>
                        </TableRow>
                      ) : (
                        botLogs.map((log) => (
                          <TableRow key={log.id}>
                            <TableCell className="font-mono text-xs">{log.ip_address}</TableCell>
                            <TableCell className="text-xs">{log.endpoint}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="text-xs">
                                {log.detection_reason}
                              </Badge>
                            </TableCell>
                            <TableCell
                              className="max-w-[200px] truncate text-xs text-muted-foreground"
                              title={log.user_agent || ''}
                            >
                              {log.user_agent || '—'}
                            </TableCell>
                            <TableCell>
                              {log.blocked ? (
                                <Badge variant="destructive" className="text-xs">
                                  Bloqueado
                                </Badge>
                              ) : (
                                <Badge variant="outline" className="text-xs">
                                  Permitido
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                              {format(new Date(log.created_at), 'dd/MM HH:mm:ss', { locale: ptBR })}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-1">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => quickAddIp(log.ip_address, 'block')}
                                >
                                  Bloquear
                                </Button>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => quickAddIp(log.ip_address, 'allow')}
                                >
                                  Permitir
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="rate">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Clock className="h-5 w-5" /> Rate limits ativos
                </CardTitle>
                <CardDescription>Janelas de contagem por IP/endpoint</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Identificador</TableHead>
                        <TableHead>Endpoint</TableHead>
                        <TableHead>Requests</TableHead>
                        <TableHead>Bloqueado até</TableHead>
                        <TableHead>Última atividade</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {rateLimits.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                            Nenhum rate limit ativo
                          </TableCell>
                        </TableRow>
                      ) : (
                        rateLimits.map((rl) => {
                          const blockedActive =
                            rl.blocked_until && new Date(rl.blocked_until) > new Date();
                          return (
                            <TableRow key={rl.id}>
                              <TableCell className="font-mono text-xs">{rl.identifier}</TableCell>
                              <TableCell className="text-xs">{rl.endpoint}</TableCell>
                              <TableCell>
                                <Badge variant="outline" className="text-xs">
                                  {rl.request_count}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-xs">
                                {blockedActive ? (
                                  <Badge variant="destructive" className="text-xs">
                                    {rl.blocked_until &&
                                      format(new Date(rl.blocked_until), 'dd/MM HH:mm', {
                                        locale: ptBR,
                                      })}
                                  </Badge>
                                ) : (
                                  <span className="text-muted-foreground">—</span>
                                )}
                              </TableCell>
                              <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                                {format(new Date(rl.updated_at), 'dd/MM HH:mm:ss', {
                                  locale: ptBR,
                                })}
                              </TableCell>
                              <TableCell>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2 text-xs"
                                  onClick={() => quickAddIp(rl.identifier, 'block')}
                                >
                                  Bloquear permanente
                                </Button>
                              </TableCell>
                            </TableRow>
                          );
                        })
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="ips">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Shield className="h-5 w-5" /> Allowlist e Blocklist manual
                  </CardTitle>
                  <CardDescription>
                    IPs sempre permitidos ou sempre bloqueados (sobrescreve detecção automática)
                  </CardDescription>
                </div>
                <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                  <DialogTrigger asChild>
                    <Button size="sm">
                      <Plus className="mr-2 h-4 w-4" /> Adicionar IP
                    </Button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Adicionar IP à lista</DialogTitle>
                      <DialogDescription>
                        Allowlist ignora todas as checagens. Blocklist rejeita imediatamente com
                        403.
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                      <div>
                        <Label htmlFor="ip">IP (IPv4, IPv6 ou CIDR)</Label>
                        <Input
                          id="ip"
                          value={form.ip_address}
                          onChange={(e) => setForm({ ...form, ip_address: e.target.value })}
                          placeholder="192.168.1.1"
                          maxLength={45}
                        />
                      </div>
                      <div>
                        <Label htmlFor="type">Tipo</Label>
                        <Select
                          value={form.list_type}
                          onValueChange={(v) =>
                            setForm({ ...form, list_type: v as 'allow' | 'block' })
                          }
                        >
                          <SelectTrigger id="type">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="block">🚫 Blocklist (bloquear)</SelectItem>
                            <SelectItem value="allow">✅ Allowlist (sempre permitir)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label htmlFor="reason">Motivo (opcional)</Label>
                        <Textarea
                          id="reason"
                          value={form.reason}
                          onChange={(e) => setForm({ ...form, reason: e.target.value })}
                          maxLength={500}
                          rows={2}
                        />
                      </div>
                      <div>
                        <Label htmlFor="exp">Expira em (opcional)</Label>
                        <Input
                          id="exp"
                          type="datetime-local"
                          value={form.expires_at}
                          onChange={(e) => setForm({ ...form, expires_at: e.target.value })}
                        />
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={() => setDialogOpen(false)}>
                        Cancelar
                      </Button>
                      <Button onClick={submitIpEntry}>Salvar</Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>IP</TableHead>
                        <TableHead>Tipo</TableHead>
                        <TableHead>Motivo</TableHead>
                        <TableHead>Expira</TableHead>
                        <TableHead>Criado</TableHead>
                        <TableHead>Ações</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {ipList.length === 0 ? (
                        <TableRow>
                          <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                            Nenhum IP cadastrado
                          </TableCell>
                        </TableRow>
                      ) : (
                        ipList.map((entry) => (
                          <TableRow key={entry.id}>
                            <TableCell className="font-mono text-xs">{entry.ip_address}</TableCell>
                            <TableCell>
                              {entry.list_type === 'allow' ? (
                                <Badge variant="outline" className="text-xs">
                                  <CheckCircle2 className="mr-1 h-3 w-3" /> Allow
                                </Badge>
                              ) : (
                                <Badge variant="destructive" className="text-xs">
                                  <Ban className="mr-1 h-3 w-3" /> Block
                                </Badge>
                              )}
                            </TableCell>
                            <TableCell
                              className="max-w-[300px] truncate text-xs text-muted-foreground"
                              title={entry.reason || ''}
                            >
                              {entry.reason || '—'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {entry.expires_at
                                ? format(new Date(entry.expires_at), 'dd/MM/yy HH:mm', {
                                    locale: ptBR,
                                  })
                                : 'Permanente'}
                            </TableCell>
                            <TableCell className="text-xs text-muted-foreground">
                              {format(new Date(entry.created_at), 'dd/MM/yy HH:mm', {
                                locale: ptBR,
                              })}
                            </TableCell>
                            <TableCell>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2"
                                onClick={() => removeIpEntry(entry.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5 text-destructive" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </>
  );
}

function StatCard({
  label,
  value,
  icon,
  valueClass,
}: {
  label: string;
  value: number;
  icon: React.ReactNode;
  valueClass?: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-2">
        <CardTitle className="text-sm font-medium">{label}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className={`text-2xl font-bold ${valueClass ?? ''}`}>{value}</div>
      </CardContent>
    </Card>
  );
}
