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
  user_email: string | null;
  ip_address: unknown;
  error_message: string | null;
  operation: string;
  table_name: string;
  user_agent: string | null;
}

interface BlockedLogsTabProps {
  logs: BlockedLog[];
}

export function BlockedLogsTab({ logs }: BlockedLogsTabProps) {
  return (
    <Card className="border-border/50">
      <CardHeader>
        <CardTitle className="text-base">Últimos Acessos Negados (RLS)</CardTitle>
        <CardDescription>
          Registro das últimas 50 negações de acesso pelo Row Level Security
        </CardDescription>
      </CardHeader>
      <CardContent>
        {logs.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <ShieldAlert className="mx-auto mb-2 h-8 w-8 opacity-40" />
            Nenhum acesso negado registrado
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Data/Hora</TableHead>
                <TableHead>Usuário</TableHead>
                <TableHead>Operação</TableHead>
                <TableHead>Tabela</TableHead>
                <TableHead>Erro</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {logs.map((log) => (
                <TableRow key={log.id}>
                  <TableCell className="whitespace-nowrap text-xs text-muted-foreground">
                    {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
                  </TableCell>
                  <TableCell className="text-sm">{log.user_email || '—'}</TableCell>
                  <TableCell>
                    <Badge variant="outline" className="font-mono text-xs">
                      {log.operation}
                    </Badge>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{log.table_name}</TableCell>
                  <TableCell className="max-w-48 truncate text-xs text-muted-foreground">
                    {log.error_message || '—'}
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
