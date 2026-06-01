/**
 * Filtros do feed de auditoria de chaves MCP.
 */
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Toggle } from '@/components/ui/toggle';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { ShieldAlert, Search, Download, RefreshCw } from 'lucide-react';
import type { AuditFilters } from './useMcpAuditFeed';

interface Props {
  filters: AuditFilters;
  onChange: (next: AuditFilters) => void;
  onExport: () => void;
  onReload: () => void;
  counts: {
    total: number;
    issued: number;
    rotated: number;
    updated: number;
    revoked: number;
    escalated: number;
  };
}

export function McpAuditFilters({ filters, onChange, onExport, onReload, counts }: Props) {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[220px] flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={filters.query}
            onChange={(e) => onChange({ ...filters, query: e.target.value })}
            placeholder="Buscar por ator, prefixo, ação..."
            className="pl-9"
          />
        </div>

        <Select
          value={filters.action}
          onValueChange={(v) => onChange({ ...filters, action: v as AuditFilters['action'] })}
        >
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="Ação" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas as ações</SelectItem>
            <SelectItem value="mcp_key.issued">Emitida</SelectItem>
            <SelectItem value="mcp_key.rotated">Rotacionada</SelectItem>
            <SelectItem value="mcp_key.updated">Editada</SelectItem>
            <SelectItem value="mcp_key.revoked">Revogada</SelectItem>
            <SelectItem value="mcp_key.scope_escalated">Escalada p/ FULL</SelectItem>
            <SelectItem value="mcp_key.auto_revoked">Auto-revogada</SelectItem>
          </SelectContent>
        </Select>

        <Toggle
          pressed={filters.onlyFull}
          onPressedChange={(p) => onChange({ ...filters, onlyFull: p })}
          aria-label="Mostrar apenas chaves FULL"
          className="data-[state=on]:bg-destructive/10 data-[state=on]:text-destructive"
        >
          <ShieldAlert className="mr-1 h-4 w-4" /> Só FULL
        </Toggle>

        <Button size="sm" variant="ghost" onClick={onReload} aria-label="Recarregar">
          <RefreshCw className="h-4 w-4" />
        </Button>
        <Button size="sm" variant="outline" onClick={onExport} aria-label="Exportar CSV">
          <Download className="mr-1 h-4 w-4" /> CSV
        </Button>
      </div>

      <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
        <span>
          Total: <strong className="text-foreground">{counts.total}</strong>
        </span>
        <span>
          Emitidas: <strong className="text-foreground">{counts.issued}</strong>
        </span>
        <span>
          Rotacionadas: <strong className="text-foreground">{counts.rotated}</strong>
        </span>
        <span>
          Editadas: <strong className="text-foreground">{counts.updated}</strong>
        </span>
        <span>
          Revogadas: <strong className="text-foreground">{counts.revoked}</strong>
        </span>
        {counts.escalated > 0 && (
          <span className="text-destructive">
            Escalações FULL: <strong>{counts.escalated}</strong>
          </span>
        )}
      </div>
    </div>
  );
}
