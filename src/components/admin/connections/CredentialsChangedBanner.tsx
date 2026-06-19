import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, RefreshCw, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useSecretsManager } from '@/hooks/admin';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';

interface CredentialsChangedBannerProps {
  /** Callback executed in parallel with cache invalidation + secret list refresh. */
  onRefreshed?: () => void | Promise<void>;
}

interface PendingChange {
  count: number;
  lastEvent: 'INSERT' | 'UPDATE' | 'DELETE';
  lastName: string | null;
  lastAt: number;
}

/**
 * Subscreve postgres_changes em `public.integration_credentials` e exibe uma
 * faixa de aviso com um botão de atualização imediata sempre que credenciais
 * são inseridas, alteradas ou removidas no banco. Garante que a UI do
 * /admin/conexoes reflete o estado real do banco sem depender do refresh manual.
 */
export function CredentialsChangedBanner({ onRefreshed }: CredentialsChangedBannerProps) {
  const { refreshCache, list } = useSecretsManager();
  const [pending, setPending] = useState<PendingChange | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const onRefreshedRef = useRef(onRefreshed);

  useEffect(() => {
    onRefreshedRef.current = onRefreshed;
  }, [onRefreshed]);

  useEffect(() => {
    const channel = supabase
      .channel('admin-conexoes-credentials-changes')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'integration_credentials' },
        (payload) => {
          const event = payload.eventType;
          // Coluna real em integration_credentials é `secret_name` —
          // typo histórico (`name`) escondia o nome do secret alterado
          // no aviso de auto-refresh.
          const payloadOld: { secret_name?: string } | null = payload.old;
          const row = (payload.new as { secret_name?: string } | null) ?? payloadOld;
          const name = row?.secret_name ?? null;
          setPending((prev) => ({
            count: (prev?.count ?? 0) + 1,
            lastEvent: event,
            lastName: name,
            lastAt: Date.now(),
          }));
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    if (isRefreshing) return;
    setIsRefreshing(true);
    const startedAt = Date.now();
    try {
      const [cacheRes, listRes, hookRes] = await Promise.allSettled([
        refreshCache(),
        list(),
        Promise.resolve().then(() => onRefreshedRef.current?.()),
      ]);
      const elapsed = ((Date.now() - startedAt) / 1000).toFixed(1);
      const cacheOk = cacheRes.status === 'fulfilled' && cacheRes.value.ok;
      const listOk = listRes.status === 'fulfilled';
      const hookOk = hookRes.status === 'fulfilled';
      const credCount = listOk && Array.isArray(listRes.value) ? listRes.value.length : 0;
      const okCount = [cacheOk, listOk, hookOk].filter(Boolean).length;

      if (okCount === 3) {
        toast.success('Status e cards atualizados', {
          description: `Cache invalidado · ${credCount} credenciais relidas (${elapsed}s)`,
        });
        setPending(null);
      } else {
        toast.warning('Atualização parcial', {
          description: `Algumas operações falharam (${elapsed}s)`,
        });
      }
    } finally {
      setIsRefreshing(false);
    }
  }, [isRefreshing, refreshCache, list]);

  if (!pending) return null;

  const eventLabel =
    pending.lastEvent === 'INSERT'
      ? 'criada'
      : pending.lastEvent === 'DELETE'
        ? 'removida'
        : 'alterada';

  const description =
    pending.count === 1
      ? `Credencial ${pending.lastName ? `"${pending.lastName}" ` : ''}${eventLabel} no banco.`
      : `${pending.count} alterações detectadas em credenciais (última: ${pending.lastName ?? '—'}, ${eventLabel}).`;

  return (
    <div
      role="status"
      aria-live="polite"
      className="flex items-center gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 px-4 py-2.5 text-sm"
    >
      <RefreshCw
        className="h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400"
        aria-hidden="true"
      />
      <div className="min-w-0 flex-1">
        <p className="font-medium text-foreground">Credenciais alteradas no banco</p>
        <p className="truncate text-xs text-muted-foreground">{description}</p>
      </div>
      <Button
        type="button"
        size="sm"
        variant="default"
        onClick={() => void handleRefresh()}
        disabled={isRefreshing}
        aria-label="Recarregar status e cards agora"
      >
        {isRefreshing ? (
          <Loader2 className="mr-1 h-4 w-4 animate-spin" />
        ) : (
          <RefreshCw className="mr-1 h-4 w-4" />
        )}
        {isRefreshing ? 'Atualizando…' : 'Atualizar agora'}
      </Button>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7"
        onClick={() => setPending(null)}
        aria-label="Dispensar aviso"
        disabled={isRefreshing}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );
}
