/**
 * safeToast — gate runtime para mensagens internas em toasts.
 *
 * Política (alinhada com Dev Infra Messages Gate):
 *  - Usuários **não-dev** NUNCA podem ver texto técnico (mensagens cruas de
 *    `Error`, stack traces, códigos UPPER_SNAKE de edge/RPC, JSON bruto,
 *    "Failed to fetch", referências a tabelas/colunas, status HTTP, etc.).
 *  - Usuários **dev** (via role `dev`/`supervisor`/`admin` ou override por
 *    env/localStorage) veem o texto original — útil para debugging.
 *  - Aplicamos no runtime via monkey-patch de `toast.error|warning|message`
 *    da `sonner`. Cobre TODOS os call sites sem refactor por arquivo.
 *
 * SSOT do que conta como "técnico": `TECHNICAL_PATTERNS` abaixo.
 * Fallback público: "Não foi possível concluir esta ação. Tente novamente."
 *
 * Importante: este patch NÃO altera `toast.success`/`toast.info` (mensagens
 * positivas tendem a ser declarativas e não vazam internals). Se um caller
 * precisar emitir título técnico de forma intencional para dev (ex: painel
 * `/admin/telemetria`), gateie o `toast.error` por `useDevGate().isAllowed`
 * — o patch é idempotente e respeita o gate.
 */
import { toast } from 'sonner';

import type { AppRole } from '@/contexts/AuthContext';
import { devInfraGate } from '@/lib/system/dev-gate/DevInfraGate';
// SSOT da heurística de "texto técnico" — ver `sanitize-message.ts`.
// Mantemos a fachada exportada (`__test__.looksTechnical`) para
// compatibilidade com testes existentes.
import { looksTechnical as ssotLooksTechnical } from './sanitize-message';

const PUBLIC_FALLBACK_TITLE = 'Não foi possível concluir esta ação. Tente novamente.';

const looksTechnical = (input: unknown): boolean => ssotLooksTechnical(input);

/* ---------------------------------------------------------------- *
 * Roles provider — atualizado pelo AuthContext via `setSafeToastRoles`.
 * Default seguro: sem roles → não-dev → sanitização ativa.
 * ---------------------------------------------------------------- */
let currentRoles: AppRole[] = [];

export function setSafeToastRoles(roles: AppRole[]): void {
  currentRoles = Array.isArray(roles) ? roles : [];
}

function shouldShowRaw(): boolean {
  try {
    return devInfraGate.shouldShow(currentRoles);
  } catch {
    return false; // fail-closed: esconde técnico em caso de erro do gate
  }
}

/* ---------------------------------------------------------------- *
 * Sanitização de argumentos de `toast.error/warning/message`.
 * Sonner aceita: `toast.error(message, options?)` onde `message` pode ser
 * string | ReactNode | (() => ReactNode) e `options.description` idem.
 * ---------------------------------------------------------------- */
interface ToastOptions {
  description?: unknown;
  [key: string]: unknown;
}

function sanitizeTitle(title: unknown): unknown {
  if (shouldShowRaw()) return title;
  if (looksTechnical(title)) return PUBLIC_FALLBACK_TITLE;
  return title;
}

function sanitizeOptions(opts: unknown): unknown {
  if (shouldShowRaw()) return opts;
  if (!opts || typeof opts !== 'object') return opts;
  const o = opts as ToastOptions;
  if ('description' in o && looksTechnical(o.description)) {
    // Remove description técnica — mantém title já sanitizado.
    const { description: _drop, ...rest } = o;
    void _drop;
    return rest;
  }
  return opts;
}

type SonnerFn = (message: unknown, opts?: unknown) => unknown;

function wrap(originalKey: 'error' | 'message' | 'warning'): void {
  const t = toast as unknown as Record<string, SonnerFn> & {
    __lov_safe_patched__?: Record<string, true>;
  };
  t.__lov_safe_patched__ ??= {};
  if (t.__lov_safe_patched__[originalKey]) return; // idempotente
  const original = t[originalKey];
  if (typeof original !== 'function') return;
  const patched: SonnerFn = (message, opts) =>
    original.call(toast, sanitizeTitle(message), sanitizeOptions(opts));
  t[originalKey] = patched;
  t.__lov_safe_patched__[originalKey] = true;
}

/**
 * Instala o patch global em `sonner`. Idempotente — chamável múltiplas vezes.
 * Deve ser chamado uma vez no bootstrap (`main.tsx`).
 */
export function installSafeToast(): void {
  wrap('error');
  wrap('warning');
  wrap('message');
}

/** Utilidade testável: expõe a heurística de classificação. */
export // eslint-disable-next-line @typescript-eslint/naming-convention
const __test__ = { looksTechnical, PUBLIC_FALLBACK_TITLE };
