import { useMemo } from 'react';
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
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { TrendingUp, AlertOctagon, Target, Ban } from 'lucide-react';

interface BotLog {
  id: string;
  ip_address: string;
  endpoint: string;
  detection_reason: string;
  blocked: boolean;
  created_at: string;
}

interface Props {
  botLogs: BotLog[];
  onBlockIp: (ip: string) => void;
}

interface AggRow {
  key: string;
  total: number;
  blocked: number;
  reasons: Set<string>;
}

export function SecurityAnalytics({ botLogs, onBlockIp }: Props) {
  const { topIps, topEndpoints, timeline, topReasons } = useMemo(() => {
    const ipMap = new Map<string, AggRow>();
    const epMap = new Map<string, AggRow>();
    const reasonMap = new Map<string, number>();

    for (const log of botLogs) {
      // IPs
      let ip = ipMap.get(log.ip_address);
      if (!ip) {
        ip = { key: log.ip_address, total: 0, blocked: 0, reasons: new Set() };
        ipMap.set(log.ip_address, ip);
      }
      ip.total += 1;
      if (log.blocked) ip.blocked += 1;
      ip.reasons.add(log.detection_reason);

      // Endpoints
      let ep = epMap.get(log.endpoint);
      if (!ep) {
        ep = { key: log.endpoint, total: 0, blocked: 0, reasons: new Set() };
        epMap.set(log.endpoint, ep);
      }
      ep.total += 1;
      if (log.blocked) ep.blocked += 1;
      ep.reasons.add(log.detection_reason);

      // Reasons
      reasonMap.set(log.detection_reason, (reasonMap.get(log.detection_reason) || 0) + 1);
    }

    const computedTopIps = Array.from(ipMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    const computedTopEndpoints = Array.from(epMap.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 10);
    const computedTopReasons = Array.from(reasonMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([reason, count]) => ({ reason, count }));

    // Timeline: last 24h bucketed per hour
    const now = Date.now();
    const buckets: { hour: string; total: number; blocked: number; ts: number }[] = [];
    for (let i = 23; i >= 0; i--) {
      const ts = now - i * 3600_000;
      const d = new Date(ts);
      buckets.push({
        ts: Math.floor(ts / 3600_000) * 3600_000,
        hour: `${String(d.getHours()).padStart(2, '0')}h`,
        total: 0,
        blocked: 0,
      });
    }
    for (const log of botLogs) {
      const t = new Date(log.created_at).getTime();
      const bucketTs = Math.floor(t / 3600_000) * 3600_000;
      const bucket = buckets.find((b) => b.ts === bucketTs);
      if (bucket) {
        bucket.total += 1;
        if (log.blocked) bucket.blocked += 1;
      }
    }

    return {
      topIps: computedTopIps,
      topEndpoints: computedTopEndpoints,
      timeline: buckets,
      topReasons: computedTopReasons,
    };
  }, [botLogs]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <TrendingUp className="h-4 w-4" /> Atividade nas últimas 24h
          </CardTitle>
          <CardDescription>Detecções por hora (total vs. bloqueadas)</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="h-[220px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timeline} margin={{ top: 8, right: 8, left: -16, bottom: 0 }}>
                <defs>
                  <linearGradient id="totalGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="blockedGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(var(--destructive))" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(var(--destructive))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" opacity={0.4} />
                <XAxis dataKey="hour" stroke="hsl(var(--muted-foreground))" fontSize={11} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} allowDecimals={false} />
                <Tooltip
                  contentStyle={{
                    background: '#1a1a1a',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '6px',
                    fontSize: '6px',
                    fontWeight: 600,
                    padding: '4px 6px',
                    backdropFilter: 'blur(8px)',
                    color: '#fff',
                  }}
                  itemStyle={{ padding: 0 }}
                  labelStyle={{
                    fontSize: '5.5px',
                    opacity: 0.7,
                    marginBottom: '2px',
                    fontWeight: 800,
                    textTransform: 'uppercase',
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="total"
                  stroke="hsl(var(--primary))"
                  fill="url(#totalGradient)"
                  strokeWidth={2}
                  name="Total"
                />
                <Area
                  type="monotone"
                  dataKey="blocked"
                  stroke="hsl(var(--destructive))"
                  fill="url(#blockedGradient)"
                  strokeWidth={2}
                  name="Bloqueadas"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertOctagon className="h-4 w-4 text-destructive" /> Top 10 IPs atacantes
            </CardTitle>
            <CardDescription>Maior volume de detecções na janela atual</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>IP</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Block</TableHead>
                  <TableHead>Razões</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {topIps.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={5}
                      className="py-6 text-center text-xs text-muted-foreground"
                    >
                      Sem dados
                    </TableCell>
                  </TableRow>
                ) : (
                  topIps.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="font-mono text-xs">{row.key}</TableCell>
                      <TableCell className="text-right text-xs">
                        <Badge variant="outline">{row.total}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {row.blocked > 0 ? (
                          <Badge variant="destructive">{row.blocked}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                      <TableCell
                        className="max-w-[160px] truncate text-xs text-muted-foreground"
                        title={Array.from(row.reasons).join(', ')}
                      >
                        {Array.from(row.reasons).slice(0, 2).join(', ')}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-7 px-2 text-xs"
                          onClick={() => onBlockIp(row.key)}
                        >
                          <Ban className="mr-1 h-3 w-3" /> Bloquear
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Target className="h-4 w-4" /> Top 10 endpoints alvo
            </CardTitle>
            <CardDescription>Funções mais visadas por bots e scrapers</CardDescription>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Endpoint</TableHead>
                  <TableHead className="text-right">Total</TableHead>
                  <TableHead className="text-right">Block</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {topEndpoints.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={3}
                      className="py-6 text-center text-xs text-muted-foreground"
                    >
                      Sem dados
                    </TableCell>
                  </TableRow>
                ) : (
                  topEndpoints.map((row) => (
                    <TableRow key={row.key}>
                      <TableCell className="text-xs">{row.key}</TableCell>
                      <TableCell className="text-right text-xs">
                        <Badge variant="outline">{row.total}</Badge>
                      </TableCell>
                      <TableCell className="text-right text-xs">
                        {row.blocked > 0 ? (
                          <Badge variant="destructive">{row.blocked}</Badge>
                        ) : (
                          <span className="text-muted-foreground">0</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Distribuição por razão de detecção</CardTitle>
          <CardDescription>Padrões observados pelo helper bot-protection</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {topReasons.length === 0 ? (
              <span className="text-xs text-muted-foreground">Sem dados na janela atual.</span>
            ) : (
              topReasons.map(({ reason, count }) => (
                <Badge key={reason} variant="outline" className="text-xs">
                  {reason} <span className="ml-1.5 font-semibold text-foreground">{count}</span>
                </Badge>
              ))
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
