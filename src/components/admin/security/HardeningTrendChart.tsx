import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp } from 'lucide-react';
import { logger } from '@/lib/logger';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';

interface Snapshot {
  id: string;
  snapshot_at: string;
  score: number;
  max_score: number;
  failures: string[];
}

export function HardeningTrendChart() {
  const [data, setData] = useState<Snapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
      // BUG-HARDENINGTRENDCHART-SNAPSHOTS-SELECT-SILENT-FAIL FIX: { data: rows } without
      // error check — RLS failure silently showed "ainda sem snapshots" empty state.
      const { data: rows, error: snapshotsErr } = await supabase
        .from('hardening_health_snapshots')
        .select('id, snapshot_at, score, max_score, failures')
        .gte('snapshot_at', since)
        .order('snapshot_at', { ascending: true });
      if (snapshotsErr) {
        logger.error('[HardeningTrendChart] Failed to load snapshots:', snapshotsErr);
      }
      setData((rows || []) as Snapshot[]);
      setLoading(false);
    };
    void load();
  }, []);

  const chartData = data.map((d) => ({
    label: format(new Date(d.snapshot_at), 'dd/MM', { locale: ptBR }),
    score: d.score,
    max: d.max_score,
  }));

  const last = data[data.length - 1];
  const min = data.length > 0 ? Math.min(...data.map((d) => d.score)) : null;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5" /> Tendência da Saúde 30d
          </CardTitle>
          <CardDescription>Snapshot diário do score de hardening</CardDescription>
        </div>
        {last && (
          <div className="flex flex-col items-end gap-1">
            <Badge variant={last.score === last.max_score ? 'default' : 'destructive'}>
              Atual {last.score}/{last.max_score}
            </Badge>
            {min !== null && min < (last?.max_score ?? 5) && (
              <span className="text-xs text-muted-foreground">Mínimo 30d: {min}</span>
            )}
          </div>
        )}
      </CardHeader>
      <CardContent>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Ainda sem snapshots registrados — o primeiro será gerado às 04:05 UTC.
          </p>
        ) : (
          <div className="h-48 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <XAxis dataKey="label" tick={{ fontSize: 11 }} />
                <YAxis domain={[0, 5]} tick={{ fontSize: 11 }} width={24} />
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
                <Line
                  type="monotone"
                  dataKey="score"
                  stroke="hsl(var(--primary))"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
