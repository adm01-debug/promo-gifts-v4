/**
 * useIncidentDetails — Onda 14
 *
 * Carrega métricas e logs filtrados pela janela do incidente (±2h em torno do
 * `occurredAt`), respeitando o tipo de entidade afetada.
 *
 * Estratégia:
 *   - Sempre busca testes em `connection_test_history` na janela; se houver
 *     `entityId` (connection_id), filtra por ele; senão pega o conjunto global.
 *   - Sempre busca entregas em `webhook_deliveries` na janela; mesma lógica de
 *     filtro condicional por webhook_id.
 *   - Resolve o nome/tipo da conexão (ou webhook) quando há entityId.
 *   - Calcula métricas: total runs, sucesso, falha, taxa, latência média/p95,
 *     primeiro e último evento na janela.
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export interface IncidentDetailsInput {
  /** Timestamp do incidente (ISO). */
  occurredAt: string;
  /** Janela em minutos para cada lado (default 120 ⇒ ±2h). */
  windowMinutes?: number;
  /** ID da conexão ou webhook afetado. Quando ausente, métricas globais. */
  entityId?: string | null;
  /** Hint sobre o tipo de entidade — quando "webhook", ignora teste de conexão. */
  kind?: string | null;
}

export interface TestEvent {
  id: string;
  tested_at: string;
  success: boolean;
  latency_ms: number | null;
  status_code: number | null;
  error_message: string | null;
  error_kind: string | null;
  triggered_by: string;
  attempts: number;
}

export interface DeliveryEvent {
  id: string;
  webhook_id: string;
  event: string;
  delivered_at: string;
  success: boolean;
  status_code: number | null;
  attempt: number;
  error_message: string | null;
}

export interface IncidentMetrics {
  windowStart: string;
  windowEnd: string;
  testCount: number;
  testSuccess: number;
  testFail: number;
  testSuccessRate: number | null;
  testAvgLatency: number | null;
  testP95Latency: number | null;
  deliveryCount: number;
  deliverySuccess: number;
  deliveryFail: number;
  deliverySuccessRate: number | null;
  firstEventAt: string | null;
  lastEventAt: string | null;
}

export interface IncidentEntity {
  id: string;
  kind: 'connection' | 'webhook';
  name: string;
  type?: string | null;
  url?: string | null;
}

export interface IncidentDetails {
  metrics: IncidentMetrics;
  tests: TestEvent[];
  deliveries: DeliveryEvent[];
  entity: IncidentEntity | null;
}

function p95(nums: number[]): number | null {
  if (nums.length === 0) return null;
  const sorted = [...nums].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.floor(sorted.length * 0.95));
  return sorted[idx];
}

async function resolveEntity(
  entityId: string,
  kindHint?: string | null,
): Promise<IncidentEntity | null> {
  // Heurística por kind: webhook_* ⇒ tenta webhook primeiro; senão tenta conexão.
  const tryWebhookFirst = kindHint?.startsWith('webhook');

  const tryWebhook = async (): Promise<IncidentEntity | null> => {
    const { data } = await supabase
      .from('outbound_webhooks')
      .select('id, name, url')
      .eq('id', entityId)
      .maybeSingle();
    if (data) return { id: data.id, kind: 'webhook', name: data.name, url: data.url };
    return null;
  };

  const tryConnection = async (): Promise<IncidentEntity | null> => {
    const { data } = await supabase
      .from('external_connections')
      .select('id, name, type')
      .eq('id', entityId)
      .maybeSingle();
    if (data) return { id: data.id, kind: 'connection', name: data.name, type: data.type };
    return null;
  };

  if (tryWebhookFirst) {
    return (await tryWebhook()) ?? (await tryConnection());
  }
  return (await tryConnection()) ?? (await tryWebhook());
}

async function fetchDetails(input: IncidentDetailsInput): Promise<IncidentDetails> {
  const windowMs = (input.windowMinutes ?? 120) * 60 * 1000;
  const center = new Date(input.occurredAt).getTime();
  const start = new Date(center - windowMs).toISOString();
  const end = new Date(center + windowMs).toISOString();

  // Resolve entidade (em paralelo às queries quando possível).
  const entityPromise = input.entityId
    ? resolveEntity(input.entityId, input.kind)
    : Promise.resolve<IncidentEntity | null>(null);

  // Tests
  let testQuery = supabase
    .from('connection_test_history')
    .select(
      'id, tested_at, success, latency_ms, status_code, error_message, error_kind, triggered_by, attempts',
    )
    .gte('tested_at', start)
    .lte('tested_at', end)
    .order('tested_at', { ascending: false })
    .limit(200);
  if (input.entityId) testQuery = testQuery.eq('connection_id', input.entityId);

  // Deliveries
  let delivQuery = supabase
    .from('webhook_deliveries')
    .select('id, webhook_id, event, delivered_at, success, status_code, attempt, error_message')
    .gte('delivered_at', start)
    .lte('delivered_at', end)
    .order('delivered_at', { ascending: false })
    .limit(200);
  if (input.entityId) delivQuery = delivQuery.eq('webhook_id', input.entityId);

  const [{ data: tests }, { data: deliveries }, entity] = await Promise.all([
    testQuery,
    delivQuery,
    entityPromise,
  ]);

  const testRows = (tests ?? []) as TestEvent[];
  const delivRows = (deliveries ?? []) as DeliveryEvent[];

  const testSuccess = testRows.filter((t) => t.success).length;
  const testFail = testRows.length - testSuccess;
  const latencies = testRows
    .map((t) => t.latency_ms)
    .filter((n): n is number => typeof n === 'number');
  const avgLat =
    latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : null;

  const delivSuccess = delivRows.filter((d) => d.success).length;
  const delivFail = delivRows.length - delivSuccess;

  const allTimestamps = [
    ...testRows.map((t) => t.tested_at),
    ...delivRows.map((d) => d.delivered_at),
  ].sort();

  return {
    metrics: {
      windowStart: start,
      windowEnd: end,
      testCount: testRows.length,
      testSuccess,
      testFail,
      testSuccessRate: testRows.length > 0 ? (testSuccess / testRows.length) * 100 : null,
      testAvgLatency: avgLat !== null ? Math.round(avgLat) : null,
      testP95Latency: p95(latencies),
      deliveryCount: delivRows.length,
      deliverySuccess: delivSuccess,
      deliveryFail: delivFail,
      deliverySuccessRate: delivRows.length > 0 ? (delivSuccess / delivRows.length) * 100 : null,
      firstEventAt: allTimestamps[0] ?? null,
      lastEventAt: allTimestamps[allTimestamps.length - 1] ?? null,
    },
    tests: testRows,
    deliveries: delivRows,
    entity: entity ?? null,
  };
}

export function useIncidentDetails(input: IncidentDetailsInput | null) {
  return useQuery({
    queryKey: [
      'incident-details',
      input?.occurredAt,
      input?.entityId ?? null,
      input?.kind ?? null,
      input?.windowMinutes ?? 120,
    ],
    queryFn: () => fetchDetails(input as IncidentDetailsInput),
    enabled: !!input,
    staleTime: 60_000,
  });
}
