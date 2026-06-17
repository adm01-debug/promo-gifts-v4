import { useEffect, useMemo, useState } from 'react';
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
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { History, RefreshCw, Eye } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

interface AuditEntry {
  id: string;
  user_id: string;
  action: string;
  resource_type: string;
  resource_id: string | null;
  details: unknown;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

interface ProfileLite {
  user_id: string;
  full_name: string | null;
  email: string | null;
}

export function RecentAuditTable() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [profiles, setProfiles] = useState<Record<string, ProfileLite>>({});
  const [loading, setLoading] = useState(true);
  const [filterAction, setFilterAction] = useState<string>('all');
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<AuditEntry | null>(null);

  const load = async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('admin_audit_log')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    if (error) {
      setLoading(false);
      return;
    }
    const list = (data || []) as AuditEntry[];
    setEntries(list);

    const ids = [...new Set(list.map((e) => e.user_id))];
    if (ids.length > 0) {
      const { data: profs } = await supabase
        .from('profiles')
        .select('user_id, full_name, email')
        .in('user_id', ids);
      const map: Record<string, ProfileLite> = {};
      (profs || []).forEach((p) => {
        if (p.user_id) map[p.user_id] = p as ProfileLite;
      });
      setProfiles(map);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
    const i = setInterval(load, 30_000);
    return () => clearInterval(i);
  }, []);

  const actions = useMemo(() => {
    const s = new Set(entries.map((e) => e.action));
    return Array.from(s).sort();
  }, [entries]);

  const filtered = useMemo(() => {
    return entries.filter((e) => {
      if (filterAction !== 'all' && e.action !== filterAction) return false;
      if (search) {
        const q = search.toLowerCase();
        const adminName = (
          profiles[e.user_id]?.full_name ||
          profiles[e.user_id]?.email ||
          ''
        ).toLowerCase();
        if (
          !e.action.toLowerCase().includes(q) &&
          !e.resource_type.toLowerCase().includes(q) &&
          !(e.resource_id || '').toLowerCase().includes(q) &&
          !adminName.includes(q)
        )
          return false;
      }
      return true;
    });
  }, [entries, filterAction, search, profiles]);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3">
        <div>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5" /> Auditoria recente (50 últimas)
          </CardTitle>
          <CardDescription>
            Ações administrativas registradas em admin_audit_log — atualiza a cada 30s
          </CardDescription>
        </div>
        <Button variant="outline" size="sm" onClick={load} disabled={loading}>
          <RefreshCw className={cn('mr-1.5 h-4 w-4', loading && 'animate-spin')} />
          Atualizar
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-2">
          <Input
            placeholder="Buscar (admin, ação, recurso)…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="max-w-xs"
          />
          <Select value={filterAction} onValueChange={setFilterAction}>
            <SelectTrigger className="w-[220px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Todas as ações</SelectItem>
              {actions.map((a) => (
                <SelectItem key={a} value={a}>
                  {a}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Quando</TableHead>
                <TableHead>Admin</TableHead>
                <TableHead>Ação</TableHead>
                <TableHead>Recurso</TableHead>
                <TableHead>IP</TableHead>
                <TableHead className="w-[60px]">Ver</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="py-8 text-center text-muted-foreground">
                    Nenhuma entrada
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map((e) => {
                  const prof = profiles[e.user_id];
                  return (
                    <TableRow key={e.id}>
                      <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                        {format(new Date(e.created_at), 'dd/MM HH:mm:ss', { locale: ptBR })}
                      </TableCell>
                      <TableCell className="text-xs">
                        <div className="font-medium">{prof?.full_name || '—'}</div>
                        <div className="text-muted-foreground">
                          {prof?.email || e.user_id.slice(0, 8)}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs">
                          {e.action}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-xs">
                        <div>{e.resource_type}</div>
                        {e.resource_id && (
                          <div
                            className="max-w-[180px] truncate font-mono text-muted-foreground"
                            title={e.resource_id}
                          >
                            {e.resource_id}
                          </div>
                        )}
                      </TableCell>
                      <TableCell className="font-mono text-xs">{e.ip_address || '—'}</TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 w-7 p-0"
                          onClick={() => setSelected(e)}
                        >
                          <Eye className="h-3.5 w-3.5" />
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

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Detalhes da auditoria</DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ação</Label>
                  <div className="font-mono">{selected.action}</div>
                </div>
                <div>
                  <Label>Recurso</Label>
                  <div className="font-mono">{selected.resource_type}</div>
                </div>
                <div>
                  <Label>ID Recurso</Label>
                  <div className="break-all font-mono">{selected.resource_id || '—'}</div>
                </div>
                <div>
                  <Label>Quando</Label>
                  <div>
                    {format(new Date(selected.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                  </div>
                </div>
                <div>
                  <Label>IP</Label>
                  <div className="font-mono">{selected.ip_address || '—'}</div>
                </div>
                <div className="col-span-2">
                  <Label>User-Agent</Label>
                  <div className="break-all text-xs text-muted-foreground">
                    {selected.user_agent || '—'}
                  </div>
                </div>
              </div>
              <div>
                <Label>Details (JSON)</Label>
                <pre className="mt-1 max-h-[300px] overflow-auto rounded-md bg-muted p-3 text-xs">
                  {JSON.stringify(selected.details, null, 2)}
                </pre>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </Card>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <div className="mb-0.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
      {children}
    </div>
  );
}
