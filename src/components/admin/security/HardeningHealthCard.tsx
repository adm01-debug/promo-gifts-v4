import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle2, XCircle, ShieldCheck, RefreshCw } from 'lucide-react';
import { useToast } from '@/hooks/ui';
import { cn } from '@/lib/utils';

interface HardeningStatus {
  private_buckets_count: number;
  private_buckets_ok: boolean;
  sensitive_realtime_count: number;
  realtime_isolation_ok: boolean;
  pg_trgm_in_extensions: boolean;
  cleanup_job_active: boolean;
  mfa_enforced_in_app: boolean;
}

interface CheckItem {
  label: string;
  ok: boolean;
  detail: string;
}

export function HardeningHealthCard() {
  const [status, setStatus] = useState<HardeningStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('check_hardening_status' as never);
      if (error) throw error;
      setStatus(data as unknown as HardeningStatus);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Erro desconhecido';
      toast({ title: 'Erro ao verificar hardening', description: msg, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    void load();
  }, [load]);

  const checks: CheckItem[] = status
    ? [
        {
          label: 'Buckets privados',
          ok: status.private_buckets_ok,
          detail: `${status.private_buckets_count}/4 buckets sensíveis privados`,
        },
        {
          label: 'Realtime isolado',
          ok: status.realtime_isolation_ok,
          detail:
            status.sensitive_realtime_count === 0
              ? 'Nenhuma tabela sensível em supabase_realtime'
              : `${status.sensitive_realtime_count} tabela(s) sensível(is) ainda expostas`,
        },
        {
          label: 'pg_trgm em schema extensions',
          ok: status.pg_trgm_in_extensions,
          detail: status.pg_trgm_in_extensions ? 'Isolada de public' : 'Ainda em public',
        },
        {
          label: 'MFA admin obrigatório',
          ok: status.mfa_enforced_in_app,
          detail: 'Enforced no AdminRoute',
        },
        {
          label: 'Limpeza automática diária',
          ok: status.cleanup_job_active,
          detail: status.cleanup_job_active
            ? 'cleanup-security-logs-daily ativo'
            : 'Job de cron não está ativo',
        },
      ]
    : [];

  const okCount = checks.filter((c) => c.ok).length;
  const total = checks.length;
  const allGood = total > 0 && okCount === total;

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-2">
        <div>
          <CardTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5" /> Saúde do Hardening
          </CardTitle>
          <CardDescription>Estado atual das defesas de plataforma</CardDescription>
        </div>
        <div className="flex items-center gap-2">
          {status && (
            <Badge variant={allGood ? 'default' : 'destructive'} className="text-xs">
              {okCount}/{total}
            </Badge>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              load();
            }}
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {loading && !status ? (
          <p className="text-sm text-muted-foreground">Verificando…</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {checks.map((c) => (
              <li
                key={c.label}
                className="flex items-start gap-2 rounded-md border border-border/50 p-2.5"
              >
                {c.ok ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />
                ) : (
                  <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
                )}
                <div className="min-w-0">
                  <p className="text-sm font-medium leading-tight">{c.label}</p>
                  <p className="mt-0.5 text-xs text-muted-foreground">{c.detail}</p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
