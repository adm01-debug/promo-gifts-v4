import { useCallback, useEffect, useMemo, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/ui';
import {
  Shield,
  RefreshCw,
  Clock,
  Infinity as InfinityIcon,
  Trash2,
  CalendarPlus,
} from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface IpEntry {
  id: string;
  ip_address: string;
  list_type: string;
  reason: string | null;
  expires_at: string | null;
  created_at: string;
  created_by: string | null;
}

type Filter = 'all' | 'allow' | 'block' | 'active' | 'expired';

export function ActiveIpsList() {
  const [items, setItems] = useState<IpEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<Filter>('all');
  const [search, setSearch] = useState('');
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('ip_access_control')
      .select('*')
      .order('created_at', { ascending: false });
    if (error) {
      toast({
        title: 'Erro ao carregar IPs',
        description: 'Não foi possível carregar a lista de IPs.',
        variant: 'destructive',
      });
    } else {
      setItems(data ?? []);
    }
    setLoading(false);
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const now = Date.now();

  const filtered = useMemo(() => {
    return items.filter((i) => {
      const isActive = !i.expires_at || new Date(i.expires_at).getTime() > now;
      if (filter === 'allow' && i.list_type !== 'allow') return false;
      if (filter === 'block' && i.list_type !== 'block') return false;
      if (filter === 'active' && !isActive) return false;
      if (filter === 'expired' && isActive) return false;
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        if (
          !i.ip_address.toLowerCase().includes(q) &&
          !(i.reason ?? '').toLowerCase().includes(q)
        ) {
          return false;
        }
      }
      return true;
    });
  }, [items, filter, search, now]);

  const revoke = async (id: string) => {
    const { error } = await supabase.from('ip_access_control').delete().eq('id', id);
    if (error) {
      toast({
        title: 'Erro ao revogar',
        description: 'Não foi possível revogar o IP.',
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'IP revogado' });
    void load();
  };

  const extend = async (id: string, currentExpires: string | null) => {
    const base = currentExpires ? new Date(currentExpires) : new Date();
    if (base.getTime() < Date.now()) base.setTime(Date.now());
    const next = new Date(base.getTime() + 24 * 60 * 60 * 1000);
    const { error } = await supabase
      .from('ip_access_control')
      .update({ expires_at: next.toISOString() })
      .eq('id', id);
    if (error) {
      toast({
        title: 'Erro ao estender',
        description: 'Não foi possível estender o acesso.',
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Expiração estendida +24h' });
    void load();
  };

  const makePermanent = async (id: string) => {
    const { error } = await supabase
      .from('ip_access_control')
      .update({ expires_at: null })
      .eq('id', id);
    if (error) {
      toast({
        title: 'Erro ao tornar permanente',
        description: 'Não foi possível tornar o bloqueio permanente.',
        variant: 'destructive',
      });
      return;
    }
    toast({ title: 'Bloqueio agora é permanente' });
    void load();
  };

  return (
    <Card>
      <CardHeader className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <CardTitle className="flex items-center gap-2">
            <Shield className="h-5 w-5" /> IPs ativos
          </CardTitle>
          <CardDescription>
            Gestão completa de allow/block — revogue, estenda ou converta em permanente
          </CardDescription>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Input
            placeholder="Buscar IP ou motivo…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="h-9 w-[180px]"
          />
          <Select value={filter} onValueChange={(v) => setFilter(v as Filter)}>
            <SelectTrigger className="h-9 w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todos</SelectItem>
              <SelectItem value="allow">Allow</SelectItem>
              <SelectItem value="block">Block</SelectItem>
              <SelectItem value="active">Ativos</SelectItem>
              <SelectItem value="expired">Expirados</SelectItem>
            </SelectContent>
          </Select>
          <Button variant="outline" size="sm" onClick={() => void load()} disabled={loading}>
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>IP</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Expira</TableHead>
                <TableHead>Criado</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="py-8 text-center text-muted-foreground">
                    {loading ? 'Carregando…' : 'Nenhum IP encontrado'}
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((i) => {
                  const isActive = !i.expires_at || new Date(i.expires_at).getTime() > now;
                  return (
                    <TableRow key={i.id}>
                      <TableCell className="font-mono text-xs">{i.ip_address}</TableCell>
                      <TableCell>
                        <Badge
                          variant={i.list_type === 'block' ? 'destructive' : 'outline'}
                          className="text-xs"
                        >
                          {i.list_type}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {isActive ? (
                          <Badge className="text-xs">Ativo</Badge>
                        ) : (
                          <Badge variant="secondary" className="text-xs">
                            Expirado
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell
                        className="max-w-[260px] truncate text-xs text-muted-foreground"
                        title={i.reason ?? ''}
                      >
                        {i.reason || '—'}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs">
                        {i.expires_at ? (
                          <span className="inline-flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            {format(new Date(i.expires_at), 'dd/MM HH:mm', { locale: ptBR })}
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 text-muted-foreground">
                            <InfinityIcon className="h-3 w-3" /> permanente
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(i.created_at), 'dd/MM HH:mm', { locale: ptBR })}
                      </TableCell>
                      <TableCell>
                        <div className="flex justify-end gap-1">
                          {i.expires_at && isActive && (
                            <>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => void extend(i.id, i.expires_at)}
                                title="Estender +24h"
                              >
                                <CalendarPlus className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                className="h-7 px-2 text-xs"
                                onClick={() => void makePermanent(i.id)}
                                title="Tornar permanente"
                              >
                                <InfinityIcon className="h-3.5 w-3.5" />
                              </Button>
                            </>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                            onClick={() => void revoke(i.id)}
                            title="Revogar"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
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
  );
}
