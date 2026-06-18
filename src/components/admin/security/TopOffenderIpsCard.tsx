import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { Flame, Loader2 } from 'lucide-react';
import { BlockIpButton } from './BlockIpButton';
import { cn } from '@/lib/utils';

interface OffenderRow {
  ip: string;
  loginFailures: number;
  tokenFailures: number;
  botHits: number;
  total: number;
}

export function TopOffenderIpsCard() {
  const [rows, setRows] = useState<OffenderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const [loginRes, tokenRes, botRes] = await Promise.all([
      supabase
        .from('login_attempts')
        .select('ip_address')
        .eq('success', false)
        .gte('created_at', since)
        .limit(2000),
      supabase
        .from('public_token_failures')
        .select('ip_address')
        .gte('created_at', since)
        .limit(2000),
      supabase
        .from('bot_detection_log')
        .select('ip_address')
        .eq('blocked', true)
        .gte('created_at', since)
        .limit(2000),
    ]);

    const map = new Map<string, OffenderRow>();
    const bump = (ip: string | null, key: keyof Omit<OffenderRow, 'ip' | 'total'>) => {
      if (!ip) return;
      const r = map.get(ip) ?? { ip, loginFailures: 0, tokenFailures: 0, botHits: 0, total: 0 };
      r[key] += 1;
      r.total += 1;
      map.set(ip, r);
    };

    (loginRes.data ?? []).forEach((r) => bump(r.ip_address, 'loginFailures'));
    (tokenRes.data ?? []).forEach((r) => bump(r.ip_address, 'tokenFailures'));
    (botRes.data ?? []).forEach((r) => bump(r.ip_address, 'botHits'));

    const top = [...map.values()].sort((a, b) => b.total - a.total).slice(0, 10);

    setRows(top);
    setLoading(false);
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 60_000);
    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="border-[1.5px]">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Flame className="h-4 w-4 text-destructive" />
          Top IPs ofensores (24h)
          {loading && <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />}
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-0">
        {!loading && rows.length === 0 && (
          <p className="text-xs text-muted-foreground">
            Nenhuma atividade ofensiva nas últimas 24h.
          </p>
        )}
        {rows.length > 0 && (
          <div className="space-y-1.5">
            {rows.map((r) => (
              <div
                key={r.ip}
                className={cn(
                  'flex items-center justify-between gap-2 rounded-md border px-2.5 py-1.5 text-xs',
                  r.total >= 20 && 'border-destructive/40 bg-destructive/5',
                  r.total >= 10 && r.total < 20 && 'border-warning/40 bg-warning/5',
                )}
              >
                <div className="flex min-w-0 flex-1 items-center gap-2">
                  <span className="font-mono font-medium tabular-nums">{r.ip}</span>
                  <div className="flex flex-wrap gap-1">
                    {r.loginFailures > 0 && (
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        login {r.loginFailures}
                      </Badge>
                    )}
                    {r.tokenFailures > 0 && (
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        token {r.tokenFailures}
                      </Badge>
                    )}
                    {r.botHits > 0 && (
                      <Badge variant="outline" className="h-5 px-1.5 text-[10px]">
                        bot {r.botHits}
                      </Badge>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-display font-bold tabular-nums">{r.total}</span>
                  <BlockIpButton
                    defaultIp={r.ip}
                    defaultReason={`Top ofensor 24h: ${r.loginFailures} login + ${r.tokenFailures} token + ${r.botHits} bot`}
                    onBlocked={load}
                  />
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
