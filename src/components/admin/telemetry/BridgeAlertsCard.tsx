/**
 * Card de alertas configuráveis por bridge no /admin/telemetria.
 *
 * - Lista alertas ativos (warn/crit) calculados a partir das amostras
 *   client-side já coletadas em bridgeCallMetrics.
 * - Permite o admin editar limiares de p95 (ms) e tamanho médio de resposta
 *   (KB) por bridge — persistidos em localStorage.
 * - Dispara toast quando um novo alerta aparece (uma vez por chave).
 */
import { useSyncExternalStore, useMemo, useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Bell, Settings2, RotateCcw, AlertTriangle, ShieldCheck } from 'lucide-react';
import { toast } from 'sonner';
import {
  aggregateByEndpoint,
  getBridgeSamples,
  subscribeBridgeCalls,
  type BridgeName,
} from '@/lib/telemetry/bridgeCallMetrics';
import {
  getThresholds,
  subscribeThresholds,
  setThresholds,
  resetThresholds,
  evaluateAlerts,
  type BridgeAlert,
} from '@/lib/telemetry/bridgeAlertThresholds';

const BRIDGES: { id: BridgeName; label: string }[] = [
  { id: 'external-db-bridge', label: 'External DB' },
  { id: 'crm-db-bridge', label: 'CRM DB' },
];

function formatMs(ms: number): string {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}
function formatBytes(b: number): string {
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1024 / 1024).toFixed(2)} MB`;
}

export function BridgeAlertsCard() {
  const samples = useSyncExternalStore(subscribeBridgeCalls, getBridgeSamples, getBridgeSamples);
  const thresholds = useSyncExternalStore(subscribeThresholds, getThresholds, getThresholds);

  const rows = useMemo(() => aggregateByEndpoint(samples), [samples]);
  const alerts = useMemo(() => evaluateAlerts(rows, thresholds), [rows, thresholds]);

  const [showSettings, setShowSettings] = useState(false);

  // Toast só quando uma nova chave de alerta surge (evita spam)
  const seenRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    for (const a of alerts) {
      if (seenRef.current.has(a.key)) continue;
      seenRef.current.add(a.key);
      const enabled = thresholds[a.bridge].toastEnabled;
      if (!enabled) continue;
      const fn = a.severity === 'crit' ? toast.error : toast.warning;
      fn(`[${a.bridge}] ${a.message}`, { description: `${a.count} amostras` });
    }
    // Remove chaves resolvidas para que voltem a alertar caso reincidam
    const active = new Set(alerts.map((a) => a.key));
    for (const k of Array.from(seenRef.current)) {
      if (!active.has(k)) seenRef.current.delete(k);
    }
  }, [alerts, thresholds]);

  const critCount = alerts.filter((a) => a.severity === 'crit').length;
  const warnCount = alerts.filter((a) => a.severity === 'warn').length;

  return (
    <Card
      className={
        critCount > 0
          ? 'border-destructive/40 bg-destructive/5'
          : warnCount > 0
            ? 'border-warning/40 bg-warning/5'
            : ''
      }
    >
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <Bell className="h-4 w-4" />
          Alertas das Bridges
          {critCount > 0 && (
            <Badge variant="destructive" className="text-[10px]">
              {critCount} crítico{critCount > 1 ? 's' : ''}
            </Badge>
          )}
          {warnCount > 0 && (
            <Badge className="border-warning/30 bg-warning/20 text-[10px] text-warning">
              {warnCount} aviso{warnCount > 1 ? 's' : ''}
            </Badge>
          )}
          {alerts.length === 0 && (
            <Badge variant="secondary" className="text-[10px]">
              tudo ok
            </Badge>
          )}
        </CardTitle>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => resetThresholds()}>
            <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
            Padrão
          </Button>
          <Button variant="outline" size="sm" onClick={() => setShowSettings((s) => !s)}>
            <Settings2 className="mr-1.5 h-3.5 w-3.5" />
            {showSettings ? 'Fechar' : 'Configurar'}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {/* Lista de alertas ativos */}
        {alerts.length === 0 ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <ShieldCheck className="h-4 w-4 text-success" />
            Nenhum limiar excedido nas amostras atuais.
          </div>
        ) : (
          <ul className="space-y-2">
            {alerts.map((a) => (
              <AlertRow key={a.key} alert={a} />
            ))}
          </ul>
        )}

        {/* Configuração de limiares */}
        {showSettings && (
          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {BRIDGES.map(({ id, label }) => (
              <ThresholdEditor key={id} bridge={id} label={label} t={thresholds[id]} />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AlertRow({ alert }: { alert: BridgeAlert }) {
  const isCrit = alert.severity === 'crit';
  const valueStr = alert.metric === 'p95' ? formatMs(alert.value) : formatBytes(alert.value);
  const limitStr =
    alert.metric === 'p95' ? formatMs(alert.threshold) : formatBytes(alert.threshold);
  return (
    <li
      className={`flex items-center gap-3 rounded-md border p-2.5 ${
        isCrit ? 'border-destructive/40 bg-destructive/10' : 'border-warning/40 bg-warning/10'
      }`}
    >
      <AlertTriangle
        className={`h-4 w-4 shrink-0 ${isCrit ? 'text-destructive' : 'text-warning'}`}
      />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          <Badge variant="outline" className="mr-2 text-[10px]">
            {alert.bridge.replace('-db-bridge', '')}
          </Badge>
          <code className="font-mono text-xs">{alert.op}</code>
          {' — '}
          {alert.metric === 'p95' ? 'p95 latência' : 'tam. médio resp.'}
        </p>
        <p className="text-xs text-muted-foreground">
          atual <span className="font-mono">{valueStr}</span> · limite{' '}
          <span className="font-mono">{limitStr}</span> · {alert.count} amostras
        </p>
      </div>
      <Badge variant={isCrit ? 'destructive' : 'secondary'} className="text-[10px]">
        {isCrit ? 'CRÍTICO' : 'AVISO'}
      </Badge>
    </li>
  );
}

function ThresholdEditor({
  bridge,
  label,
  t,
}: {
  bridge: BridgeName;
  label: string;
  t: ReturnType<typeof getThresholds>[BridgeName];
}) {
  const update = (patch: Partial<typeof t>) => setThresholds(bridge, patch);
  const numInput = (val: number, onChange: (n: number) => void, min = 0) => (
    <Input
      type="number"
      value={val}
      min={min}
      onChange={(e) => {
        const n = Number(e.target.value);
        if (Number.isFinite(n) && n >= min) onChange(n);
      }}
      className="h-8 text-sm"
    />
  );

  const respWarnKb = Math.round(t.avgRespWarnBytes / 1024);
  const respCritKb = Math.round(t.avgRespCritBytes / 1024);

  return (
    <div className="space-y-3 rounded-lg border border-border/60 bg-muted/20 p-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-semibold">{label}</h4>
        <Button variant="ghost" size="sm" onClick={() => resetThresholds(bridge)}>
          <RotateCcw className="mr-1 h-3 w-3" />
          reset
        </Button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">p95 aviso (ms)</Label>
          {numInput(t.p95WarnMs, (n) => update({ p95WarnMs: n }))}
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">p95 crítico (ms)</Label>
          {numInput(t.p95CritMs, (n) => update({ p95CritMs: n }))}
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">resp. aviso (KB)</Label>
          {numInput(respWarnKb, (n) => update({ avgRespWarnBytes: n * 1024 }))}
        </div>
        <div className="space-y-1">
          <Label className="text-[11px] text-muted-foreground">resp. crítico (KB)</Label>
          {numInput(respCritKb, (n) => update({ avgRespCritBytes: n * 1024 }))}
        </div>
        <div className="col-span-2 space-y-1">
          <Label className="text-[11px] text-muted-foreground">amostras mínimas</Label>
          {numInput(t.minSamples, (n) => update({ minSamples: Math.max(1, n) }), 1)}
        </div>
      </div>

      <div className="flex items-center justify-between border-t border-border/40 pt-1">
        <Label htmlFor={`toast-${bridge}`} className="text-xs">
          Notificar via toast
        </Label>
        <Switch
          id={`toast-${bridge}`}
          checked={t.toastEnabled}
          onCheckedChange={(checked) => update({ toastEnabled: checked })}
        />
      </div>
    </div>
  );
}

export default BridgeAlertsCard;
