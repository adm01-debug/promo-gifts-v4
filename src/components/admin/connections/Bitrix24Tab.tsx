import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Briefcase } from 'lucide-react';
import { ConnectionStatusBadge } from './ConnectionStatusBadge';
import { SecretField } from './SecretField';
import { useSecretsManager } from '@/hooks/admin';
import { useConnectionTester } from '@/hooks/intelligence';
import { ConnectionTimelineDrawer } from './ConnectionTimelineDrawer';
import { LastTestLine, type LastTestInfo } from './LastTestLine';
import { ConnectionTestHistoryPanel } from './ConnectionTestHistoryPanel';
import { RetestButton } from './RetestButton';
import { ConnectionTestDetailsDialog } from './ConnectionTestDetailsDialog';
import { RefreshFromDbButton } from './RefreshFromDbButton';
import { hasSuspiciousLength, getPreflightIssues } from './secretValidators';
import { ConnectionPreflightAlert } from './ConnectionPreflightAlert';
import { TestProgressIndicator, type TestProgressPhase } from './TestProgressIndicator';
import { RetestCooldownSelector } from './RetestCooldownSelector';

export function Bitrix24Tab() {
  const { secrets, list } = useSecretsManager();
  const { test, isTesting, fetchLastTest } = useConnectionTester();
  const [last, setLast] = useState<LastTestInfo | null>(null);
  const [historyKey, setHistoryKey] = useState(0);
  const [detailsDialogOpen, setDetailsDialogOpen] = useState(false);
  const [phase, setPhase] = useState<TestProgressPhase>('idle');
  const [pendingStartedAt, setPendingStartedAt] = useState<string | null>(null);
  const [timelineOpen, setTimelineOpen] = useState(false);

  useEffect(() => {
    list();
  }, [list]);

  const hydrate = useCallback(async () => {
    const r = await fetchLastTest('bitrix24');
    setLast(
      r ? { ok: r.ok, tested_at: r.tested_at, latency_ms: r.latency_ms, message: r.message } : null,
    );
  }, [fetchLastTest]);
  useEffect(() => {
    hydrate();
  }, [hydrate]);

  const get = (n: string) => secrets.find((s) => s.name === n);
  const wh = get('BITRIX24_WEBHOOK_URL');
  const credsOk = !!wh?.has_value;
  const suspicious = hasSuspiciousLength(secrets, ['BITRIX24_WEBHOOK_URL']);
  const credsLooksValid = credsOk && !suspicious;
  const preflightIssues = getPreflightIssues(secrets, [
    { name: 'BITRIX24_WEBHOOK_URL', label: 'Webhook URL' },
  ]);
  const canTest = credsLooksValid && preflightIssues.length === 0;
  const status: 'active' | 'error' | 'unconfigured' = !credsOk
    ? 'unconfigured'
    : last?.ok === false
      ? 'error'
      : 'active';

  const onTest = async () => {
    setPhase('running');
    setPendingStartedAt(new Date().toISOString());
    const r = await test('bitrix24');
    setLast({
      ok: r.ok,
      tested_at: r.tested_at ?? new Date().toISOString(),
      latency_ms: r.latency_ms,
      message: r.error ?? r.message,
      status: r.status,
      error_kind: r.error_kind ?? null,
    });
    setHistoryKey((k) => k + 1);
    setPendingStartedAt(null);
    setPhase(r.ok ? 'completed' : 'failed');
  };

  return (
    <Card
      data-retest-scope
      tabIndex={0}
      className="focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-2">
            <Briefcase className="h-5 w-5 text-primary" />
            <CardTitle>Bitrix24</CardTitle>
          </div>
          <ConnectionStatusBadge status={status} />
        </div>
        <CardDescription>
          Sincronização automática de orçamentos e contatos com o Bitrix24.
        </CardDescription>
      </CardHeader>
      <CardContent className="max-w-2xl space-y-4">
        <SecretField
          label="Webhook URL completa"
          secretName="BITRIX24_WEBHOOK_URL"
          status={wh}
          onSaved={list}
          connectionId="bitrix24"
          helperText="Ex: https://seudominio.bitrix24.com.br/rest/1/abc123xyz/"
        />
        <SecretField
          label="Domínio Bitrix24"
          secretName="BITRIX24_DOMAIN"
          status={get('BITRIX24_DOMAIN')}
          onSaved={list}
          connectionId="bitrix24"
        />
        <SecretField
          label="User ID"
          secretName="BITRIX24_USER_ID"
          status={get('BITRIX24_USER_ID')}
          onSaved={list}
          connectionId="bitrix24"
        />
        <SecretField
          label="Token"
          secretName="BITRIX24_TOKEN"
          status={get('BITRIX24_TOKEN')}
          onSaved={list}
          connectionId="bitrix24"
        />
        <ConnectionPreflightAlert issues={preflightIssues} />
        <div className="flex flex-wrap gap-2 pt-2">
          <Button
            size="sm"
            disabled={isTesting || !canTest}
            title={
              preflightIssues.length > 0
                ? 'Corrija o campo acima antes de testar'
                : !credsOk
                  ? 'Configure o Webhook URL primeiro'
                  : !credsLooksValid
                    ? 'Webhook com formato suspeito (comprimento curto) — re-salve antes de testar'
                    : 'Testar conexão'
            }
            onClick={onTest}
          >
            {isTesting ? 'Testando…' : 'Testar conexão (crm.contact.fields)'}
          </Button>
          <ConnectionTimelineDrawer
            type="bitrix24"
            label="Bitrix24"
            open={timelineOpen}
            onOpenChange={setTimelineOpen}
          />
          <RefreshFromDbButton
            onRefreshed={() => {
              list();
            }}
          />
          <RetestCooldownSelector className="ml-auto" />
        </div>
        <TestProgressIndicator
          phase={phase}
          latencyMs={last?.latency_ms ?? null}
          message={last?.ok ? `HTTP ${last?.status ?? 200}` : (last?.message ?? null)}
          onDismiss={() => setPhase('idle')}
        />
        <LastTestLine
          info={last}
          autoFocusOnFailure
          onClick={last?.tested_at ? () => setDetailsDialogOpen(true) : undefined}
          action={
            <RetestButton
              onRetest={onTest}
              disabled={!canTest}
              cooldownKey="bitrix24"
              disabledReason={
                preflightIssues.length > 0
                  ? 'Corrija os campos sinalizados acima antes de testar'
                  : !credsOk
                    ? 'Configure o Webhook URL primeiro'
                    : 'Webhook com formato suspeito — re-salve antes de testar'
              }
            />
          }
        />
        <ConnectionTestHistoryPanel
          type="bitrix24"
          label="Bitrix24"
          refreshKey={historyKey}
          pendingTest={pendingStartedAt ? { startedAt: pendingStartedAt } : null}
        />
        <ConnectionTestDetailsDialog
          open={detailsDialogOpen}
          onOpenChange={setDetailsDialogOpen}
          connectionType="bitrix24"
          connectionLabel="Bitrix24"
          onViewFullHistory={() => setTimelineOpen(true)}
        />
      </CardContent>
    </Card>
  );
}
