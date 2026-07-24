/**
 * SeverityFilterToolbar — Onda 14
 *
 * Combina o controle visual de filtro com os contadores de incidentes recentes
 * por severidade. Renderiza nada quando ainda não há nenhum incidente
 * carregado para evitar ruído visual no estado verde inicial.
 */
import { SeverityFilterControl } from './SeverityFilterControl';
import { useIncidentSeverityCounts } from './useIncidentSeverityCounts';
import { useSeverityFilter } from './SeverityFilterContext';

export function SeverityFilterToolbar({ className }: { className?: string }) {
  const counts = useIncidentSeverityCounts();
  const { filter } = useSeverityFilter();

  // Sem incidentes E sem filtro ativo ⇒ não polui a UI.
  // Com filtro ativo (mesmo sem incidentes), mantemos visível para ficar claro
  // que existe um filtro persistido.
  if (counts.total === 0 && filter === 'all') return null;

  return <SeverityFilterControl counts={counts} className={className} />;
}
