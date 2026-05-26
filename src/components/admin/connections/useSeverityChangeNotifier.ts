/**
 * useSeverityChangeNotifier — Onda 14
 *
 * Observa a severidade global da Pulse Bar (P0/P1/P2) e dispara um toast
 * quando ela escala para P0 ou P1, com confirmação explícita do usuário
 * para não repetir o mesmo alerta indefinidamente.
 *
 * Regras de deduplicação:
 *  - Cada nível P0/P1 só dispara um toast novo se:
 *      (a) for a primeira vez na sessão, OU
 *      (b) o usuário "Reconheceu" (acked) e a severidade voltou para P2
 *          em algum momento entre disparos (reset implícito).
 *  - "Adiar 1h" silencia o nível por 60min (snooze por severidade).
 *  - "Não mostrar de novo" persiste opt-out em localStorage por severidade.
 *  - Estado persistido em localStorage para sobreviver a reload.
 *
 * Não dispara em:
 *  - P2 (estável)
 *  - Mudança de P0→P1 (downgrade) — apenas escalations geram toast
 *  - Loading inicial (data === undefined)
 */
import { useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { usePulseBarStatus, type PulseSeverity } from './usePulseBarStatus';

const STORAGE_KEY = 'connections.severity-notifier.v1';
const SNOOZE_MS = 60 * 60 * 1000; // 1h

interface NotifierState {
  /** Última severidade vista (para detectar transições) */
  lastSeen: PulseSeverity | null;
  /** Severidades reconhecidas — não re-disparam até voltar a P2 */
  acked: { P0: boolean; P1: boolean };
  /** Snooze até timestamp (ms) por severidade */
  snoozedUntil: { P0: number; P1: number };
  /** Opt-out permanente por severidade */
  muted: { P0: boolean; P1: boolean };
}

const DEFAULT_STATE: NotifierState = {
  lastSeen: null,
  acked: { P0: false, P1: false },
  snoozedUntil: { P0: 0, P1: 0 },
  muted: { P0: false, P1: false },
};

function loadState(): NotifierState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<NotifierState>;
    return {
      ...DEFAULT_STATE,
      ...parsed,
      acked: { ...DEFAULT_STATE.acked, ...(parsed.acked ?? {}) },
      snoozedUntil: { ...DEFAULT_STATE.snoozedUntil, ...(parsed.snoozedUntil ?? {}) },
      muted: { ...DEFAULT_STATE.muted, ...(parsed.muted ?? {}) },
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

function saveState(s: NotifierState) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    /* noop */
  }
}

const SEV_TITLE: Record<'P0' | 'P1', string> = {
  P0: '🚨 Incidente crítico em integrações (P0)',
  P1: '⚠️ Degradação detectada em integrações (P1)',
};

export function useSeverityChangeNotifier() {
  const { data } = usePulseBarStatus();
  const stateRef = useRef<NotifierState>(loadState());

  useEffect(() => {
    if (!data) return;
    const sev = data.severity;
    const state = stateRef.current;
    const prev = state.lastSeen;

    // Atualiza lastSeen sempre
    if (prev !== sev) {
      // Reset de ack ao voltar para P2 — permite novo alerta na próxima escalada
      if (sev === 'P2') {
        state.acked = { P0: false, P1: false };
      }
      state.lastSeen = sev;
      saveState(state);
    }

    // Só notifica para P0/P1
    if (sev !== 'P0' && sev !== 'P1') return;

    // Regras de supressão
    if (state.muted[sev]) return;
    if (state.acked[sev]) return;
    if (Date.now() < state.snoozedUntil[sev]) return;

    // Evita re-disparar a cada refetch enquanto severidade fica igual:
    // só dispara na transição de severidade OU primeira detecção (prev === null)
    const isTransition = prev === null || prev !== sev;
    if (!isTransition) return;

    // Dispara toast com ações de confirmação
    const headline = data.headline;
    const reason = data.reasons[0] ?? 'Veja detalhes na barra de status';

    const toastId = toast(SEV_TITLE[sev], {
      description: `${headline}\n${reason}`,
      duration: sev === 'P0' ? Infinity : 30_000,
      // important: sev === "P0", // Not in ExternalToast type
      action: {
        label: 'Reconhecer',
        onClick: () => {
          state.acked[sev] = true;
          saveState(state);
          toast.success(`Alerta ${sev} reconhecido. Não será repetido até retornar a P2.`);
        },
      },
      cancel: {
        label: 'Adiar 1h',
        onClick: () => {
          state.snoozedUntil[sev] = Date.now() + SNOOZE_MS;
          saveState(state);
          toast.message(`Alerta ${sev} adiado por 1h.`, {
            action: {
              label: 'Não mostrar mais',
              onClick: () => {
                state.muted[sev] = true;
                saveState(state);
                toast.success(`Alertas ${sev} silenciados nesta sessão. Reative em Conexões.`);
              },
            },
          });
        },
      },
    });

    return () => {
      toast.dismiss(toastId);
    };
  }, [data]);
}

/** Helper exposto para reativar manualmente (futuro: settings panel) */
export function resetSeverityNotifierState() {
  saveState({ ...DEFAULT_STATE });
}
