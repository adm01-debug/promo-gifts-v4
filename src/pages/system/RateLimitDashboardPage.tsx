import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { useToast } from '@/hooks/ui';
import { sanitizeError } from '@/lib/security/sanitize-error';
import { Shield, AlertTriangle, Ban, RefreshCw, Clock, Activity } from 'lucide-react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { PageSEO } from '@/components/seo/PageSEO';

interface RateLimitLog {
  id: string;
  ip_address: string;
  endpoint: string;
  request_count: number;
  blocked: boolean;
  created_at: string;
}

export default function RateLimitDashboardPage() {
  const [logs, setLogs] = useState<RateLimitLog[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [stats, setStats] = useState({ totalRequests: 0, blockedRequests: 0, uniqueIPs: 0 });
  const { toast } = useToast();

  const fetchData = useCallback(async () => {
    try {
      const { data: loginAttempts, error } = await supabase
        .from('login_attempts')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

      if (error) throw error;

      const transformedLogs: RateLimitLog[] = (loginAttempts || []).map((attempt) => ({
        id: attempt.id,
        ip_address: attempt.ip_address,
        endpoint: '/auth/login',
        request_count: 1,
        blocked: !attempt.success,
        created_at: attempt.created_at,
      }));

      setLogs(transformedLogs);

      const blocked = transformedLogs.filter((l) => l.blocked).length;
      const uniqueIPs = new Set(transformedLogs.map((l) => l.ip_address)).size;
      setStats({
        totalRequests: transformedLogs.length,
        blockedRequests: blocked,
        uniqueIPs,
      });
    } catch (error: unknown) {
      toast({ title: 'Erro', description: sanitizeError(error), variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  return (
    <>
      <PageSEO
        title="Rate Limit"
        description="Monitore limites de requisições e controle de acesso."
        path="/admin/rate-limit"
        noIndex
      />
      <div className="mx-auto w-full max-w-[1920px] animate-fade-in space-y-3 px-3 py-3 pb-24 sm:space-y-4 sm:px-4 sm:py-4 md:pb-6 lg:px-6 xl:px-8">
        <div className="flex items-center justify-between">
          <div>
            <h1
              data-testid="page-title-rate-limit"
              className="font-display text-2xl font-bold tracking-tight"
            >
              Dashboard de Rate Limiting
            </h1>
            <p className="text-muted-foreground">Monitoramento de requisições e bloqueios</p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchData}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>

        <div className="grid gap-4 md:grid-cols-3">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Total de Requisições</CardTitle>
              <Activity className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.totalRequests}</div>
              <p className="text-xs text-muted-foreground">Últimas 100 requisições</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">Requisições Bloqueadas</CardTitle>
              <Ban className="h-4 w-4 text-destructive" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-destructive">{stats.blockedRequests}</div>
              <p className="text-xs text-muted-foreground">
                {stats.totalRequests > 0
                  ? ((stats.blockedRequests / stats.totalRequests) * 100).toFixed(1)
                  : 0}
                % do total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium">IPs Únicos</CardTitle>
              <Shield className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats.uniqueIPs}</div>
              <p className="text-xs text-muted-foreground">Endereços distintos</p>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Clock className="h-5 w-5" />
              Logs de Requisições
            </CardTitle>
            <CardDescription>Histórico recente de requisições e tentativas</CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-8">
                <div className="h-8 w-8 animate-spin rounded-full border-b-2 border-primary" />
              </div>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>IP</TableHead>
                    <TableHead>Endpoint</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Data</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={4} className="py-8 text-center text-muted-foreground">
                        Nenhuma tentativa registrada
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((log) => (
                      <TableRow key={log.id}>
                        <TableCell className="font-mono text-sm">{log.ip_address}</TableCell>
                        <TableCell>{log.endpoint}</TableCell>
                        <TableCell>
                          {log.blocked ? (
                            <Badge variant="destructive" className="flex w-fit items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              Falhou
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="border-success text-success">
                              Sucesso
                            </Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-muted-foreground">
                          {format(new Date(log.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
