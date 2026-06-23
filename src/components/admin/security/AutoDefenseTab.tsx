import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { ShieldAlert, Bot } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { HardeningTrendChart } from './HardeningTrendChart';

interface AuditRow {
  id: string;
  ip_address: string | null;
  resource_id: string | null;
  details: Record<string, unknown> | null;
  created_at: string;
}

export function AutoDefenseTab() {
  // BUG-HEAD-GUARD FIX (2026-06-23): 1 HEAD request sem guard.
  const { rolesLoaded, isAdmin } = useAuth();
  const [rows, setRows] = useState<AuditRow[]>([]);
  const [count7d, setCount7d] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!rolesLoaded || !isAdmin) return;
    const load = async () => {
      setLoading(true);
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

      const [recent, week] = await Promise.all([
        supabase
          .from('admin_audit_log')
          .select('id, ip_address, resource_id, details, created_at')
          .eq('action', 'auto_ip_block')
          .order('created_at', { ascending: false })
          .limit(20),
        supabase
          .from('admin_audit_log')
          .select('id', { count: 'exact', head: true })
          .eq('action', 'auto_ip_block')
          .gte('created_at', sevenDaysAgo),
      ]);

      setRows((recent.data || []) as AuditRow[]);
      setCount7d(week.count ?? 0);
      setLoading(false);
    };
    void load();
  }, [rolesLoaded, isAdmin]);  // BUG-HEAD-GUARD

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-2">
        <HardeningTrendChart />
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Bot className="h-5 w-5" /> Auto-defesa ativa
            </CardTitle>
            <CardDescription>
              IPs com ≥30 ofensas em 1h são bloqueados por 6h automaticamente
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl font-bold tabular-nums">{count7d}</span>
              <span className="text-sm text-muted-foreground">
                auto-bloqueios nos últimos 7 dias
              </span>
            </div>
            <p className="mt-3 text-xs text-muted-foreground">
              Verificação a cada 15 minutos. Combina falhas de login, tokens públicos e bots
              detectados.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <ShieldAlert className="h-5 w-5" /> Últimos 20 auto-bloqueios
          </CardTitle>
          <CardDescription>Entradas de `auto_ip_block` em admin_audit_log</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <p className="text-sm text-muted-foreground">Carregando…</p>
          ) : rows.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Nenhum auto-bloqueio registrado. O sistema só dispara quando um IP atinge ≥30 ofensas
              em 1h.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP</TableHead>
                    <TableHead>Ofensas</TableHead>
                    <TableHead>Expira</TableHead>
                    <TableHead>Quando</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rows.map((r) => {
                    const details = (r.details ?? {}) as {
                      offense_count?: number;
                      expires_at?: string;
                    };
                    return (
                      <TableRow key={r.id}>
                        <TableCell className="font-mono text-xs">
                          {r.ip_address || r.resource_id || '—'}
                        </TableCell>
                        <TableCell>
                          <Badge variant="destructive" className="text-xs">
                            {details.offense_count ?? '—'}
                          </Badge>
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {details.expires_at
                            ? format(new Date(details.expires_at), 'dd/MM HH:mm', { locale: ptBR })
                            : '—'}
                        </TableCell>
                        <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                          {format(new Date(r.created_at), 'dd/MM HH:mm:ss', { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
