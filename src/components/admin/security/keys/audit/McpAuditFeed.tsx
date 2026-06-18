/**
 * Feed de auditoria de chaves MCP. Combina filtros, linhas e exportação CSV.
 */
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import { ClipboardList } from 'lucide-react';
import { McpAuditFilters } from './McpAuditFilters';
import { McpAuditRow } from './McpAuditRow';
import { useMcpAuditFeed } from './useMcpAuditFeed';

function toCsv(rows: ReturnType<typeof useMcpAuditFeed>['rows']): string {
  const headers = [
    'created_at',
    'action',
    'actor_email',
    'actor_name',
    'key_prefix',
    'ip_address',
    'is_full',
    'escalated',
    'details',
  ];
  const esc = (s: unknown) => `"${String(s ?? '').replace(/"/g, '""')}"`;
  const lines = [headers.join(',')];
  for (const r of rows) {
    lines.push(
      [
        r.created_at,
        r.action,
        r.actor_email ?? '',
        r.actor_name ?? '',
        r.key_prefix ?? '',
        r.ip_address ?? '',
        r.is_full ? '1' : '0',
        r.escalated ? '1' : '0',
        JSON.stringify(r.details ?? {}),
      ]
        .map(esc)
        .join(','),
    );
  }
  return lines.join('\n');
}

export function McpAuditFeed() {
  const { rows, loading, filters, setFilters, counts, reload } = useMcpAuditFeed();

  const onExport = () => {
    const csv = toCsv(rows);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mcp-audit-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <ClipboardList className="h-4 w-4" /> Histórico de auditoria
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <McpAuditFilters
          filters={filters}
          onChange={setFilters}
          onExport={onExport}
          onReload={reload}
          counts={counts}
        />

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-20 w-full" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Nenhum evento encontrado com os filtros atuais.
          </p>
        ) : (
          <ScrollArea className="h-[600px] pr-3">
            <ul className="space-y-2">
              {rows.map((r) => (
                <McpAuditRow key={r.id} row={r} />
              ))}
            </ul>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
