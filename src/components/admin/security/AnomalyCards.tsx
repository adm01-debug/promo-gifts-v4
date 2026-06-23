import { useEffect, useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import { AlertTriangle, ShieldAlert, KeyRound, Activity } from 'lucide-react';
import { cn } from '@/lib/utils';
import { BlockIpButton } from './BlockIpButton';
import { TopOffenderIpsCard } from './TopOffenderIpsCard';

interface AnomalyStats {
  loginFailures24h: number;
  botHits24h: number;
  tokenFailures24h: number;
  distinctTokenIps24h: number;
  loading: boolean;
}

export function AnomalyCards() {
  // BUG-HEAD-GUARD FIX (2026-06-23): 3 HEAD requests com setInterval=30s sem guard.
  const { rolesLoaded, isAdmin } = useAuth();
  const [stats, setStats] = useState<AnomalyStats>({
    loginFailures24h: 0,
    botHits24h: 0,
    tokenFailures24h: 0,
    distinctTokenIps24h: 0,
    loading: true,
  });

  useEffect(() => {
    if (!rolesLoaded || !isAdmin) return;
    let cancelled = false;

    const load = async () => {
      const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

      const [loginRes, botRes, tokenRes, tokenIpsRes] = await Promise.all([
        supabase
          .from('login_attempts')
          .select('*', { count: 'exact', head: true })
          .eq('success', false)
          .gte('created_at', since),
        supabase
          .from('bot_detection_log')
          .select('*', { count: 'exact', head: true })
          .eq('blocked', true)
          .gte('created_at', since),
        supabase
          .from('public_token_failures')
          .select('*', { count: 'exact', head: true })
          .gte('created_at', since),
        supabase
          .from('public_token_failures')
          .select('ip_address')
          .gte('created_at', since)
          .limit(1000),
      ]);

      if (cancelled) return;

      const distinctIps = new Set(
        ((tokenIpsRes.data as Array<{ ip_address: string }> | null) || []).map((r) => r.ip_address),
      ).size;

      setStats({
        loginFailures24h: loginRes.count || 0,
        botHits24h: botRes.count || 0,
        tokenFailures24h: tokenRes.count || 0,
        distinctTokenIps24h: distinctIps,
        loading: false,
      });
    };

    load();
    const interval = setInterval(load, 30_000);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, [rolesLoaded, isAdmin]);  // BUG-HEAD-GUARD

  const cards = [
    {
      label: 'Falhas de login',
      value: stats.loginFailures24h,
      icon: <KeyRound className="h-4 w-4" />,
      severity:
        stats.loginFailures24h > 50 ? 'high' : stats.loginFailures24h > 10 ? 'medium' : 'low',
    },
    {
      label: 'Bots bloqueados',
      value: stats.botHits24h,
      icon: <ShieldAlert className="h-4 w-4" />,
      severity: stats.botHits24h > 100 ? 'high' : stats.botHits24h > 20 ? 'medium' : 'low',
    },
    {
      label: 'Falhas de token público',
      value: stats.tokenFailures24h,
      icon: <AlertTriangle className="h-4 w-4" />,
      severity:
        stats.tokenFailures24h > 20 ? 'high' : stats.tokenFailures24h > 5 ? 'medium' : 'low',
    },
    {
      label: 'IPs distintos em tokens',
      value: stats.distinctTokenIps24h,
      icon: <Activity className="h-4 w-4" />,
      severity:
        stats.distinctTokenIps24h > 30 ? 'high' : stats.distinctTokenIps24h > 10 ? 'medium' : 'low',
    },
  ] as const;

  const showQuickBlock =
    stats.loginFailures24h >= 10 || stats.tokenFailures24h >= 5 || stats.botHits24h >= 20;

  return (
    <div className="space-y-3">
      <div className="grid gap-3 md:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label} className="border-[1.5px]">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-medium text-muted-foreground">{c.label}</p>
                <div
                  className={cn(
                    'rounded-md p-1.5',
                    c.severity === 'high' && 'bg-destructive/10 text-destructive',
                    c.severity === 'medium' && 'bg-warning/10 text-warning',
                    c.severity === 'low' && 'bg-muted text-muted-foreground',
                  )}
                >
                  {c.icon}
                </div>
              </div>
              <p
                className={cn(
                  'mt-2 font-display text-2xl font-bold tabular-nums',
                  c.severity === 'high' && 'text-destructive',
                  c.severity === 'medium' && 'text-warning',
                )}
              >
                {stats.loading ? '—' : c.value}
              </p>
              <p className="mt-1 text-[10px] uppercase tracking-wide text-muted-foreground">
                Últimas 24h
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {showQuickBlock && (
        <div className="flex items-center justify-between gap-3 rounded-lg border border-warning/40 bg-warning/5 p-3">
          <div className="text-sm">
            <p className="font-medium">Atividade suspeita detectada nas últimas 24h</p>
            <p className="text-xs text-muted-foreground">
              Identifique o IP nas tabelas abaixo e bloqueie temporariamente.
            </p>
          </div>
          <BlockIpButton
            variant="destructive"
            defaultReason="Bloqueio rápido — anomalia detectada no Security Center"
          />
        </div>
      )}

      <TopOffenderIpsCard />
    </div>
  );
}
