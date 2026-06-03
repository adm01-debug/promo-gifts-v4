/**
 * sanitize-message — SSOT central de saneamento de mensagens/erros para UI.
 *
 * Une duas camadas pré-existentes:
 *  - `sanitize-error.ts`  → mapeia *códigos conhecidos* (RPCs/edges) → copy pública.
 *  - `safeToast.ts`       → heurística por *regex* em texto cru (stack, JSON, etc.).
 *
 * Esta função é pura, **independente de React**, e deve ser usada por qualquer
 * componente/util que vá renderizar uma string vinda de `Error`, `data.error`
 * de edge function, RPC ou payload de exceção desconhecido.
 *
 * Política:
 *  - **dev** (`isDev=true`) → retorna o texto cru (debug).
 *  - **não-dev** → 1) tenta `sanitizeError` (códigos canônicos);
 *                  2) se a string ainda "parece técnica" (`looksTechnical`),
 *                     devolve o fallback público;
 *                  3) caso contrário, devolve a string amigável original.
 *
 * Componentes que renderizam mensagens DEVEM usar `<SafeMessage />` ou
 * `sanitizeMessage()` — nunca interpolar `error.message` direto no JSX.
 */
import { sanitizeError, SAFE_MESSAGES } from './sanitize-error';

/** Fallback público quando texto cru é considerado técnico. */
export const PUBLIC_FALLBACK_MESSAGE = SAFE_MESSAGES.GENERIC;

/**
 * Padrões que indicam mensagem TÉCNICA (espelhados de `safeToast`).
 * Conservador: prefere falso-positivo (esconder) a vazar internals.
 */
const TECHNICAL_PATTERNS: readonly RegExp[] = [
  /\bError\s*:/i,
  /\bTypeError\b/,
  /\bReferenceError\b/,
  /\bSyntaxError\b/,
  /\bStack trace\b/i,
  /\bComponent Stack\b/i,
  /\bat\s+https?:\/\/.+:\d+/i,
  /\bFailed to fetch\b/i,
  /\bNetworkError\b/i,
  /\bUNAUTHORIZED_LEGACY_JWT\b/,
  /\bSUPABASE_EDGE_RUNTIME_ERROR\b/,
  /\b[A-Z][A-Z0-9_]{6,}\b/,
  /\b(?:401|403|404|409|422|429|500|502|503|504)\b\s*[:-]/,
  /\bJSON(?:\.parse|\.stringify)?\b/i,
  /\bunexpected token\b/i,
  /^\s*[{[]/,
  /violates\s+(?:row[- ]level|foreign key|check)/i,
  /\bpermission denied for\b/i,
  /\bduplicate key value\b/i,
  /\brelation\s+"[^"]+"\s+does not exist\b/i,
];

export function looksTechnical(input: unknown): boolean {
  if (typeof input !== 'string' || input.length === 0) return false;
  for (const re of TECHNICAL_PATTERNS) {
    if (re.test(input)) return true;
  }
  return false;
}

/** Extrai string "melhor esforço" de qualquer entrada — sem decisão de visibilidade. */
export function extractRawMessage(input: unknown): string {
  if (input === null) return '';
  if (typeof input === 'string') return input;
  if (input instanceof Error) return input.message ?? '';
  if (typeof input === 'object') {
    const o = input as { message?: unknown; error?: unknown };
    if (typeof o.message === 'string') return o.message;
    if (typeof o.error === 'string') return o.error;
  }
  return '';
}

export interface SanitizeOptions {
  /** Quando `true`, devolve texto cru (uso em devs/debug). */
  isDev?: boolean;
  /** Fallback público customizado (default: `PUBLIC_FALLBACK_MESSAGE`). */
  fallback?: string;
}

/**
 * Saneia uma mensagem para exibição. SSOT — use em TODA renderização de erro.
 */
export function sanitizeMessage(input: unknown, opts: SanitizeOptions = {}): string {
  const { isDev = false, fallback = PUBLIC_FALLBACK_MESSAGE } = opts;
  const raw = extractRawMessage(input);

  if (isDev) return raw || fallback;

  // 1) Códigos canônicos (RPC/edge): mapeia para copy pública conhecida.
  if (input && typeof input === 'object') {
    const mapped = sanitizeError(input);
    if (mapped && mapped !== SAFE_MESSAGES.GENERIC) return mapped;
  }

  // 2) Texto cru considerado técnico → fallback.
  if (looksTechnical(raw)) return fallback;

  // 3) String amigável original ou fallback se vazio.
  return raw || fallback;
}

export // eslint-disable-next-line @typescript-eslint/naming-convention
const __test__ = { TECHNICAL_PATTERNS, looksTechnical };
