/**
 * useIncidentTimeline72h — Onda 14
 *
 * Busca incidentes/alterações de status nas últimas 72h para alimentar
 * uma timeline horizontal compacta abaixo da Pulse Bar.
 *
 * Fontes:
 *   1. workspace_notifications (category='integrations') — alertas formais
 *      já com severidade/kind em metadata.
 *   2. connection_test_history (success=false) — eventos brutos.
 *
 * Severidade derivada igual a useRecentIncidents (P0/P1/P2).
 */
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';
import type { IncidentSeverity } from './useRecentIncidents';

export interface TimelineEvent {
  id: string;
  severity: IncidentSeverity;
  occurredAt: string;
  /** posição relativa 0..1 dentro da janela (0 = mais antigo, 1 = agora) */
  position: number;
  title: string;
  subtitle?: string | null;
  kind?: string | null;
  entityId?: string | null;
}

interface NotifRow {
  id: string;
  title: string;
  message: string;
  type: string;
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

const WINDOW_MS = 72 * 60 * 60 * 1000;

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

async function fetchTimeline72h(): Promise<{
  events: TimelineEvent[];
  windowStart: number;
  windowEnd: number;
}> {
  const windowEnd = Date.now();
  const windowStart = windowEnd - WINDOW_MS;
  const sinceIso = new Date(windowStart).toISOString();

  const [{ data: notifs }, { data: tests }] = await Promise.all([
    supabase
      .from('workspace_notifications')
      .select('id, title, message, type, metadata, created_at')
      .eq('category', 'integrations')
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(80),
    supabase
      .from('connection_test_history')
      .select('id, connection_id, tested_at, error_message, error_kind')
      .eq('success', false)
      .gte('tested_at', sinceIso)
      .order('tested_at', { ascending: false })
      .limit(80),
  ]);

  const events: TimelineEvent[] = [];
  const coveredEntities = new Set<string>();

  for (const n of (notifs ?? []) as NotifRow[]) {
    const meta = n.metadata ?? {};
    const entityId = (meta.connection_id as string) ?? (meta.webhook_id as string) ?? null;
    if (entityId) coveredEntities.add(entityId);
    const ts = new Date(n.created_at).getTime();
    events.push({
      id: `notif:${n.id}`,
      severity: severityFromNotification(n),
      occurredAt: n.created_at,
      position: Math.min(1, Math.max(0, (ts - windowStart) / WINDOW_MS)),
      title: n.title,
      subtitle: n.message,
      kind: (meta.kind as string) ?? null,
      entityId,
    });
  }

  for (const t of (tests ?? []) as TestRow[]) {
    if (t.connection_id && coveredEntities.has(t.connection_id)) continue;
    const ts = new Date(t.tested_at).getTime();
    events.push({
      id: `test:${t.id}`,
      severity: severityFromTestKind(t.error_kind),
      occurredAt: t.tested_at,
      position: Math.min(1, Math.max(0, (ts - windowStart) / WINDOW_MS)),
      title: `Falha em conexão${t.error_kind ? ` (${t.error_kind})` : ''}`,
      subtitle: t.error_message,
      kind: t.error_kind,
      entityId: t.connection_id,
    });
  }

  // ordena por timestamp asc para render previsível
  events.sort((a, b) => new Date(a.occurredAt).getTime() - new Date(b.occurredAt).getTime());

  return { events, windowStart, windowEnd };
}

export function useIncidentTimeline72h() {
  // BUG-INCIDENT-403 FIX (2026-06-22): adicionado rolesLoaded + isAdmin guard.
  // Espelha fix de useRecentIncidents. Timeline é dado de admin — sem isAdmin
  // a query retornaria [] e desperdiçaria bandwidth durante o boot.
  const { rolesLoaded, isAdmin } = useAuth();
  return useQuery({
    queryKey: ['connections-incident-timeline-72h'],
    queryFn: fetchTimeline72h,
    enabled: rolesLoaded && isAdmin,  // garante JWT pronto + permissão admin
    refetchInterval: 60_000,
    staleTime: 30_000,
    retry: 0,
    retryOnMount: false,
  });
}
