/**
 * DiscountNotificationFilterPanel — painel dedicado para o gestor com
 * filtros ESTRUTURADOS sobre as notificações da categoria `discount`:
 *  - filtro por `metadata.seller_id`
 *  - filtro por `metadata.requested_discount_percent` (min/max)
 *  - marcar como lida individualmente / marcar todas as visíveis
 *  - deep-link via `action_url` (já vem com ?tab=discounts&request=<id>)
 *
 * Pluga-se ao lado da fila no `AdminUsuariosPage` (tab "discounts").
 * O drawer global (NotificationDrawer) continua existindo para todo o
 * resto; aqui o gestor tem busca/triagem específica.
 */
import { useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Bell, CheckCheck, ExternalLink, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface DiscountNotification {
  id: string;
  title: string;
  message: string;
  action_url: string | null;
  is_read: boolean;
  created_at: string;
  metadata: {
    request_id?: string | null;
    quote_id?: string | null;
    seller_id?: string | null;
    seller_name?: string | null;
    requested_discount_percent?: number | null;
    max_allowed_percent?: number | null;
    seller_notes?: string | null;
  } | null;
}

export function DiscountNotificationFilterPanel() {
  const { user, isAdmin, rolesLoaded } = useAuth();
  const qc = useQueryClient();
  const [sellerId, setSellerId] = useState<string>('all');
  const [minPct, setMinPct] = useState<string>('');
  const [maxPct, setMaxPct] = useState<string>('');
  const [onlyUnread, setOnlyUnread] = useState<boolean>(true);

  const { data, isLoading } = useQuery({
    queryKey: ['discount-notifications', user?.id],
    queryFn: async () => {
      if (!user) return [] as DiscountNotification[];
      const { data: rows, error } = await supabase
        .from('workspace_notifications')
        .select('id, title, message, action_url, is_read, created_at, metadata')
        .eq('user_id', user.id)
        .eq('category', 'discount')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return (rows ?? []) as DiscountNotification[];
    },
    enabled: rolesLoaded && Boolean(isAdmin) && Boolean(user),
  });

  const sellers = useMemo(() => {
    const map = new Map<string, string>();
    (data ?? []).forEach((n) => {
      const sid = n.metadata?.seller_id;
      if (!sid) return;
      const label = n.metadata?.seller_name || sid.slice(0, 8);
      if (!map.has(sid)) map.set(sid, label);
    });
    return Array.from(map.entries()).map(([id, label]) => ({ id, label }));
  }, [data]);

  const filtered = useMemo(() => {
    const min = minPct === '' ? null : Number(minPct);
    const max = maxPct === '' ? null : Number(maxPct);
    return (data ?? []).filter((n) => {
      if (onlyUnread && n.is_read) return false;
      if (sellerId !== 'all' && n.metadata?.seller_id !== sellerId) return false;
      const pct = Number(n.metadata?.requested_discount_percent ?? NaN);
      if (min !== null && (Number.isNaN(pct) || pct < min)) return false;
      if (max !== null && (Number.isNaN(pct) || pct > max)) return false;
      return true;
    });
  }, [data, sellerId, minPct, maxPct, onlyUnread]);

  const markRead = async (id: string) => {
    const { error } = await supabase
      .from('workspace_notifications')
      .update({ is_read: true })
      .eq('id', id);
    if (error) {
      toast.error('Não foi possível marcar como lida');
      return;
    }
    qc.invalidateQueries({ queryKey: ['discount-notifications', user?.id] });
  };

  const markAllVisibleRead = async () => {
    const ids = filtered.filter((n) => !n.is_read).map((n) => n.id);
    if (ids.length === 0) {
      toast.info('Nada a marcar — todas as visíveis já estão lidas.');
      return;
    }
    const { error } = await supabase
      .from('workspace_notifications')
      .update({ is_read: true })
      .in('id', ids);
    if (error) {
      toast.error('Não foi possível marcar como lidas');
      return;
    }
    toast.success(`${ids.length} notificaç${ids.length === 1 ? 'ão' : 'ões'} marcadas como lidas`);
    qc.invalidateQueries({ queryKey: ['discount-notifications', user?.id] });
  };

  const clearFilters = () => {
    setSellerId('all');
    setMinPct('');
    setMaxPct('');
    setOnlyUnread(true);
  };

  if (!isAdmin) return null;

  return (
    <Card data-testid="discount-notifications-panel">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between gap-2 text-base">
          <span className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-primary" /> Notificações de desconto
            <Badge variant="outline">{filtered.length}</Badge>
          </span>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-7 gap-1.5 text-xs"
            onClick={markAllVisibleRead}
            data-testid="dn-mark-all-visible-read"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Marcar visíveis como lidas
          </Button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 gap-2 md:grid-cols-4">
          <div className="md:col-span-2">
            <Label className="text-xs">Vendedor</Label>
            <Select value={sellerId} onValueChange={setSellerId}>
              <SelectTrigger className="h-9" data-testid="dn-filter-seller">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos</SelectItem>
                {sellers.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">% mínimo</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={minPct}
              onChange={(e) => setMinPct(e.target.value)}
              className="h-9"
              data-testid="dn-filter-min-pct"
            />
          </div>
          <div>
            <Label className="text-xs">% máximo</Label>
            <Input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={maxPct}
              onChange={(e) => setMaxPct(e.target.value)}
              className="h-9"
              data-testid="dn-filter-max-pct"
            />
          </div>
        </div>

        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <label className="inline-flex cursor-pointer items-center gap-2">
            <input
              type="checkbox"
              checked={onlyUnread}
              onChange={(e) => setOnlyUnread(e.target.checked)}
              data-testid="dn-filter-only-unread"
            />
            Apenas não lidas
          </label>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 gap-1 text-xs"
            onClick={clearFilters}
            data-testid="dn-filter-clear"
          >
            <X className="h-3 w-3" /> Limpar
          </Button>
        </div>

        {isLoading ? (
          <div className="space-y-2">
            {[0, 1, 2].map((i) => (
              <Skeleton key={i} className="h-16 w-full" />
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nenhuma notificação corresponde aos filtros.
          </p>
        ) : (
          <ul className="space-y-2" data-testid="dn-list">
            {filtered.map((n) => {
              const pct = n.metadata?.requested_discount_percent;
              const url =
                n.action_url ||
                (n.metadata?.request_id
                  ? `/admin/usuarios?tab=discounts&request=${n.metadata.request_id}`
                  : '/admin/usuarios?tab=discounts');
              return (
                <li
                  key={n.id}
                  className={`rounded border p-3 ${n.is_read ? 'border-border/30 bg-muted/10' : 'border-primary/30 bg-primary/5'}`}
                  data-testid={`dn-item-${n.id}`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium">{n.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">{n.message}</p>
                      <div className="mt-1.5 flex flex-wrap items-center gap-1.5 text-[10px]">
                        {n.metadata?.seller_name && (
                          <Badge variant="outline">{n.metadata.seller_name}</Badge>
                        )}
                        {pct !== null && pct !== undefined && (
                          <Badge variant="outline">{Number(pct).toFixed(1)}%</Badge>
                        )}
                        <span className="text-muted-foreground">
                          {formatDistanceToNow(new Date(n.created_at), {
                            addSuffix: true,
                            locale: ptBR,
                          })}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1">
                      <Button asChild size="sm" variant="outline" className="h-7 gap-1 text-xs">
                        <Link to={url}>
                          <ExternalLink className="h-3 w-3" /> Abrir
                        </Link>
                      </Button>
                      {!n.is_read && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 gap-1 text-xs"
                          onClick={() => markRead(n.id)}
                          data-testid={`dn-mark-read-${n.id}`}
                        >
                          <CheckCheck className="h-3 w-3" /> Lida
                        </Button>
                      )}
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
