/**
 * Cálculo de expiração de orçamento — helper PURO e determinístico.
 *
 * Decisões críticas (validadas em testes exaustivos):
 *
 * 1. `valid_until` vindo do BD em coluna DATE chega como string "YYYY-MM-DD".
 *    `new Date("YYYY-MM-DD")` é parseado como UTC midnight pelo JS, e em
 *    fusos negativos (ex.: America/Sao_Paulo UTC-3) `.getDate()` retorna o
 *    dia ANTERIOR — causando off-by-one. Para evitar, parseamos manualmente
 *    a string como data civil (sem hora) quando ela bate em /^YYYY-MM-DD$/,
 *    e só caímos para `new Date()` se houver horário (timestamp ISO).
 *
 * 2. Diferença em dias usa "midnight local" dos dois lados via componentes
 *    Y/M/D — robusto a DST (Math.round absorve o salto de 23h/25h).
 */

export type ExpirationTone =
  'text-amber-400' | 'text-amber-500' | 'text-destructive' | 'text-muted-foreground/80';

export interface ExpirationInfo {
  /** Dias até `valid_until` no fuso local; negativo = passado; null se inválido. */
  diffDays: number | null;
  /** Texto canônico exibido na célula. */
  label: string;
  /** Classe Tailwind (subset) para coloração. */
  tone: ExpirationTone | null;
  /** Data formatada dd/MM/yyyy (fuso-agnóstica). */
  formattedDate: string | null;
}

const MS_PER_DAY = 86_400_000;
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Constrói uma Date local a partir de "YYYY-MM-DD" sem passar pela rota UTC.
 *  Valida que os componentes voltam idênticos (Date é tolerante e normaliza
 *  "2026-13-45" para 14/02/2027 silenciosamente — rejeitamos). */
function parseValidUntil(raw: string): Date | null {
  const m = DATE_ONLY_RE.exec(raw.trim());
  if (m) {
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const d = Number(m[3]);
    if (mo < 1 || mo > 12 || d < 1 || d > 31) return null;
    const dt = new Date(y, mo - 1, d);
    if (
      Number.isNaN(dt.getTime()) ||
      dt.getFullYear() !== y ||
      dt.getMonth() !== mo - 1 ||
      dt.getDate() !== d
    ) {
      return null;
    }
    return dt;
  }
  const dt = new Date(raw);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

/** Retorna "dd/MM/yyyy" usando componentes locais (sem `toLocaleDateString`,
 *  que poderia variar com locale do navegador). */
function formatDDMMYYYY(d: Date): string {
  return `${pad2(d.getDate())}/${pad2(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export function computeExpiration(
  validUntil: string | null | undefined,
  now: Date = new Date(),
): ExpirationInfo {
  if (!validUntil) return { diffDays: null, label: '—', tone: null, formattedDate: null };
  const target = parseValidUntil(validUntil);
  if (!target) return { diffDays: null, label: '—', tone: null, formattedDate: null };

  const todayMid = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const targetMid = new Date(target.getFullYear(), target.getMonth(), target.getDate()).getTime();
  const diffDays = Math.round((targetMid - todayMid) / MS_PER_DAY);

  let label: string;
  let tone: ExpirationTone;
  if (diffDays < 0) {
    label = `Expirado há ${Math.abs(diffDays)}d`;
    tone = 'text-destructive';
  } else if (diffDays === 0) {
    label = 'Expira hoje';
    tone = 'text-destructive';
  } else if (diffDays <= 3) {
    label = `${diffDays} ${diffDays === 1 ? 'dia' : 'dias'}`;
    tone = 'text-amber-500';
  } else if (diffDays <= 7) {
    label = `${diffDays} dias`;
    tone = 'text-amber-400';
  } else {
    label = `${diffDays} dias`;
    tone = 'text-muted-foreground/80';
  }

  return { diffDays, label, tone, formattedDate: formatDDMMYYYY(target) };
}
