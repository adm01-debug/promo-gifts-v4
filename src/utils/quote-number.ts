/**
 * quote-number — SSOT para formatação/validação do número de proposta.
 * Formato canônico: `NNNNN/YY` (ex.: `10010/26`).
 *
 * O número é gerado por trigger no INSERT em `quotes` (DB autoridade).
 * Aqui apenas validamos exibição na UI e calculamos prévia client-side.
 */

/** Regex do formato canônico aceito na UI/PDF. */
export const QUOTE_NUMBER_REGEX = /^\d{3,6}\/\d{2}$/;

/**
 * Sanitiza/valida um quote_number vindo do banco.
 * - Remove espaços.
 * - Retorna `null` quando vazio/ausente/malformado (modos de criação).
 */
export function formatQuoteNumberLabel(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = String(raw).replace(/\s+/g, '');
  if (!trimmed) return null;
  if (!QUOTE_NUMBER_REGEX.test(trimmed)) return null;
  return trimmed;
}

/**
 * Calcula a prévia do próximo número (`~N+1/YY`) a partir de uma lista
 * de quote_numbers existentes do ano corrente. Retorna `null` se a
 * lista estiver vazia ou nenhum item bater no formato.
 *
 * Marcado com `~` para deixar claro que é estimativa: o trigger do
 * banco é a SSOT e pode divergir em concorrência.
 */
export function computeNextQuoteNumberPreview(
  existing: ReadonlyArray<string | null | undefined>,
  year: number = new Date().getFullYear(),
): string | null {
  const yy = String(year % 100).padStart(2, '0');
  let max = 0;
  for (const n of existing) {
    const f = formatQuoteNumberLabel(n);
    if (!f) continue;
    const [seq, y] = f.split('/');
    if (y !== yy) continue;
    const parsed = Number.parseInt(seq, 10);
    if (Number.isFinite(parsed) && parsed > max) max = parsed;
  }
  if (max <= 0) return null;
  return `~${max + 1}/${yy}`;
}
