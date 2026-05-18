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

const PUBLIC_FALLBACK_TITLE = 'Não foi possível concluir esta ação. Tente novamente.';

/**
 * Padrões que indicam mensagem TÉCNICA (não pode chegar a não-dev).
 * Conservador: prefere falso-positivo (esconder em prod) a vazar.
 */
const TECHNICAL_PATTERNS: RegExp[] = [
  /\bError\s*:/i,
  /\bTypeError\b/,
  /\bReferenceError\b/,
  /\bSyntaxError\b/,
  /\bStack trace\b/i,
  /\bComponent Stack\b/i,
  /\bat\s+https?:\/\/.+:\d+/i, // stack frame URL
  /\bFailed to fetch\b/i,
  /\bNetworkError\b/i,
  /\bUNAUTHORIZED_LEGACY_JWT\b/,
  /\bSUPABASE_EDGE_RUNTIME_ERROR\b/,
  /\b[A-Z][A-Z0-9_]{6,}\b/, // códigos UPPER_SNAKE_CASE longos (>=7 chars)
  /\b(?:401|403|404|409|422|429|500|502|503|504)\b\s*[:\-]/, // status:
  /\bJSON(?:\.parse|\.stringify)?\b/i,
  /\bunexpected token\b/i,
  /^\s*[{[]/, // começa com { ou [ → JSON bruto
  /violates\s+(?:row[- ]level|foreign key|check)/i,
  /\bpermission denied for\b/i,
  /\bduplicate key value\b/i,
  /\brelation\s+"[^"]+"\s+does not exist\b/i,
];

function looksTechnical(input: unknown): boolean {
  if (typeof input !== 'string') return false;
  if (input.length === 0) return false;
  for (const re of TECHNICAL_PATTERNS) {
    if (re.test(input)) return true;
  }
  return false;
}

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

function wrap(originalKey: 'error' | 'warning' | 'message'): void {
  const t = toast as unknown as Record<string, SonnerFn> & {
    __lov_safe_patched__?: Record<string, true>;
  };
  t.__lov_safe_patched__ = t.__lov_safe_patched__ ?? {};
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
export const __test__ = { looksTechnical, PUBLIC_FALLBACK_TITLE };
