/**
 * Hook que dispara um callback quando o "dia local" muda — sem precisar
 * de reload. Estratégias combinadas para robustez:
 *
 *  1) `setTimeout` até a próxima meia-noite local (recalculado a cada tick).
 *  2) `visibilitychange` — quando a aba volta ao foco, compara a data
 *     corrente com a última data conhecida (cobre laptops que suspendem,
 *     mobile Safari que pausa timers em background).
 *  3) `focus` — mesma lógica, para navegadores que não emitem visibilitychange.
 *
 * Recomendação: use apenas em componentes long-lived (ex.: página do carrinho).
 * O callback recebe o novo carimbo `YYYY-MM-DD`.
 */
import { useEffect, useRef } from 'react';
import { getLocalDateStamp } from './cartViewModePrefs';

const ONE_MINUTE_MS = 60_000;

function msUntilNextLocalMidnight(now: Date = new Date()): number {
  const next = new Date(now);
  next.setDate(next.getDate() + 1);
  next.setHours(0, 0, 0, 0);
  // +1s de folga para garantir que a Date estará no "amanhã" quando o
  // callback rodar (evita corrida com clocks/DST).
  return next.getTime() - now.getTime() + 1_000;
}

export interface UseMidnightResetOptions {
  /** Desabilita o hook (útil enquanto o uid ainda não carregou). */
  enabled?: boolean;
  /** Injeção para testes — retorna Date "agora". */
  nowProvider?: () => Date;
}

/**
 * Executa `onDayChange(newStamp)` sempre que o carimbo local mudar em relação
 * à última leitura. Não dispara na montagem inicial.
 */
export function useMidnightReset(
  onDayChange: (newStamp: string) => void,
  { enabled = true, nowProvider = () => new Date() }: UseMidnightResetOptions = {},
): void {
  const lastStampRef = useRef<string>(getLocalDateStamp(nowProvider()));
  const callbackRef = useRef(onDayChange);
  callbackRef.current = onDayChange;

  useEffect(() => {
    if (!enabled) return;

    let timeoutId: ReturnType<typeof setTimeout> | null = null;
    let cancelled = false;

    const check = () => {
      if (cancelled) return;
      const current = getLocalDateStamp(nowProvider());
      if (current !== lastStampRef.current) {
        lastStampRef.current = current;
        try {
          callbackRef.current(current);
        } catch {
          // Nunca propagar falha do consumidor para dentro do timer.
        }
      }
    };

    const schedule = () => {
      if (cancelled) return;
      // Se a próxima meia-noite estiver a menos de 1 min, evita jitter
      // agendando um checkpoint fixo mais curto.
      const wait = Math.max(ONE_MINUTE_MS, msUntilNextLocalMidnight(nowProvider()));
      timeoutId = setTimeout(() => {
        check();
        schedule();
      }, wait);
    };

    const onVisible = () => {
      if (document.visibilityState === 'visible') check();
    };

    schedule();
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('focus', check);

    return () => {
      cancelled = true;
      if (timeoutId) clearTimeout(timeoutId);
      document.removeEventListener('visibilitychange', onVisible);
      window.removeEventListener('focus', check);
    };
  }, [enabled, nowProvider]);
}
