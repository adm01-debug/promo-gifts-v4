/**
 * incidentZoneMapping — Onda 14
 *
 * Mapeia incidentes para a zona semântica relevante de /admin/conexoes:
 *   - "health"     → questões de saúde imediata (conexão caída, webhook
 *                    auto-disabled, falhas de teste).
 *   - "operation"  → questões operacionais/cron (auto-test parado,
 *                    janela de falha, secret stale/rotação).
 *
 * Usado pela Incident Strip para gerar links que rolam até a zona certa
 * e (via TargetZoneHighlight) destacam visualmente por alguns segundos.
 */
import type { IncidentItem } from './useRecentIncidents';

export type TargetZone = 'health' | 'operation';

const ZONE_LABEL: Record<TargetZone, string> = {
  health: 'Saúde',
  operation: 'Operação',
};

const ZONE_ANCHOR: Record<TargetZone, string> = {
  health: 'zone-health',
  operation: 'zone-operation',
};

export function getIncidentTargetZone(incident: IncidentItem): TargetZone {
  const kind = (incident.kind ?? '').toLowerCase();

  // Operacional: rotação/cron/configuração
  if (kind.includes('secret_stale') || kind.includes('rotation')) return 'operation';
  if (kind.includes('autotest') || kind.includes('auto_test') || kind.includes('cron'))
    return 'operation';
  if (kind.includes('failure_window') || kind.includes('config')) return 'operation';

  // Saúde: tudo que é falha imediata da conexão/entrega
  if (kind.includes('connection') || kind.includes('webhook') || kind.includes('delivery'))
    return 'health';
  if (
    ['auth', 'http_5xx', 'http_4xx', 'platform_error', 'timeout', 'network'].some((k) =>
      kind.includes(k),
    )
  ) {
    return 'health';
  }

  // Default: Saúde (incidentes brutos sem kind ⇒ falha de teste)
  return 'health';
}

export function getZoneLabel(zone: TargetZone): string {
  return ZONE_LABEL[zone];
}

export function getZoneAnchorId(zone: TargetZone): string {
  return ZONE_ANCHOR[zone];
}

/**
 * Rola até a zona, força "mostrar" se estiver oculta (via storage flag) e
 * dispara um highlight temporário emitindo um CustomEvent.
 *
 * Como o estado de visibilidade vive em React state (useZoneVisibility),
 * usamos um CustomEvent que é escutado pela página para reabrir a zona se
 * necessário antes de rolar.
 */
export function navigateToZone(zone: TargetZone) {
  const detail = { zone, anchorId: getZoneAnchorId(zone) };
  window.dispatchEvent(new CustomEvent('connections:focus-zone', { detail }));
}
