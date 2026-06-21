import type { ConnectionType } from '@/hooks/intelligence';

/**
 * Mapeia o `connectionId` (curto, usado nas abas) para a `ConnectionType`
 * + `env_key` que o backend de testes entende. Retorna `null` quando não há
 * mapeamento conhecido.
 */
export function mapConnectionToTester(
  connectionId: string | undefined,
): { type: ConnectionType; envKey?: 'crm' | 'promobrind' } | null {
  if (!connectionId) return null;
  if (connectionId === 'n8n') return { type: 'n8n' };
  if (connectionId === 'bitrix24') return { type: 'bitrix24' };
  if (connectionId === 'mcp') return { type: 'mcp' };
  if (connectionId === 'promobrind' || connectionId === 'crm') {
    return { type: 'supabase', envKey: connectionId };
  }
  return null;
}

export function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  const diffMs = Date.now() - then;
  if (Number.isNaN(then)) return '';
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return 'agora';
  const min = Math.floor(sec / 60);
  if (min < 60) return `há ${min}m`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `há ${hr}h`;
  const d = Math.floor(hr / 24);
  return `há ${d}d`;
}

/**
 * Timestamp completo em PT-BR no padrão "dd/mm/aaaa, HH:MM:SS (GMT-3)".
 */
export function formatFullPtBr(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return iso;
  const fmt = new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZoneName: 'short',
  });
  return fmt.format(date);
}

/**
 * Monta o tooltip multi-linha de "última atualização" com autor + timestamp.
 */
export function buildUpdatedTooltip(
  updatedAt: string | null | undefined,
  updatedByEmail: string | null | undefined,
  updatedBy?: string | null,
): string | undefined {
  if (!updatedAt) return undefined;

  const dateStr = formatFullPtBr(updatedAt);
  const relative = formatRelative(updatedAt);

  let author = 'sistema (sem autor registrado)';
  if (updatedByEmail) {
    author = updatedByEmail;
  } else if (updatedBy) {
    author = `equipe (#${updatedBy.substring(0, 8)})`;
  }

  return `Atualizado ${relative}\n${dateStr}\npor ${author}`;
}
