/**
 * useSeasonalPeakNotifications — dispara notificação proativa quando o cliente
 * selecionado entra a ≤7 dias de pico sazonal histórico.
 *
 * Estratégia: client-side guard. Quando o usuário acessa o BI de um cliente e
 * `useClientSeasonality` indica daysToNextPeak ≤ 7 e ainda não notificamos hoje,
 * insere uma `workspace_notification` (com chave de deduplicação em localStorage).
 *
 * Não cria cron — segue padrão do projeto (poll/polling em hooks).
 */
import { useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/contexts/AuthContext';

interface Args {
  clientId: string | null;
  clientName: string;
  daysToNextPeak: number | null;
  nextPeakMonth: number | null;
}

const MONTHS = [
  'Janeiro',
  'Fevereiro',
  'Março',
  'Abril',
  'Maio',
  'Junho',
  'Julho',
  'Agosto',
  'Setembro',
  'Outubro',
  'Novembro',
  'Dezembro',
];

function dedupKey(userId: string, clientId: string, peakMonth: number) {
  const today = new Date().toISOString().slice(0, 10);
  return `bi.peak-notif.${userId}.${clientId}.${peakMonth}.${today}`;
}

export function useSeasonalPeakNotifications({
  clientId,
  clientName,
  daysToNextPeak,
  nextPeakMonth,
}: Args) {
  const { user } = useAuth();

  useEffect(() => {
    if (!user?.id || !clientId || !clientName) return;
    if (daysToNextPeak === null || nextPeakMonth === null) return;
    if (daysToNextPeak > 7) return;

    const key = dedupKey(user.id, clientId, nextPeakMonth);
    try {
      if (localStorage.getItem(key) === '1') return;
    } catch {
      return;
    }

    const monthLabel = MONTHS[nextPeakMonth - 1] ?? '—';
    const title =
      daysToNextPeak === 0
        ? `📅 ${clientName} está em pico sazonal hoje`
        : `📅 ${clientName} entra em pico em ${daysToNextPeak} ${daysToNextPeak === 1 ? 'dia' : 'dias'}`;
    const message = `${clientName} historicamente concentra compras em ${monthLabel}. Momento ideal para abordagem.`;

    (async () => {
      try {
        const { error } = await supabase.from('workspace_notifications').insert({
          user_id: user.id,
          title,
          message,
          type: 'info',
          category: 'bi_seasonal_peak',
          action_url: `/ferramentas/bi?clientId=${encodeURIComponent(clientId)}`,
          metadata: { clientId, peakMonth: nextPeakMonth, daysToPeak: daysToNextPeak },
        });
        if (!error) {
          try {
            localStorage.setItem(key, '1');
          } catch {
            // ignore
          }
        }
      } catch {
        // silencioso
      }
    })();
  }, [user?.id, clientId, clientName, daysToNextPeak, nextPeakMonth]);
}
