/**
 * useRecentIncidents — Onda 14
 *
 * Agrega incidentes recentes do hub de Conexões a partir de duas fontes:
 *   1. workspace_notifications (category='integrations') — alertas formais
 *      gerados pelo cron `connections-health-check` (já com dedupe por
 *      incident_key) — ricos em contexto: action_url, metadata.severity,
 *      metadata.kind ('webhook_auto_disabled' | 'connection_down' |
 *      'secret_stale' etc).
 *   2. connection_test_history (success=false, últimas 24h) — eventos
 *      brutos quando o cron ainda não consolidou em notificação.
 *
 * Severidade derivada (P0/P1/P2):
 *   - P0: webhook_auto_disabled, connection_down (com janela), type='error'
 *   - P1: failures recentes sem janela, secret_stale, type='warning'
 *   - P2: informacional / type='info'
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

export type IncidentSeverity = 'P0' | 'P1' | 'P2';
export type IncidentSource = 'notification' | 'test_history';

export interface IncidentItem {
  id: string;
  source: IncidentSource;
  severity: IncidentSeverity;
  title: string;
  subtitle?: string | null;
  occurredAt: string;
  /** kind/category técnico — útil para roteamento futuro */
  kind?: string | null;
  /** id da entidade (connection_id, webhook_id) quando disponível */
  entityId?: string | null;
  /** URL externa pré-computada (action_url da notificação) */
  actionUrl?: string | null;
  /** rota interna calculada para abrir detalhes dentro do hub */
  detailsHref: string;
}

interface NotifRow {
  id: string;
  title: string;
  message: string;
  type: string;
  action_url: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

interface TestRow {
  id: string;
  connection_id: string | null;
  tested_at: string;
  error_message: string | null;
  error_kind: string | null;
}

function severityFromNotification(row: NotifRow): IncidentSeverity {
  const sevMeta = (row.metadata?.severity as string | undefined)?.toUpperCase();
  if (sevMeta === 'P0' || sevMeta === 'P1' || sevMeta === 'P2') return sevMeta as IncidentSeverity;
  const kind = row.metadata?.kind as string | undefined;
  if (kind === 'webhook_auto_disabled' || kind === 'connection_down') return 'P0';
  if (row.type === 'error') return 'P0';
  if (row.type === 'warning' || kind === 'secret_stale') return 'P1';
  return 'P2';
}

function severityFromTestKind(errorKind: string | null): IncidentSeverity {
  if (!errorKind) return 'P1';
  if (['auth', 'http_5xx', 'platform_error'].includes(errorKind)) return 'P0';
  return 'P1';
}

const INCIDENT_SEV_WEIGHT: Record<IncidentSeverity, number> = { P0: 3, P1: 2, P2: 1 } as const;

async function fetchIncidents(): Promise<IncidentItem[]> {
  const since24h = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const [{ data: notifs }, { data: tests }] = await Promise.all([
    supabase
      .from('workspace_notifications')
      .select('id, title, message, type, action_url, metadata, created_at')
      .eq('category', 'integrations')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('connection_test_history')
      .select('id, connection_id, tested_at, error_message, error_kind')
      .eq('success', false)
      .gte('tested_at', since24h)
      .order('tested_at', { ascending: false })
      .limit(15),
  ]);

  const items: IncidentItem[] = [];

  for (const n of (notifs ?? []) as NotifRow[]) {
    const meta = n.metadata ?? {};
    const entityId = (meta.connection_id as string) ?? (meta.webhook_id as string) ?? null;
    items.push({
      id: `notif:${n.id}`,
      source: 'notification',
      severity: severityFromNotification(n),
      title: n.title,
      subtitle: n.message,
      occurredAt: n.created_at,
      kind: (meta.kind as string) ?? null,
      entityId,
      actionUrl: n.action_url,
      detailsHref: n.action_url ?? `/admin/conexoes${entityId ? `?incident=${entityId}` : ''}`,
    });
  }

  // Dedup por entityId — se já temos uma notificação para a mesma conexão,
  // não inflamos a strip com o evento bruto subjacente.
  const coveredEntities = new Set(items.map((i) => i.entityId).filter(Boolean) as string[]);

  for (const t of (tests ?? []) as TestRow[]) {
    if (t.connection_id && coveredEntities.has(t.connection_id)) continue;
    items.push({
      id: `test:${t.id}`,
      source: 'test_history',
      severity: severityFromTestKind(t.error_kind),
      title: `Falha em conexão${t.error_kind ? ` (${t.error_kind})` : ''}`,
      subtitle: t.error_message,
      occurredAt: t.tested_at,
      kind: t.error_kind,
      entityId: t.connection_id,
      actionUrl: null,
      detailsHref: `/admin/conexoes${t.connection_id ? `?incident=${t.connection_id}` : ''}`,
    });
  }

  // Ordena por severidade desc (P0>P1>P2) e depois por timestamp desc.
  items.sort((a, b) => {
    const s = INCIDENT_SEV_WEIGHT[b.severity] - INCIDENT_SEV_WEIGHT[a.severity];
    if (s !== 0) return s;
    return new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime();
  });

  return items.slice(0, 12);
}

export function useRecentIncidents() {
  return useQuery({
    queryKey: ['connections-recent-incidents'],
    queryFn: fetchIncidents,
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
}
