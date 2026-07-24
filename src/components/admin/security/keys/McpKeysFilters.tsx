/**
 * Barra de filtros + contadores da tela de chaves MCP.
 *
 * Filtros disponíveis:
 *   - Busca textual (nome, prefixo, email do criador)
 *   - Status (ativa / expirada / revogada)
 *   - Somente FULL (chaves com escopo *)
 *   - Criador (lista derivada das chaves visíveis ao usuário pelas RLS)
 *   - Intervalo de datas de criação (de / até) via DatePicker shadcn
 *   - Ordenação
 *
 * Os criadores listados respeitam as RLS atuais: o hook `useMcpKeys` só
 * recebe linhas que o JWT do usuário pode ler, então a lista derivada
 * em `creators` nunca expõe usuários cujas chaves o usuário não veria.
 */
import { useMemo } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { CalendarIcon, Search, ShieldAlert, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import type { CreatorOption, StatusFilter, SortKey } from './useMcpKeys';

interface Props {
  search: string;
  status: StatusFilter;
  onlyFull: boolean;
  sort: SortKey;
  creator: string | null;
  createdFrom: string | null;
  createdTo: string | null;
  creators: CreatorOption[];
  counts: { total: number; active: number; expired: number; revoked: number; full: number };
  onChange: (
    patch: Partial<{
      search: string;
      status: StatusFilter;
      onlyFull: boolean;
      sort: SortKey;
      creator: string | null;
      createdFrom: string | null;
      createdTo: string | null;
    }>,
  ) => void;
}

const ALL_CREATORS = '__all__';

function isoDate(d: Date | undefined): string | null {
  if (!d) return null;
  // YYYY-MM-DD em local time (sem TZ surprise)
  const pad = (n: number) => n.toString().padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function parseIso(value: string | null): Date | undefined {
  if (!value) return undefined;
  const d = new Date(`${value}T00:00:00`);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function creatorLabel(c: CreatorOption): string {
  const base = c.name?.trim() || c.email?.trim() || c.user_id.slice(0, 8);
  return c.email && c.name ? `${c.name} <${c.email}>` : base;
}

export function McpKeysFilters({
  search,
  status,
  onlyFull,
  sort,
  creator,
  createdFrom,
  createdTo,
  creators,
  counts,
  onChange,
}: Props) {
  const fromDate = useMemo(() => parseIso(createdFrom), [createdFrom]);
  const toDate = useMemo(() => parseIso(createdTo), [createdTo]);

  const hasDateFilter = Boolean(createdFrom || createdTo);
  const clearDates = () => onChange({ createdFrom: null, createdTo: null });

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1">
          Total: <strong>{counts.total}</strong>
        </Badge>
        <Badge variant="outline" className="gap-1 border-success/30 text-success">
          Ativas: <strong>{counts.active}</strong>
        </Badge>
        <Badge variant="outline" className="gap-1">
          Expiradas: <strong>{counts.expired}</strong>
        </Badge>
        <Badge variant="outline" className="gap-1">
          Revogadas: <strong>{counts.revoked}</strong>
        </Badge>
        {counts.full > 0 && (
          <Badge variant="destructive" className="gap-1">
            <ShieldAlert className="h-3 w-3" /> FULL ativas: <strong>{counts.full}</strong>
          </Badge>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[240px] flex-1">
          <Search
            className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={search}
            onChange={(e) => onChange({ search: e.target.value })}
            placeholder="Buscar por nome, prefixo ou email do criador…"
            className="pl-8"
            aria-label="Buscar chaves"
          />
        </div>

        <Select value={status} onValueChange={(v) => onChange({ status: v as StatusFilter })}>
          <SelectTrigger className="w-[160px]" aria-label="Filtrar por status">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="active">Ativas</SelectItem>
            <SelectItem value="expired">Expiradas</SelectItem>
            <SelectItem value="revoked">Revogadas</SelectItem>
          </SelectContent>
        </Select>

        <Select
          value={creator ?? ALL_CREATORS}
          onValueChange={(v) => onChange({ creator: v === ALL_CREATORS ? null : v })}
        >
          <SelectTrigger className="w-[220px]" aria-label="Filtrar por criador">
            <SelectValue placeholder="Todos criadores" />
          </SelectTrigger>
          <SelectContent className="max-h-[280px]">
            <SelectItem value={ALL_CREATORS}>Todos criadores</SelectItem>
            {creators.map((c) => (
              <SelectItem key={c.user_id} value={c.user_id}>
                {creatorLabel(c)} <span className="text-muted-foreground">· {c.count}</span>
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'min-w-[140px] justify-start text-left font-normal',
                !fromDate && 'text-muted-foreground',
              )}
            >
              <CalendarIcon className="mr-1 h-4 w-4" />
              {fromDate ? format(fromDate, 'dd/MM/yyyy', { locale: ptBR }) : 'De'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={fromDate}
              onSelect={(d) => onChange({ createdFrom: isoDate(d ?? undefined) })}
              disabled={(date) => (toDate ? date > toDate : false) || date > new Date()}
              initialFocus
              locale={ptBR}
              className={cn('pointer-events-auto p-3')}
            />
          </PopoverContent>
        </Popover>

        <Popover>
          <PopoverTrigger asChild>
            <Button
              variant="outline"
              size="sm"
              className={cn(
                'min-w-[140px] justify-start text-left font-normal',
                !toDate && 'text-muted-foreground',
              )}
            >
              <CalendarIcon className="mr-1 h-4 w-4" />
              {toDate ? format(toDate, 'dd/MM/yyyy', { locale: ptBR }) : 'Até'}
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="start">
            <Calendar
              mode="single"
              selected={toDate}
              onSelect={(d) => onChange({ createdTo: isoDate(d ?? undefined) })}
              disabled={(date) => (fromDate ? date < fromDate : false) || date > new Date()}
              initialFocus
              locale={ptBR}
              className={cn('pointer-events-auto p-3')}
            />
          </PopoverContent>
        </Popover>

        {hasDateFilter && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={clearDates}
            aria-label="Limpar filtro de data"
          >
            <X className="mr-1 h-4 w-4" /> Limpar datas
          </Button>
        )}

        <Select value={sort} onValueChange={(v) => onChange({ sort: v as SortKey })}>
          <SelectTrigger className="w-[200px]" aria-label="Ordenação">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="created_desc">Mais recentes</SelectItem>
            <SelectItem value="expires_asc">Próximas a expirar</SelectItem>
            <SelectItem value="last_used_desc">Último uso</SelectItem>
          </SelectContent>
        </Select>

        <Button
          type="button"
          variant={onlyFull ? 'destructive' : 'outline'}
          size="sm"
          onClick={() => onChange({ onlyFull: !onlyFull })}
          aria-pressed={onlyFull}
        >
          <ShieldAlert className="mr-1 h-4 w-4" /> Somente FULL
        </Button>
      </div>
    </div>
  );
}
