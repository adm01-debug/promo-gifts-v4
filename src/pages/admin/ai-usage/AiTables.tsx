import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import { Users, Brain, Activity } from 'lucide-react';

const formatCurrency = (val: number) => `$${val.toFixed(4)}`;
const formatNumber = (val: number) => val.toLocaleString('pt-BR');

interface UserStats {
  userId: string;
  count: number;
  tokens: number;
  cost: number;
}
interface ModelStats {
  name: string;
  count: number;
  tokens: number;
  cost: number;
}
interface LogEntry {
  id: string;
  created_at: string;
  user_id: string;
  function_name: string;
  model: string | null;
  total_tokens: number;
  estimated_cost_usd: string | number | null;
  duration_ms: number | null;
  status: string;
}

interface AiTablesProps {
  byUser: UserStats[];
  byModel: ModelStats[];
  logs: LogEntry[];
  statsLoading: boolean;
  logsLoading: boolean;
}

export function AiTables({ byUser, byModel, logs, statsLoading, logsLoading }: AiTablesProps) {
  return (
    <>
      {/* Top Users */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Users className="h-4 w-4" /> Top Usuários por Consumo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="space-y-2">
              {[...Array(5)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="px-3 py-2 text-left text-xs font-medium">Usuário</th>
                    <th className="px-3 py-2 text-right text-xs font-medium">Requisições</th>
                    <th className="px-3 py-2 text-right text-xs font-medium">Tokens</th>
                    <th className="px-3 py-2 text-right text-xs font-medium">Custo (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {byUser.slice(0, 10).map((u) => (
                    <tr key={u.userId} className="border-b border-border/20 hover:bg-accent/20">
                      <td className="px-3 py-2 font-mono text-xs">{u.userId.slice(0, 8)}...</td>
                      <td className="px-3 py-2 text-right">{formatNumber(u.count)}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(u.tokens)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(u.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* By Model */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Brain className="h-4 w-4" /> Consumo por Modelo
          </CardTitle>
        </CardHeader>
        <CardContent>
          {statsLoading ? (
            <div className="space-y-2">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="px-3 py-2 text-left text-xs font-medium">Modelo</th>
                    <th className="px-3 py-2 text-right text-xs font-medium">Chamadas</th>
                    <th className="px-3 py-2 text-right text-xs font-medium">Tokens</th>
                    <th className="px-3 py-2 text-right text-xs font-medium">Custo (USD)</th>
                  </tr>
                </thead>
                <tbody>
                  {byModel.map((m) => (
                    <tr key={m.name} className="border-b border-border/20 hover:bg-accent/20">
                      <td className="px-3 py-2">
                        <Badge variant="outline" className="font-mono text-xs">
                          {m.name}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right">{formatNumber(m.count)}</td>
                      <td className="px-3 py-2 text-right">{formatNumber(m.tokens)}</td>
                      <td className="px-3 py-2 text-right font-medium">{formatCurrency(m.cost)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Recent Logs */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-sm font-medium">
            <Activity className="h-4 w-4" /> Últimas Chamadas
          </CardTitle>
        </CardHeader>
        <CardContent>
          {logsLoading ? (
            <div className="space-y-2">
              {[...Array(8)].map((_, i) => (
                <Skeleton key={i} className="h-8 w-full" />
              ))}
            </div>
          ) : (
            <div className="max-h-[400px] overflow-x-auto overflow-y-auto">
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-card">
                  <tr className="border-b border-border/50 text-muted-foreground">
                    <th className="px-2 py-2 text-left font-medium">Data</th>
                    <th className="px-2 py-2 text-left font-medium">Usuário</th>
                    <th className="px-2 py-2 text-left font-medium">Função</th>
                    <th className="px-2 py-2 text-left font-medium">Modelo</th>
                    <th className="px-2 py-2 text-right font-medium">Tokens</th>
                    <th className="px-2 py-2 text-right font-medium">Custo</th>
                    <th className="px-2 py-2 text-right font-medium">Tempo</th>
                    <th className="px-2 py-2 text-center font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map((log) => (
                    <tr key={log.id} className="border-b border-border/20 hover:bg-accent/20">
                      <td className="whitespace-nowrap px-2 py-1.5">
                        {new Date(log.created_at).toLocaleString('pt-BR', {
                          day: '2-digit',
                          month: '2-digit',
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </td>
                      <td className="px-2 py-1.5 font-mono">{log.user_id.slice(0, 8)}</td>
                      <td className="px-2 py-1.5">
                        <Badge variant="outline" className="text-[10px]">
                          {log.function_name}
                        </Badge>
                      </td>
                      <td className="px-2 py-1.5 text-muted-foreground">
                        {(log.model || '').replace(/^(google|openai)\//, '')}
                      </td>
                      <td className="px-2 py-1.5 text-right">{formatNumber(log.total_tokens)}</td>
                      <td className="px-2 py-1.5 text-right">
                        {formatCurrency(Number(log.estimated_cost_usd))}
                      </td>
                      <td className="px-2 py-1.5 text-right">
                        {log.duration_ms ? `${log.duration_ms}ms` : '-'}
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        {log.status === 'success' ? (
                          <Badge
                            variant="outline"
                            className="border-success/30 bg-success/10 text-[10px] text-success"
                          >
                            OK
                          </Badge>
                        ) : (
                          <Badge
                            variant="outline"
                            className="border-destructive/30 bg-destructive/10 text-[10px] text-destructive"
                          >
                            Erro
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
