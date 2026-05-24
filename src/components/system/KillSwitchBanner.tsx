/**
 * Banner global exibido quando o kill-switch está ATIVO (= edge function descontinuada).
 *
 * - Renderizado uma única vez em App.tsx.
 * - Consulta o estado via useKillSwitchBanner (poll 2min).
 * - Dispensável pelo usuário (localStorage para não repetir na sessão).
 * - Não usa aição destrutiva — apenas informa.
 *
 * UX:
 *   - Não ofusca o produto (apenas top banner).
 *   - Mensagem amigável vinda do banco (legacy_message).
 *   - Cor amarelo/âmbar (warning, não erro — a funcionalidade tem fallback).
 */
import { useEffect, useState } from 'react';
import { useKillSwitchBanner } from '@/hooks/useKillSwitchBanner';

const DISMISS_STORAGE_KEY = 'kill_switch_banner:dismissed_at';
const DISMISS_TTL_MS = 6 * 60 * 60 * 1000; // 6h — reaparece no dia seguinte

function wasDismissedRecently(): boolean {
  if (typeof window === 'undefined' || !window.localStorage) return false;
  try {
    const raw = window.localStorage.getItem(DISMISS_STORAGE_KEY);
    if (!raw) return false;
    const dismissedAt = parseInt(raw, 10);
    if (Number.isNaN(dismissedAt)) return false;
    return Date.now() - dismissedAt < DISMISS_TTL_MS;
  } catch {
    return false;
  }
}

function markDismissed(): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(DISMISS_STORAGE_KEY, Date.now().toString());
  } catch {
    // ignore quota errors
  }
}

export function KillSwitchBanner(): JSX.Element | null {
  const banner = useKillSwitchBanner();
  const [dismissed, setDismissed] = useState(false);

  // Verifica dismissal persistido na montagem
  useEffect(() => {
    if (wasDismissedRecently()) setDismissed(true);
  }, []);

  if (!banner || dismissed) return null;

  return (
    <div
      role="alert"
      aria-live="polite"
      className="w-full bg-amber-50 border-b border-amber-200 px-4 py-2 text-sm text-amber-900 flex items-center justify-between gap-4"
      data-testid="kill-switch-banner"
    >
      <div className="flex items-center gap-2 min-w-0">
        <span className="font-medium shrink-0">⚠️ Aviso do sistema:</span>
        <span className="truncate">{banner.message}</span>
      </div>
      <button
        type="button"
        onClick={() => {
          markDismissed();
          setDismissed(true);
        }}
        className="shrink-0 text-amber-700 hover:text-amber-900 underline text-xs"
        aria-label="Dispensar aviso"
      >
        Dispensar
      </button>
    </div>
  );
}
