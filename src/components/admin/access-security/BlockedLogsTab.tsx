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
import { ShieldAlert } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface BlockedLog {
  id: string;
  created_at: string;
  email: string | null;
  ip_address: string;
  city: string | null;
  state: string | null;
  country: string | null;
  block_reason: string;
}

const BLOCK_REASON_LABELS: Record<string, string> = {
  ip_not_whitelisted: 'IP não autorizado',
  city_not_whitelisted: 'Cidade não autorizada',
  too_many_attempts: 'Muitas tentativas',
};

interface BlockedLogsTabProps {
  logs: BlockedLog[];
}

export function BlockedLogsTab({ logs }: BlockedLogsTabProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Últimos Acessos Bloqueados</CardTitle>
        <CardDescription>
          Registro das últimas 50 tentativas de acesso bloqueadas pelo sistema
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <ShieldAlert className="mx-auto mb-2 h-8 w-8 opacity-40" />
            Nenhum acesso bloqueado registrado
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Email</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Localização</TableHead>
                <TableHead>Motivo</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-sm">{log.email || '—'}</TableCell>
                  <TableCell className="font-mono text-xs">{log.ip_address}</TableCell>
                  <TableCell className="text-sm">
                    {log.city
                      ? `${log.city}${log.state ? `, ${log.state}` : ''}${log.country ? ` (${log.country})` : ''}`
                      : '—'}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={log.block_reason === 'too_many_attempts' ? 'destructive' : 'outline'}
                      className="text-xs"
                    >
                      {BLOCK_REASON_LABELS[log.block_reason] || log.block_reason}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
